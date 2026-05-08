import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STOP_REGEX = /^(STOP|UNSUBSCRIBE|QUIT|CANCEL|END)\b/i;

async function sendTwilio(accountSid: string, authToken: string, from: string, to: string, body: string): Promise<string | null> {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("[receive-sms] Twilio send failed:", res.status, errBody.slice(0, 200));
    return null;
  }
  const data = await res.json();
  return data?.sid ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const openaiKey = Deno.env.get("OPENAI_API_KEY")!;
  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
  const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER") ?? "";
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const contentType = req.headers.get("content-type") ?? "";
    let fromPhone = "";
    let body = "";
    let twilioMsgSid = "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      fromPhone = params.get("From") ?? "";
      body = params.get("Body") ?? "";
      twilioMsgSid = params.get("MessageSid") ?? "";
    } else {
      const payload = await req.json().catch(() => ({}));
      fromPhone = payload.From ?? payload.from ?? "";
      body = payload.Body ?? payload.body ?? "";
      twilioMsgSid = payload.MessageSid ?? payload.messageSid ?? "";
    }

    if (!fromPhone || !body) {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // STOP compliance — send confirmation immediately, no AI involvement
    if (STOP_REGEX.test(body.trim())) {
      await supabase
        .from("sms_threads")
        .update({ status: "ended" })
        .eq("homeowner_phone", fromPhone)
        .eq("status", "active");

      await sendTwilio(twilioAccountSid, twilioAuthToken, twilioPhone, fromPhone,
        "You have been unsubscribed and will not receive further messages. Reply START to opt back in.");
      return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", {
        status: 200, headers: { "Content-Type": "text/xml" },
      });
    }

    // Opt back in
    if (/^START\b/i.test(body.trim())) {
      await supabase
        .from("sms_threads")
        .update({ status: "active" })
        .eq("homeowner_phone", fromPhone)
        .eq("status", "ended");
      return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", {
        status: 200, headers: { "Content-Type": "text/xml" },
      });
    }

    // Find active thread for this sender
    const { data: thread } = await supabase
      .from("sms_threads")
      .select("*")
      .eq("homeowner_phone", fromPhone)
      .eq("status", "active")
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!thread) {
      console.log("[receive-sms] No active thread for", fromPhone);
      return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", {
        status: 200, headers: { "Content-Type": "text/xml" },
      });
    }

    // Fetch property context
    const { data: property } = await supabase
      .from("properties")
      .select("address, city, state, distress_types, report_data, distress_details")
      .eq("id", thread.property_id)
      .single();

    // Fetch owner name
    const { data: ownerContact } = await supabase
      .from("owner_contacts")
      .select("owner_name")
      .eq("property_id", thread.property_id)
      .maybeSingle();

    const ownerName = ownerContact?.owner_name
      ?? (property?.distress_details as Record<string, unknown>)?.ownerName as string
      ?? "the owner";

    // Fetch full conversation history
    const { data: history } = await supabase
      .from("sms_messages")
      .select("direction, body")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true });

    // Log inbound message first so it's part of history context
    await supabase.from("sms_messages").insert({
      thread_id: thread.id,
      direction: "inbound",
      body,
      telnyx_message_id: twilioMsgSid,
    });

    const rd = (property?.report_data as Record<string, unknown>) ?? {};
    const distressTypes = ((property?.distress_types as string[]) ?? []).join(", ") || "distressed";
    const urgencySummary = (rd.urgency_summary as string) ?? "";
    const address = property ? `${property.address}, ${property.city}, ${property.state}` : "this property";

    const systemPrompt = `You are an AI assistant representing a real estate investor.
You are texting a distressed property owner about their property at ${address}.
Your goal is to have a warm, empathetic conversation and book a 15-minute phone call between the owner and the investor.

Property context: ${distressTypes}${urgencySummary ? `. ${urgencySummary}` : ""}
Owner name: ${ownerName}

Rules:
- Keep replies under 160 characters
- Be conversational, friendly, never pushy or salesy
- Acknowledge their situation with empathy first
- When they show any interest, ask what day and time works for a quick call
- When they confirm a specific time (e.g. "Tuesday at 3pm"), respond with "Perfect! I'll let them know. They'll call you then." and set meeting_confirmed=true
- If they seem hesitant, give them space — ask if you can check back later
- Never mention a specific price unless they bring it up first
- If they ask who you are: "I'm an assistant for a local investor interested in your property at ${address}."

Return ONLY valid JSON with no markdown:
{
  "reply": "<your SMS reply, max 160 chars>",
  "meeting_detected": true or false,
  "meeting_time_raw": "<time they mentioned, e.g. Tuesday at 3pm, or null>",
  "meeting_confirmed": true or false
}`;

    const historyMessages = (history ?? []).map((m) => ({
      role: m.direction === "outbound" ? "assistant" : "user",
      content: m.body,
    }));
    historyMessages.push({ role: "user", content: body });

    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "system", content: systemPrompt }, ...historyMessages],
        response_format: { type: "json_object" },
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    let aiResult: {
      reply: string;
      meeting_detected: boolean;
      meeting_time_raw: string | null;
      meeting_confirmed: boolean;
    } = {
      reply: "Thanks for reaching out! I'll have someone follow up with you shortly.",
      meeting_detected: false,
      meeting_time_raw: null,
      meeting_confirmed: false,
    };

    if (gptRes.ok) {
      const gptData = await gptRes.json();
      try {
        aiResult = JSON.parse(gptData.choices?.[0]?.message?.content ?? "{}");
      } catch {
        console.error("[receive-sms] Failed to parse GPT response");
      }
    } else {
      console.error("[receive-sms] GPT error:", gptRes.status);
    }

    const draftReply = (aiResult.reply ?? "").slice(0, 160);

    // Auto-book meetings when confirmed — still automated since it's a calendar event, not a message
    if (aiResult.meeting_confirmed && aiResult.meeting_time_raw) {
      const { data: existingMeeting } = await supabase
        .from("meetings")
        .select("id")
        .eq("thread_id", thread.id)
        .eq("status", "pending")
        .maybeSingle();

      if (!existingMeeting) {
        await supabase.from("meetings").insert({
          user_id: thread.user_id,
          property_id: thread.property_id,
          thread_id: thread.id,
          homeowner_phone: fromPhone,
          homeowner_name: ownerName !== "the owner" ? ownerName : null,
          scheduled_at_raw: aiResult.meeting_time_raw,
          status: "pending",
        });

        await supabase.from("notifications").insert({
          user_id: thread.user_id,
          title: `Meeting booked — ${property?.address ?? "property"}`,
          message: `${ownerName} agreed to a call: ${aiResult.meeting_time_raw}`,
        });
      }
    }

    // Store AI draft for user review — do NOT auto-send
    const now = new Date().toISOString();
    await supabase
      .from("sms_threads")
      .update({
        ai_draft: draftReply,
        unread_count: (thread.unread_count ?? 0) + 1,
        last_inbound_at: now,
        last_message_at: now,
      })
      .eq("id", thread.id);

    // Return empty TwiML — no auto-reply
    return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", {
      status: 200, headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[receive-sms] Error:", msg);
    return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", {
      status: 200, headers: { "Content-Type": "text/xml" },
    });
  }
});
