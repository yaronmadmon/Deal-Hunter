import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

const normalizeFilters = (body: Record<string, unknown>): SearchFilters => {
  const location = typeof body.location === "string" ? body.location.trim() : "";

  return {
    searchMode: inferSearchMode(location),
    location,
    distressTypes: Array.isArray(body.distressTypes)
      ? body.distressTypes.filter((value): value is string => typeof value === "string")
      : [],
    priceMin: typeof body.priceMin === "number" ? body.priceMin : undefined,
    priceMax: typeof body.priceMax === "number" ? body.priceMax : undefined,
    propertyTypes: Array.isArray(body.propertyTypes)
      ? body.propertyTypes.filter((value): value is string => typeof value === "string")
      : undefined,
    equityMin: typeof body.equityMin === "number" ? body.equityMin : undefined,
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const filters = normalizeFilters((body ?? {}) as Record<string, unknown>);

    if (!filters.location || filters.location.length < (filters.searchMode === "property" ? 6 : 3)) {
      return new Response(JSON.stringify({
        error: filters.searchMode === "property"
          ? "property address is required"
          : "location is required (zip code or city)",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validDistressTypes = ["tax_lien", "foreclosure", "divorce", "delinquency"];
    const invalidTypes = filters.distressTypes.filter((type) => !validDistressTypes.includes(type));
    if (invalidTypes.length > 0) {
      return new Response(JSON.stringify({ error: `Invalid distress types: ${invalidTypes.join(", ")}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const searchBatchId = crypto.randomUUID();

    // Create a named campaign to group these results
    const serviceClient = createClient(supabaseUrl!, serviceRoleKey!);
    const campaignMonth = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const campaignName = `${filters.location} — ${campaignMonth}`;
    const { data: campaign } = await serviceClient
      .from("search_campaigns")
      .insert({ user_id: user.id, name: campaignName, filters })
      .select("id")
      .single();
    const campaignId: string | null = campaign?.id ?? null;

    const fetchPromise = fetch(`${supabaseUrl}/functions/v1/run-property-fetch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        apikey: anonKey,
      },
      body: JSON.stringify({
        searchBatchId,
        userId: user.id,
        filters,
        campaignId,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const responseBody = await response.text().catch(() => "");
          console.error(
            `[start-property-search] run-property-fetch returned ${response.status}: ${responseBody.slice(0, 500)}`,
          );
        }
      })
      .catch((error) => {
        console.error("[start-property-search] Failed to trigger run-property-fetch:", error);
      });

    const edgeRuntime = (
      globalThis as { EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void } }
    ).EdgeRuntime;
    if (edgeRuntime?.waitUntil) {
      edgeRuntime.waitUntil(fetchPromise);
    } else {
      fetchPromise.catch(() => {});
    }

    return new Response(JSON.stringify({ queued: true, searchBatchId, campaignId }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
