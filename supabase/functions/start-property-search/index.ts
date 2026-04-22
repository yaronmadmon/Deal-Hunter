import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SearchFilters {
  location: string;          // zip code or "City, ST"
  distressTypes: string[];   // ['tax_lien','foreclosure','divorce','delinquency']
  priceMin?: number;
  priceMax?: number;
  propertyTypes?: string[];  // ['SFR','MFR','Condo','Land','Commercial']
  equityMin?: number;        // minimum equity percentage
}

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

    // Verify the user's JWT
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
    const filters: SearchFilters = body;

    // Validate required fields
    if (!filters.location || typeof filters.location !== "string" || filters.location.trim().length < 3) {
      return new Response(JSON.stringify({ error: "location is required (zip code or city)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!filters.distressTypes || !Array.isArray(filters.distressTypes) || filters.distressTypes.length === 0) {
      return new Response(JSON.stringify({ error: "At least one distressType is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate distress types
    const validDistressTypes = ["tax_lien", "foreclosure", "divorce", "delinquency"];
    const invalidTypes = filters.distressTypes.filter((t) => !validDistressTypes.includes(t));
    if (invalidTypes.length > 0) {
      return new Response(JSON.stringify({ error: `Invalid distress types: ${invalidTypes.join(", ")}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate search batch ID — all properties from this search share this ID
    const searchBatchId = crypto.randomUUID();

    // Trigger run-property-fetch asynchronously (fire-and-forget, same pattern as start-pipeline)
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
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          console.error(
            `[start-property-search] run-property-fetch returned ${response.status}: ${body.slice(0, 500)}`,
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

    return new Response(JSON.stringify({ queued: true, searchBatchId }), {
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
