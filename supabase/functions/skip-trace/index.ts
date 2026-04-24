import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const tracerfyKey = Deno.env.get("TRACERFY_API_KEY");

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { propertyId } = await req.json();
    if (!propertyId) {
      return new Response(JSON.stringify({ error: "propertyId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check if we already have a cached skip trace for this (property, user) pair
    const { data: existing } = await supabase
      .from("owner_contacts")
      .select("*")
      .eq("property_id", propertyId)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      // Return cached result — no credit charge
      return new Response(JSON.stringify({ ok: true, cached: true, contact: existing }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the property to get address + owner name
    const { data: property, error: propError } = await supabase
      .from("properties")
      .select("address, city, state, zip, distress_details")
      .eq("id", propertyId)
      .single();

    if (propError || !property) {
      return new Response(JSON.stringify({ error: "Property not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const distressDetails = property.distress_details as Record<string, unknown> ?? {};
    const ownerName = (distressDetails.ownerName ?? distressDetails.owner_name ?? "") as string;

    if (!tracerfyKey) {
      return new Response(JSON.stringify({ error: "Skip tracing service not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduct 1 credit atomically BEFORE calling Tracerfy
    // Uses userClient so auth.uid() resolves correctly in the RPC
    const { data: deducted, error: deductError } = await userClient.rpc(
      "deduct_credit_for_property",
      { p_property_id: propertyId }
    );

    if (deductError || !deducted) {
      return new Response(
        JSON.stringify({ error: "Insufficient skip trace credits", code: "NO_CREDITS" }),
        {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Call Tracerfy API
    let tracerfyData: Record<string, unknown> = {};
    let tracerfyFailed = false;

    try {
      const tracerfyResponse = await fetch("https://api.tracerfy.com/v1/skiptrace", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tracerfyKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: ownerName,
          address: property.address,
          city: property.city,
          state: property.state,
          zip: property.zip,
        }),
      });

      if (!tracerfyResponse.ok) {
        const body = await tracerfyResponse.text().catch(() => "");
        throw new Error(`Tracerfy API ${tracerfyResponse.status}: ${body.slice(0, 300)}`);
      }

      tracerfyData = await tracerfyResponse.json();
    } catch (tracerfyError) {
      const errMsg = tracerfyError instanceof Error ? tracerfyError.message : String(tracerfyError);
      console.error("[skip-trace] Tracerfy call failed:", errMsg);
      tracerfyFailed = true;

      // Refund the credit — read current balance, add 1 back
      try {
        const { data: curr } = await supabase
          .from("profiles")
          .select("credits")
          .eq("id", user.id)
          .single();
        const currentCredits = typeof curr?.credits === "number" ? curr.credits : 0;
        await supabase
          .from("profiles")
          .update({ credits: currentCredits + 1 })
          .eq("id", user.id);
        console.log(`[skip-trace] Refunded 1 credit to user ${user.id}`);
      } catch (refundErr) {
        console.error("[skip-trace] Credit refund failed:", refundErr);
      }

      return new Response(
        JSON.stringify({ error: `Skip trace service error: ${errMsg}` }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (tracerfyFailed) {
      return new Response(JSON.stringify({ error: "Skip trace failed" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map Tracerfy response to our schema
    // Tracerfy returns: { phones: [{number, type, confidence}], emails: [{address, confidence}], mailingAddress: {...} }
    const contactRow = {
      property_id: propertyId,
      user_id: user.id,
      owner_name: (tracerfyData.name as string) ?? ownerName ?? null,
      phones: (tracerfyData.phones as unknown[]) ?? [],
      emails: (tracerfyData.emails as unknown[]) ?? [],
      mailing_address: (tracerfyData.mailingAddress as Record<string, unknown>) ?? {},
      skip_trace_source: "tracerfy",
      traced_at: new Date().toISOString(),
    };

    const { data: inserted, error: insertError } = await supabase
      .from("owner_contacts")
      .insert(contactRow)
      .select()
      .single();

    if (insertError) {
      console.error("[skip-trace] Failed to save owner contact:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save contact data" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, cached: false, contact: inserted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[skip-trace] Unhandled error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
