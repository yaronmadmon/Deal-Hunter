import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  try {
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

    const { propertyId, outreachType } = await req.json() as { propertyId: string; outreachType: "email" | "sms" };
    if (!propertyId || !outreachType) {
      return new Response(JSON.stringify({ error: "propertyId and outreachType are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: property, error: propError } = await supabase
      .from("properties")
      .select("address, city, state, zip, deal_verdict, deal_score, distress_types, distress_details, estimated_value, equity_pct, report_data")
      .eq("id", propertyId)
      .single();

    if (propError || !property) {
      return new Response(JSON.stringify({ error: "Property not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ownerContact } = await supabase
      .from("owner_contacts")
      .select("owner_name")
      .eq("property_id", propertyId)
      .eq("user_id", user.id)
      .maybeSingle();

    const dd = (property.distress_details as Record<string, unknown>) ?? {};
    const reportData = (property.report_data as Record<string, unknown>) ?? {};
    const ownerName = ownerContact?.owner_name
      || (dd.ownerName as string)
      || (dd.owner_name as string)
      || "Property Owner";

    const systemPrompt = `You are a professional real estate investor writing outreach to a distressed property owner. Be empathetic and solution-focused. Never be pushy — you're offering to help solve a financial problem. Focus on the owner's situation, not your profit. Return only valid JSON.`;

    const propertyContext = `Address: ${property.address}, ${property.city}, ${property.state} ${property.zip}
Owner Name: ${ownerName}
Est. Value: $${property.estimated_value ?? "Unknown"}
Equity: ${property.equity_pct != null ? `${Math.round(property.equity_pct as number)}%` : "Unknown"}
Distress Types: ${(property.distress_types as string[] ?? []).join(", ") || "None identified"}
Deal Score: ${property.deal_score ?? "N/A"} (${property.deal_verdict ?? "Unknown"})
Distress Analysis: ${(reportData.distress_analysis as string) ?? ""}
Score Rationale: ${(reportData.score_rationale as string) ?? ""}
Opportunity Type: ${(reportData.opportunity_type as string) ?? "distressed"}
Opportunity Analysis: ${(reportData.opportunity_analysis as string) ?? ""}`;

    let userPrompt: string;
    let maxTokens: number;

    if (outreachType === "sms") {
      userPrompt = `Write a personalized SMS to this distressed property owner. Max 160 characters. Casual, friendly tone. Mention their name and that you're a local investor who may be able to help with their situation. No hard sell.

${propertyContext}

Return JSON: { "body": "<sms text under 160 chars>" }`;
      maxTokens = 300;
    } else {
      userPrompt = `Write a personalized email to this distressed property owner. Include a compelling subject line. Body: 3-4 short paragraphs. Empathetic tone — acknowledge their situation, explain you're a local investor who pays cash and closes fast, offer a no-obligation conversation.

${propertyContext}

Return JSON: { "subject": "<email subject>", "body": "<email body with paragraph breaks using \\n\\n>" }`;
      maxTokens = 800;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`OpenAI API ${response.status}: ${body.slice(0, 300)}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    const draft = JSON.parse(raw);

    return new Response(JSON.stringify({ ok: true, draft }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[generate-outreach] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
