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

  const floodZone = floodResults.some((r) => {
    const text = `${r.title} ${r.snippet}`.toLowerCase();
    return text.includes("flood zone") || text.includes("fema") || text.includes("floodplain");
  });

  const environmental = envResults.some((r) => {
    const text = `${r.title} ${r.snippet}`.toLowerCase();
    return text.includes("superfund") || text.includes("contamination") || text.includes("hazardous");
  });

  if (floodZone) {
    const evidence = floodResults.find((r) => `${r.title} ${r.snippet}`.toLowerCase().includes("flood zone"));
    killSignals.push({ type: "flood_zone", evidence: evidence?.snippet ?? "Flood zone reference found" });
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
): Promise<{
  deal_score: number;
  deal_verdict: "Strong Deal" | "Investigate" | "Pass";
  score_rationale: string;
  distress_analysis: string;
  equity_assessment: string;
  market_heat_assessment: string;
  risks: string[];
  opportunities: string[];
}> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) throw new Error("OPENAI_API_KEY not set");

  const marketHeat = intelligence.marketHeat as Record<string, unknown> ?? {};
  const neighborhoodSentiment = intelligence.neighborhoodSentiment as Record<string, unknown> ?? {};
  const ownerResearch = intelligence.ownerResearch as Record<string, unknown> ?? {};
  const publicRecords = intelligence.publicRecordsConfirm as Record<string, unknown> ?? {};

  const systemPrompt = `You are a professional real estate investment analyst. Score distressed properties as deal opportunities using all provided data. Return only valid JSON.`;

  const userPrompt = `Score this distressed property as a deal opportunity using ALL provided data.

## Property Data (ATTOM — Layer 1, verified)
Address: ${property.address}, ${property.city}, ${property.state} ${property.zip}
Type: ${property.property_type ?? "Unknown"}, ${property.beds ?? "?"}bd/${property.baths ?? "?"}ba, ${property.sqft ?? "?"}sqft
Estimated Value: $${property.estimated_value ?? "Unknown"}
Last Sale: $${property.last_sale_price ?? "Unknown"} (${property.last_sale_date ?? "Unknown"})
Equity Position: ${property.equity_pct !== null && property.equity_pct !== undefined ? `${property.equity_pct}%` : "Unknown"}
Distress Types: ${(property.distress_types as string[])?.join(", ") ?? "None identified"}
Distress Details: ${JSON.stringify(property.distress_details)}

## Intelligence Data (Layer 2)
Market Heat (${property.zip}): Motivated seller search volume = ${marketHeat.motivatedSellerVolume ?? "N/A"}/mo, Investor competition CPC = $${marketHeat.investorCompetitionCpc ?? "N/A"}, Signal = ${marketHeat.signal ?? "Unknown"}
Neighborhood Sentiment: ${neighborhoodSentiment.sentiment ?? "Unknown"} — ${(neighborhoodSentiment.snippets as Array<{ snippet: string }> ?? []).slice(0, 2).map((s) => s.snippet).join("; ")}
Owner Research: Business entity = ${ownerResearch.isBusinessEntity ? "Yes" : "No"}, Distress confirmed in public records = ${ownerResearch.distressConfirmed ? "Yes" : "No"}
Public Records: Lis pendens confirmed = ${publicRecords.lisPendensConfirmed ? "Yes" : "No"}, Tax lien confirmed = ${publicRecords.taxLienConfirmed ? "Yes" : "No"}
Market Narrative: ${intelligence.marketNarrative ?? "Not available"}

## Deal Killer Signals (pre-scored)
${hardKillSignals.length === 0 ? "None identified" : hardKillSignals.map((k) => `- ${k.type} (${k.severity}): ${k.evidence}`).join("\n")}

## Scoring Instructions
Score 0-100 based on:
- Equity position (higher equity = stronger deal)
- Distress signal quality (verified by public records = stronger)
- Market heat (high motivated-seller volume, low investor competition = stronger)
- Neighborhood trajectory
- Number and severity of kill signals

Thresholds: ≥70 = Strong Deal, 40-69 = Investigate, <40 = Pass

Return ONLY valid JSON:
{
  "deal_score": <0-100>,
  "deal_verdict": "Strong Deal|Investigate|Pass",
  "score_rationale": "<2-3 sentences citing specific evidence from the data above>",
  "distress_analysis": "<assessment of each distress signal with ATTOM verification status>",
  "equity_assessment": "<ARV potential, lien burden analysis, equity position>",
  "market_heat_assessment": "<motivated seller supply vs investor competition for this market>",
  "risks": ["<specific risk with evidence>"],
  "opportunities": ["<specific opportunity with evidence>"]
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

// ─── Fetch property photos via Firecrawl ─────────────────────────────────────

async function fetchPropertyPhotos(address: string, city: string, state: string): Promise<string[]> {
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!firecrawlKey) return [];

  // First use Serper to find the Zillow URL
  const serperKey = Deno.env.get("SERPER_API_KEY");
  if (!serperKey) return [];

  try {
    const searchResp = await withTimeout(
      fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: `site:zillow.com "${address}" ${city} ${state}`, num: 3 }),
      }),
      DEFAULT_SOURCE_TIMEOUT,
      "Serper Zillow URL search"
    );

    if (!searchResp.ok) return [];
    const searchData = await searchResp.json();
    const zillowUrl = (searchData.organic?.[0]?.link as string) ?? "";
    if (!zillowUrl || !zillowUrl.includes("zillow.com")) return [];

    // Scrape the Zillow page for photos
    const scrapeResp = await withTimeout(
      fetch("https://api.firecrawl.dev/v0/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${firecrawlKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: zillowUrl, pageOptions: { screenshot: false } }),
      }),
      15000,
      "Firecrawl Zillow scrape"
    );

    if (!scrapeResp.ok) return [];
    const scrapeData = await scrapeResp.json();
    const markdown = (scrapeData.data?.markdown as string) ?? "";

    // Extract image URLs from markdown
    const imgMatches = markdown.matchAll(/!\[.*?\]\((https:\/\/.*?\.(?:jpg|jpeg|png|webp).*?)\)/gi);
    const photos: string[] = [];
    for (const match of imgMatches) {
      if (photos.length >= 10) break;
      photos.push(match[1]);
    }
    return photos;
  } catch (err) {
    console.warn("[run-deal-analyze] Photo fetch failed:", err);
    return [];
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
    const ownerName = (property.distress_details as Record<string, unknown>)?.ownerName as string | null ?? null;

    const pipelineMetrics: Record<string, { status: string; durationMs: number; error?: string }> = {};
    const currentYear = new Date().getFullYear();

    // ── Run all Layer 2 intelligence calls in parallel ──────────────────────
    const [
      marketHeatResult,
      neighborhoodResult,
      ownerResearchResult,
      dealKillersResult,
      publicRecordsResult,
      marketNarrativeResult,
      photosResult,
    ] = await Promise.all([
      safeCall(() => fetchMarketHeat(zip, city), "market_heat", { motivatedSellerVolume: null, investorCompetitionCpc: null, signal: "Unknown" }),
      safeCall(() => fetchNeighborhoodSentiment(city, state, zip), "neighborhood_sentiment", { snippets: [], sentiment: "Unknown" }),
      safeCall(() => fetchOwnerResearch(ownerName, address, city), "owner_research", { courtRecords: [], distressConfirmed: false, isBusinessEntity: false }),
      safeCall(() => fetchDealKillers(address, city, state), "deal_killers", { floodZone: false, environmental: false, killSignals: [] }),
      safeCall(() => fetchPublicRecordsConfirm(address, ownerName, city, currentYear), "public_records", { lisPendensConfirmed: false, taxLienConfirmed: false, snippets: [] }),
      safeCall(() => fetchMarketNarrative(zip, city, state), "market_narrative", ""),
      safeCall(() => fetchPropertyPhotos(address, city, state), "photos", []),
    ]);

    // Record metrics
    pipelineMetrics.market_heat = { status: marketHeatResult.status, durationMs: marketHeatResult.durationMs, error: marketHeatResult.error };
    pipelineMetrics.neighborhood_sentiment = { status: neighborhoodResult.status, durationMs: neighborhoodResult.durationMs, error: neighborhoodResult.error };
    pipelineMetrics.owner_research = { status: ownerResearchResult.status, durationMs: ownerResearchResult.durationMs, error: ownerResearchResult.error };
    pipelineMetrics.deal_killers = { status: dealKillersResult.status, durationMs: dealKillersResult.durationMs, error: dealKillersResult.error };
    pipelineMetrics.public_records = { status: publicRecordsResult.status, durationMs: publicRecordsResult.durationMs, error: publicRecordsResult.error };
    pipelineMetrics.market_narrative = { status: marketNarrativeResult.status, durationMs: marketNarrativeResult.durationMs, error: marketNarrativeResult.error };
    pipelineMetrics.photos = { status: photosResult.status, durationMs: photosResult.durationMs, error: photosResult.error };

    const intelligence = {
      marketHeat: marketHeatResult.result,
      neighborhoodSentiment: neighborhoodResult.result,
      ownerResearch: ownerResearchResult.result,
      dealKillers: dealKillersResult.result,
      publicRecordsConfirm: publicRecordsResult.result,
      marketNarrative: marketNarrativeResult.result,
    };

    // ── Adversarial kill pass (parallel with Layer 2, using deal killer signals) ──
    const adversarialResult = await safeCall(
      () => runAdversarialPass(property, dealKillersResult.result, property.equity_pct),
      "adversarial_pass",
      []
    );
    pipelineMetrics.adversarial_pass = { status: adversarialResult.status, durationMs: adversarialResult.durationMs, error: adversarialResult.error };
    const hardKillSignals = adversarialResult.result;

    // ── Check if hard kills force "Pass" before calling Claude ──────────────
    const hardKills = hardKillSignals.filter((k) => k.severity === "Hard");
    let finalVerdict: "Strong Deal" | "Investigate" | "Pass" = "Investigate";
    let finalScore = 50;
    let claudeResult: Awaited<ReturnType<typeof scoreDealWithClaude>> | null = null;

    if (hardKills.length >= 2) {
      // Skip Claude — deterministically fail
      finalVerdict = "Pass";
      finalScore = 20;
    } else {
      // ── Main GPT-4o scoring ──────────────────────────────────────────────
      const claudeCall = await safeCall(
        () => scoreDealWithGPT(property, intelligence, hardKillSignals),
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
      risks: claudeResult?.risks ?? hardKills.map((k) => k.evidence),
      opportunities: claudeResult?.opportunities ?? [],
      hardKillSignals,
      intelligence,
      photos: photosResult.result,
      pipelineMetrics: { sources: pipelineMetrics },
    };

    // ── Update the property row ──────────────────────────────────────────────
    const { error: updateError } = await supabase
      .from("properties")
      .update({
        deal_score: finalScore,
        deal_verdict: finalVerdict,
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
