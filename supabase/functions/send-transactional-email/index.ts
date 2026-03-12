import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { sendLovableEmail } from "npm:@lovable.dev/email-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type EmailType = "welcome" | "analysis_complete" | "payment_confirmation" | "subscription_activated";

interface EmailRequest {
  type: EmailType;
  to: string;
  data?: Record<string, unknown>;
}

const toPlainText = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const templates: Record<EmailType, (data: Record<string, unknown>) => { subject: string; html: string }> = {
  welcome: (data) => ({
    subject: "Welcome to Gold Rush! 🚀",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff;">
        <h1 style="color: #1a1a1a; font-size: 24px;">Welcome to Gold Rush!</h1>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">
          You're all set to validate your next startup idea with real market data.
        </p>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">
          You have <strong>${(data?.credits as number | undefined) ?? 2} free credits</strong> to get started. Each credit lets you run a full market validation analysis.
        </p>
        <a href="${(data?.appUrl as string | undefined) || 'https://goldrushapp.live'}/dashboard" 
           style="display: inline-block; background: #d4af37; color: #000; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 16px;">
          Start Your First Analysis →
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">Gold Rush — Data-driven idea validation</p>
      </div>
    `,
  }),
  analysis_complete: (data) => ({
    subject: `Your analysis is ready: ${((data?.idea as string | undefined)?.slice(0, 50)) || "Market Report"}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff;">
        <h1 style="color: #1a1a1a; font-size: 24px;">Your Analysis is Ready! 📊</h1>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">
          We've finished analyzing: <strong>"${(data?.idea as string | undefined) || 'your idea'}"</strong>
        </p>
        ${(data?.score ? `<p style="color: #555; font-size: 16px;">Overall Score: <strong>${data.score as number}/100</strong></p>` : "")}
        <a href="${(data?.appUrl as string | undefined) || 'https://goldrushapp.live'}/report/${(data?.analysisId as string | undefined) || ''}" 
           style="display: inline-block; background: #d4af37; color: #000; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 16px;">
          View Full Report →
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">Gold Rush — Data-driven idea validation</p>
      </div>
    `,
  }),
  payment_confirmation: (data) => ({
    subject: "Payment Confirmed — Credits Added ✅",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff;">
        <h1 style="color: #1a1a1a; font-size: 24px;">Payment Confirmed!</h1>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">
          <strong>${(data?.credits as number | undefined) || 0} credits</strong> have been added to your account.
        </p>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">
          Your new balance: <strong>${(data?.newBalance as number | string | undefined) ?? "N/A"} credits</strong>
        </p>
        <a href="${(data?.appUrl as string | undefined) || 'https://goldrushapp.live'}/dashboard" 
           style="display: inline-block; background: #d4af37; color: #000; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 16px;">
          Go to Dashboard →
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">Gold Rush — Data-driven idea validation</p>
      </div>
    `,
  }),
  subscription_activated: (data) => ({
    subject: `Your ${(data?.plan as string | undefined) || "Gold Rush"} Plan is Active! 🎉`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff;">
        <h1 style="color: #1a1a1a; font-size: 24px;">Welcome to ${(data?.plan as string | undefined) || "Gold Rush"} Plan! 🎉</h1>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">
          Your subscription is now active. Here's what you get:
        </p>
        <ul style="color: #555; font-size: 16px; line-height: 1.8;">
          ${(data?.plan === "Agency" ? "<li>Unlimited reports</li><li>3 team seats</li><li>White label PDF</li><li>Bulk analysis</li><li>Gold Rush Live access</li>" : "")}
          ${(data?.plan === "Pro" ? "<li>Unlimited reports</li><li>Gold Rush Live access</li><li>Idea tracking</li><li>GitHub trending signals</li>" : "")}
          ${(data?.plan === "Starter" ? "<li>10 credits per month</li><li>Full 6-card reports</li><li>Blueprint included</li><li>Clean PDF download</li>" : "")}
        </ul>
        ${(data?.bonusCredits ? `<p style="color: #555; font-size: 16px; line-height: 1.6;">🎁 We've added <strong>${data.bonusCredits as number} bonus credits</strong> to get you started!</p>` : "")}
        <p style="color: #555; font-size: 16px; line-height: 1.6;">
          Your plan renews on <strong>${(data?.renewDate as string | undefined) || "next month"}</strong>.
        </p>
        <a href="${(data?.appUrl as string | undefined) || 'https://goldrushapp.live'}/dashboard" 
           style="display: inline-block; background: #d4af37; color: #000; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 16px;">
          Start Validating Ideas →
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">Gold Rush — Data-driven idea validation</p>
      </div>
    `,
  }),
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const senderDomain = Deno.env.get("EMAIL_SENDER_DOMAIN") ?? "notify.goldrushapp.live";
  const fromAddress = Deno.env.get("EMAIL_FROM") ?? "Gold Rush <no-reply@notify.goldrushapp.live>";

  const supabaseAdmin = supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : null;

  let parsedBody: Partial<EmailRequest> = {};

  try {
    parsedBody = (await req.json()) as Partial<EmailRequest>;

    const type = typeof parsedBody.type === "string" && parsedBody.type in templates
      ? (parsedBody.type as EmailType)
      : null;
    const to = typeof parsedBody.to === "string" ? parsedBody.to.trim() : "";
    const data = typeof parsedBody.data === "object" && parsedBody.data !== null
      ? (parsedBody.data as Record<string, unknown>)
      : {};

    if (!type || !to) {
      return new Response(JSON.stringify({ error: "Invalid email type or missing recipient" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!lovableApiKey) {
      throw new Error("Email service not configured");
    }

    const { subject, html } = templates[type](data);
    const messageId = crypto.randomUUID();
    const unsubscribeToken = crypto.randomUUID();

    if (supabaseAdmin) {
      await supabaseAdmin.from("email_unsubscribe_tokens").insert({
        email: to,
        token: unsubscribeToken,
      });
    }

    await sendLovableEmail(
      {
        to,
        from: fromAddress,
        sender_domain: senderDomain,
        subject,
        html,
        text: toPlainText(html),
        purpose: "transactional",
        label: type,
        external_id: messageId,
        idempotency_key: messageId,
        unsubscribe_token: unsubscribeToken,
      },
      { apiKey: lovableApiKey, sendUrl: Deno.env.get("LOVABLE_SEND_URL") }
    );

    if (supabaseAdmin) {
      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: type,
        recipient_email: to,
        status: "sent",
      });
    }

    return new Response(JSON.stringify({ sent: true, messageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Email send failed";
    console.error("[send-email] Error:", errorMessage);

    try {
      const type = typeof parsedBody.type === "string" ? parsedBody.type : "unknown";
      const to = typeof parsedBody.to === "string" ? parsedBody.to : "unknown";

      if (supabaseAdmin) {
        await supabaseAdmin.from("email_send_log").insert({
          template_name: type,
          recipient_email: to,
          status: "failed",
          error_message: errorMessage.slice(0, 1000),
        });
      }
    } catch {
      // no-op
    }

    return new Response(JSON.stringify({ sent: false, reason: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
