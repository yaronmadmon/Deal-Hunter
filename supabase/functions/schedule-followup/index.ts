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

    const { propertyId } = await req.json() as { propertyId: string };
    if (!propertyId) {
      return new Response(JSON.stringify({ error: "propertyId is required" }), {
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

    // Fetch property
    const { data: property, error: propError } = await supabase
      .from("properties")
      .select("id, address, city, state, distress_types, equity_pct, deal_score, deal_verdict, report_data, distress_details")
      .eq("id", propertyId)
      .single();

    if (propError || !property) {
      return new Response(JSON.stringify({ error: "Property not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch contact history for this user+property
    const { data: contactLog } = await supabase
      .from("contact_log")
      .select("contact_type, outcome, notes, created_at")
      .eq("property_id", propertyId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // Fetch SMS thread data for richer context
    const { data: smsThread } = await supabase
      .from("sms_threads" as any)
      .select("id, status, last_message_at, last_inbound_at")
      .eq("property_id", propertyId)
      .eq("user_id", user.id)
      .in("status", ["active", "paused"])
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let smsMessageCount = 0;
    let smsResponseCount = 0;
    if (smsThread) {
      const { count: totalCount } = await supabase
        .from("sms_messages" as any)
        .select("id", { count: "exact", head: true })
        .eq("thread_id", smsThread.id);
      const { count: inboundCount } = await supabase
        .from("sms_messages" as any)
        .select("id", { count: "exact", head: true })
        .eq("thread_id", smsThread.id)
        .eq("direction", "inbound");
      smsMessageCount = totalCount ?? 0;
      smsResponseCount = inboundCount ?? 0;
    }

    // Ensure pipeline_deals record exists
    const { data: existingDeal } = await supabase
      .from("pipeline_deals")
      .select("id, stage, follow_up_status")
      .eq("property_id", propertyId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingDeal) {
      await supabase.from("pipeline_deals").insert({
        user_id: user.id,
        property_id: propertyId,
        stage: "contacted",
        priority: "medium",
        follow_up_status: "none",
      });
    }

    // Build prompt context
    const rd = (property.report_data as Record<string, unknown>) ?? {};
    const dd = (property.distress_details as Record<string, unknown>) ?? {};
    const ownerName = (dd.ownerName as string) || (dd.owner_name as string) || "Unknown";

    const contactHistory = (contactLog ?? []).map((e) => {
      const ts = new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return `[${ts}] ${e.contact_type}${e.outcome ? ` — ${e.outcome}` : ""}${e.notes ? ` — "${e.notes}"` : ""}`;
    }).join("\n") || "No contacts logged yet.";

    const systemPrompt = `You are a real estate investor coaching assistant. Analyze the property and contact history, then produce a structured follow-up recommendation. Return ONLY valid JSON — no prose, no markdown.

Scheduling rules (phone contacts):
- Owner spoke + interested: 2 days, next_action="call"
- Owner spoke + not interested: 7 days, next_action="call" (re-approach with new angle)
- Left voicemail: 3 days, next_action="call"
- No answer on first attempt: 3 days, next_action="call"
- No answer after 2+ attempts: 4 days, next_action="text"
- No answer after 4+ attempts: 5 days, next_action="letter"
- 6+ attempts with no response: 14 days, next_action="pause"

SMS escalation rules (use when sms_response_count > 0):
- Owner replied to SMS but no call scheduled yet: 1 day, next_action="call" (strike while warm)
- Owner replied to SMS 2+ times and engaged: urgency_flag=true, 1 day, next_action="call"
- SMS thread active but owner hasn't responded in 5+ days: next_action="call" to break through

Urgency rules:
- equity > 60% OR distress_types include foreclosure with imminent deadline: urgency_flag=true
- Owner expressed interest (spoke/interested outcome) + high equity: urgency_flag=true
- follow_up_at must be ISO 8601 UTC`;

    const userPrompt = `Property: ${property.address}, ${property.city}, ${property.state}
Owner: ${ownerName}
Distress Types: ${(property.distress_types as string[] ?? []).join(", ") || "Unknown"}
Equity: ${property.equity_pct != null ? `${Math.round(property.equity_pct as number)}%` : "Unknown"}
Deal Score: ${property.deal_score ?? "N/A"} (${property.deal_verdict ?? "Unknown"})
Urgency Summary: ${(rd.urgency_summary as string) ?? "None"}
History Summary: ${(rd.history_summary as string) ?? "None"}
Next Step (from analysis): ${(rd.next_step as string) ?? "None"}

SMS Activity: ${smsMessageCount} messages sent, ${smsResponseCount} owner replies
Contact History (most recent first):
${contactHistory}

Return JSON:
{
  "next_action": "call" | "text" | "email" | "letter" | "pause",
  "next_step_brief": "<1-2 sentence investor coaching note>",
  "follow_up_at": "<ISO 8601 UTC timestamp>",
  "urgency_flag": true | false
}`;

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
        max_tokens: 300,
        temperature: 0.2,
      }),
    });

    let aiResult: { next_action: string; next_step_brief: string; follow_up_at: string; urgency_flag: boolean };

    if (response.ok) {
      const data = await response.json();
      try {
        aiResult = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
      } catch {
        aiResult = defaultFollowUp();
      }
    } else {
      console.error("[schedule-followup] OpenAI error:", response.status);
      aiResult = defaultFollowUp();
    }

    // Validate follow_up_at is a valid date; fall back if not
    if (!aiResult.follow_up_at || isNaN(Date.parse(aiResult.follow_up_at))) {
      aiResult.follow_up_at = daysFromNow(3);
    }
    if (!["call","text","email","letter","pause"].includes(aiResult.next_action)) {
      aiResult.next_action = "call";
    }

    // Update pipeline_deals
    const updateStage = (!existingDeal || existingDeal.stage === "new") ? "contacted" : undefined;
    await supabase
      .from("pipeline_deals")
      .update({
        follow_up_at: aiResult.follow_up_at,
        next_action: aiResult.next_action,
        next_step_brief: aiResult.next_step_brief,
        urgency_flag: aiResult.urgency_flag ?? false,
        follow_up_status: "pending",
        ...(updateStage ? { stage: updateStage } : {}),
      })
      .eq("property_id", propertyId)
      .eq("user_id", user.id);

    // Notify if urgent
    if (aiResult.urgency_flag) {
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: `Urgent Follow-Up: ${property.address}`,
        message: aiResult.next_step_brief ?? "This deal needs immediate attention.",
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        next_action: aiResult.next_action,
        follow_up_at: aiResult.follow_up_at,
        next_step_brief: aiResult.next_step_brief,
        urgency_flag: aiResult.urgency_flag ?? false,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[schedule-followup] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function defaultFollowUp() {
  return {
    next_action: "call",
    next_step_brief: "Follow up with the owner to keep the conversation moving forward.",
    follow_up_at: daysFromNow(3),
    urgency_flag: false,
  };
}
