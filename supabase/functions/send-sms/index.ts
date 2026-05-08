import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sendTwilio(
  accountSid: string,
  authToken: string,
  opts: { messagingServiceSid?: string; from?: string },
  to: string,
  body: string,
): Promise<string | null> {
  const sender = opts.messagingServiceSid
    ? { MessagingServiceSid: opts.messagingServiceSid }
    : { From: opts.from! };
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ ...sender, To: to, Body: body }).toString(),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("[send-sms] Twilio error:", res.status, errBody.slice(0, 300));
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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");
  const twilioMessagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { propertyId, homeownerPhone, message } = await req.json() as {
      propertyId: string;
      homeownerPhone: string;
      message: string;
    };

    if (!propertyId || !homeownerPhone || !message) {
      return new Response(JSON.stringify({ error: "propertyId, homeownerPhone, and message are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!twilioAccountSid || !twilioAuthToken || !(twilioMessagingServiceSid || twilioPhone)) {
      return new Response(JSON.stringify({ error: "Twilio not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_MESSAGING_SERVICE_SID to Supabase secrets." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Upsert thread — one thread per (user, homeowner phone)
    const { data: thread, error: threadError } = await supabase
      .from("sms_threads")
      .upsert(
        { user_id: user.id, property_id: propertyId, homeowner_phone: homeownerPhone, status: "active" },
        { onConflict: "user_id,homeowner_phone" }
      )
      .select()
      .single();

    if (threadError || !thread) {
      throw new Error(`Thread upsert failed: ${threadError?.message}`);
    }

    const twilioMessageSid = await sendTwilio(
      twilioAccountSid,
      twilioAuthToken,
      { messagingServiceSid: twilioMessagingServiceSid ?? undefined, from: twilioPhone ?? undefined },
      homeownerPhone,
      message,
    );
    if (!twilioMessageSid) {
      throw new Error("Twilio send failed");
    }

    await supabase.from("sms_messages").insert({
      thread_id: thread.id,
      direction: "outbound",
      body: message,
      telnyx_message_id: twilioMessageSid,
    });

    // Clear AI draft and reset unread count when user sends a message
    await supabase
      .from("sms_threads")
      .update({ last_message_at: new Date().toISOString(), ai_draft: null, unread_count: 0 })
      .eq("id", thread.id);

    return new Response(JSON.stringify({ ok: true, threadId: thread.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-sms] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
