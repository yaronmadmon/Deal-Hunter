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
function mapAttomProperty(attomProp: Record<string, unknown>, filters: Record<string, unknown>, searchBatchId: string, userId: string) {
  const identifier = (attomProp.identifier as Record<string, unknown>) ?? {};
  const address = (attomProp.address as Record<string, unknown>) ?? {};
  const building = (attomProp.building as Record<string, unknown>) ?? {};
  const rooms = (building.rooms as Record<string, unknown>) ?? {};
  const size = (building.size as Record<string, unknown>) ?? {};
  const avm = (attomProp.avm as Record<string, unknown>) ?? {};
  const sale = (attomProp.sale as Record<string, unknown>) ?? {};
  const saleAmount = (sale.amount as Record<string, unknown>) ?? {};
  const events = (attomProp.eventHistory as unknown[]) ?? [];

  // Derive distress types from event history
  const distressTypes: string[] = [];
  for (const event of events) {
    const ev = event as Record<string, unknown>;
    const mapped = mapAttomDistressType(String(ev.eventType ?? ev.type ?? ""));
    if (mapped && !distressTypes.includes(mapped)) {
      distressTypes.push(mapped);
    }
  }

  // If ATTOM returned top-level event fields, also check those
  const topLevelEventType = String(attomProp.eventType ?? attomProp.type ?? "");
  if (topLevelEventType) {
    const mapped = mapAttomDistressType(topLevelEventType);
    if (mapped && !distressTypes.includes(mapped)) distressTypes.push(mapped);
  }

  const estimatedValue =
    (avm.amount as number) ??
    (avm.value as number) ??
    (saleAmount.saleAmt as number) ??
    null;

  // Lien amount: ATTOM may provide this in event data
  let lienAmount: number | null = null;
  for (const event of events) {
    const ev = event as Record<string, unknown>;
    const amount = ev.lienAmount ?? ev.amount ?? ev.taxAmount;
    if (typeof amount === "number" && amount > 0) {
      lienAmount = amount;
      break;
    }
  }

  return {
    user_id: userId,
    search_batch_id: searchBatchId,
    attom_id: String(identifier.attomId ?? identifier.Id ?? attomProp.id ?? ""),
    address: String(address.line1 ?? address.oneLine ?? ""),
    city: String(address.cityName ?? address.locality ?? ""),
    state: String(address.stateName ?? address.state ?? address.countrySubd ?? ""),
    zip: String(address.postal1 ?? address.zipCode ?? ""),
    property_type: String(attomProp.lotSize ?? building.buildingType ?? "SFR"),
    beds: (rooms.beds as number) ?? (rooms.bedsCount as number) ?? null,
    baths: (rooms.bathsTotal as number) ?? null,
    sqft: (size.universalSize as number) ?? (size.livingSize as number) ?? null,
    estimated_value: estimatedValue,
    last_sale_price: (saleAmount.saleAmt as number) ?? null,
    last_sale_date: (sale.saleTransDate as string) ?? null,
    distress_types: distressTypes,
    distress_details: { events, rawAttom: attomProp },
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

    // Trigger run-deal-analyze for each property (sequential with 150ms gap to avoid overwhelming APIs)
    const authHeader = req.headers.get("Authorization") ?? `Bearer ${serviceRoleKey}`;
    for (const prop of inserted) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/run-deal-analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
            apikey: anonKey,
          },
          body: JSON.stringify({ propertyId: prop.id }),
        });
        await new Promise((resolve) => setTimeout(resolve, 150));
      } catch (analyzeError) {
        console.error(`[run-property-fetch] Failed to trigger analyze for ${prop.id}:`, analyzeError);
        // Mark this property as failed but continue with others
        await supabase
          .from("properties")
          .update({ status: "failed", report_data: { error: "Analyze trigger failed" } })
          .eq("id", prop.id);
      }
    }

    // Check saved search alerts (non-blocking)
    await checkSavedSearchAlerts(
      supabase,
      inserted as Array<{ id: string; zip: string; city: string; state: string; distress_types: string[]; estimated_value: number | null; equity_pct: number | null; deal_score: number | null; deal_verdict: string | null; address: string }>,
      supabaseUrl,
      anonKey,
    );

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
