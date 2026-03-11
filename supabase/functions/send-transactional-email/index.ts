import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type EmailType = "welcome" | "analysis_complete" | "payment_confirmation" | "subscription_activated";

interface EmailRequest {
  type: EmailType;
  to: string;
  data?: Record<string, any>;
}

const templates: Record<EmailType, (data: any) => { subject: string; html: string }> = {
  welcome: (data) => ({
    subject: "Welcome to Gold Rush! 🚀",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff;">
        <h1 style="color: #1a1a1a; font-size: 24px;">Welcome to Gold Rush!</h1>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">
          You're all set to validate your next startup idea with real market data.
        </p>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">
          You have <strong>${data?.credits ?? 2} free credits</strong> to get started. Each credit lets you run a full market validation analysis.
        </p>
        <a href="${data?.appUrl || 'https://goldrush.app'}/dashboard" 
           style="display: inline-block; background: #d4af37; color: #000; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 16px;">
          Start Your First Analysis →
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">Gold Rush — Data-driven idea validation</p>
      </div>
    `,
  }),
  analysis_complete: (data) => ({
    subject: `Your analysis is ready: ${data?.idea?.slice(0, 50) || "Market Report"}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff;">
        <h1 style="color: #1a1a1a; font-size: 24px;">Your Analysis is Ready! 📊</h1>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">
          We've finished analyzing: <strong>"${data?.idea || 'your idea'}"</strong>
        </p>
        ${data?.score ? `<p style="color: #555; font-size: 16px;">Overall Score: <strong>${data.score}/100</strong></p>` : ''}
        <a href="${data?.appUrl || 'https://goldrush.app'}/report/${data?.analysisId || ''}" 
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
          <strong>${data?.credits || 0} credits</strong> have been added to your account.
        </p>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">
          Your new balance: <strong>${data?.newBalance || 'N/A'} credits</strong>
        </p>
        <a href="${data?.appUrl || 'https://goldrush.app'}/dashboard" 
           style="display: inline-block; background: #d4af37; color: #000; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 16px;">
          Go to Dashboard →
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">Gold Rush — Data-driven idea validation</p>
      </div>
    `,
  }),
  subscription_activated: (data) => ({
    subject: `Your ${data?.plan || 'Gold Rush'} Plan is Active! 🎉`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff;">
        <h1 style="color: #1a1a1a; font-size: 24px;">Welcome to ${data?.plan || 'Gold Rush'} Plan! 🎉</h1>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">
          Your subscription is now active. Here's what you get:
        </p>
        <ul style="color: #555; font-size: 16px; line-height: 1.8;">
          ${data?.plan === 'Agency' ? '<li>Unlimited reports</li><li>3 team seats</li><li>White label PDF</li><li>Bulk analysis</li><li>Gold Rush Live access</li>' : ''}
          ${data?.plan === 'Pro' ? '<li>Unlimited reports</li><li>Gold Rush Live access</li><li>Idea tracking</li><li>GitHub trending signals</li>' : ''}
          ${data?.plan === 'Starter' ? '<li>10 credits per month</li><li>Full 6-card reports</li><li>Blueprint included</li><li>Clean PDF download</li>' : ''}
        </ul>
        ${data?.bonusCredits ? `<p style="color: #555; font-size: 16px; line-height: 1.6;">🎁 We've added <strong>${data.bonusCredits} bonus credits</strong> to get you started!</p>` : ''}
        <p style="color: #555; font-size: 16px; line-height: 1.6;">
          Your plan renews on <strong>${data?.renewDate || 'next month'}</strong>.
        </p>
        <a href="${data?.appUrl || 'https://goldrush.app'}/dashboard" 
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

  try {
    const { type, to, data } = (await req.json()) as EmailRequest;

    if (!type || !to || !templates[type]) {
      return new Response(JSON.stringify({ error: "Invalid email type or missing recipient" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subject, html } = templates[type](data || {});

    // Use Lovable's built-in email sending via the Go API
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const projectId = supabaseUrl.replace("https://", "").split(".")[0];

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      console.error("[send-email] LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailResponse = await fetch(
      `https://api.lovable.dev/v1/projects/${projectId}/emails/send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          to,
          subject,
          html,
          purpose: "transactional",
        }),
      }
    );

    if (!emailResponse.ok) {
      const errText = await emailResponse.text();
      console.error("[send-email] Failed:", emailResponse.status, errText);
      // Don't throw — email failures should not block the caller
      return new Response(JSON.stringify({ sent: false, reason: errText }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log(`[send-email] Sent ${type} email to ${to}`);
    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("[send-email] Error:", err);
    return new Response(JSON.stringify({ error: "Email send failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
