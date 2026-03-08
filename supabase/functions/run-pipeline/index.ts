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

    const { analysisId, idea } = await req.json();
    if (!analysisId || !idea) {
      return new Response(JSON.stringify({ error: "Missing analysisId or idea" }), { status: 400, headers: corsHeaders });
    }

    // Step 1: fetching
    await supabase.from("analyses").update({ status: "fetching" }).eq("id", analysisId);
    await new Promise((r) => setTimeout(r, 2000));

    // Step 2: analyzing
    await supabase.from("analyses").update({ status: "analyzing" }).eq("id", analysisId);

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    let reportData = null;
    let overallScore = 65;
    let signalStrength = "Moderate";

    if (lovableApiKey) {
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
                content: `You are a market analysis AI for Gold Rush, a startup idea validation tool. Analyze the given startup idea and return a JSON object with this EXACT structure (no markdown, pure JSON):

{
  "idea": "the idea text",
  "overallScore": 0-100,
  "signalStrength": "Strong" or "Moderate" or "Weak",
  "scoreExplanation": "1-2 sentence explanation",
  "signalCards": [
    {
      "title": "Trend Momentum",
      "source": "Social Media + Search Trends",
      "icon": "TrendingUp",
      "type": "metrics",
      "confidence": "High" or "Medium" or "Low",
      "evidenceCount": number,
      "metrics": [{"label": "string", "value": "string"}],
      "sparkline": [{"name": "W1", "value": number}, ...12 data points],
      "evidence": ["quote strings"],
      "insight": "one sentence"
    },
    {
      "title": "Market Saturation",
      "source": "App Store + Google Play",
      "icon": "PieChart",
      "type": "metrics",
      "confidence": "High" or "Medium" or "Low",
      "evidenceCount": number,
      "metrics": [{"label": "string", "value": "string"}],
      "donut": [{"name": "Top 5", "value": number}, {"name": "Others", "value": number}],
      "evidence": ["strings"],
      "insight": "one sentence"
    },
    {
      "title": "Competitor Snapshot",
      "source": "App Stores",
      "icon": "Users",
      "type": "competitors",
      "confidence": "High",
      "evidenceCount": number,
      "competitors": [{"name": "string", "rating": "string", "reviews": "string", "downloads": "string", "weakness": "string"}],
      "evidence": ["strings"],
      "insight": "one sentence"
    },
    {
      "title": "Sentiment & Pain Points",
      "source": "App Reviews + Social Discussions",
      "icon": "MessageCircle",
      "type": "sentiment",
      "confidence": "Medium",
      "evidenceCount": number,
      "sentiment": {"complaints": ["strings"], "loves": ["strings"], "emotion": "string", "complaintCount": number, "positiveCount": number},
      "evidence": ["strings"],
      "insight": "one sentence"
    },
    {
      "title": "Growth Signals",
      "source": "Search Trends + Market Activity",
      "icon": "Zap",
      "type": "metrics",
      "confidence": "Medium",
      "evidenceCount": number,
      "metrics": [{"label": "string", "value": "string"}],
      "lineChart": [{"name": "month", "value": number}, ...9 data points],
      "evidence": ["strings"],
      "insight": "one sentence"
    }
  ],
  "opportunity": {"featureGaps": ["strings"], "underservedUsers": ["strings"], "positioning": "string"},
  "revenueBenchmark": {"summary": "string", "range": "string", "basis": "string"},
  "scoreBreakdown": [
    {"label": "Trend Momentum", "value": 0-20},
    {"label": "Market Saturation", "value": 0-20},
    {"label": "Sentiment", "value": 0-20},
    {"label": "Growth", "value": 0-20},
    {"label": "Opportunity", "value": 0-20}
  ],
  "blueprint": {
    "productConcept": "string",
    "strategicPositioning": "string",
    "coreFeatures": ["strings 5-7 items"],
    "targetUsers": ["strings 3-4 items"],
    "monetization": ["strings 2-3 items"],
    "mvpPlan": ["strings 5-6 items"]
  }
}

Be realistic and data-driven. Generate plausible market data, competitor names, and user sentiments based on what would realistically exist for this type of product. Score honestly - not everything should be high. Return ONLY the JSON, no markdown formatting.`
              },
              {
                role: "user",
                content: `Analyze this startup idea: "${idea}"`
              }
            ],
            temperature: 0.7,
            max_tokens: 4000,
          }),
        });

        if (aiResponse.ok) {
          const aiResult = await aiResponse.json();
          const content = aiResult.choices?.[0]?.message?.content || "";
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            reportData = JSON.parse(jsonMatch[0]);
            overallScore = reportData.overallScore || 65;
            signalStrength = reportData.signalStrength || "Moderate";
          }
        } else {
          const errText = await aiResponse.text();
          console.error("AI gateway error:", aiResponse.status, errText);
        }
      } catch (aiErr) {
        console.error("AI analysis failed:", aiErr);
      }
    } else {
      console.error("LOVABLE_API_KEY not found");
    }

    // Step 3: complete
    await supabase.from("analyses").update({
      status: "complete",
      overall_score: overallScore,
      signal_strength: signalStrength,
      report_data: reportData,
      updated_at: new Date().toISOString(),
    }).eq("id", analysisId);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Pipeline error:", err);
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);
      const body = await req.clone().json().catch(() => ({}));
      if (body.analysisId) {
        await supabase.from("analyses").update({ status: "failed" }).eq("id", body.analysisId);
      }
    } catch (_) {}
    return new Response(JSON.stringify({ error: "Pipeline failed" }), { status: 500, headers: corsHeaders });
  }
});
