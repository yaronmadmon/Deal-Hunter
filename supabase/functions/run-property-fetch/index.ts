import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_SOURCE_TIMEOUT = 20000;

type SearchMode = "market" | "property";

interface SearchFilters {
  searchMode: SearchMode;
  location: string;
  distressTypes: string[];
  priceMin?: number;
  priceMax?: number;
  propertyTypes?: string[];
  equityMin?: number;
}

type InsertedProperty = {
  id: string;
  zip: string;
  city: string;
  state: string;
  distress_types: string[];
  estimated_value: number | null;
  equity_pct: number | null;
  deal_score: number | null;
  deal_verdict: string | null;
  address: string;
};

const ZIP_CODE_REGEX = /^\d{5}(?:-\d{4})?$/;
const STREET_HINTS = [
  " st",
  " street",
  " ave",
  " avenue",
  " rd",
  " road",
  " dr",
  " drive",
  " ln",
  " lane",
  " ct",
  " court",
  " blvd",
  " boulevard",
  " cir",
  " circle",
  " hwy",
  " highway",
  " pkwy",
  " parkway",
  " pl",
  " place",
  " ter",
  " terrace",
  " way",
];

const inferSearchMode = (location: string): SearchMode => {
  const query = location.trim().toLowerCase();
  if (!query || ZIP_CODE_REGEX.test(query)) return "market";

  const hasNumber = /\d/.test(query);
  const hasLetter = /[a-z]/.test(query);
  const hasStreetHint = STREET_HINTS.some((token) => query.includes(token)) || query.includes(",");

  return hasNumber && hasLetter && hasStreetHint ? "property" : "market";
};

const normalizeFilters = (raw: Record<string, unknown>): SearchFilters => {
  const location = typeof raw.location === "string" ? raw.location.trim() : "";

  return {
    searchMode: inferSearchMode(location),
    location,
    distressTypes: Array.isArray(raw.distressTypes)
      ? raw.distressTypes.filter((value): value is string => typeof value === "string")
      : [],
    priceMin: typeof raw.priceMin === "number" ? raw.priceMin : undefined,
    priceMax: typeof raw.priceMax === "number" ? raw.priceMax : undefined,
    propertyTypes: Array.isArray(raw.propertyTypes)
      ? raw.propertyTypes.filter((value): value is string => typeof value === "string")
      : undefined,
    equityMin: typeof raw.equityMin === "number" ? raw.equityMin : undefined,
  };
};

const normalizeText = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const toText = (...values: unknown[]): string | null => {
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

const getLotSizeSqft = (size: Record<string, unknown>) => {
  const lotSizeSqft = toNumber(
    size.lotSizeSqFt,
    size.lotsizesqft,
    size.lotSizeSqft,
    size.lotsize1,
    size.lotSize1,
    size.lotsize,
    size.lotSize,
  );

  if (lotSizeSqft !== null) return lotSizeSqft;

  const lotSizeAcres = toNumber(
    size.lotSizeAcres,
    size.lotsizeacres,
    size.lotacres,
    size.lotAcres,
  );

  return lotSizeAcres !== null ? Math.round(lotSizeAcres * 43560) : null;
};

type AttomOwnerMortgageDetails = {
  attomId: string;
  ownerName: string | null;
  ownerMailingAddress: string | null;
  mortgageLoanAmount: number | null;
  mortgageLenderName: string | null;
  mortgageLoanType: string | null;
  deedBuyerName: string | null;
  deedSellerName: string | null;
  rawDeed: Record<string, unknown> | null;
};

const buildOwnerDisplayName = (ownerRecord: Record<string, unknown>) => {
  const owner1 = toRecord(ownerRecord.owner1);
  const owner2 = toRecord(ownerRecord.owner2);
  const firstOwner = [
    toText(owner1.firstnameandmi, owner1.firstNameAndMi, owner1.firstname, owner1.firstName),
    toText(owner1.lastname, owner1.lastName),
  ].filter(Boolean).join(" ").trim();
  const secondOwner = [
    toText(owner2.firstnameandmi, owner2.firstNameAndMi, owner2.firstname, owner2.firstName),
    toText(owner2.lastname, owner2.lastName),
  ].filter(Boolean).join(" ").trim();

  return toText(
    firstOwner && secondOwner ? `${firstOwner} & ${secondOwner}` : firstOwner || secondOwner,
    ownerRecord.name1full,
    ownerRecord.ownerName,
  );
};

const buildPartyDisplayName = (partyRecord: Record<string, unknown>) => {
  const party1 = toRecord(partyRecord.party1);
  const party2 = toRecord(partyRecord.party2);
  const firstParty = [
    toText(party1.firstnameandmi, party1.firstNameAndMi, party1.firstname, party1.firstName),
    toText(party1.lastname, party1.lastName),
  ].filter(Boolean).join(" ").trim();
  const secondParty = [
    toText(party2.firstnameandmi, party2.firstNameAndMi, party2.firstname, party2.firstName),
    toText(party2.lastname, party2.lastName),
  ].filter(Boolean).join(" ").trim();

  return toText(
    firstParty && secondParty ? `${firstParty} & ${secondParty}` : firstParty || secondParty,
    partyRecord.name1full,
    partyRecord.name,
    partyRecord.ownerName,
  );
};

const normalizeOwnerMortgageProperty = (attomProp: Record<string, unknown>): AttomOwnerMortgageDetails => {
  const identifier = toRecord(attomProp.identifier);
  const owner = toRecord(attomProp.owner);
  const mortgage = toRecord(attomProp.mortgage);
  const lender = toRecord(mortgage.lender);
  const deed = toRecord(attomProp.deed);
  const deedBuyer = toRecord(deed.buyer);
  const deedSeller = toRecord(deed.seller);

  const lenderName = toText(
    [toText(lender.firstname, lender.firstName), toText(lender.lastname, lender.lastName)].filter(Boolean).join(" ").trim(),
    lender.companyname,
    lender.companyName,
    lender.name,
  );

  return {
    attomId: String(identifier.attomId ?? identifier.Id ?? attomProp.id ?? ""),
    ownerName: buildOwnerDisplayName(owner),
    ownerMailingAddress: toText(owner.mailingaddressoneline, owner.mailingAddressOneLine),
    mortgageLoanAmount: toNumber(mortgage.amount, toRecord(mortgage.amount).loanamt, toRecord(mortgage.amount).amount),
    mortgageLenderName: lenderName,
    mortgageLoanType: toText(mortgage.loantypecode, mortgage.loanTypeCode, mortgage.deedtype, mortgage.deedType, mortgage.interestratetype, mortgage.interestRateType),
    deedBuyerName: buildPartyDisplayName(deedBuyer),
    deedSellerName: buildPartyDisplayName(deedSeller),
    rawDeed: Object.keys(deed).length > 0 ? deed : null,
  };
};

function mapAttomDistressType(eventType: string): string | null {
  const type = (eventType || "").toUpperCase();
  if (type.includes("TAXLIEN") || type.includes("TAX_LIEN") || type.includes("DELINQUENT")) return "tax_lien";
  if (type.includes("FORECLOSURE") || type.includes("LISPENDENS") || type.includes("LIS_PENDENS") || type.includes("NOTICE_OF_DEFAULT") || type.includes("NOD")) return "foreclosure";
  if (type.includes("DIVORCE") || type.includes("PROBATE") || type.includes("ESTATE")) return "divorce";
  if (type.includes("DELINQUENCY") || type.includes("DELINQUENT") || type.includes("PAST_DUE")) return "delinquency";
  return null;
}

function computeEquityPct(estimatedValue: number | null, lienAmount: number | null): number | null {
  if (!estimatedValue || estimatedValue <= 0) return null;
  if (lienAmount === null || lienAmount === undefined) return null;
  return Math.round(((estimatedValue - lienAmount) / estimatedValue) * 100);
}

function mapAttomProperty(
  attomProp: Record<string, unknown>,
  ownerMortgageDetails: AttomOwnerMortgageDetails | null,
  filters: SearchFilters,
  searchBatchId: string,
  userId: string,
) {
  const identifier = (attomProp.identifier as Record<string, unknown>) ?? {};
  const address = (attomProp.address as Record<string, unknown>) ?? {};
  const building = (attomProp.building as Record<string, unknown>) ?? {};
  const rooms = (building.rooms as Record<string, unknown>) ?? {};
  const size = (building.size as Record<string, unknown>) ?? {};
  const summary = (attomProp.summary as Record<string, unknown>) ?? {};
  const avm = (attomProp.avm as Record<string, unknown>) ?? {};
  const avmAmount = (avm.amount as Record<string, unknown>) ?? {};
  const avmHigh = (avmAmount.high as number) ?? null;
  const avmLow = (avmAmount.low as number) ?? null;
  const avmMidpoint = avmLow !== null && avmHigh !== null ? Math.round((avmLow + avmHigh) / 2) : null;
  const sale = (attomProp.sale as Record<string, unknown>) ?? {};
  const saleAmount = (sale.amount as Record<string, unknown>) ?? {};
  const assessment = (attomProp.assessment as Record<string, unknown>) ?? {};
  const assessmentCalc = (assessment.calculations as Record<string, unknown>) ?? {};
  const assessmentMarket = (assessment.market as Record<string, unknown>) ?? {};
  const assessmentTax = (assessment.tax as Record<string, unknown>) ?? {};
  const assessmentLand = (assessment.market as Record<string, unknown>) ?? {};

  const mortgage = (attomProp.mortgage as Record<string, unknown>) ?? {};
  const mortgageAmount = (mortgage.amount as Record<string, unknown>) ?? {};
  const mortgageLender = (mortgage.lender as Record<string, unknown>) ?? {};
  const mortgageTerm = (mortgage.term as Record<string, unknown>) ?? {};
  const deed = (attomProp.deed as Record<string, unknown>) ?? {};
  const deedAmount = (deed.amount as Record<string, unknown>) ?? {};

  const loanAmount: number | null =
    ownerMortgageDetails?.mortgageLoanAmount ??
    ((mortgageAmount.loanamt as number) > 0 ? (mortgageAmount.loanamt as number) : null);
  const lenderName: string | null =
    ownerMortgageDetails?.mortgageLenderName ??
    (String(mortgageLender.name ?? mortgageLender.lendername ?? "").trim() || null);
  const loanType: string | null =
    ownerMortgageDetails?.mortgageLoanType ??
    (String(mortgageTerm.termtype ?? mortgage.loantype ?? "").trim() || null);
  const deedSaleAmt: number | null = (deedAmount.saleamt as number) > 0 ? (deedAmount.saleamt as number) : null;
  const isCashPurchase =
    String(saleAmount.saledisclosuretype ?? "").toUpperCase().includes("CASH") ||
    String(saleAmount.cashpurchase ?? "").toUpperCase() === "TRUE" ||
    (!loanAmount && !!(saleAmount.saleamt as number));

  const yearBuiltRaw = summary.yearbuilt ?? summary.yearBuilt ?? null;
  const yearBuilt: number | null = yearBuiltRaw !== null ? Number(yearBuiltRaw) || null : null;
  const fallbackOwnerName: string | null = String(
    (deed as Record<string, unknown>).buyer
      ? ((deed.buyer as Record<string, unknown>).name1full ?? "")
      : (summary.owner1fullname ?? summary.ownerfullname ?? "")
  ).trim() || null;
  const ownerName = ownerMortgageDetails?.ownerName ?? fallbackOwnerName;

  const estimatedValue: number | null =
    toNumber(avmAmount.value, avm.value, avmAmount.amount) ??
    avmMidpoint ??
    (typeof assessmentMarket.mktttlvalue === "number" && (assessmentMarket.mktttlvalue as number) > 0 ? assessmentMarket.mktttlvalue as number : null) ??
    (typeof assessmentCalc.calcttlvalue === "number" && (assessmentCalc.calcttlvalue as number) > 0 ? assessmentCalc.calcttlvalue as number : null) ??
    (typeof saleAmount.saleamt === "number" && (saleAmount.saleamt as number) > 0 ? saleAmount.saleamt as number : null) ??
    null;

  const taxAmt: number | null = typeof assessmentTax.taxamt === "number" && (assessmentTax.taxamt as number) > 0
    ? assessmentTax.taxamt as number
    : null;
  const lienAmount: number | null = loanAmount ?? (taxAmt !== null ? taxAmt * 10 : null);

  const distressTypes: string[] = [];
  const foreclosureStatus = String(sale.foreclosure ?? "").trim().toUpperCase();
  if (foreclosureStatus && foreclosureStatus !== "N" && foreclosureStatus !== "0") {
    distressTypes.push("foreclosure");
  }

  const absenteeInd = String(summary.absenteeInd ?? "").toUpperCase();

  const events = (attomProp.eventHistory as unknown[]) ?? [];
  for (const event of events) {
    const mapped = mapAttomDistressType(String((event as Record<string, unknown>).eventType ?? (event as Record<string, unknown>).type ?? ""));
    if (mapped && !distressTypes.includes(mapped)) {
      distressTypes.push(mapped);
    }
  }

  const propType = String(summary.proptype ?? summary.propsubtype ?? summary.propertyType ?? "SFR");
  const beds = (rooms.beds as number) ?? (rooms.bedscount as number) ?? (rooms.bedsTotal as number) ?? null;
  const baths = (rooms.bathstotal as number) ?? (rooms.bathsfull as number) ?? null;
  const sqft = (size.universalsize as number) ?? (size.livingsize as number) ?? (size.bldgsize as number) ?? null;
  const lotSizeSqft = getLotSizeSqft(size);

  return {
    user_id: userId,
    search_batch_id: searchBatchId,
    attom_id: String(identifier.attomId ?? identifier.Id ?? attomProp.id ?? ""),
    address: String(address.line1 ?? address.oneLine ?? ""),
    city: String(address.locality ?? address.cityName ?? ""),
    state: String(address.countrySubd ?? address.stateName ?? address.state ?? ""),
    zip: String(address.postal1 ?? address.zipCode ?? ""),
    property_type: propType,
    beds,
    baths,
    sqft,
    estimated_value: estimatedValue,
    last_sale_price: (saleAmount.saleamt as number) ?? null,
    last_sale_date: (sale.saleTransDate as string) ?? null,
    distress_types: distressTypes,
    distress_details: {
      foreclosureStatus,
      absenteeInd,
      events,
      assessmentTax,
      rawSale: sale,
      mortgage: {
        loanAmount,
        lenderName,
        loanType,
        isCashPurchase,
      },
      avmRange: { high: avmHigh, low: avmLow },
      yearBuilt,
      lotSizeSqft,
      ownerName,
      ownerMailingAddress: ownerMortgageDetails?.ownerMailingAddress ?? null,
      rawDeed: ownerMortgageDetails?.rawDeed ?? deed,
      deedBuyerName: ownerMortgageDetails?.deedBuyerName ?? null,
      deedSellerName: ownerMortgageDetails?.deedSellerName ?? null,
      deedSaleAmt,
      assessedLandValue: (assessmentLand as Record<string, unknown>).mktlandvalue ?? null,
      assessedImprValue: (assessmentMarket as Record<string, unknown>).mktimprvalue ?? null,
    },
    equity_pct: computeEquityPct(estimatedValue, lienAmount),
    status: "scoring" as const,
    search_filters: filters,
  };
}

async function fetchAttomProperties(filters: SearchFilters): Promise<Record<string, unknown>[]> {
  const attomApiKey = Deno.env.get("ATTOM_API_KEY");
  if (!attomApiKey) throw new Error("ATTOM_API_KEY not configured");

  const params = new URLSearchParams({
    pagesize: filters.searchMode === "property" ? "1" : "50",
    page: "1",
  });

  if (filters.searchMode === "property") {
    params.set("address", filters.location);
  } else {
    const isZip = ZIP_CODE_REGEX.test(filters.location);
    if (isZip) {
      params.set("postalcode", filters.location.slice(0, 5));
    } else {
      const [city, state] = filters.location.split(",").map((segment) => segment.trim());
      if (city) params.set("address2", city);
      if (state) params.set("state", state);
    }

    if (filters.priceMin) params.set("minSaleAmt", String(filters.priceMin));
    if (filters.priceMax) params.set("maxSaleAmt", String(filters.priceMax));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_SOURCE_TIMEOUT);

  try {
    const response = await fetch(
      `https://api.gateway.attomdata.com/propertyapi/v1.0.0/allevents/detail?${params}`,
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
      throw new Error(`ATTOM API error ${response.status}: ${body.slice(0, 500)}`);
    }

    const data = await response.json();
    const properties = (data.property ?? data.properties ?? data.eventHistory ?? []) as Record<string, unknown>[];

    return filters.searchMode === "property" ? properties.slice(0, 1) : properties;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAttomOwnerMortgageDetails(filters: SearchFilters): Promise<Record<string, AttomOwnerMortgageDetails>> {
  const attomApiKey = Deno.env.get("ATTOM_API_KEY");
  if (!attomApiKey) throw new Error("ATTOM_API_KEY not configured");

  const params = new URLSearchParams({
    pagesize: filters.searchMode === "property" ? "1" : "100",
    page: "1",
  });

  if (filters.searchMode === "property") {
    params.set("address", filters.location);
  } else if (ZIP_CODE_REGEX.test(filters.location)) {
    params.set("postalcode", filters.location.slice(0, 5));
  } else {
    return {};
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_SOURCE_TIMEOUT);

  try {
    const response = await fetch(
      `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detailmortgageowner?${params}`,
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
      throw new Error(`ATTOM detailmortgageowner error ${response.status}: ${body.slice(0, 500)}`);
    }

    const data = await response.json();
    const properties = (data.property ?? data.properties ?? []) as Record<string, unknown>[];

    return Object.fromEntries(
      properties
        .map(normalizeOwnerMortgageProperty)
        .filter((property) => property.attomId)
        .map((property) => [property.attomId, property]),
    );
  } finally {
    clearTimeout(timeout);
  }
}

const matchesSavedSearchLocation = (
  searchFilters: { searchMode?: string; location?: string },
  property: InsertedProperty,
) => {
  if (!searchFilters.location) return true;

  const location = searchFilters.location.trim();
  if (inferSearchMode(location) === "property") {
    const propertyAddress = normalizeText(`${property.address} ${property.city} ${property.state} ${property.zip}`);
    const query = normalizeText(location);
    return propertyAddress.includes(query) || query.includes(normalizeText(property.address));
  }

  const zipMatch = location.match(/^\d{5}/)?.[0];
  return property.zip === zipMatch || property.city.toLowerCase().includes(location.toLowerCase());
};

async function checkSavedSearchAlerts(
  supabase: ReturnType<typeof createClient>,
  insertedProperties: InsertedProperty[],
) {
  try {
    const { data: savedSearches } = await supabase
      .from("saved_searches")
      .select("id, user_id, name, filters");

    if (!savedSearches || savedSearches.length === 0) return;

    for (const search of savedSearches) {
      const f = search.filters as {
        searchMode?: string;
        location?: string;
        distressTypes?: string[];
        priceMin?: number;
        priceMax?: number;
        equityMin?: number;
      };

      const matches = insertedProperties.filter((property) => {
        const locationMatch = matchesSavedSearchLocation(f, property);
        const distressMatch =
          !f.distressTypes ||
          f.distressTypes.length === 0 ||
          f.distressTypes.some((distressType) => property.distress_types.includes(distressType));
        const priceMatch =
          (!f.priceMin || (property.estimated_value ?? 0) >= f.priceMin) &&
          (!f.priceMax || (property.estimated_value ?? Infinity) <= f.priceMax);
        const equityMatch = !f.equityMin || (property.equity_pct ?? 0) >= f.equityMin;

        return locationMatch && distressMatch && priceMatch && equityMatch;
      });

      if (matches.length === 0) continue;

      const { data: recentEmail } = await supabase
        .from("email_send_log")
        .select("id")
        .eq("user_id", search.user_id)
        .ilike("metadata->template_type", "new_deal_alert")
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (recentEmail && recentEmail.length > 0) continue;

      await supabase.rpc("enqueue_email", {
        p_queue_name: "transactional_emails",
        p_payload: {
          user_id: search.user_id,
          template_type: "new_deal_alert",
          search_name: search.name,
          match_count: matches.length,
          properties: matches.slice(0, 5).map((property) => ({
            id: property.id,
            address: property.address,
            city: property.city,
            state: property.state,
            deal_score: property.deal_score,
            deal_verdict: property.deal_verdict,
            distress_types: property.distress_types,
            equity_pct: property.equity_pct,
          })),
        },
      });
    }
  } catch (error) {
    console.error("[run-property-fetch] Saved search alert check failed:", error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const searchBatchId = typeof body.searchBatchId === "string" ? body.searchBatchId : "";
    const userId = typeof body.userId === "string" ? body.userId : "";
    const campaignId = typeof body.campaignId === "string" ? body.campaignId : null;
    const filters = normalizeFilters((body.filters ?? {}) as Record<string, unknown>);

    if (!searchBatchId || !userId || !filters.location) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[run-property-fetch] Starting batch ${searchBatchId} for user ${userId}`);
    console.log("[run-property-fetch] Filters:", JSON.stringify(filters));

    let attomProperties: Record<string, unknown>[] = [];
    let ownerMortgageDetailsByAttomId: Record<string, AttomOwnerMortgageDetails> = {};
    try {
      attomProperties = await fetchAttomProperties(filters);
      ownerMortgageDetailsByAttomId = await fetchAttomOwnerMortgageDetails(filters).catch((error) => {
        console.error("[run-property-fetch] ATTOM owner/mortgage fetch failed:", error);
        return {} as Record<string, AttomOwnerMortgageDetails>;
      });
      console.log(`[run-property-fetch] ATTOM returned ${attomProperties.length} properties`);
    } catch (attomError) {
      console.error("[run-property-fetch] ATTOM fetch failed:", attomError);
      await supabase.from("properties").insert({
        user_id: userId,
        search_batch_id: searchBatchId,
        address: "Search failed",
        status: "failed",
        search_filters: filters,
        distress_details: { error: String(attomError) },
      });
      return new Response(JSON.stringify({ error: "ATTOM fetch failed", details: String(attomError) }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (attomProperties.length === 0) {
      await supabase.from("properties").insert({
        user_id: userId,
        search_batch_id: searchBatchId,
        address: "__no_results__",
        status: "complete",
        search_filters: filters,
        report_data: { noResults: true },
      });
      return new Response(JSON.stringify({ queued: true, count: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const toMappedProperty = (property: Record<string, unknown>) => {
      const identifier = toRecord(property.identifier);
      const attomId = String(identifier.attomId ?? identifier.Id ?? property.id ?? "");
      return mapAttomProperty(
        property,
        ownerMortgageDetailsByAttomId[attomId] ?? null,
        filters,
        searchBatchId,
        userId,
      );
    };

    const filteredProperties = attomProperties.filter((property) => {
      if (filters.searchMode === "property") return true;
      const mapped = toMappedProperty(property);
      if (mapped.distress_types.length === 0) return false;
      return (
        filters.distressTypes.length === 0 ||
        mapped.distress_types.some((distressType: string) => filters.distressTypes.includes(distressType))
      );
    });

    if (filteredProperties.length === 0) {
      await supabase.from("properties").insert({
        user_id: userId,
        search_batch_id: searchBatchId,
        address: "__no_results__",
        status: "complete",
        search_filters: filters,
        report_data: { noResults: true },
      });
      return new Response(JSON.stringify({ queued: true, count: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = filteredProperties.map((p) => ({
      ...toMappedProperty(p),
      ...(campaignId ? { campaign_id: campaignId } : {}),
    }));

    const { data: insertedRows, error: insertError } = await supabase
      .from("properties")
      .upsert(rows, { onConflict: "user_id,attom_id", ignoreDuplicates: false })
      .select("id, attom_id, address, city, state, zip, distress_types, estimated_value, equity_pct, deal_score, deal_verdict");

    if (insertError) {
      console.error("[run-property-fetch] Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Database insert failed", details: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inserted = (insertedRows ?? []) as InsertedProperty[];
    console.log(`[run-property-fetch] Inserted/updated ${inserted.length} properties`);

    // Update campaign property count
    if (campaignId && inserted.length > 0) {
      await supabase
        .from("search_campaigns")
        .update({ property_count: inserted.length })
        .eq("id", campaignId);
    }

    const analyzeAll = Promise.all(
      inserted.map(async (property, index) => {
        await new Promise((resolve) => setTimeout(resolve, index * 200));
        try {
          await fetch(`${supabaseUrl}/functions/v1/run-deal-analyze`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
              apikey: anonKey,
            },
            body: JSON.stringify({ propertyId: property.id }),
          });
        } catch (analyzeError) {
          console.error(`[run-property-fetch] analyze failed for ${property.id}:`, analyzeError);
          await supabase
            .from("properties")
            .update({ status: "failed", report_data: { error: "Analyze trigger failed" } })
            .eq("id", property.id);
        }
      }),
    );

    const alertsAll = checkSavedSearchAlerts(supabase, inserted);
    const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void } }).EdgeRuntime;
    if (edgeRuntime?.waitUntil) {
      edgeRuntime.waitUntil(Promise.all([analyzeAll, alertsAll]));
    } else {
      await Promise.all([analyzeAll, alertsAll]);
    }

    return new Response(JSON.stringify({ queued: true, count: inserted.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[run-property-fetch] Unhandled error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
