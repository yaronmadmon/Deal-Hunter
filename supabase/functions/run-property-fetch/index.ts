import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_SOURCE_TIMEOUT = 20000; // 20s for ATTOM

// ─── ATTOM distress type mapping ─────────────────────────────────────────────
// Maps ATTOM event type codes to our internal distress type strings
function mapAttomDistressType(eventType: string): string | null {
  const type = (eventType || "").toUpperCase();
  if (type.includes("TAXLIEN") || type.includes("TAX_LIEN") || type.includes("DELINQUENT")) return "tax_lien";
  if (type.includes("FORECLOSURE") || type.includes("LISPENDENS") || type.includes("LIS_PENDENS") || type.includes("NOTICE_OF_DEFAULT") || type.includes("NOD")) return "foreclosure";
  if (type.includes("DIVORCE") || type.includes("PROBATE") || type.includes("ESTATE")) return "divorce";
  if (type.includes("DELINQUENCY") || type.includes("DELINQUENT") || type.includes("PAST_DUE")) return "delinquency";
  return null;
}

// ─── Equity calculation (defensive) ──────────────────────────────────────────
function computeEquityPct(estimatedValue: number | null, lienAmount: number | null): number | null {
  if (!estimatedValue || estimatedValue <= 0) return null;
  if (lienAmount === null || lienAmount === undefined) return null;
  return Math.round(((estimatedValue - lienAmount) / estimatedValue) * 100);
}

// ─── Map ATTOM property to our schema ────────────────────────────────────────
// Field names use ATTOM's actual casing from allevents/detail responses
function mapAttomProperty(attomProp: Record<string, unknown>, filters: Record<string, unknown>, searchBatchId: string, userId: string) {
  const identifier = (attomProp.identifier as Record<string, unknown>) ?? {};
  const address    = (attomProp.address   as Record<string, unknown>) ?? {};
  const building   = (attomProp.building  as Record<string, unknown>) ?? {};
  const rooms      = (building.rooms      as Record<string, unknown>) ?? {};
  const size       = (building.size       as Record<string, unknown>) ?? {};
  const summary    = (attomProp.summary   as Record<string, unknown>) ?? {};
  const avm        = (attomProp.avm       as Record<string, unknown>) ?? {};
  const avmAmount  = (avm.amount          as Record<string, unknown>) ?? {};
  const avmHigh    = (avmAmount.high      as number) ?? null;
  const avmLow     = (avmAmount.low       as number) ?? null;
  const sale       = (attomProp.sale      as Record<string, unknown>) ?? {};
  const saleAmount = (sale.amount         as Record<string, unknown>) ?? {};
  const assessment = (attomProp.assessment as Record<string, unknown>) ?? {};
  const assessmentCalc   = (assessment.calculations as Record<string, unknown>) ?? {};
  const assessmentMarket = (assessment.market       as Record<string, unknown>) ?? {};
  const assessmentTax    = (assessment.tax          as Record<string, unknown>) ?? {};
  const assessmentLand   = (assessment.market       as Record<string, unknown>) ?? {};

  // ── Mortgage / deed (ATTOM includes these on allevents/detail)
  const mortgage       = (attomProp.mortgage as Record<string, unknown>) ?? {};
  const mortgageAmount = (mortgage.amount    as Record<string, unknown>) ?? {};
  const mortgageLender = (mortgage.lender    as Record<string, unknown>) ?? {};
  const mortgageTerm   = (mortgage.term      as Record<string, unknown>) ?? {};
  const deed           = (attomProp.deed     as Record<string, unknown>) ?? {};
  const deedAmount     = (deed.amount        as Record<string, unknown>) ?? {};

  const loanAmount: number | null = (mortgageAmount.loanamt as number) > 0 ? (mortgageAmount.loanamt as number) : null;
  const lenderName: string | null = String(mortgageLender.name ?? mortgageLender.lendername ?? "").trim() || null;
  const loanType: string | null   = String(mortgageTerm.termtype ?? mortgage.loantype ?? "").trim() || null;
  const deedSaleAmt: number | null = (deedAmount.saleamt as number) > 0 ? (deedAmount.saleamt as number) : null;
  // Cash purchase: last sale had no associated mortgage, or ATTOM flags it
  const isCashPurchase: boolean =
    String(saleAmount.saledisclosuretype ?? "").toUpperCase().includes("CASH") ||
    String(saleAmount.cashpurchase ?? "").toUpperCase() === "TRUE" ||
    (!loanAmount && !!(saleAmount.saleamt as number));

  const yearBuiltRaw = summary.yearbuilt ?? summary.yearBuilt ?? null;
  const yearBuilt: number | null = yearBuiltRaw !== null ? Number(yearBuiltRaw) || null : null;
  const ownerName: string | null = String(
    (deed as Record<string, unknown>).buyer
      ? ((deed.buyer as Record<string, unknown>).name1full ?? "")
      : (summary.owner1fullname ?? summary.ownerfullname ?? "")
  ).trim() || null;

  // ── Estimated value: prefer AVM, fall back to assessment market / assessed value
  const estimatedValue: number | null =
    (typeof avmAmount.scr === "number" && (avmAmount.scr as number) > 0 ? avmAmount.scr as number : null) ??
    (typeof assessmentMarket.mktttlvalue === "number" && (assessmentMarket.mktttlvalue as number) > 0 ? assessmentMarket.mktttlvalue as number : null) ??
    (typeof assessmentCalc.calcttlvalue === "number" && (assessmentCalc.calcttlvalue as number) > 0 ? assessmentCalc.calcttlvalue as number : null) ??
    (typeof saleAmount.saleamt === "number" && (saleAmount.saleamt as number) > 0 ? saleAmount.saleamt as number : null) ??
    null;

  // ── Lien amount for equity calc: prefer actual mortgage loan amount over tax proxy
  const taxAmt: number | null = (typeof assessmentTax.taxamt === "number" && (assessmentTax.taxamt as number) > 0)
    ? assessmentTax.taxamt as number : null;
  const lienAmount: number | null =
    loanAmount ??
    (taxAmt !== null ? taxAmt * 10 : null); // fallback: annual tax × 10

  // ── Distress type detection from available ATTOM fields
  const distressTypes: string[] = [];

  // Foreclosure: sale.foreclosure = "O" (Open), "F" (Filed), "P" (Pending), etc.
  const foreclosureStatus = String(sale.foreclosure ?? "").trim().toUpperCase();
  if (foreclosureStatus && foreclosureStatus !== "N" && foreclosureStatus !== "0" && foreclosureStatus !== "") {
    distressTypes.push("foreclosure");
  }

  // Tax delinquency: property with non-zero tax and absentee owner is a candidate
  const absenteeInd = String(summary.absenteeInd ?? "").toUpperCase();
  if (absenteeInd.includes("ABSENTEE") && assessmentTax.taxamt) {
    distressTypes.push("delinquency");
  }

  // Also check legacy eventHistory if present (some ATTOM plans include it)
  const events = (attomProp.eventHistory as unknown[]) ?? [];
  for (const event of events) {
    const ev = event as Record<string, unknown>;
    const mapped = mapAttomDistressType(String(ev.eventType ?? ev.type ?? ""));
    if (mapped && !distressTypes.includes(mapped)) distressTypes.push(mapped);
  }

  // Fallback: if no distress type detected but user is searching for them,
  // include property with a generic indicator so the AI can evaluate it.
  if (distressTypes.length === 0) {
    const filterTypes = (filters.distressTypes as string[]) ?? [];
    if (filterTypes.length > 0) {
      distressTypes.push(filterTypes[0]);   // tag with first requested type; AI will verify
    }
  }

  // ── Property type from summary
  const propType = String(summary.proptype ?? summary.propsubtype ?? summary.propertyType ?? "SFR");

  // ── Beds/baths: ATTOM uses lowercase keys
  const beds  = (rooms.beds as number) ?? (rooms.bedscount as number) ?? (rooms.bedsTotal as number) ?? null;
  const baths = (rooms.bathstotal as number) ?? (rooms.bathsfull as number) ?? null;
  const sqft  = (size.universalsize as number) ?? (size.livingsize as number) ?? (size.bldgsize as number) ?? null;

  return {
    user_id: userId,
    search_batch_id: searchBatchId,
    attom_id: String(identifier.attomId ?? identifier.Id ?? attomProp.id ?? ""),
    address:  String(address.line1 ?? address.oneLine ?? ""),
    city:     String(address.locality ?? address.cityName ?? ""),
    state:    String(address.countrySubd ?? address.stateName ?? address.state ?? ""),
    zip:      String(address.postal1 ?? address.zipCode ?? ""),
    property_type: propType,
    beds,
    baths,
    sqft,
    estimated_value: estimatedValue,
    last_sale_price: (saleAmount.saleamt as number) ?? null,
    last_sale_date:  (sale.saleTransDate as string) ?? null,
    distress_types:  distressTypes,
    distress_details: {
      foreclosureStatus,
      absenteeInd,
      events,
      assessmentTax,
      rawSale: sale,
      // Financial intelligence fields
      mortgage: {
        loanAmount,
        lenderName,
        loanType,
        isCashPurchase,
      },
      avmRange: { high: avmHigh, low: avmLow },
      yearBuilt,
      ownerName,
      deedSaleAmt,
      assessedLandValue: (assessmentLand as Record<string, unknown>).mktlandvalue ?? null,
      assessedImprValue: (assessmentMarket as Record<string, unknown>).mktimprvalue ?? null,
    },
    equity_pct: computeEquityPct(estimatedValue, lienAmount),
    status: "scoring" as const,
    search_filters: filters,
  };
}

// ─── Fetch from ATTOM API ─────────────────────────────────────────────────────
async function fetchAttomProperties(filters: {
  location: string;
  distressTypes: string[];
  priceMin?: number;
  priceMax?: number;
  propertyTypes?: string[];
  equityMin?: number;
}): Promise<Record<string, unknown>[]> {
  const attomApiKey = Deno.env.get("ATTOM_API_KEY");
  if (!attomApiKey) throw new Error("ATTOM_API_KEY not configured");

  // Determine if location is a zip code or city
  const isZip = /^\d{5}$/.test(filters.location.trim());

  // Build query params
  const params = new URLSearchParams({
    pagesize: "50",
    page: "1",
  });

  if (isZip) {
    params.set("postalcode", filters.location.trim());
  } else {
    // Assume "City, ST" format
    const [city, state] = filters.location.split(",").map((s) => s.trim());
    if (city) params.set("address2", city);
    if (state) params.set("state", state);
  }

  if (filters.priceMin) params.set("minSaleAmt", String(filters.priceMin));
  if (filters.priceMax) params.set("maxSaleAmt", String(filters.priceMax));

  // ATTOM allevents endpoint returns distress events for properties
  const url = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/allevents/detail?${params}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_SOURCE_TIMEOUT);

  try {
    const response = await fetch(url, {
      headers: {
        apikey: attomApiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`ATTOM API error ${response.status}: ${body.slice(0, 500)}`);
    }

    const data = await response.json();

    // ATTOM wraps results in property[] or eventHistory[]
    const properties: Record<string, unknown>[] =
      data.property ??
      data.properties ??
      data.eventHistory ??
      [];

    return properties;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Post-insert: check saved searches and queue deal alert emails ─────────────
async function checkSavedSearchAlerts(
  supabase: ReturnType<typeof createClient>,
  insertedProperties: Array<{ id: string; zip: string; city: string; state: string; distress_types: string[]; estimated_value: number | null; equity_pct: number | null; deal_score: number | null; deal_verdict: string | null; address: string }>,
  supabaseUrl: string,
  anonKey: string,
) {
  try {
    // Fetch all saved searches — we check against new properties across all users
    const { data: savedSearches } = await supabase
      .from("saved_searches")
      .select("id, user_id, name, filters");

    if (!savedSearches || savedSearches.length === 0) return;

    for (const search of savedSearches) {
      const f = search.filters as {
        location?: string;
        distressTypes?: string[];
        priceMin?: number;
        priceMax?: number;
        equityMin?: number;
      };

      // Match properties against this saved search's filters
      const matches = insertedProperties.filter((prop) => {
        const locationMatch =
          !f.location ||
          prop.zip === f.location.trim() ||
          prop.city.toLowerCase().includes(f.location.toLowerCase());

        const distressMatch =
          !f.distressTypes ||
          f.distressTypes.length === 0 ||
          f.distressTypes.some((dt: string) => prop.distress_types.includes(dt));

        const priceMatch =
          (!f.priceMin || (prop.estimated_value ?? 0) >= f.priceMin) &&
          (!f.priceMax || (prop.estimated_value ?? Infinity) <= f.priceMax);

        const equityMatch = !f.equityMin || (prop.equity_pct ?? 0) >= f.equityMin;

        return locationMatch && distressMatch && priceMatch && equityMatch;
      });

      if (matches.length === 0) continue;

      // Dedup: check if we already sent a new_deal_alert to this user for this location in the last 24h
      const { data: recentEmail } = await supabase
        .from("email_send_log")
        .select("id")
        .eq("user_id", search.user_id)
        .ilike("metadata->template_type", "new_deal_alert")
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (recentEmail && recentEmail.length > 0) continue;

      // Queue the alert email via the existing enqueue_email RPC
      await supabase.rpc("enqueue_email", {
        p_queue_name: "transactional_emails",
        p_payload: {
          user_id: search.user_id,
          template_type: "new_deal_alert",
          search_name: search.name,
          match_count: matches.length,
          properties: matches.slice(0, 5).map((p) => ({
            id: p.id,
            address: p.address,
            city: p.city,
            state: p.state,
            deal_score: p.deal_score,
            deal_verdict: p.deal_verdict,
            distress_types: p.distress_types,
            equity_pct: p.equity_pct,
          })),
        },
      });
    }
  } catch (err) {
    // Non-critical — log and continue
    console.error("[run-property-fetch] Saved search alert check failed:", err);
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { searchBatchId, userId, filters } = await req.json();

    if (!searchBatchId || !userId || !filters) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[run-property-fetch] Starting batch ${searchBatchId} for user ${userId}`);
    console.log(`[run-property-fetch] Filters:`, JSON.stringify(filters));

    // Fetch properties from ATTOM (Layer 1)
    let attomProperties: Record<string, unknown>[] = [];
    try {
      attomProperties = await fetchAttomProperties(filters);
      console.log(`[run-property-fetch] ATTOM returned ${attomProperties.length} properties`);
    } catch (attomError) {
      console.error("[run-property-fetch] ATTOM fetch failed:", attomError);
      // Mark batch as failed — insert a sentinel failed property so the Processing page can detect it
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
      // No results — insert a sentinel so the UI shows "no results found"
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

    // Filter by requested distress types (ATTOM may return extras)
    const filteredProperties = attomProperties.filter((prop) => {
      const mapped = mapAttomProperty(prop, filters, searchBatchId, userId);
      return (
        filters.distressTypes.length === 0 ||
        mapped.distress_types.some((dt: string) => filters.distressTypes.includes(dt))
      );
    });

    // Map and bulk-insert
    const rows = filteredProperties.map((prop) =>
      mapAttomProperty(prop, filters, searchBatchId, userId)
    );

    // Upsert — ON CONFLICT (user_id, attom_id) DO UPDATE keeps fresh data
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

    const inserted = insertedRows ?? [];
    console.log(`[run-property-fetch] Inserted/updated ${inserted.length} properties`);

    // Trigger run-deal-analyze for each property IN PARALLEL — do NOT await sequentially
    // (sequential + await caused edge function timeout with >3 properties)
    const analyzeAll = Promise.all(
      inserted.map(async (prop, i) => {
        // Stagger starts by 200ms to avoid hammering APIs simultaneously
        await new Promise((resolve) => setTimeout(resolve, i * 200));
        try {
          await fetch(`${supabaseUrl}/functions/v1/run-deal-analyze`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
              apikey: anonKey,
            },
            body: JSON.stringify({ propertyId: prop.id }),
          });
        } catch (analyzeError) {
          console.error(`[run-property-fetch] analyze failed for ${prop.id}:`, analyzeError);
          await supabase
            .from("properties")
            .update({ status: "failed", report_data: { error: "Analyze trigger failed" } })
            .eq("id", prop.id);
        }
      })
    );

    // Check saved search alerts in parallel with analyzes (non-blocking)
    const alertsAll = checkSavedSearchAlerts(
      supabase,
      inserted as Array<{ id: string; zip: string; city: string; state: string; distress_types: string[]; estimated_value: number | null; equity_pct: number | null; deal_score: number | null; deal_verdict: string | null; address: string }>,
      supabaseUrl,
      anonKey,
    );

    // Return success immediately — use waitUntil to keep function alive for background work
    const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime;
    if (edgeRuntime?.waitUntil) {
      edgeRuntime.waitUntil(Promise.all([analyzeAll, alertsAll]));
    } else {
      // Fallback: await (slower but safe for local dev)
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
