import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("analyses")
      .update({ status: "failed" })
      .in("status", ["pending", "fetching", "analyzing"])
      .lt("updated_at", fiveMinutesAgo)
      .select("id, idea, status");

    if (error) throw error;

    // Also mark stuck Deal Hunter property searches as failed
    const { data: propData, error: propError } = await supabase
      .from("properties")
      .update({ status: "failed" })
      .in("status", ["searching", "scoring"])
      .lt("updated_at", fiveMinutesAgo)
      .select("id, address, status");

    if (propError) {
      console.warn("Timeout watchdog: properties update error:", propError);
    }

    console.log(`Timeout watchdog: marked ${data?.length ?? 0} stuck analyses as failed`);
    console.log(`Timeout watchdog: marked ${propData?.length ?? 0} stuck properties as failed`);

    return new Response(
      JSON.stringify({
        marked_failed: data?.length ?? 0,
        analyses: data,
        properties_marked_failed: propData?.length ?? 0,
        properties: propData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Timeout watchdog error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
