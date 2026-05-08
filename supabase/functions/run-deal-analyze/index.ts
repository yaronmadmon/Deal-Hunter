import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_SOURCE_TIMEOUT = 8000;
const PERPLEXITY_TIMEOUT = 15000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function safeCall<T>(fn: () => Promise<T>, label: string, fallback: T): Promise<{ result: T; status: string; durationMs: number; error?: string }> {
  const start = Date.now();
  try {
    const result = await fn();
    return { result, status: "ok", durationMs: Date.now() - start };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.warn(`[run-deal-analyze] ${label} failed: ${error}`);
    return { result: fallback, status: "error", durationMs: Date.now() - start, error };
  }
}

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const toRecordArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item))
    : [];

const toTextValue = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
};

const toNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const normalized = value.replace(/[$,\s]/g, "");
      if (!normalized) continue;
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

const computeEquityPct = (estimatedValue: number | null, loanAmount: number | null): number | null => {
  if (!estimatedValue || estimatedValue <= 0) return null;
  if (loanAmount === null || loanAmount === undefined) return null;
  return Math.round(((estimatedValue - loanAmount) / estimatedValue) * 100);
};

const sortByDateDesc = (items: Array<Record<string, unknown>>, key: string) =>
  [...items].sort((a, b) => {
    const aTime = Date.parse(String(a[key] ?? ""));
    const bTime = Date.parse(String(b[key] ?? ""));
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  });

const sortByNumericDesc = (items: Array<Record<string, unknown>>, key: string) =>
  [...items].sort((a, b) => (Number(b[key] ?? 0)) - (Number(a[key] ?? 0)));

const pickRecordText = (record: Record<string, unknown>, fields: string[]) =>
  toTextValue(...fields.map((field) => record[field]));

const pickRecordNumber = (record: Record<string, unknown>, fields: string[]) =>
  toNumber(...fields.map((field) => record[field]));

const ATTOM_DISTRESS_DATE_FIELDS = [
  "auctionDateTime",
  "auctiondateTime",
  "auctionDate",
  "auctiondate",
  "defaultDate",
  "defaultdate",
  "filingDate",
  "filingdate",
  "recordingDate",
  "recordingdate",
  "statusDate",
  "statusdate",
  "eventDate",
  "eventdate",
  "eventDateTime",
  "date",
];

const estimateMonthlyPrincipalAndInterest = (principal: number | null, annualRate = 0.07, termYears = 30) => {
  if (principal === null || principal <= 0) return null;
  const monthlyRate = annualRate / 12;
  const paymentCount = termYears * 12;
  if (monthlyRate <= 0 || paymentCount <= 0) return null;
  const factor = Math.pow(1 + monthlyRate, paymentCount);
  return Math.round(principal * ((monthlyRate * factor) / (factor - 1)));
};

const LOW_RISK_FLOOD_PATTERNS = [
  /\bzone x\b/i,
  /\bzone c\b/i,
  /minimal flood hazard/i,
  /low to moderate flood hazard/i,
  /low flood risk/i,
  /outside (the )?(100|500)-year flood/i,
  /outside .*flood zone/i,
  /not in .*flood zone/i,
];

const HIGH_RISK_FLOOD_PATTERNS = [
  /\bzone (?:a|ae|ah|ao|ar|a99|ve|v|a\d{1,2}|v\d{1,2})\b/i,
  /special flood hazard area/i,
  /\bsfha\b/i,
  /mandatory flood insurance/i,
  /1% annual chance flood/i,
  /coastal high hazard/i,
];

const isHighRiskFloodMention = (text: string) => {
  const normalized = text.toLowerCase();
  if (!normalized.includes("flood") && !normalized.includes("fema") && !normalized.includes("sfha")) {
    return false;
  }

  const hasHighRiskSignal = HIGH_RISK_FLOOD_PATTERNS.some((pattern) => pattern.test(text));
  const hasLowRiskSignal = LOW_RISK_FLOOD_PATTERNS.some((pattern) => pattern.test(text));

  if (hasLowRiskSignal && !hasHighRiskSignal) return false;
  return hasHighRiskSignal;
};

const getAttomPropertyRecords = (payload: Record<string, unknown>): Record<string, unknown>[] => {
  const propertyArray = toRecordArray(payload.property);
  if (propertyArray.length > 0) return propertyArray;

  const propertyRecord = toRecord(payload.property);
  return Object.keys(propertyRecord).length > 0 ? [propertyRecord] : [];
};

function normalizeSaleHistoryItem(
  item: Record<string, unknown>,
  propertyRecord: Record<string, unknown>,
): Record<string, unknown> | null {
  const amount = toRecord(item.amount);
  const buyer = toRecord(item.buyer);
  const seller = toRecord(item.seller);
  const deed = toRecord(propertyRecord.deed);
  const deedBuyer = toRecord(deed.buyer);
  const deedSeller = toRecord(deed.seller);

  const saleTransDate = toTextValue(
    item.saleTransDate,
    item.saleSearchDate,
    item.salesearchdate,
    amount.saleRecDate,
    amount.salerecdate,
  );
  const saleAmt = toNumber(item.saleAmt, item.saleamt, amount.saleAmt, amount.saleamt);
  const buyerName = toTextValue(item.buyerName, buyer.name1full, buyer.name, deedBuyer.name1full, deedBuyer.name);
  const sellerName = toTextValue(item.sellerName, seller.name1full, seller.name, deedSeller.name1full, deedSeller.name);

  if (!saleTransDate && saleAmt === null && !buyerName && !sellerName) return null;

  return { saleTransDate, saleAmt, buyerName, sellerName };
}

function normalizeSaleHistoryPayload(payload: Record<string, unknown>): Array<Record<string, unknown>> {
  const normalized: Array<Record<string, unknown>> = [];

  for (const propertyRecord of getAttomPropertyRecords(payload)) {
    const historyItems = [
      ...toRecordArray(propertyRecord.saleHistory),
      ...toRecordArray(propertyRecord.salehistory),
    ];

    if (historyItems.length > 0) {
      for (const item of historyItems) {
        const normalizedItem = normalizeSaleHistoryItem(item, propertyRecord);
        if (normalizedItem) normalized.push(normalizedItem);
      }
      continue;
    }

    const singleHistoryRecord = toRecord(propertyRecord.saleHistory);
    if (Object.keys(singleHistoryRecord).length > 0) {
      const normalizedItem = normalizeSaleHistoryItem(singleHistoryRecord, propertyRecord);
      if (normalizedItem) normalized.push(normalizedItem);
      continue;
    }

    const legacyHistoryRecord = toRecord(propertyRecord.salehistory);
    if (Object.keys(legacyHistoryRecord).length > 0) {
      const normalizedItem = normalizeSaleHistoryItem(legacyHistoryRecord, propertyRecord);
      if (normalizedItem) normalized.push(normalizedItem);
      continue;
    }

    const saleSnapshot = toRecord(propertyRecord.sale);
    if (Object.keys(saleSnapshot).length > 0) {
      const normalizedItem = normalizeSaleHistoryItem(saleSnapshot, propertyRecord);
      if (normalizedItem) normalized.push(normalizedItem);
    }
  }

  const deduped = normalized.filter((item, index, array) => {
    const key = `${item.saleTransDate ?? ""}-${item.saleAmt ?? ""}`;
    return array.findIndex((candidate) => `${candidate.saleTransDate ?? ""}-${candidate.saleAmt ?? ""}` === key) === index;
  });

  return sortByDateDesc(deduped, "saleTransDate").slice(0, 12);
}

function normalizeAssessmentHistoryItem(item: Record<string, unknown>): Record<string, unknown> | null {
  const assessed = toRecord(item.assessed);
  const calculations = toRecord(item.calculations);
  const market = toRecord(item.market);
  const tax = toRecord(item.tax);

  const taxYear = toNumber(
    item.taxYear,
    item.taxyear,
    tax.taxYear,
    tax.taxyear,
    tax.taxYearAssessed,
    tax.assessorYear,
  );
  const assessedValue = toNumber(
    item.assessedValue,
    item.assdTtlValue,
    item.assdttlvalue,
    assessed.assdTtlValue,
    assessed.assdttlvalue,
    calculations.calcTtlValue,
    calculations.calcttlvalue,
  );
  const marketValue = toNumber(
    item.marketValue,
    item.mktTtlValue,
    item.mktttlvalue,
    market.mktTtlValue,
    market.mktttlvalue,
  );
  const taxAmt = toNumber(item.taxAmt, item.taxamt, tax.taxAmt, tax.taxamt);

  if (taxYear === null && assessedValue === null && marketValue === null && taxAmt === null) return null;

  return { taxYear, assessedValue, marketValue, taxAmt };
}

function normalizeAssessmentHistoryPayload(payload: Record<string, unknown>): Array<Record<string, unknown>> {
  const normalized: Array<Record<string, unknown>> = [];

  for (const propertyRecord of getAttomPropertyRecords(payload)) {
    const historyItems = [
      ...toRecordArray(propertyRecord.assessmentHistory),
      ...toRecordArray(propertyRecord.assessmenthistory),
    ];

    if (historyItems.length > 0) {
      for (const item of historyItems) {
        const normalizedItem = normalizeAssessmentHistoryItem(item);
        if (normalizedItem) normalized.push(normalizedItem);
      }
      continue;
    }

    const assessmentHistoryRecord = toRecord(propertyRecord.assessmentHistory);
    if (Object.keys(assessmentHistoryRecord).length > 0) {
      const normalizedItem = normalizeAssessmentHistoryItem(assessmentHistoryRecord);
      if (normalizedItem) normalized.push(normalizedItem);
      continue;
    }

    const legacyAssessmentHistoryRecord = toRecord(propertyRecord.assessmenthistory);
    if (Object.keys(legacyAssessmentHistoryRecord).length > 0) {
      const normalizedItem = normalizeAssessmentHistoryItem(legacyAssessmentHistoryRecord);
      if (normalizedItem) normalized.push(normalizedItem);
      continue;
    }

    const assessmentSnapshot = toRecord(propertyRecord.assessment);
    if (Object.keys(assessmentSnapshot).length > 0) {
      const normalizedItem = normalizeAssessmentHistoryItem(assessmentSnapshot);
      if (normalizedItem) normalized.push(normalizedItem);
    }
  }

  const deduped = normalized.filter((item, index, array) => {
    const key = `${item.taxYear ?? ""}-${item.assessedValue ?? ""}-${item.taxAmt ?? ""}`;
    return array.findIndex((candidate) => `${candidate.taxYear ?? ""}-${candidate.assessedValue ?? ""}-${candidate.taxAmt ?? ""}` === key) === index;
  });

  return sortByNumericDesc(deduped, "taxYear").slice(0, 12);
}

async function fetchAttomHistory(
  paths: string[],
  label: string,
  normalize: (payload: Record<string, unknown>) => Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  const attomKey = Deno.env.get("ATTOM_API_KEY");
  if (!attomKey) return [];

  let lastHttpError: string | null = null;

  for (const path of paths) {
    const resp = await withTimeout(
      fetch(`https://api.gateway.attomdata.com/propertyapi/v1.0.0${path}`, {
        headers: { apikey: attomKey, accept: "application/json" },
      }),
      DEFAULT_SOURCE_TIMEOUT,
      label,
    );

    if (!resp.ok) {
      lastHttpError = `${path}: ${resp.status}`;
      continue;
    }

    const data = await resp.json() as Record<string, unknown>;
    const normalized = normalize(data);
    if (normalized.length > 0) return normalized;
  }

  if (lastHttpError) throw new Error(lastHttpError);
  return [];
}

function buildFallbackSaleHistory(property: Record<string, unknown>): Array<Record<string, unknown>> {
  const distressDetails = toRecord(property.distress_details);
  const rawSale = toRecord(distressDetails.rawSale);
  const rawSaleAmount = toRecord(rawSale.amount);
  const rawDeed = toRecord(distressDetails.rawDeed);
  const deedBuyer = toRecord(rawDeed.buyer);
  const deedSeller = toRecord(rawDeed.seller);

  const saleTransDate = toTextValue(property.last_sale_date, rawSale.saleTransDate, rawSale.salesearchdate);
  const saleAmt = toNumber(property.last_sale_price, distressDetails.deedSaleAmt, rawSale.saleAmt, rawSale.saleamt, rawSaleAmount.saleAmt, rawSaleAmount.saleamt);
  const buyerName = toTextValue(
    distressDetails.deedBuyerName,
    deedBuyer.name1full,
    deedBuyer.name,
    distressDetails.ownerName,
    distressDetails.owner_name,
  );
  const sellerName = toTextValue(
    distressDetails.deedSellerName,
    deedSeller.name1full,
    deedSeller.name,
  );

  if (!saleTransDate && saleAmt === null) return [];
  return [{ saleTransDate, saleAmt, buyerName, sellerName }];
}

function buildFallbackAssessmentHistory(property: Record<string, unknown>): Array<Record<string, unknown>> {
  const distressDetails = toRecord(property.distress_details);
  const assessmentTax = toRecord(distressDetails.assessmentTax);
  const landValue = toNumber(distressDetails.assessedLandValue);
  const improvementValue = toNumber(distressDetails.assessedImprValue);
  const assessedValue = landValue !== null || improvementValue !== null ? (landValue ?? 0) + (improvementValue ?? 0) : null;
  const marketValue = toNumber(property.estimated_value);
  const taxYear = toNumber(assessmentTax.taxYear, assessmentTax.taxyear);
  const taxAmt = toNumber(assessmentTax.taxAmt, assessmentTax.taxamt);

  if (taxYear === null && assessedValue === null && marketValue === null && taxAmt === null) return [];
  return [{ taxYear, assessedValue, marketValue, taxAmt }];
}

// ─── Layer 2: Market Heat (Keywords Everywhere) ───────────────────────────────

async function fetchMarketHeat(zip: string, city: string): Promise<{
  motivatedSellerVolume: number | null;
  investorCompetitionCpc: number | null;
  signal: string;
}> {
  const keApiKey = Deno.env.get("KEYWORDS_EVERYWHERE_API_KEY");
  if (!keApiKey) throw new Error("KEYWORDS_EVERYWHERE_API_KEY not set");

  const queries = [
    `sell my house fast ${zip}`,
    `cash for houses ${city}`,
    `foreclosed homes ${city}`,
  ];

  const response = await withTimeout(
    fetch("https://api.keywordseverywhere.com/v1/get_keyword_data", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${keApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ country: "us", currency: "USD", dataSource: "gkp", kw: queries }),
    }),
    DEFAULT_SOURCE_TIMEOUT,
    "Keywords Everywhere"
  );

  if (!response.ok) throw new Error(`KE API ${response.status}`);
  const data = await response.json();
  const keywords: Array<{ keyword: string; vol: number; cpc: { value: string } }> = data.data ?? [];

  const sellerVolume = keywords.find((k) => k.keyword.includes("sell my house"))?.vol ?? null;
  const competitionCpc = keywords.find((k) => k.keyword.includes("cash for houses"));
  const cpcValue = competitionCpc ? parseFloat(competitionCpc.cpc?.value ?? "0") : null;

  let signal = "Unknown";
  if (sellerVolume !== null && cpcValue !== null) {
    if (sellerVolume > 500 && cpcValue < 5) signal = "High Opportunity"; // many sellers, low competition
    else if (sellerVolume > 200) signal = "Moderate Opportunity";
    else signal = "Low Activity";
  }

  return { motivatedSellerVolume: sellerVolume, investorCompetitionCpc: cpcValue, signal };
}

// ─── Layer 2: Serper search helper ───────────────────────────────────────────

async function serperSearch(query: string): Promise<Array<{ title: string; snippet: string; link: string }>> {
  const serperKey = Deno.env.get("SERPER_API_KEY");
  if (!serperKey) throw new Error("SERPER_API_KEY not set");

  const response = await withTimeout(
    fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 5 }),
    }),
    DEFAULT_SOURCE_TIMEOUT,
    `Serper: ${query}`
  );

  if (!response.ok) throw new Error(`Serper API ${response.status}`);
  const data = await response.json();
  return (data.organic ?? []).map((r: Record<string, string>) => ({
    title: r.title ?? "",
    snippet: r.snippet ?? "",
    link: r.link ?? "",
  }));
}

// ─── Layer 2: Neighborhood Sentiment (Serper Reddit) ─────────────────────────

async function fetchNeighborhoodSentiment(city: string, state: string, zip: string): Promise<{
  snippets: Array<{ title: string; snippet: string }>;
  sentiment: string;
}> {
  const results = await serperSearch(`site:reddit.com ${city} ${state} real estate invest OR "good neighborhood" OR "avoid"`);

  const snippets = results.map((r) => ({ title: r.title, snippet: r.snippet }));

  // Simple sentiment: count positive/negative keywords
  const text = snippets.map((s) => `${s.title} ${s.snippet}`).join(" ").toLowerCase();
  const positiveWords = ["good", "great", "growing", "up and coming", "invest", "opportunity", "appreciate"];
  const negativeWords = ["avoid", "crime", "declining", "bad", "dangerous", "flooding", "blight"];
  const posScore = positiveWords.filter((w) => text.includes(w)).length;
  const negScore = negativeWords.filter((w) => text.includes(w)).length;

  const sentiment = posScore > negScore ? "Positive" : negScore > posScore ? "Negative" : "Mixed";
  return { snippets, sentiment };
}

// ─── Layer 2: Owner Research (Serper) ────────────────────────────────────────

async function fetchOwnerResearch(ownerName: string | null, address: string, city: string): Promise<{
  courtRecords: Array<{ title: string; snippet: string }>;
  distressConfirmed: boolean;
  isBusinessEntity: boolean;
}> {
  if (!ownerName || ownerName.trim().length === 0) {
    return { courtRecords: [], distressConfirmed: false, isBusinessEntity: false };
  }

  // Detect business entities — skip owner research if LLC/Corp/Trust
  const businessIndicators = ["llc", "inc", "corp", "trust", "ltd", "lp", "l.l.c", "l.p."];
  const isBusinessEntity = businessIndicators.some((b) => ownerName.toLowerCase().includes(b));

  if (isBusinessEntity) {
    return { courtRecords: [], distressConfirmed: false, isBusinessEntity: true };
  }

  const results = await serperSearch(`"${ownerName}" ${city} court OR bankruptcy OR lawsuit OR foreclosure OR divorce`);
  const courtRecords = results.map((r) => ({ title: r.title, snippet: r.snippet }));
  const distressConfirmed = courtRecords.length > 0;

  return { courtRecords, distressConfirmed, isBusinessEntity: false };
}

// ─── Layer 2: Deal Killers (Serper adversarial) ───────────────────────────────

async function fetchDealKillers(address: string, city: string, state: string): Promise<{
  floodZone: boolean;
  environmental: boolean;
  killSignals: Array<{ type: string; evidence: string }>;
}> {
  const killSignals: Array<{ type: string; evidence: string }> = [];

  // Run flood zone + environmental checks in parallel
  const [floodResults, envResults] = await Promise.all([
    serperSearch(`"${address}" ${city} ${state} flood zone FEMA`).catch(() => []),
    serperSearch(`"${address}" ${city} ${state} EPA superfund contamination environmental`).catch(() => []),
  ]);

  const floodEvidence = floodResults.find((r) => isHighRiskFloodMention(`${r.title} ${r.snippet}`));
  const floodZone = !!floodEvidence;

  const environmental = envResults.some((r) => {
    const text = `${r.title} ${r.snippet}`.toLowerCase();
    return text.includes("superfund") || text.includes("contamination") || text.includes("hazardous");
  });

  if (floodEvidence) {
    killSignals.push({
      type: "flood_zone",
      evidence: floodEvidence.snippet || floodEvidence.title || "High-risk FEMA flood zone reference found",
    });
  }

  if (environmental) {
    const evidence = envResults.find((r) => `${r.title} ${r.snippet}`.toLowerCase().includes("superfund"));
    killSignals.push({ type: "environmental", evidence: evidence?.snippet ?? "Environmental issue reference found" });
  }

  return { floodZone, environmental, killSignals };
}

// ─── Layer 2: Public Records Confirmation (Serper) ───────────────────────────

async function fetchPublicRecordsConfirm(address: string, ownerName: string | null, county: string, year: number): Promise<{
  lisPendensConfirmed: boolean;
  taxLienConfirmed: boolean;
  snippets: Array<{ title: string; snippet: string }>;
}> {
  const queries = [
    `"${address}" lis pendens ${year}`,
    ownerName ? `"${ownerName}" divorce ${county} ${year}` : null,
    `"${address}" tax lien ${county}`,
  ].filter(Boolean) as string[];

  const results = await Promise.all(
    queries.map((q) => serperSearch(q).catch(() => []))
  );

  const allResults = results.flat();
  const allText = allResults.map((r) => `${r.title} ${r.snippet}`).join(" ").toLowerCase();

  return {
    lisPendensConfirmed: allText.includes("lis pendens") || allText.includes("notice of default"),
    taxLienConfirmed: allText.includes("tax lien") || allText.includes("tax delinquent"),
    snippets: allResults.map((r) => ({ title: r.title, snippet: r.snippet })).slice(0, 5),
  };
}

// ─── Layer 2: Market Narrative (Perplexity) ───────────────────────────────────

async function fetchMarketNarrative(zip: string, city: string, state: string): Promise<string> {
  const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
  if (!perplexityKey) throw new Error("PERPLEXITY_API_KEY not set");

  const response = await withTimeout(
    fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${perplexityKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages: [
          {
            role: "user",
            content: `In 3-4 sentences, summarize the real estate investment market for ${city}, ${state} (zip: ${zip}) as of ${new Date().getFullYear()}. Focus on: price trends, distressed property activity, investor interest, and any notable neighborhood developments. Be specific with data when available.`,
          },
        ],
        max_tokens: 300,
      }),
    }),
    PERPLEXITY_TIMEOUT,
    "Perplexity market narrative"
  );

  if (!response.ok) throw new Error(`Perplexity API ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ─── Adversarial kill pass (GPT-4o-mini) ─────────────────────────────────────

async function runAdversarialPass(
  propertyData: Record<string, unknown>,
  dealKillers: { floodZone: boolean; environmental: boolean; killSignals: Array<{ type: string; evidence: string }> },
  equityPct: number | null,
): Promise<Array<{ type: string; severity: "Hard" | "Soft"; evidence: string }>> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) return [];

  const systemPrompt = `You are a skeptical real estate investment analyst. Your job is to find genuine, evidence-based reasons why this property is a BAD investment. 0 kill signals is a perfectly valid answer if the evidence doesn't support any.

For each kill signal you identify, you MUST provide specific evidence from the data provided. Generic statements like "the market is risky" or "renovations can be expensive" are NOT valid — they must cite specific data points from the property.

Kill signal types and their evidence requirements:
- flood_zone: must name FEMA flood zone designation or source
- environmental: must name specific EPA/state environmental issue
- title_dispute: must cite an active court case
- underwater: equity_pct must be negative (property worth less than liens)
- hoa_overleveraged: requires HOA lien + tax lien + foreclosure all present simultaneously
- no_distress_evidence: distress signals couldn't be confirmed in any public records`;

  const userPrompt = `Analyze this property for investment kill signals:

Address: ${propertyData.address}, ${propertyData.city}, ${propertyData.state} ${propertyData.zip}
Estimated Value: $${propertyData.estimated_value ?? "Unknown"}
Equity Position: ${equityPct !== null ? `${equityPct}%` : "Unknown"}
Distress Types: ${JSON.stringify(propertyData.distress_types)}
Flood Zone Detected: ${dealKillers.floodZone}
Environmental Issue Detected: ${dealKillers.environmental}
Existing Kill Signals: ${JSON.stringify(dealKillers.killSignals)}

Return JSON: { "killSignals": [{ "type": string, "severity": "Hard"|"Soft", "evidence": "specific data point quoted" }] }
If no kill signals, return: { "killSignals": [] }`;

  try {
    const response = await withTimeout(
      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          max_tokens: 500,
          temperature: 0.3,
        }),
      }),
      DEFAULT_SOURCE_TIMEOUT,
      "Adversarial kill pass"
    );

    if (!response.ok) return [];
    const data = await response.json();
    const content = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    return content.killSignals ?? [];
  } catch {
    return [];
  }
}

// ─── Main GPT-4o scoring call ────────────────────────────────────────────────

async function scoreDealWithGPT(
  property: Record<string, unknown>,
  intelligence: Record<string, unknown>,
  hardKillSignals: Array<{ type: string; severity: string; evidence: string }>,
  opportunityType?: string,
  opportunityContext?: string,
  history?: {
    sales: Array<Record<string, unknown>>;
    assessments: Array<Record<string, unknown>>;
    listing: Array<Record<string, unknown>>;
  },
): Promise<{
  deal_score: number;
  deal_verdict: "Strong Deal" | "Investigate" | "Pass";
  score_rationale: string;
  distress_analysis: string;
  equity_assessment: string;
  market_heat_assessment: string;
  risks: string[];
  opportunities: string[];
  opportunity_analysis?: string;
  history_summary?: string;
  urgency_summary?: string;
  next_step?: string;
}> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) throw new Error("OPENAI_API_KEY not set");

  const marketHeat = intelligence.marketHeat as Record<string, unknown> ?? {};
  const neighborhoodSentiment = intelligence.neighborhoodSentiment as Record<string, unknown> ?? {};
  const ownerResearch = intelligence.ownerResearch as Record<string, unknown> ?? {};
  const publicRecords = intelligence.publicRecordsConfirm as Record<string, unknown> ?? {};

  const systemPrompt = `You are a professional real estate investment analyst. Write a concise investor brief from the property's verified history, urgency, and opportunity signals. Keep every claim tied to the provided data. Return only valid JSON.`;

  const userPrompt = `Score this distressed property as a deal opportunity using ALL provided data.

## Property Data (ATTOM — Layer 1, verified)
Address: ${property.address}, ${property.city}, ${property.state} ${property.zip}
Type: ${property.property_type ?? "Unknown"}, ${property.beds ?? "?"}bd/${property.baths ?? "?"}ba, ${property.sqft ?? "?"}sqft
Estimated Value: $${property.estimated_value ?? "Unknown"}
Last Sale: $${property.last_sale_price ?? "Unknown"} (${property.last_sale_date ?? "Unknown"})
Equity Position: ${property.equity_pct !== null && property.equity_pct !== undefined ? `${property.equity_pct}%` : "Unknown"}
Distress Types: ${(property.distress_types as string[])?.join(", ") ?? "None identified"}
Distress Details: ${JSON.stringify(property.distress_details)}

## History Data
Sales History: ${JSON.stringify((history?.sales ?? []).slice(0, 6))}
Tax History: ${JSON.stringify((history?.assessments ?? []).slice(0, 6))}
Listing Timeline: ${JSON.stringify((history?.listing ?? []).slice(0, 10))}

## Intelligence Data (Layer 2)
Market Heat (${property.zip}): Motivated seller search volume = ${marketHeat.motivatedSellerVolume ?? "N/A"}/mo, Investor competition CPC = $${marketHeat.investorCompetitionCpc ?? "N/A"}, Signal = ${marketHeat.signal ?? "Unknown"}
Neighborhood Sentiment: ${neighborhoodSentiment.sentiment ?? "Unknown"} — ${(neighborhoodSentiment.snippets as Array<{ snippet: string }> ?? []).slice(0, 2).map((s) => s.snippet).join("; ")}
Owner Research: Business entity = ${ownerResearch.isBusinessEntity ? "Yes" : "No"}, Distress confirmed in public records = ${ownerResearch.distressConfirmed ? "Yes" : "No"}
Public Records: Lis pendens confirmed = ${publicRecords.lisPendensConfirmed ? "Yes" : "No"}, Tax lien confirmed = ${publicRecords.taxLienConfirmed ? "Yes" : "No"}
Market Narrative: ${intelligence.marketNarrative ?? "Not available"}

## Deal Killer Signals (pre-scored)
${hardKillSignals.length === 0 ? "None identified" : hardKillSignals.map((k) => `- ${k.type} (${k.severity}): ${k.evidence}`).join("\n")}
${opportunityContext ? `\n## Opportunity Context\n${opportunityContext}` : ""}
## Scoring Instructions
Score 0-100 based on:
- Equity position (higher equity = stronger deal)
- Distress signal quality (verified by public records = stronger)
- Market heat (high motivated-seller volume, low investor competition = stronger)
- Neighborhood trajectory
- Number and severity of kill signals
- Opportunity type: short sales and deep-discount scenarios can still score 70+ if acquisition math works

Thresholds: ≥70 = Strong Deal, 40-69 = Investigate, <40 = Pass

Return ONLY valid JSON:
{
  "deal_score": <0-100>,
  "deal_verdict": "Strong Deal|Investigate|Pass",
  "score_rationale": "<2-3 sentences citing specific evidence from the data above>",
  "distress_analysis": "<assessment of each distress signal with ATTOM verification status>",
  "equity_assessment": "<ARV potential, lien burden analysis, equity position>",
  "market_heat_assessment": "<motivated seller supply vs investor competition for this market>",
  "history_summary": "<2-3 sentences on purchase/listing/default history and what it means for owner motivation>",
  "urgency_summary": "<1-2 sentences naming the dated trigger or current urgency level in plain English>",
  "next_step": "<single sentence with the best operator move right now>",
  "risks": ["<specific risk with evidence>"],
  "opportunities": ["<specific opportunity with evidence>"],
  "opportunity_analysis": "<if opportunity context was provided, a 2-3 sentence analysis of that specific opportunity type; otherwise empty string>"
}`;

  const response = await withTimeout(
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
        temperature: 0.3,
      }),
    }),
    60000,
    "GPT-4o deal scoring"
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenAI API ${response.status}: ${body.slice(0, 500)}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("GPT-4o returned non-JSON response");
  }
}

// ─── Verdict enforcement after kill pass ─────────────────────────────────────

const VERDICT_ORDER = ["Strong Deal", "Investigate", "Pass"] as const;

function applyKillSignals(
  verdict: "Strong Deal" | "Investigate" | "Pass",
  score: number,
  hardKillSignals: Array<{ severity: string }>,
): { verdict: "Strong Deal" | "Investigate" | "Pass"; score: number } {
  const hardKills = hardKillSignals.filter((k) => k.severity === "Hard");
  if (hardKills.length >= 2) return { verdict: "Pass", score: Math.min(score, 35) };
  if (hardKills.length === 1) {
    const currentIdx = VERDICT_ORDER.indexOf(verdict);
    const newIdx = Math.min(currentIdx + 1, VERDICT_ORDER.length - 1);
    return { verdict: VERDICT_ORDER[newIdx], score: Math.min(score, 55) };
  }
  return { verdict, score };
}

// ─── Fetch photos + listing history via Zillow/Firecrawl ─────────────────────

interface ListingEvent {
  date: string;
  event: string;
  price: number | null;
}

const REAL_ESTATE_RESULT_HOSTS = [
  "zillow.com",
  "realtor.com",
  "redfin.com",
  "homes.com",
];

const PREFERRED_IMAGE_HOSTS = [
  "photos.zillowstatic.com",
  "ap.rdcpix.com",
  "ssl.cdn-redfin.com",
  "cdn.realtor.com",
  "cdn.resize.sparkplatform.com",
  "mlspin.com",
  "imgix.net",
];

const isSupportedListingUrl = (url: string) => {
  const normalized = url.toLowerCase();
  return REAL_ESTATE_RESULT_HOSTS.some((host) => normalized.includes(host));
};

const isLikelyPropertyImage = (url: string) => {
  const normalized = url.toLowerCase();
  if (!/^https?:\/\//.test(normalized)) return false;
  if (!/\.(?:jpg|jpeg|png|webp)(?:[?#].*)?$/.test(normalized)) return false;
  if (/(logo|avatar|icon|favicon|sprite|banner|googleapis|gstatic|gravatar)/.test(normalized)) return false;
  if (normalized.includes("/profile/")) return false;
  return true;
};

const dedupeUrls = (urls: string[]) => Array.from(new Set(urls.filter(Boolean)));

async function fetchZillowData(address: string, city: string, state: string): Promise<{ photos: string[]; listingHistory: ListingEvent[] }> {
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!firecrawlKey) return { photos: [], listingHistory: [] };

  const serperKey = Deno.env.get("SERPER_API_KEY");
  if (!serperKey) return { photos: [], listingHistory: [] };

  try {
    const searchResp = await withTimeout(
      fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          q: `"${address}" ${city} ${state} (site:zillow.com OR site:realtor.com OR site:redfin.com OR site:homes.com)`,
          num: 5,
        }),
      }),
      DEFAULT_SOURCE_TIMEOUT,
      "Serper property image search"
    );

    if (!searchResp.ok) return { photos: [], listingHistory: [] };
    const searchData = await searchResp.json();
    const listingUrl = ((searchData.organic as Array<Record<string, unknown>> | undefined) ?? [])
      .map((result) => String(result.link ?? ""))
      .find(isSupportedListingUrl) ?? "";
    if (!listingUrl) return { photos: [], listingHistory: [] };

    const scrapeResp = await withTimeout(
      fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${firecrawlKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: listingUrl,
          formats: ["markdown", "html", "images"],
          onlyMainContent: false,
          waitFor: 2500,
          timeout: 45000,
          maxAge: 86400000,
          blockAds: true,
          proxy: "auto",
        }),
      }),
      20000,
      "Firecrawl property scrape"
    );

    if (!scrapeResp.ok) return { photos: [], listingHistory: [] };
    const scrapeData = await scrapeResp.json() as Record<string, unknown>;
    const scrapePayload = toRecord(scrapeData.data);
    const markdown = String(scrapePayload.markdown ?? "");
    const html = String(scrapePayload.html ?? "");
    const metadata = toRecord(scrapePayload.metadata);
    const listedImages = Array.isArray(scrapePayload.images)
      ? scrapePayload.images.map((value) => String(value ?? "").trim())
      : [];

    const markdownMatches = Array.from(markdown.matchAll(/!\[.*?\]\((https:\/\/.*?\.(?:jpg|jpeg|png|webp).*?)\)/gi)).map((match) => match[1]);
    const htmlMatches = Array.from(html.matchAll(/<img[^>]+src=["'](https:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi)).map((match) => match[1]);
    const metadataImages = [
      String(metadata.ogImage ?? ""),
      String(metadata.image ?? ""),
    ];

    const photos = dedupeUrls([
      ...listedImages,
      ...markdownMatches,
      ...htmlMatches,
      ...metadataImages,
    ])
      .filter(isLikelyPropertyImage)
      .sort((left, right) => {
        const leftPreferred = PREFERRED_IMAGE_HOSTS.some((host) => left.includes(host)) ? 1 : 0;
        const rightPreferred = PREFERRED_IMAGE_HOSTS.some((host) => right.includes(host)) ? 1 : 0;
        return rightPreferred - leftPreferred;
      })
      .slice(0, 12);

    // Parse price history table ? pipe-delimited rows after "Price history" heading
    const listingHistory: ListingEvent[] = [];
    const historySection = markdown.match(/price history[\s\S]*?((?:\|[^\n]+\n){1,25})/i);
    if (historySection) {
      const rows = historySection[1].trim().split("\n").filter(r => r.includes("|") && !/^[\s|:-]+$/.test(r));
      for (const row of rows.slice(0, 20)) {
        const cols = row.split("|").map(c => c.trim()).filter(Boolean);
        if (cols.length < 2) continue;
        const [dateStr, eventStr, priceStr] = cols;
        const priceNum = priceStr ? parseInt(priceStr.replace(/[^0-9]/g, ""), 10) || null : null;
        listingHistory.push({ date: dateStr, event: eventStr ?? "", price: priceNum });
      }
    }

    return { photos, listingHistory };
  } catch (err) {
    console.warn("[run-deal-analyze] Zillow fetch failed:", err);
    return { photos: [], listingHistory: [] };
  }
}

// ─── ATTOM history calls ──────────────────────────────────────────────────────

async function fetchAttomSaleHistory(attomId: string): Promise<Array<Record<string, unknown>>> {
  return fetchAttomHistory(
    [
      `/saleshistory/detail?attomId=${encodeURIComponent(attomId)}`,
      `/saleshistory/detail?id=${encodeURIComponent(attomId)}`,
      `/saleshistory/snapshot?attomId=${encodeURIComponent(attomId)}`,
      `/salehistory/snapshot?attomid=${encodeURIComponent(attomId)}`,
    ],
    "ATTOM sale history",
    normalizeSaleHistoryPayload,
  );
}

async function fetchAttomAssessmentHistory(attomId: string): Promise<Array<Record<string, unknown>>> {
  return fetchAttomHistory(
    [
      `/assessmenthistory/detail?attomId=${encodeURIComponent(attomId)}`,
      `/assessmenthistory/detail?id=${encodeURIComponent(attomId)}`,
      `/assessmenthistory/snapshot?attomId=${encodeURIComponent(attomId)}`,
      `/assessmenthistory/snapshot?attomid=${encodeURIComponent(attomId)}`,
    ],
    "ATTOM assessment history",
    normalizeAssessmentHistoryPayload,
  );
}

type AttomDebtStatus = {
  statusLabel: string | null;
  delinquentAmount: number | null;
  taxLienAmount: number | null;
  openingBidAmount: number | null;
  auctionDate: string | null;
  defaultDate: string | null;
  recordingDate: string | null;
  originalLoanDate: string | null;
  taxDelinquentYear: number | null;
  estimatedMissedPayments: number | null;
  estimatedMonthlyPayment: number | null;
  estimateBasis: string | null;
  sourceEventType: string | null;
};

const hasDebtStatus = (value: AttomDebtStatus | null) =>
  Boolean(
    value &&
      (
        value.delinquentAmount !== null ||
        value.taxLienAmount !== null ||
        value.openingBidAmount !== null ||
        value.auctionDate ||
        value.defaultDate ||
        value.recordingDate ||
        value.taxDelinquentYear !== null
      ),
  );

function normalizeAttomDebtStatus(
  propertyRecord: Record<string, unknown>,
  fallbackLoanAmount: number | null,
): AttomDebtStatus | null {
  const assessment = toRecord(propertyRecord.assessment);
  const assessmentTax = toRecord(assessment.tax);
  const foreclosure = toRecord(propertyRecord.foreclosure);
  const saleHistoryItems = [
    ...toRecordArray(propertyRecord.saleHistory),
    ...toRecordArray(propertyRecord.salehistory),
  ];

  const candidateRecords = [
    foreclosure,
    ...saleHistoryItems.flatMap((item) => {
      const nestedForeclosure = toRecord(item.foreclosure);
      return Object.keys(nestedForeclosure).length > 0 ? [item, nestedForeclosure] : [item];
    }),
    ...toRecordArray(propertyRecord.eventHistory),
    ...toRecordArray(propertyRecord.events),
  ].filter((candidate) => Object.keys(candidate).length > 0);

  const relevantCandidates = candidateRecords
    .filter((candidate) => {
      const label = pickRecordText(candidate, ["eventType", "type", "eventDescription", "description", "status", "stage"]);
      const hasDate = pickRecordText(candidate, ATTOM_DISTRESS_DATE_FIELDS);
      const hasMoney = pickRecordNumber(candidate, [
        "delinquentAmount",
        "delinquentamount",
        "bidAmount",
        "bidamount",
        "openingBidAmount",
        "taxLienAmount",
        "taxlienamount",
        "amount",
        "balance",
      ]);

      return Boolean(hasDate || hasMoney || (label && /foreclos|default|auction|lien|delinquen|pendens|trustee|sheriff/i.test(label)));
    })
    .sort((left, right) => {
      const leftTime = Date.parse(pickRecordText(left, ATTOM_DISTRESS_DATE_FIELDS) ?? "");
      const rightTime = Date.parse(pickRecordText(right, ATTOM_DISTRESS_DATE_FIELDS) ?? "");
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    });

  const foreclosureCandidate = relevantCandidates.find((candidate) => {
    const label = pickRecordText(candidate, ["eventType", "type", "eventDescription", "description", "status", "stage"]) ?? "";
    return /foreclos|default|auction|pendens|trustee|sheriff/i.test(label);
  }) ?? relevantCandidates[0] ?? foreclosure;

  const taxCandidate = relevantCandidates.find((candidate) => {
    const label = pickRecordText(candidate, ["eventType", "type", "eventDescription", "description", "status", "stage"]) ?? "";
    return /tax|delinquen/i.test(label);
  }) ?? null;

  const delinquentAmount = toNumber(
    pickRecordNumber(foreclosureCandidate, ["delinquentAmount", "delinquentamount"]),
    pickRecordNumber(foreclosure, ["delinquentAmount", "delinquentamount"]),
  );
  const taxLienAmount = toNumber(
    pickRecordNumber(taxCandidate ?? {}, ["taxLienAmount", "taxlienamount", "delinquentAmount", "delinquentamount", "amount", "balance"]),
    pickRecordNumber(assessmentTax, ["delinquentAmount", "delinquentamount"]),
  );
  const openingBidAmount = toNumber(
    pickRecordNumber(foreclosureCandidate, ["openingBidAmount", "bidAmount", "bidamount", "auctionBidAmount"]),
    pickRecordNumber(foreclosure, ["openingBidAmount", "bidAmount", "bidamount", "auctionBidAmount"]),
  );
  const auctionDate = toTextValue(
    pickRecordText(foreclosureCandidate, ["auctionDateTime", "auctiondateTime", "auctionDate", "auctiondate"]),
    pickRecordText(foreclosure, ["auctionDateTime", "auctiondateTime", "auctionDate", "auctiondate"]),
  );
  const defaultDate = toTextValue(
    pickRecordText(foreclosureCandidate, ["defaultDate", "defaultdate", "filingDate", "filingdate"]),
    pickRecordText(foreclosure, ["defaultDate", "defaultdate", "filingDate", "filingdate"]),
  );
  const recordingDate = toTextValue(
    pickRecordText(foreclosureCandidate, ["recordingDate", "recordingdate", "statusDate", "statusdate", "eventDate", "eventdate", "date"]),
    pickRecordText(foreclosure, ["recordingDate", "recordingdate", "statusDate", "statusdate", "eventDate", "eventdate", "date"]),
  );
  const originalLoanDate = toTextValue(
    pickRecordText(foreclosureCandidate, ["originalLoanDate", "originalloandate"]),
    pickRecordText(foreclosure, ["originalLoanDate", "originalloandate"]),
  );
  const taxDelinquentYear = toNumber(
    assessment.delinquentyear,
    assessment.delinquentYear,
    assessmentTax.delinquentyear,
    assessmentTax.delinquentYear,
    propertyRecord.delinquentyear,
    propertyRecord.delinquentYear,
  );
  const monthlyPaymentEstimate = estimateMonthlyPrincipalAndInterest(fallbackLoanAmount);
  const estimatedMissedPayments = delinquentAmount !== null && monthlyPaymentEstimate
    ? Math.max(1, Math.round(delinquentAmount / monthlyPaymentEstimate))
    : null;

  const normalized: AttomDebtStatus = {
    statusLabel: pickRecordText(foreclosureCandidate, ["eventType", "type", "eventDescription", "description", "status", "stage"]),
    delinquentAmount,
    taxLienAmount,
    openingBidAmount,
    auctionDate,
    defaultDate,
    recordingDate,
    originalLoanDate,
    taxDelinquentYear,
    estimatedMissedPayments,
    estimatedMonthlyPayment: monthlyPaymentEstimate,
    estimateBasis: estimatedMissedPayments !== null
      ? "Estimated from delinquent amount against a 30-year fixed loan payment at 7% APR on the recorded mortgage balance."
      : null,
    sourceEventType: pickRecordText(foreclosureCandidate, ["eventType", "type", "eventDescription", "description", "status", "stage"]),
  };

  return hasDebtStatus(normalized) ? normalized : null;
}

async function fetchAttomDebtStatus(attomId: string, fallbackLoanAmount: number | null): Promise<AttomDebtStatus | null> {
  const attomKey = Deno.env.get("ATTOM_API_KEY");
  if (!attomKey) return null;

  const paths = [
    `/saleshistory/expandedhistory?attomId=${encodeURIComponent(attomId)}`,
    `/saleshistory/expandedhistory?attomid=${encodeURIComponent(attomId)}`,
    `/saleshistory/expandedhistory?id=${encodeURIComponent(attomId)}`,
  ];

  let lastHttpError: string | null = null;

  for (const path of paths) {
    const response = await withTimeout(
      fetch(`https://api.gateway.attomdata.com/propertyapi/v1.0.0${path}`, {
        headers: { apikey: attomKey, accept: "application/json" },
      }),
      DEFAULT_SOURCE_TIMEOUT,
      "ATTOM debt status",
    );

    if (!response.ok) {
      lastHttpError = `${path}: ${response.status}`;
      continue;
    }

    const payload = await response.json() as Record<string, unknown>;
    for (const propertyRecord of getAttomPropertyRecords(payload)) {
      const normalized = normalizeAttomDebtStatus(propertyRecord, fallbackLoanAmount);
      if (normalized) return normalized;
    }
  }

  if (lastHttpError) throw new Error(lastHttpError);
  return null;
}

type AttomOwnerMortgageDetails = {
  attomId: string;
  ownerName: string | null;
  ownerMailingAddress: string | null;
  mortgageLoanAmount: number | null;
  mortgageLenderName: string | null;
  mortgageLoanType: string | null;
};

const buildOwnerDisplayName = (ownerRecord: Record<string, unknown>) => {
  const owner1 = toRecord(ownerRecord.owner1);
  const owner2 = toRecord(ownerRecord.owner2);

  const firstOwner = [
    toTextValue(owner1.firstnameandmi, owner1.firstNameAndMi, owner1.firstname, owner1.firstName),
    toTextValue(owner1.lastname, owner1.lastName),
  ].filter(Boolean).join(" ").trim();

  const secondOwner = [
    toTextValue(owner2.firstnameandmi, owner2.firstNameAndMi, owner2.firstname, owner2.firstName),
    toTextValue(owner2.lastname, owner2.lastName),
  ].filter(Boolean).join(" ").trim();

  return toTextValue(
    firstOwner && secondOwner ? `${firstOwner} & ${secondOwner}` : firstOwner || secondOwner,
    ownerRecord.name1full,
    ownerRecord.ownerName,
  );
};

const normalizeOwnerMortgageProperty = (propertyRecord: Record<string, unknown>): AttomOwnerMortgageDetails => {
  const identifier = toRecord(propertyRecord.identifier);
  const owner = toRecord(propertyRecord.owner);
  const mortgage = toRecord(propertyRecord.mortgage);
  const lender = toRecord(mortgage.lender);

  const lenderName = toTextValue(
    [toTextValue(lender.firstname, lender.firstName), toTextValue(lender.lastname, lender.lastName)].filter(Boolean).join(" ").trim(),
    lender.companyname,
    lender.companyName,
    lender.name,
  );

  return {
    attomId: String(identifier.attomId ?? identifier.Id ?? propertyRecord.id ?? "").trim(),
    ownerName: buildOwnerDisplayName(owner),
    ownerMailingAddress: toTextValue(owner.mailingaddressoneline, owner.mailingAddressOneLine),
    mortgageLoanAmount: toNumber(mortgage.amount, toRecord(mortgage.amount).loanamt, toRecord(mortgage.amount).amount),
    mortgageLenderName: lenderName,
    mortgageLoanType: toTextValue(
      mortgage.loantypecode,
      mortgage.loanTypeCode,
      mortgage.deedtype,
      mortgage.deedType,
      mortgage.interestratetype,
      mortgage.interestRateType,
    ),
  };
};

async function fetchAttomOwnerMortgageDetails(opts: {
  attomId?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): Promise<AttomOwnerMortgageDetails | null> {
  const attomApiKey = Deno.env.get("ATTOM_API_KEY");
  if (!attomApiKey) throw new Error("ATTOM_API_KEY not configured");

  const params = new URLSearchParams({ page: "1", pagesize: "1" });
  if (opts.attomId) {
    params.set("attomId", opts.attomId);
  } else {
    const addressLine = toTextValue(opts.address);
    const localityLine = [toTextValue(opts.city), toTextValue(opts.state), toTextValue(opts.zip)].filter(Boolean).join(", ").replace(", ,", ",");

    if (addressLine) params.set("address1", addressLine);
    if (localityLine) {
      params.set("address2", localityLine.replace(/, ([A-Z]{2}), (\d{5}(?:-\d{4})?)/, ", $1 $2"));
    }
  }

  if (![...params.keys()].some((key) => key !== "page" && key !== "pagesize")) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_SOURCE_TIMEOUT);

  try {
    const response = await fetch(
      `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detailmortgageowner?${params.toString()}`,
      {
        headers: {
          apikey: attomApiKey,
          Accept: "application/json",
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`ATTOM owner/mortgage error ${response.status}: ${body.slice(0, 500)}`);
    }

    const data = await response.json() as Record<string, unknown>;
    const properties = toRecordArray(data.property).length > 0
      ? toRecordArray(data.property)
      : toRecordArray(data.properties);

    if (properties.length === 0) return null;
    return normalizeOwnerMortgageProperty(properties[0]);
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Opportunity classification ───────────────────────────────────────────────

function classifyOpportunity(opts: {
  loanAmount: number;
  estimatedValue: number;
  equityPct: number;
  distressTypes: string[];
}): string {
  const { loanAmount, estimatedValue, equityPct, distressTypes } = opts;
  const ltv = loanAmount > 0 && estimatedValue > 0 ? loanAmount / estimatedValue : 0;
  if (ltv > 1.0) return "short_sale";
  if (distressTypes.some(t => t.includes("foreclosure")) && equityPct > 0) return "pre_foreclosure";
  if (distressTypes.some(t => t.includes("tax_lien") || t === "tax_lien") && equityPct > 30) return "tax_lien_buyout";
  if (distressTypes.some(t => t.includes("divorce") || t.includes("probate"))) return "probate_estate";
  if (equityPct > 40 && distressTypes.length > 0) return "equity_rich_distressed";
  return "distressed";
}

function buildOpportunityContext(opportunityType: string, loanAmount: number, estimatedValue: number): string {
  if (opportunityType === "short_sale" && loanAmount > 0 && estimatedValue > 0) {
    const overage = loanAmount - estimatedValue;
    const ltv = Math.round(loanAmount / estimatedValue * 100);
    return `SHORT SALE OPPORTUNITY: Mortgage $${loanAmount.toLocaleString()} exceeds AVM $${estimatedValue.toLocaleString()} by $${overage.toLocaleString()} (LTV ${ltv}%). Analyze lender discount likelihood (lenders typically accept 75-85% of AVM to avoid $20-30K foreclosure costs), comp support at 70-75% AVM, timeline risk, and net acquisition cost. Short sales can be Strong Deals if acquired at deep enough discount.`;
  }
  if (opportunityType === "pre_foreclosure") return "PRE-FORECLOSURE: Owner has financial incentive to sell before auction. Analyze timeline pressure and acquisition discount potential.";
  if (opportunityType === "tax_lien_buyout") return "TAX LIEN BUYOUT: Strong equity (>30%) with tax lien distress. Investor can satisfy lien and acquire at deep discount.";
  if (opportunityType === "probate_estate") return "PROBATE/DIVORCE DISTRESS: Family/estate may prioritize speed over maximum price. Analyze motivation and typical timeline for this distress type.";
  if (opportunityType === "equity_rich_distressed") return "EQUITY-RICH DISTRESSED SELLER (>40% equity): Strong motivation plus significant equity — ideal acquisition scenario for cash buyers.";
  return "";
}

// ─── Auto-trace Strong Deals in background ───────────────────────────────────

const TRACERFY_LOOKUP_URL = "https://tracerfy.com/v1/api/trace/lookup/";

const toTracerfyRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const toTracerfyArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item))
    : [];

const flattenTracerfyPhones = (persons: Record<string, unknown>[]) => {
  const seen = new Set<string>();

  return persons.flatMap((person) =>
    toTracerfyArray(person.phones).flatMap((phone) => {
      const number = String(phone.number ?? "").trim();
      if (!number || seen.has(number)) return [];
      seen.add(number);
      return [{
        number,
        type: String(phone.type ?? "").trim() || undefined,
        rank: typeof phone.rank === "number" ? phone.rank : undefined,
        dnc: typeof phone.dnc === "boolean" ? phone.dnc : undefined,
        carrier: String(phone.carrier ?? "").trim() || undefined,
      }];
    })
  );
};

const flattenTracerfyEmails = (persons: Record<string, unknown>[]) => {
  const seen = new Set<string>();

  return persons.flatMap((person) =>
    toTracerfyArray(person.emails).flatMap((email) => {
      const address = String(email.email ?? email.address ?? "").trim().toLowerCase();
      if (!address || seen.has(address)) return [];
      seen.add(address);
      return [{
        address,
        rank: typeof email.rank === "number" ? email.rank : undefined,
      }];
    })
  );
};

const mapTracerfyLookup = (payload: Record<string, unknown>, fallbackOwnerName: string) => {
  const persons = toTracerfyArray(payload.persons);
  const owner =
    persons.find((person) => person.property_owner === true) ??
    persons[0] ??
    {};
  const splitName = [owner.first_name, owner.last_name]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ");
  const splitNameCandidate = splitName || undefined;
  const payloadName = typeof payload.name === "string" ? payload.name : undefined;
  const ownerFullName = typeof owner.full_name === "string" ? owner.full_name : undefined;

  return {
    ownerName: String(ownerFullName ?? splitNameCandidate ?? payloadName ?? fallbackOwnerName).trim() || null,
    phones: flattenTracerfyPhones(persons),
    emails: flattenTracerfyEmails(persons),
    mailingAddress: toTracerfyRecord(owner.mailing_address ?? owner.mailingAddress),
  };
};

async function autoTraceStrongDeal(
  supabase: ReturnType<typeof createClient>,
  property: Record<string, unknown>,
  verdict: string,
): Promise<void> {
  if (verdict !== "Strong Deal") return;
  const tracerfyKey = Deno.env.get("TRACERFY_API_KEY");
  if (!tracerfyKey) return;

  const propertyId = property.id as string;
  const userId = property.user_id as string;
  if (!propertyId || !userId) return;

  try {
    const { data: existing } = await supabase
      .from("owner_contacts")
      .select("id")
      .eq("property_id", propertyId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) return;

    const dd = (property.distress_details as Record<string, unknown>) ?? {};
    const ownerName = String((dd.ownerName ?? dd.owner_name) ?? "");

    const tracerfyResp = await fetch(TRACERFY_LOOKUP_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${tracerfyKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        address: property.address,
        city: property.city,
        state: property.state,
        zip: property.zip,
        find_owner: true,
      }),
    });

    if (!tracerfyResp.ok) {
      const body = await tracerfyResp.text().catch(() => "");
      throw new Error(`Tracerfy ${tracerfyResp.status}: ${body.slice(0, 200)}`);
    }

    const td = await tracerfyResp.json() as Record<string, unknown>;
    const contact = mapTracerfyLookup(td, ownerName);
    await supabase.from("owner_contacts").insert({
      property_id: propertyId,
      user_id: userId,
      owner_name: contact.ownerName,
      phones: contact.phones,
      emails: contact.emails,
      mailing_address: contact.mailingAddress,
      skip_trace_source: "auto_tracerfy",
      traced_at: new Date().toISOString(),
    });
    console.log(`[run-deal-analyze] Auto-traced Strong Deal ${propertyId}`);
  } catch (err) {
    console.error(`[run-deal-analyze] autoTraceStrongDeal failed for ${propertyId}:`, err);
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { propertyId } = await req.json();
    if (!propertyId) {
      return new Response(JSON.stringify({ error: "propertyId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the property row
    const { data: property, error: fetchError } = await supabase
      .from("properties")
      .select("*")
      .eq("id", propertyId)
      .single();

    if (fetchError || !property) {
      return new Response(JSON.stringify({ error: "Property not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[run-deal-analyze] Analyzing property ${propertyId}: ${property.address}`);

    const zip = property.zip ?? "";
    const city = property.city ?? "";
    const state = property.state ?? "";
    const address = property.address ?? "";
    const baseDistressDetails = toRecord(property.distress_details);

    const pipelineMetrics: Record<string, { status: string; durationMs: number; error?: string }> = {};
    const currentYear = new Date().getFullYear();
    const attomId = (property.attom_id as string | null) ?? null;

    const emptyHistoryResult = { result: [] as Array<Record<string, unknown>>, status: "skip", durationMs: 0 };
    const ownerMortgageResult = await safeCall(
      () => fetchAttomOwnerMortgageDetails({ attomId, address, city, state, zip }),
      "owner_mortgage_details",
      null,
    );
    pipelineMetrics.owner_mortgage_details = {
      status: ownerMortgageResult.status,
      durationMs: ownerMortgageResult.durationMs,
      error: ownerMortgageResult.error,
    };

    const existingMortgage = toRecord(baseDistressDetails.mortgage);
    const existingAvmRange = toRecord(baseDistressDetails.avmRange);
    const existingDebtStatus = toRecord(baseDistressDetails.debtStatus);
    const mortgageLoanAmount = ownerMortgageResult.result?.mortgageLoanAmount ?? toNumber(existingMortgage.loanAmount);
    const mortgageLenderName = ownerMortgageResult.result?.mortgageLenderName ?? toTextValue(existingMortgage.lenderName);
    const mortgageLoanType = ownerMortgageResult.result?.mortgageLoanType ?? toTextValue(existingMortgage.loanType);
    const ownerName = ownerMortgageResult.result?.ownerName
      ?? toTextValue(baseDistressDetails.ownerName, baseDistressDetails.owner_name);
    const ownerMailingAddress = ownerMortgageResult.result?.ownerMailingAddress
      ?? toTextValue(baseDistressDetails.ownerMailingAddress);
    const avmHigh = toNumber(existingAvmRange.high);
    const avmLow = toNumber(existingAvmRange.low);
    const avmMidpoint = avmLow !== null && avmHigh !== null ? Math.round((avmLow + avmHigh) / 2) : null;
    const estimatedValue = (() => {
      const currentEstimatedValue = toNumber(property.estimated_value);
      if (currentEstimatedValue !== null && currentEstimatedValue >= 1000) {
        return currentEstimatedValue;
      }
      return avmMidpoint ?? currentEstimatedValue;
    })();
    const refreshedEquityPct = mortgageLoanAmount !== null
      ? computeEquityPct(estimatedValue, mortgageLoanAmount)
      : (typeof property.equity_pct === "number" ? property.equity_pct : null);
    const baseDistressDetailsWithOwner = {
      ...baseDistressDetails,
      ownerName,
      ownerMailingAddress,
      mortgage: {
        ...existingMortgage,
        loanAmount: mortgageLoanAmount,
        lenderName: mortgageLenderName,
        loanType: mortgageLoanType,
      },
    };

    // ── Run all Layer 2 intelligence calls in parallel ──────────────────────
    const [
      marketHeatResult,
      neighborhoodResult,
      ownerResearchResult,
      dealKillersResult,
      publicRecordsResult,
      marketNarrativeResult,
      zillowResult,
      saleHistoryResult,
      assessmentHistoryResult,
      debtStatusResult,
    ] = await Promise.all([
      safeCall(() => fetchMarketHeat(zip, city), "market_heat", { motivatedSellerVolume: null, investorCompetitionCpc: null, signal: "Unknown" }),
      safeCall(() => fetchNeighborhoodSentiment(city, state, zip), "neighborhood_sentiment", { snippets: [], sentiment: "Unknown" }),
      safeCall(() => fetchOwnerResearch(ownerName, address, city), "owner_research", { courtRecords: [], distressConfirmed: false, isBusinessEntity: false }),
      safeCall(() => fetchDealKillers(address, city, state), "deal_killers", { floodZone: false, environmental: false, killSignals: [] }),
      safeCall(() => fetchPublicRecordsConfirm(address, ownerName, city, currentYear), "public_records", { lisPendensConfirmed: false, taxLienConfirmed: false, snippets: [] }),
      safeCall(() => fetchMarketNarrative(zip, city, state), "market_narrative", ""),
      safeCall(() => fetchZillowData(address, city, state), "zillow", { photos: [], listingHistory: [] }),
      attomId ? safeCall(() => fetchAttomSaleHistory(attomId), "sale_history", []) : Promise.resolve(emptyHistoryResult),
      attomId ? safeCall(() => fetchAttomAssessmentHistory(attomId), "assessment_history", []) : Promise.resolve(emptyHistoryResult),
      attomId ? safeCall(() => fetchAttomDebtStatus(attomId, mortgageLoanAmount), "debt_status", null) : Promise.resolve({ result: null as AttomDebtStatus | null, status: "skip", durationMs: 0 }),
    ]);

    // Record metrics
    pipelineMetrics.market_heat = { status: marketHeatResult.status, durationMs: marketHeatResult.durationMs, error: marketHeatResult.error };
    pipelineMetrics.neighborhood_sentiment = { status: neighborhoodResult.status, durationMs: neighborhoodResult.durationMs, error: neighborhoodResult.error };
    pipelineMetrics.owner_research = { status: ownerResearchResult.status, durationMs: ownerResearchResult.durationMs, error: ownerResearchResult.error };
    pipelineMetrics.deal_killers = { status: dealKillersResult.status, durationMs: dealKillersResult.durationMs, error: dealKillersResult.error };
    pipelineMetrics.public_records = { status: publicRecordsResult.status, durationMs: publicRecordsResult.durationMs, error: publicRecordsResult.error };
    pipelineMetrics.market_narrative = { status: marketNarrativeResult.status, durationMs: marketNarrativeResult.durationMs, error: marketNarrativeResult.error };
    pipelineMetrics.zillow = { status: zillowResult.status, durationMs: zillowResult.durationMs, error: zillowResult.error };
    if (attomId) {
      pipelineMetrics.sale_history = { status: saleHistoryResult.status, durationMs: saleHistoryResult.durationMs };
      pipelineMetrics.assessment_history = { status: assessmentHistoryResult.status, durationMs: assessmentHistoryResult.durationMs };
      pipelineMetrics.debt_status = { status: debtStatusResult.status, durationMs: debtStatusResult.durationMs, error: debtStatusResult.error };
    }

    const intelligence = {
      marketHeat: marketHeatResult.result,
      neighborhoodSentiment: neighborhoodResult.result,
      ownerResearch: ownerResearchResult.result,
      dealKillers: dealKillersResult.result,
      publicRecordsConfirm: publicRecordsResult.result,
      marketNarrative: marketNarrativeResult.result,
    };
    const normalizedSalesHistory = saleHistoryResult.result.length > 0
      ? saleHistoryResult.result
      : buildFallbackSaleHistory(property);
    const normalizedAssessmentHistory = assessmentHistoryResult.result.length > 0
      ? assessmentHistoryResult.result
      : buildFallbackAssessmentHistory(property);
    const mergedDebtStatus = debtStatusResult.result
      ? {
          statusLabel: debtStatusResult.result.statusLabel ?? toTextValue(existingDebtStatus.statusLabel),
          delinquentAmount: debtStatusResult.result.delinquentAmount ?? toNumber(existingDebtStatus.delinquentAmount),
          taxLienAmount: debtStatusResult.result.taxLienAmount ?? toNumber(existingDebtStatus.taxLienAmount),
          openingBidAmount: debtStatusResult.result.openingBidAmount ?? toNumber(existingDebtStatus.openingBidAmount, existingDebtStatus.bidAmount),
          auctionDate: debtStatusResult.result.auctionDate ?? toTextValue(existingDebtStatus.auctionDate, existingDebtStatus.auctionDateTime),
          defaultDate: debtStatusResult.result.defaultDate ?? toTextValue(existingDebtStatus.defaultDate),
          recordingDate: debtStatusResult.result.recordingDate ?? toTextValue(existingDebtStatus.recordingDate, existingDebtStatus.filingDate),
          originalLoanDate: debtStatusResult.result.originalLoanDate ?? toTextValue(existingDebtStatus.originalLoanDate),
          taxDelinquentYear: debtStatusResult.result.taxDelinquentYear ?? toNumber(existingDebtStatus.taxDelinquentYear),
          estimatedMissedPayments: debtStatusResult.result.estimatedMissedPayments ?? toNumber(existingDebtStatus.estimatedMissedPayments),
          estimatedMonthlyPayment: debtStatusResult.result.estimatedMonthlyPayment ?? toNumber(existingDebtStatus.estimatedMonthlyPayment),
          estimateBasis: debtStatusResult.result.estimateBasis ?? toTextValue(existingDebtStatus.estimateBasis),
          sourceEventType: debtStatusResult.result.sourceEventType ?? toTextValue(existingDebtStatus.sourceEventType),
        }
      : (Object.keys(existingDebtStatus).length > 0 ? existingDebtStatus : null);
    const distressDetails = {
      ...baseDistressDetailsWithOwner,
      ...(mergedDebtStatus ? { debtStatus: mergedDebtStatus } : {}),
    };
    const propertyForAnalysis = {
      ...property,
      estimated_value: estimatedValue,
      distress_details: distressDetails,
      equity_pct: refreshedEquityPct,
    };

    // ?? Classify opportunity type (deterministic, before GPT) ???????????????
    const dd = toRecord(distressDetails);
    const mtg = toRecord(dd.mortgage);
    const loanAmt = typeof mtg.loanAmount === "number" ? mtg.loanAmount : 0;
    const estValue = typeof estimatedValue === "number" ? estimatedValue : 0;
    const equityPct = typeof refreshedEquityPct === "number" ? refreshedEquityPct : 0;
    const distressTypes = (property.distress_types as string[]) ?? [];
    const opportunityType = classifyOpportunity({ loanAmount: loanAmt, estimatedValue: estValue, equityPct, distressTypes });
    const opportunityContext = buildOpportunityContext(opportunityType, loanAmt, estValue);

    // ?? Adversarial kill pass (parallel with Layer 2, using deal killer signals) ??
    const adversarialResult = await safeCall(
      () => runAdversarialPass(propertyForAnalysis, dealKillersResult.result, refreshedEquityPct),
      "adversarial_pass",
      []
    );
    pipelineMetrics.adversarial_pass = { status: adversarialResult.status, durationMs: adversarialResult.durationMs, error: adversarialResult.error };
    const hardKillSignals = adversarialResult.result;

    // ── Check if hard kills force "Pass" before calling Claude ──────────────
    const hardKills = hardKillSignals.filter((k) => k.severity === "Hard");
    let finalVerdict: "Strong Deal" | "Investigate" | "Pass" = "Investigate";
    let finalScore = 50;
    let claudeResult: Awaited<ReturnType<typeof scoreDealWithGPT>> | null = null;

    if (hardKills.length >= 2) {
      // Skip Claude — deterministically fail
      finalVerdict = "Pass";
      finalScore = 20;
    } else {
      // ── Main GPT-4o scoring ──────────────────────────────────────────────
      const claudeCall = await safeCall(
        () => scoreDealWithGPT(
          propertyForAnalysis,
          intelligence,
          hardKillSignals,
          opportunityType,
          opportunityContext,
          {
            sales: normalizedSalesHistory,
            assessments: normalizedAssessmentHistory,
            listing: zillowResult.result.listingHistory,
          },
        ),
        "gpt_scoring",
        null
      );
      pipelineMetrics.gpt_scoring = { status: claudeCall.status, durationMs: claudeCall.durationMs, error: claudeCall.error };

      if (claudeCall.result) {
        claudeResult = claudeCall.result;
        const adjusted = applyKillSignals(claudeResult.deal_verdict, claudeResult.deal_score, hardKillSignals);
        finalVerdict = adjusted.verdict;
        finalScore = adjusted.score;
      }
    }

    // ── Assemble report_data ─────────────────────────────────────────────────
    const reportData = {
      deal_score: finalScore,
      deal_verdict: finalVerdict,
      score_rationale: claudeResult?.score_rationale ?? (hardKills.length >= 2 ? `Forced Pass: ${hardKills.map((k) => k.type).join(", ")}` : "Analysis unavailable"),
      distress_analysis: claudeResult?.distress_analysis ?? "",
      equity_assessment: claudeResult?.equity_assessment ?? "",
      market_heat_assessment: claudeResult?.market_heat_assessment ?? "",
      history_summary: claudeResult?.history_summary ?? "",
      urgency_summary: claudeResult?.urgency_summary ?? "",
      next_step: claudeResult?.next_step ?? "",
      risks: claudeResult?.risks ?? hardKills.map((k) => k.evidence),
      opportunities: claudeResult?.opportunities ?? [],
      opportunity_type: opportunityType,
      opportunity_analysis: claudeResult?.opportunity_analysis ?? null,
      hardKillSignals,
      intelligence,
      photos: zillowResult.result.photos,
      history: {
        sales: normalizedSalesHistory,
        assessments: normalizedAssessmentHistory,
        listing: zillowResult.result.listingHistory,
      },
      pipelineMetrics: { sources: pipelineMetrics },
    };

    // ── Update the property row ──────────────────────────────────────────────
    const { error: updateError } = await supabase
      .from("properties")
      .update({
        deal_score: finalScore,
        deal_verdict: finalVerdict,
        estimated_value: estimatedValue,
        distress_details: distressDetails,
        equity_pct: refreshedEquityPct,
        report_data: reportData,
        status: "complete",
      })
      .eq("id", propertyId);

    if (updateError) {
      console.error(`[run-deal-analyze] Update failed for ${propertyId}:`, updateError);
      return new Response(JSON.stringify({ error: "DB update failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[run-deal-analyze] Done: ${property.address} → ${finalVerdict} (${finalScore})`);

    // Fire auto-trace for Strong Deals in background (no credit deduction)
    const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime;
    if (edgeRuntime?.waitUntil) {
      edgeRuntime.waitUntil(autoTraceStrongDeal(supabase, propertyForAnalysis, finalVerdict));
    } else {
      autoTraceStrongDeal(supabase, propertyForAnalysis, finalVerdict).catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true, deal_score: finalScore, deal_verdict: finalVerdict }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[run-deal-analyze] Unhandled error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
