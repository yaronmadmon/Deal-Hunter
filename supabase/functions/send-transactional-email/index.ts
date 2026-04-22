import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EmailType = "welcome" | "analysis_complete" | "payment_confirmation" | "subscription_activated" | "new_deal_alert";
interface EmailRequest { type: EmailType; to: string; data?: Record<string, unknown>; }

const toPlain = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/s+/g, " ").trim();

const templates: Record<EmailType, (d: Record<string, unknown>) => { subject: string; html: string }> = {
  welcome: (d) => ({
    subject: "Welcome to Deal Hunter!",
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px"><h1>Welcome to Deal Hunter!</h1><p>You have <strong>${(d?.credits as number|undefined)??2} free skip trace credits</strong> to get started.</p><a href="${(d?.appUrl as string|undefined)||"https://dealhunter.live"}/dashboard" style="display:inline-block;background:#d4af37;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:16px">Find Your First Deal</a><p style="color:#999;font-size:12px;margin-top:32px">Deal Hunter &mdash; Find distressed deals before anyone else</p></div>`,
  }),
  analysis_complete: (d) => ({
    subject: "Your analysis is ready: " + (((d?.idea as string|undefined)?.slice(0,50))||"Market Report"),
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px"><h1>Your Analysis is Ready!</h1><p>We finished analyzing: <strong>&ldquo;${(d?.idea as string|undefined)||"your idea"}&rdquo;</strong></p>${d?.score?"<p>Overall Score: <strong>"+d.score+"/100</strong></p>":""}<a href="${(d?.appUrl as string|undefined)||"https://goldrushapp.live"}/report/${(d?.analysisId as string|undefined)||""} " style="display:inline-block;background:#d4af37;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:16px">View Full Report</a><p style="color:#999;font-size:12px;margin-top:32px">Gold Rush &mdash; Data-driven idea validation</p></div>`,
  }),
  payment_confirmation: (d) => ({
    subject: "Payment Confirmed — Credits Added",
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px"><h1>Payment Confirmed!</h1><p><strong>${(d?.credits as number|undefined)||0} credits</strong> added. New balance: <strong>${(d?.newBalance as number|string|undefined)??"N/A"} credits</strong></p><a href="${(d?.appUrl as string|undefined)||"https://goldrushapp.live"}/dashboard" style="display:inline-block;background:#d4af37;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:16px">Go to Dashboard</a><p style="color:#999;font-size:12px;margin-top:32px">Gold Rush &mdash; Data-driven idea validation</p></div>`,
  }),
  subscription_activated: (d) => ({
    subject: "Your " + ((d?.plan as string|undefined)||"Deal Hunter") + " Plan is Active!",
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px"><h1>Welcome to ${(d?.plan as string|undefined)||"Deal Hunter"} Plan!</h1><p>Your subscription is now active. Renews on ${(d?.renewDate as string|undefined)||"next month"}.</p>${d?.bonusCredits?"<p>Bonus: <strong>"+d.bonusCredits+" skip trace credits</strong> added!</p>":""}<a href="${(d?.appUrl as string|undefined)||"https://dealhunter.live"}/dashboard" style="display:inline-block;background:#d4af37;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:16px">Start Finding Deals</a><p style="color:#999;font-size:12px;margin-top:32px">Deal Hunter &mdash; Find distressed deals before anyone else</p></div>`,
  }),
  new_deal_alert: (d) => {
    const city = (d?.city as string|undefined) ?? "your market";
    const state = (d?.state as string|undefined) ?? "";
    const count = (d?.count as number|undefined) ?? 0;
    const properties = (d?.properties as Array<{ address: string; deal_score: number; deal_verdict: string; equity_pct: number; id: string }>|undefined) ?? [];
    const appUrl = (d?.appUrl as string|undefined) ?? "https://dealhunter.live";
    const propHtml = properties.slice(0, 5).map((p) =>
      `<tr><td style="padding:8px;border-bottom:1px solid #eee"><a href="${appUrl}/property/${p.id}" style="color:#d4af37;text-decoration:none;font-weight:bold">${p.address}</a><br/><span style="font-size:12px;color:#666">Score: ${p.deal_score} &bull; ${p.deal_verdict} &bull; ${Math.round(p.equity_pct)}% equity</span></td></tr>`
    ).join("");
    return {
      subject: `New deals found in ${city}${state ? ", " + state : ""} — ${count} propert${count === 1 ? "y" : "ies"} match your search`,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px"><h1>New Deals Found!</h1><p>${count} new propert${count === 1 ? "y" : "ies"} matched your saved search for <strong>${city}${state ? ", " + state : ""}</strong>.</p><table style="width:100%;border-collapse:collapse;margin:16px 0">${propHtml}</table><a href="${appUrl}/dashboard" style="display:inline-block;background:#d4af37;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:8px">View All Deals</a><p style="color:#999;font-size:12px;margin-top:32px"><a href="${appUrl}/dashboard" style="color:#999">Manage saved searches</a> &mdash; Deal Hunter</p></div>`,
    };
  },
};

async function sendResend(apiKey: string, to: string, from: string, subject: string, html: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, text: toPlain(html) }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error("Resend API " + res.status + ": " + err.slice(0, 200));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromAddress = Deno.env.get("EMAIL_FROM") ?? "Deal Hunter <noreply@dealhunter.live>";
  const supabaseAdmin = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

  let parsedBody: Partial<EmailRequest> = {};
  try {
    parsedBody = await req.json() as Partial<EmailRequest>;
    const type = typeof parsedBody.type === "string" && parsedBody.type in templates ? parsedBody.type as EmailType : null;
    const to = typeof parsedBody.to === "string" ? parsedBody.to.trim() : "";
    const data = (typeof parsedBody.data === "object" && parsedBody.data !== null) ? parsedBody.data as Record<string, unknown> : {};

    if (!type || !to) return new Response(JSON.stringify({ error: "Invalid type or missing recipient" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!resendApiKey) throw new Error("Email service not configured (missing RESEND_API_KEY)");

    const { subject, html } = templates[type](data);
    const messageId = crypto.randomUUID();
    await sendResend(resendApiKey, to, fromAddress, subject, html);
    supabaseAdmin && await supabaseAdmin.from("email_send_log").insert({ message_id: messageId, template_name: type, recipient_email: to, status: "sent" });
    return new Response(JSON.stringify({ sent: true, messageId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Email send failed";
    console.error("[send-email]", msg);
    try { supabaseAdmin && await supabaseAdmin.from("email_send_log").insert({ template_name: typeof parsedBody.type === "string" ? parsedBody.type : "unknown", recipient_email: typeof parsedBody.to === "string" ? parsedBody.to : "unknown", status: "failed", error_message: msg.slice(0, 1000) }); } catch { /**/ }
    return new Response(JSON.stringify({ sent: false, reason: msg }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});