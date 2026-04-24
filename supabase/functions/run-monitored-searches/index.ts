import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ATTOM_TIMEOUT = 20000;

// ── Minimal ATTOM property mapper ─────────────────────────────────────────────
function mapAttomProp(
  attomProp: Record<string, unknown>,
  userId: string,
  searchBatchId: string,
  filters: Record<string, unknown>,
) {
  const identifier = (attomProp.identifier as Record<string, unknown>) ?? {};
  const address    = (attomProp.address   as Record<string, unknown>) ?? {};
  const building   = (attomProp.building  as Record<string, unknown>) ?? {};
  const rooms      = (building.rooms      as Record<string, unknown>) ?? {};
  const size       = (building.size       as Record<string, unknown>) ?? {};
  const summary    = (attomProp.summary   as Record<string, unknown>) ?? {};
  const avm        = (attomProp.avm       as Record<string, unknown>) ?? {};
  const avmAmount  = (avm.amount          as Record<string, unknown>) ?? {};
  const sale       = (attomProp.sale      as Record<string, unknown>) ?? {};
  const saleAmount = (sale.amount         as Record<string, unknown>) ?? {};
  const assessment = (attomProp.assessment as Record<string, unknown>) ?? {};
  const assessmentMarket = (assessment.market as Record<string, unknown>) ?? {};
  const assessmentCalc   = (assessment.calculations as Record<string, unknown>) ?? {};
  const assessmentTax    = (assessment.tax as Record<string, unknown>) ?? {};
  const mortgage         = (attomProp.mortgage as Record<string, unknown>) ?? {};
  const mortgageAmount   = (mortgage.amount as Record<string, unknown>) ?? {};
  const mortgageLender   = (mortgage.lender as Record<string, unknown>) ?? {};
  const mortgageTerm     = (mortgage.term   as Record<string, unknown>) ?? {};
  const deed             = (attomProp.deed  as Record<string, unknown>) ?? {};
  const deedAmount       = (deed.amount     as Record<string, unknown>) ?? {};

  const attomId = String(identifier.attomId ?? identifier.Id ?? attomProp.id ?? "");

  const estimatedValue: number | null =
    (typeof avmAmount.scr === "number" && avmAmount.scr > 0 ? avmAmount.scr : null) ??
    (typeof assessmentMarket.mktttlvalue === "number" && assessmentMarket.mktttlvalue > 0 ? assessmentMarket.mktttlvalue : null) ??
    (typeof assessmentCalc.calcttlvalue === "number" && assessmentCalc.calcttlvalue > 0 ? assessmentCalc.calcttlvalue : null) ??
    null;

  const loanAmount: number | null = (mortgageAmount.loanamt as number) > 0 ? (mortgageAmount.loanamt as number) : null;
  const taxAmt: number | null = typeof assessmentTax.taxamt === "number" && assessmentTax.taxamt > 0 ? assessmentTax.taxamt : null;
  const lienAmount: number | null = loanAmount ?? (taxAmt !== null ? taxAmt * 10 : null);
  const equityPct = estimatedValue && lienAmount != null
    ? Math.round(((estimatedValue - lienAmount) / estimatedValue) * 100)
    : null;

  const foreclosureStatus = String(sale.foreclosure ?? "").trim().toUpperCase();
  const absenteeInd = String(summary.absenteeInd ?? "").toUpperCase();
  const distressTypes: string[] = [];
  if (foreclosureStatus && foreclosureStatus !== "N") distressTypes.push("foreclosure");
  if (absenteeInd.includes("ABSENTEE") && assessmentTax.taxamt) distressTypes.push("delinquency");
  if (distressTypes.length === 0) {
    const ft = (filters.distressTypes as string[]) ?? [];
    if (ft.length > 0) distressTypes.push(ft[0]);
  }

  const ownerName = String(
    (deed.buyer as Record<string, unknown>)?.name1full ?? summary.owner1fullname ?? summary.ownerfullname ?? ""
  ).trim() || null;

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
        lenderName: String(mortgageLender.name ?? mortgageLender.lendername ?? "").trim() || null,
        loanType: String(mortgageTerm.termtype ?? mortgage.loantype ?? "").trim() || null,
        isCashPurchase: String(saleAmount.saledisclosuretype ?? "").toUpperCase().includes("CASH"),
      },
      avmRange: { high: (avmAmount.high as number) ?? null, low: (avmAmount.low as number) ?? null },
      ownerName,
      deedSaleAmt: (deedAmount.saleamt as number) > 0 ? (deedAmount.saleamt as number) : null,
    },
    equity_pct: equityPct,
    status: "scoring" as const,
    search_filters: filters,
  };
}

// ── ATTOM fetch ───────────────────────────────────────────────────────────────
async function fetchAttomForFilters(filters: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const attomApiKey = Deno.env.get("ATTOM_API_KEY");
  if (!attomApiKey) throw new Error("ATTOM_API_KEY not configured");

  const location = String(filters.location ?? "");
  const isZip = /^\d{5}$/.test(location.trim());
  const params = new URLSearchParams({ pagesize: "50", page: "1" });

  if (isZip) {
    params.set("postalcode", location.trim());
  } else {
    const [city, state] = location.split(",").map((s) => s.trim());
    if (city) params.set("address2", city);
    if (state) params.set("state", state);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ATTOM_TIMEOUT);

  try {
    const resp = await fetch(
      `https://api.gateway.attomdata.com/propertyapi/v1.0.0/allevents/detail?${params}`,
      { headers: { apikey: attomApiKey, Accept: "application/json" }, signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`ATTOM ${resp.status}: ${body.slice(0, 300)}`);
    }
    const data = await resp.json();
    return (data.property ?? data.properties ?? data.eventHistory ?? []) as Record<string, unknown>[];
  } finally {
    clearTimeout(timeout);
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Find all monitored searches that are due to run
    const { data: dueSearches, error: fetchErr } = await supabase
      .from("saved_searches" as any)
      .select("*")
      .eq("is_monitored", true)
      .or("last_monitored_at.is.null,last_monitored_at.lt." + new Date(Date.now() - 3600_000).toISOString());

    if (fetchErr) throw fetchErr;
    if (!dueSearches || dueSearches.length === 0) {
      return new Response(JSON.stringify({ ran: 0, newProperties: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalNew = 0;

    for (const search of dueSearches) {
      // Check if it's actually due based on its frequency
      if (search.last_monitored_at) {
        const nextDue = new Date(search.last_monitored_at).getTime() + (search.monitor_frequency_hours ?? 24) * 3600_000;
        if (Date.now() < nextDue) continue;
      }

      try {
        const filters = (search.filters as Record<string, unknown>) ?? {};
        const seenIds: string[] = (search.seen_attom_ids as string[]) ?? [];

        const attomProps = await fetchAttomForFilters(filters).catch((err) => {
          console.error(`[run-monitored-searches] ATTOM failed for search ${search.id}:`, err);
          return [] as Record<string, unknown>[];
        });

        // Filter to only unseen ATTOM IDs
        const newProps = attomProps.filter((p) => {
          const id = (p.identifier as Record<string, unknown>)?.attomId ?? (p.identifier as Record<string, unknown>)?.Id ?? p.id;
          return id && !seenIds.includes(String(id));
        });

        if (newProps.length === 0) {
          await supabase
            .from("saved_searches" as any)
            .update({ last_monitored_at: new Date().toISOString() })
            .eq("id", search.id);
          continue;
        }

        const searchBatchId = crypto.randomUUID();
        const mappedProps = newProps.map((p) =>
          mapAttomProp(p as Record<string, unknown>, search.user_id, searchBatchId, filters)
        );

        // Upsert new properties
        const { data: inserted, error: insertErr } = await supabase
          .from("properties" as any)
          .upsert(mappedProps, { onConflict: "user_id,attom_id", ignoreDuplicates: false })
          .select("id, attom_id");

        if (insertErr) {
          console.error(`[run-monitored-searches] Upsert failed for search ${search.id}:`, insertErr);
        } else if (inserted && inserted.length > 0) {
          totalNew += inserted.length;

          // Trigger run-deal-analyze for each new property (fire-and-forget)
          const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime;
          const analyzeAll = Promise.all(
            inserted.map((prop: { id: string }) =>
              fetch(`${supabaseUrl}/functions/v1/run-deal-analyze`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${serviceRoleKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ propertyId: prop.id }),
              }).catch((err) => console.error(`[run-monitored-searches] analyze failed for ${prop.id}:`, err))
            )
          );
          if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(analyzeAll);
          else analyzeAll.catch(() => {});

          // Update seen_attom_ids with the new IDs
          const newAttomIds = inserted
            .map((p: { attom_id?: string }) => p.attom_id)
            .filter(Boolean) as string[];
          const updatedSeen = [...new Set([...seenIds, ...newAttomIds])];

          await supabase
            .from("saved_searches" as any)
            .update({
              last_monitored_at: new Date().toISOString(),
              seen_attom_ids: updatedSeen,
            })
            .eq("id", search.id);
        }
      } catch (searchErr) {
        console.error(`[run-monitored-searches] Error processing search ${search.id}:`, searchErr);
        // Still update last_monitored_at to avoid hammering on repeated errors
        await supabase
          .from("saved_searches" as any)
          .update({ last_monitored_at: new Date().toISOString() })
          .eq("id", search.id)
          .catch(() => {});
      }
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
