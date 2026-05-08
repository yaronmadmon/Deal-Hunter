import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BRIEF_REFRESHES = 10;

type OverdueDeal = {
  id: string;
  user_id: string;
  property_id: string;
  follow_up_at: string;
  urgency_flag: boolean;
  next_step_brief: string | null;
  next_action: string | null;
  follow_up_status: string;
  stage: string;
  properties: {
    address: string;
    city: string;
    state: string;
    distress_types: string[] | null;
    equity_pct: number | null;
    deal_score: number | null;
    deal_verdict: string | null;
    report_data: Record<string, unknown> | null;
  } | null;
};

async function refreshBrief(
  deal: OverdueDeal,
  supabase: ReturnType<typeof createClient>,
  openaiKey: string
): Promise<void> {
  try {
    const property = deal.properties;
    if (!property) return;

    const { data: contactLog } = await supabase
      .from("contact_log")
      .select("contact_type, outcome, notes, created_at")
      .eq("property_id", deal.property_id)
      .eq("user_id", deal.user_id)
      .order("created_at", { ascending: false })
      .limit(10);

    const rd = property.report_data ?? {};
    const contactHistory = (contactLog ?? []).map((e) => {
      const ts = new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return `[${ts}] ${e.contact_type}${e.outcome ? ` — ${e.outcome}` : ""}${e.notes ? ` — "${e.notes}"` : ""}`;
    }).join("\n") || "No contacts logged yet.";

    const systemPrompt = `You are a real estate investor coaching assistant. The investor has missed a follow-up deadline. Give them a concise, action-oriented coaching note for what to do next. Return ONLY valid JSON.

Scheduling rules:
- Left voicemail: 3 days, next_action="call"
- No answer after 2+ attempts: 4 days, next_action="text"
- No answer after 4+ attempts: 5 days, next_action="letter"
- 6+ attempts with no response: 14 days, next_action="pause"
- Spoke + interested: 2 days, next_action="call"
- Spoke + not interested: 7 days, next_action="call"
- follow_up_at must be ISO 8601 UTC`;

    const userPrompt = `Property: ${property.address}, ${property.city}, ${property.state}
Distress Types: ${(property.distress_types ?? []).join(", ") || "Unknown"}
Equity: ${property.equity_pct != null ? `${Math.round(property.equity_pct)}%` : "Unknown"}
Deal Score: ${property.deal_score ?? "N/A"} (${property.deal_verdict ?? "Unknown"})
Urgency Summary: ${(rd.urgency_summary as string) ?? "None"}
Next Step (from AI analysis): ${(rd.next_step as string) ?? "None"}

Contact History (most recent first):
${contactHistory}

This follow-up is OVERDUE. The investor missed the scheduled follow-up. Update the recommendation.

Return JSON:
{
  "next_action": "call" | "text" | "email" | "letter" | "pause",
  "next_step_brief": "<1-2 sentence coaching note emphasizing urgency>",
  "follow_up_at": "<new ISO 8601 UTC timestamp>",
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

    if (!response.ok) {
      console.error(`[run-followup-agent] OpenAI error for deal ${deal.id}:`, response.status);
      return;
    }

    const data = await response.json();
    let result: { next_action?: string; next_step_brief?: string; follow_up_at?: string; urgency_flag?: boolean };
    try {
      result = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    } catch {
      return;
    }

    const nextFollowUpAt = result.follow_up_at && !isNaN(Date.parse(result.follow_up_at))
      ? result.follow_up_at
      : daysFromNow(3);

    await supabase
      .from("pipeline_deals")
      .update({
        next_step_brief: result.next_step_brief ?? deal.next_step_brief,
        next_action: result.next_action ?? deal.next_action ?? "call",
        follow_up_at: nextFollowUpAt,
        urgency_flag: result.urgency_flag ?? deal.urgency_flag,
        follow_up_status: "pending",
      })
      .eq("id", deal.id);
  } catch (err) {
    console.error(`[run-followup-agent] refreshBrief failed for deal ${deal.id}:`, err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const now = new Date().toISOString();

    // Find all deals that are past their follow_up_at and still marked pending
    const { data: overdue, error: fetchError } = await supabase
      .from("pipeline_deals")
      .select(`
        id, user_id, property_id, follow_up_at, urgency_flag,
        next_step_brief, next_action, follow_up_status, stage,
        properties(address, city, state, distress_types, equity_pct, deal_score, deal_verdict, report_data)
      `)
      .in("stage", ["contacted", "follow_up", "negotiating"])
      .lt("follow_up_at", now)
      .eq("follow_up_status", "pending")
      .not("follow_up_at", "is", null)
      .limit(50);

    if (fetchError) throw fetchError;
    if (!overdue || overdue.length === 0) {
      return new Response(JSON.stringify({ processed: 0, notified: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const deals = overdue as unknown as OverdueDeal[];

    // Mark all as overdue in one batch
    const dealIds = deals.map((d) => d.id);
    await supabase
      .from("pipeline_deals")
      .update({ follow_up_status: "overdue" })
      .in("id", dealIds);

    // Insert notifications (one per deal, no spam guard needed — status flip prevents double-notify)
    const notifications = deals.map((deal) => ({
      user_id: deal.user_id,
      title: `Follow-up overdue: ${deal.properties?.address ?? "Property"}`,
      message: deal.next_step_brief ?? "Time to reach out — this deal needs your attention.",
    }));
    await supabase.from("notifications").insert(notifications);

    // Urgent email alerts — deals with urgency_flag that are overdue
    const urgentDeals = deals.filter((d) => d.urgency_flag);
    if (urgentDeals.length > 0) {
      // Group by user to avoid sending multiple emails to same user
      const byUser = new Map<string, OverdueDeal[]>();
      for (const deal of urgentDeals) {
        const list = byUser.get(deal.user_id) ?? [];
        list.push(deal);
        byUser.set(deal.user_id, list);
      }

      for (const [userId, userDeals] of byUser.entries()) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", userId)
          .maybeSingle();

        if (!profile?.email) continue;

        await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "follow_up_digest",
            to: profile.email,
            data: {
              appUrl: Deno.env.get("APP_URL") ?? "https://deal-hunter-beta.vercel.app",
              overdueDeals: userDeals.map((d) => ({
                id: d.property_id,
                address: d.properties?.address ?? "Unknown",
                next_action: d.next_action ?? "call",
                next_step_brief: d.next_step_brief ?? "",
              })),
              dueTodayDeals: [],
            },
          }),
        }).catch((err) => console.error("[run-followup-agent] email send failed:", err));
      }
    }

    // Refresh AI briefs for up to MAX_BRIEF_REFRESHES deals using waitUntil
    if (openaiKey) {
      const toRefresh = deals.slice(0, MAX_BRIEF_REFRESHES);
      const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void } }).EdgeRuntime;
      const refreshAll = Promise.all(
        toRefresh.map((deal) => refreshBrief(deal, supabase, openaiKey))
      );
      if (edgeRuntime?.waitUntil) {
        edgeRuntime.waitUntil(refreshAll);
      } else {
        refreshAll.catch(() => {});
      }
    }

    return new Response(
      JSON.stringify({ processed: deals.length, notified: deals.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[run-followup-agent] Error:", message);
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
