import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ATTOM_TIMEOUT = 20000;
const MONITOR_SCHEDULER_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MONITOR_FREQUENCY_HOURS = 24;

type SearchMode = "market" | "property";

type SearchFilters = {
  searchMode: SearchMode;
  location: string;
  distressTypes: string[];
  priceMin?: number;
  priceMax?: number;
  propertyTypes?: string[];
  equityMin?: number;
};

type InsertedProperty = {
  id: string;
  attom_id?: string | null;
  address: string;
  city: string;
  state: string;
  distress_types: string[];
  equity_pct?: number | null;
  deal_score?: number | null;
  deal_verdict?: string | null;
};

type SavedSearchRow = {
  id: string;
  user_id: string;
  name: string;
  filters?: Record<string, unknown> | null;
  last_monitored_at?: string | null;
  monitor_frequency_hours?: number | null;
  monitor_run_time?: string | null;
  monitor_timezone?: string | null;
  seen_attom_ids?: string[] | null;
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

const getTimeZone = (value: string | null | undefined) => {
  const candidate = (value ?? "").trim();
  if (!candidate) return "UTC";

  try {
    Intl.DateTimeFormat("en-US", { timeZone: candidate }).format();
    return candidate;
  } catch {
    return "UTC";
  }
};

const parseMonitorTime = (value: string | null | undefined) => {
  const match = (value ?? "").match(/^(\d{2}):(\d{2})/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return { hours, minutes };
};

const getZonedDateParts = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute"),
  };
};

const getDateKey = (parts: ReturnType<typeof getZonedDateParts>) =>
  `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;

const isSearchDue = (search: SavedSearchRow) => {
  const frequencyHours = search.monitor_frequency_hours ?? DEFAULT_MONITOR_FREQUENCY_HOURS;
  const runTime = parseMonitorTime(search.monitor_run_time);

  if (runTime && frequencyHours >= 24) {
    const timeZone = getTimeZone(search.monitor_timezone);
    const nowParts = getZonedDateParts(new Date(), timeZone);
    const nowMinutes = nowParts.hour * 60 + nowParts.minute;
    const scheduledMinutes = runTime.hours * 60 + runTime.minutes;
    if (nowMinutes < scheduledMinutes) return false;

    if (!search.last_monitored_at) return true;

    const lastParts = getZonedDateParts(new Date(search.last_monitored_at), timeZone);
    return getDateKey(lastParts) !== getDateKey(nowParts);
  }

  if (!search.last_monitored_at) return true;

  const nextDue = new Date(search.last_monitored_at).getTime() + frequencyHours * 3600_000;
  return Date.now() >= nextDue;
};

function mapAttomProp(
  attomProp: Record<string, unknown>,
  ownerMortgageDetails: AttomOwnerMortgageDetails | null,
  userId: string,
  searchBatchId: string,
  filters: SearchFilters,
) {
  const identifier = (attomProp.identifier as Record<string, unknown>) ?? {};
  const address = (attomProp.address as Record<string, unknown>) ?? {};
  const building = (attomProp.building as Record<string, unknown>) ?? {};
  const rooms = (building.rooms as Record<string, unknown>) ?? {};
  const size = (building.size as Record<string, unknown>) ?? {};
  const summary = (attomProp.summary as Record<string, unknown>) ?? {};
  const avm = (attomProp.avm as Record<string, unknown>) ?? {};
  const avmAmount = (avm.amount as Record<string, unknown>) ?? {};
  const avmHigh = typeof avmAmount.high === "number" ? avmAmount.high : null;
  const avmLow = typeof avmAmount.low === "number" ? avmAmount.low : null;
  const avmMidpoint = avmLow !== null && avmHigh !== null ? Math.round((avmLow + avmHigh) / 2) : null;
  const sale = (attomProp.sale as Record<string, unknown>) ?? {};
  const saleAmount = (sale.amount as Record<string, unknown>) ?? {};
  const assessment = (attomProp.assessment as Record<string, unknown>) ?? {};
  const assessmentMarket = (assessment.market as Record<string, unknown>) ?? {};
  const assessmentCalc = (assessment.calculations as Record<string, unknown>) ?? {};
  const assessmentTax = (assessment.tax as Record<string, unknown>) ?? {};
  const mortgage = (attomProp.mortgage as Record<string, unknown>) ?? {};
  const mortgageAmount = (mortgage.amount as Record<string, unknown>) ?? {};
  const mortgageLender = (mortgage.lender as Record<string, unknown>) ?? {};
  const mortgageTerm = (mortgage.term as Record<string, unknown>) ?? {};
  const deed = (attomProp.deed as Record<string, unknown>) ?? {};
  const deedAmount = (deed.amount as Record<string, unknown>) ?? {};

  const attomId = String(identifier.attomId ?? identifier.Id ?? attomProp.id ?? "");
  const estimatedValue: number | null =
    toNumber(avmAmount.value, avm.value, avmAmount.amount) ??
    avmMidpoint ??
    (typeof assessmentMarket.mktttlvalue === "number" && assessmentMarket.mktttlvalue > 0 ? assessmentMarket.mktttlvalue : null) ??
    (typeof assessmentCalc.calcttlvalue === "number" && assessmentCalc.calcttlvalue > 0 ? assessmentCalc.calcttlvalue : null) ??
    null;

  const loanAmount: number | null =
    ownerMortgageDetails?.mortgageLoanAmount ??
    ((mortgageAmount.loanamt as number) > 0 ? (mortgageAmount.loanamt as number) : null);
  const taxAmt: number | null = typeof assessmentTax.taxamt === "number" && assessmentTax.taxamt > 0 ? assessmentTax.taxamt : null;
  const lienAmount: number | null = loanAmount ?? (taxAmt !== null ? taxAmt * 10 : null);
  const equityPct = estimatedValue && lienAmount != null
    ? Math.round(((estimatedValue - lienAmount) / estimatedValue) * 100)
    : null;

  const foreclosureStatus = String(sale.foreclosure ?? "").trim().toUpperCase();
  const absenteeInd = String(summary.absenteeInd ?? "").toUpperCase();
  const distressTypes: string[] = [];
  if (foreclosureStatus && foreclosureStatus !== "N") distressTypes.push("foreclosure");

  const fallbackOwnerName = String(
    (deed.buyer as Record<string, unknown>)?.name1full ?? summary.owner1fullname ?? summary.ownerfullname ?? ""
  ).trim() || null;
  const ownerName = ownerMortgageDetails?.ownerName ?? fallbackOwnerName;
  const lotSizeSqft = getLotSizeSqft(size);

  return {
    attom_id: attomId,
    user_id: userId,
    search_batch_id: searchBatchId,
    address: String(address.line1 ?? address.oneLine ?? ""),
    city: String(address.locality ?? address.cityName ?? ""),
    state: String(address.countrySubd ?? address.stateName ?? ""),
    zip: String(address.postal1 ?? address.zipCode ?? ""),
    property_type: String(summary.proptype ?? "SFR"),
    beds: (rooms.beds as number) ?? (rooms.bedscount as number) ?? null,
    baths: (rooms.bathstotal as number) ?? (rooms.bathsfull as number) ?? null,
    sqft: (size.universalsize as number) ?? (size.livingsize as number) ?? null,
    estimated_value: estimatedValue,
    last_sale_price: (saleAmount.saleamt as number) ?? null,
    last_sale_date: (sale.saleTransDate as string) ?? null,
    distress_types: distressTypes,
    distress_details: {
      foreclosureStatus,
      absenteeInd,
      assessmentTax,
      mortgage: {
        loanAmount,
        lenderName: ownerMortgageDetails?.mortgageLenderName ?? (String(mortgageLender.name ?? mortgageLender.lendername ?? "").trim() || null),
        loanType: ownerMortgageDetails?.mortgageLoanType ?? (String(mortgageTerm.termtype ?? mortgage.loantype ?? "").trim() || null),
        isCashPurchase: String(saleAmount.saledisclosuretype ?? "").toUpperCase().includes("CASH"),
      },
      avmRange: { high: avmHigh, low: avmLow },
      lotSizeSqft,
      ownerName,
      ownerMailingAddress: ownerMortgageDetails?.ownerMailingAddress ?? null,
      rawDeed: ownerMortgageDetails?.rawDeed ?? deed,
      deedBuyerName: ownerMortgageDetails?.deedBuyerName ?? null,
      deedSellerName: ownerMortgageDetails?.deedSellerName ?? null,
      deedSaleAmt: (deedAmount.saleamt as number) > 0 ? (deedAmount.saleamt as number) : null,
    },
    equity_pct: equityPct,
    status: "scoring" as const,
    search_filters: filters,
  };
}

async function fetchAttomForFilters(filters: SearchFilters): Promise<Record<string, unknown>[]> {
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
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ATTOM_TIMEOUT);

  try {
    const response = await fetch(
      `https://api.gateway.attomdata.com/propertyapi/v1.0.0/allevents/detail?${params}`,
      {
        headers: { apikey: attomApiKey, Accept: "application/json" },
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`ATTOM ${response.status}: ${body.slice(0, 300)}`);
    }
    const data = await response.json();
    const rows = (data.property ?? data.properties ?? data.eventHistory ?? []) as Record<string, unknown>[];
    return filters.searchMode === "property" ? rows.slice(0, 1) : rows;
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
  const timeout = setTimeout(() => controller.abort(), ATTOM_TIMEOUT);

  try {
    const response = await fetch(
      `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detailmortgageowner?${params}`,
      {
        headers: { apikey: attomApiKey, Accept: "application/json" },
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`ATTOM detailmortgageowner ${response.status}: ${body.slice(0, 300)}`);
    }

    const data = await response.json();
    const rows = (data.property ?? data.properties ?? []) as Record<string, unknown>[];

    return Object.fromEntries(
      rows
        .map(normalizeOwnerMortgageProperty)
        .filter((property) => property.attomId)
        .map((property) => [property.attomId, property]),
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function sendMonitoredSearchAlerts(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceRoleKey: string,
  search: {
    id: string;
    user_id: string;
    name: string;
    filters?: Record<string, unknown> | null;
  },
  insertedProperties: InsertedProperty[],
) {
  if (insertedProperties.length === 0) return;

  const location = typeof search.filters?.location === "string" ? search.filters.location : search.name;
  const count = insertedProperties.length;

  const [{ data: profile }, { data: preferences }] = await Promise.all([
    supabase
      .from("profiles" as any)
      .select("email")
      .eq("id", search.user_id)
      .maybeSingle(),
    supabase
      .from("user_preferences" as any)
      .select("email_notifications, watchlist_alerts")
      .eq("user_id", search.user_id)
      .maybeSingle(),
  ]);

  if (preferences?.watchlist_alerts !== false) {
    await supabase.from("notifications").insert({
      user_id: search.user_id,
      saved_search_id: search.id,
      title: count === 1 ? "1 new deal found" : `${count} new deals found`,
      message: `${count} new propert${count === 1 ? "y" : "ies"} matched your monitored search for ${location}.`,
    });
  }

  if (preferences?.email_notifications === false || !profile?.email) return;

  const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "new_deal_alert",
      to: profile.email,
      data: {
        city: location,
        count,
        appUrl: Deno.env.get("APP_URL") ?? "https://deal-hunter-beta.vercel.app",
        properties: insertedProperties.slice(0, 5).map((property) => ({
          id: property.id,
          address: property.address,
          city: property.city,
          state: property.state,
          deal_score: property.deal_score ?? null,
          deal_verdict: property.deal_verdict ?? null,
          equity_pct: property.equity_pct ?? null,
        })),
      },
    }),
  });

  if (!emailResponse.ok) {
    const errorBody = await emailResponse.text().catch(() => "");
    throw new Error(`send-transactional-email ${emailResponse.status}: ${errorBody.slice(0, 300)}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { data: dueSearches, error: fetchError } = await supabase
      .from("saved_searches" as any)
      .select("*")
      .eq("is_monitored", true)
      .or("last_monitored_at.is.null,last_monitored_at.lt." + new Date(Date.now() - MONITOR_SCHEDULER_WINDOW_MS).toISOString());

    if (fetchError) throw fetchError;
    if (!dueSearches || dueSearches.length === 0) {
      return new Response(JSON.stringify({ ran: 0, newProperties: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalNew = 0;

    for (const search of dueSearches as SavedSearchRow[]) {
      if (!isSearchDue(search)) continue;

      try {
        const filters = normalizeFilters((search.filters ?? {}) as Record<string, unknown>);
        const seenIds: string[] = (search.seen_attom_ids as string[]) ?? [];

        const attomProps = await fetchAttomForFilters(filters).catch((error) => {
          console.error(`[run-monitored-searches] ATTOM failed for search ${search.id}:`, error);
          return [] as Record<string, unknown>[];
        });
        const ownerMortgageDetailsByAttomId = await fetchAttomOwnerMortgageDetails(filters).catch((error) => {
          console.error(`[run-monitored-searches] ATTOM owner/mortgage failed for search ${search.id}:`, error);
          return {} as Record<string, AttomOwnerMortgageDetails>;
        });

        const newProps = attomProps.filter((property) => {
          const identifier = (property.identifier as Record<string, unknown>) ?? {};
          const attomId = identifier.attomId ?? identifier.Id ?? property.id;
          return attomId && !seenIds.includes(String(attomId));
        });

        if (newProps.length === 0) {
          await supabase
            .from("saved_searches" as any)
            .update({ last_monitored_at: new Date().toISOString() })
            .eq("id", search.id);
          continue;
        }

        const searchBatchId = crypto.randomUUID();
        const mappedProps = newProps.map((property) =>
          mapAttomProp(
            property,
            ownerMortgageDetailsByAttomId[String(toRecord(property.identifier).attomId ?? toRecord(property.identifier).Id ?? property.id ?? "")] ?? null,
            search.user_id,
            searchBatchId,
            filters,
          )
        ).filter((property) => {
          if (filters.searchMode === "property") return true;
          if (property.distress_types.length === 0) return false;
          return (
            !filters.distressTypes ||
            filters.distressTypes.length === 0 ||
            property.distress_types.some((distressType) => filters.distressTypes.includes(distressType))
          );
        });

        if (mappedProps.length === 0) {
          await supabase
            .from("saved_searches" as any)
            .update({ last_monitored_at: new Date().toISOString() })
            .eq("id", search.id);
          continue;
        }

        const { data: inserted, error: insertError } = await supabase
          .from("properties" as any)
          .upsert(mappedProps, { onConflict: "user_id,attom_id", ignoreDuplicates: false })
          .select("id, attom_id, address, city, state, distress_types, equity_pct, deal_score, deal_verdict");

        if (insertError) {
          console.error(`[run-monitored-searches] Upsert failed for search ${search.id}:`, insertError);
          continue;
        }

        if (!inserted || inserted.length === 0) {
          await supabase
            .from("saved_searches" as any)
            .update({ last_monitored_at: new Date().toISOString() })
            .eq("id", search.id);
          continue;
        }

        totalNew += inserted.length;

        const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void } }).EdgeRuntime;
        const analyzeAll = Promise.all(
          inserted.map((property: { id: string }) =>
            fetch(`${supabaseUrl}/functions/v1/run-deal-analyze`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${serviceRoleKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ propertyId: property.id }),
            }).catch((error) => console.error(`[run-monitored-searches] analyze failed for ${property.id}:`, error))
          )
        );
        const alertsAll = sendMonitoredSearchAlerts(
          supabase,
          supabaseUrl,
          serviceRoleKey,
          {
            id: String(search.id),
            user_id: String(search.user_id),
            name: String(search.name ?? ""),
            filters: (search.filters ?? {}) as Record<string, unknown>,
          },
          inserted as InsertedProperty[],
        );

        if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(Promise.all([analyzeAll, alertsAll]));
        else Promise.all([analyzeAll, alertsAll]).catch(() => {});

        const newAttomIds = inserted
          .map((property: { attom_id?: string }) => property.attom_id)
          .filter(Boolean) as string[];
        const updatedSeen = [...new Set([...seenIds, ...newAttomIds])];

        await supabase
          .from("saved_searches" as any)
          .update({
            last_monitored_at: new Date().toISOString(),
            seen_attom_ids: updatedSeen,
          })
          .eq("id", search.id);
      } catch (error) {
        console.error(`[run-monitored-searches] Error processing search ${search.id}:`, error);
        await supabase
          .from("saved_searches" as any)
          .update({ last_monitored_at: new Date().toISOString() })
          .eq("id", search.id)
          .catch(() => {});
      }

      // Rate-limit guard: stay well under ATTOM's 150 req/min limit
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return new Response(JSON.stringify({ ran: dueSearches.length, newProperties: totalNew }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[run-monitored-searches] Unhandled error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
