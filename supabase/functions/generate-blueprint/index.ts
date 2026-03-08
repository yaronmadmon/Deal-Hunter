import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { analysisId } = await req.json();
    if (!analysisId) {
      return new Response(JSON.stringify({ error: "Missing analysisId" }), { status: 400, headers: corsHeaders });
    }

    const { data: analysis } = await supabase.from("analyses").select("*").eq("id", analysisId).single();
    if (!analysis || !analysis.report_data) {
      return new Response(JSON.stringify({ error: "No report data found. Run the market analysis first." }), { status: 404, headers: corsHeaders });
    }

    const report = analysis.report_data as Record<string, unknown>;

    // ── Extract structured fields from the report ──
    const overallScore = analysis.overall_score ?? (report as any).overallScore ?? 0;
    const signalStrength = analysis.signal_strength ?? (report as any).signalStrength ?? "Unknown";
    const idea = analysis.idea;

    const signalCards = (report as any).signalCards ?? [];
    const trendCard = signalCards.find((c: any) => c.title === "Trend Momentum");
    const saturationCard = signalCards.find((c: any) => c.title === "Market Saturation");
    const competitorCard = signalCards.find((c: any) => c.title === "Competitor Snapshot");
    const sentimentCard = signalCards.find((c: any) => c.title === "Sentiment & Pain Points");
    const growthCard = signalCards.find((c: any) => c.title === "Growth Signals");

    const opportunity = (report as any).opportunity ?? {};
    const revenueBenchmark = (report as any).revenueBenchmark ?? {};
    const scoreBreakdown = (report as any).scoreBreakdown ?? [];

    // Build a structured context object for the AI
    const reportContext = {
      idea,
      overallScore,
      signalStrength,
      trendMomentum: trendCard ? { metrics: trendCard.metrics, insight: trendCard.insight, evidence: trendCard.evidence } : null,
      marketSaturation: saturationCard ? { metrics: saturationCard.metrics, insight: saturationCard.insight } : null,
      competitors: competitorCard?.competitors ?? [],
      competitorInsight: competitorCard?.insight ?? "",
      sentimentPainPoints: sentimentCard?.sentiment ?? null,
      sentimentInsight: sentimentCard?.insight ?? "",
      sentimentEvidence: sentimentCard?.evidence ?? [],
      growthSignals: growthCard ? { metrics: growthCard.metrics, insight: growthCard.insight } : null,
      opportunityGaps: opportunity.featureGaps ?? [],
      underservedUsers: opportunity.underservedUsers ?? [],
      positioning: opportunity.positioning ?? "",
      revenueBenchmark,
      scoreBreakdown,
    };

    let blueprint = null;

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "AI key not configured" }), { status: 500, headers: corsHeaders });
    }

    try {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are a startup strategist for Gold Rush, a market validation tool. You are given REAL market analysis data for a specific startup idea. Your job is to generate a startup blueprint that is DIRECTLY and SPECIFICALLY derived from this data. Every sentence you write must trace back to a data point from the report.

RULES:
- NEVER write generic startup advice. Every statement must reference specific data from the report.
- If a competitor has a weakness, name the competitor and state the weakness.
- If users complained about something, quote or reference the complaint.
- Pricing must reference the revenue benchmark range provided.
- The MVP plan must prioritize the highest-signal opportunity from the report.
- Financial modeling (TAM/SAM/SOM) belongs in post-MVP, NOT in the MVP plan.

Return ONLY a JSON object (no markdown, no code fences) with this exact structure:

{
  "reportSummary": "One paragraph that opens with the market score, references the strongest signal, and identifies the key opportunity. This must read like a continuation of the report, not a generic intro. Example tone: 'Based on a market score of X/100 with [signal strength] trend momentum ([specific metric from report]) and a clear gap in [specific gap from opportunity data], here is your build strategy.'",
  "productConcept": "A refined product description that directly addresses the opportunity gaps and pain points found in the report. Reference specific competitor weaknesses this product solves.",
  "strategicPositioning": "How to differentiate based on SPECIFIC competitor weaknesses and opportunity gaps from the report. Name competitors and their weaknesses.",
  "competitiveEdge": [
    "For each top competitor from the report: '[Competitor Name] weakness: [their weakness]. Your edge: [how this product exploits it specifically].' One entry per competitor."
  ],
  "coreFeatures": ["5-7 features. EACH feature must trace back to a specific pain point from the Sentiment card or a gap from the Opportunity data. Format: '[Feature] — addresses [specific complaint/gap from report]'"],
  "targetUsers": ["3-4 user segments pulled from the underserved users in the report data. Reference why they are underserved based on report evidence."],
  "monetization": ["2-3 revenue models. Pricing MUST reference the revenue benchmark range from the report. Tiers must target the specific user segments identified."],
  "mvpPlan": ["5-6 week-by-week steps. Week 1-2 MUST focus on the highest-signal opportunity from the report. No financial modeling in MVP phase. Each step must reference which report signal it addresses."]
}`
            },
            {
              role: "user",
              content: `Generate a startup blueprint for "${idea}" using this market analysis data:\n\n${JSON.stringify(reportContext, null, 2)}`
            }
          ],
          temperature: 0.7,
          max_tokens: 3000,
        }),
      });

      if (aiResponse.ok) {
        const aiResult = await aiResponse.json();
        const content = aiResult.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          blueprint = JSON.parse(jsonMatch[0]);
        }
      } else {
        const errText = await aiResponse.text();
        console.error("Blueprint AI error:", aiResponse.status, errText);
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), { status: 429, headers: corsHeaders });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: corsHeaders });
        }
      }
    } catch (aiErr) {
      console.error("Blueprint AI failed:", aiErr);
    }

    if (blueprint) {
      await supabase.from("analyses").update({ blueprint_data: blueprint }).eq("id", analysisId);
    }

    return new Response(JSON.stringify({ blueprint: blueprint || analysis.blueprint_data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Blueprint error:", err);
    return new Response(JSON.stringify({ error: "Blueprint generation failed" }), { status: 500, headers: corsHeaders });
  }
});
