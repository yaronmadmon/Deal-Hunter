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
    const nicheAnalysis = (report as any).nicheAnalysis ?? {};
    const unitEconomics = (report as any).unitEconomics ?? {};
    const buildComplexity = (report as any).buildComplexity ?? {};
    const scoreBreakdown = (report as any).scoreBreakdown ?? [];

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
      nicheAnalysis,
      unitEconomics,
      buildComplexity,
      scoreBreakdown,
    };

    let blueprint = null;

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "AI key not configured" }), { status: 500, headers: corsHeaders });
    }

    try {
      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are a startup strategist for Gold Rush, a market validation tool. You are given REAL market analysis data for a specific startup idea. Your job is to generate an ACTIONABLE, HONEST startup blueprint with realistic timelines, technical specifics, and validation gates.

RULES:
- NEVER write generic startup advice. Every statement must reference specific data from the report.
- Be HONEST about timelines — a real MVP takes 10-14 weeks, not 6.
- Specify EXACT technologies, not vague references.
- Clearly separate MVP features from Phase 2 features.
- Include go-to-market, competitive response, and validation milestones.
- If a claim (like "local processing") has tradeoffs, be explicit about them.
- For monetization, include validation approach, not just pricing.

Return ONLY a JSON object (no markdown, no code fences) with this exact structure:

{
  "reportSummary": "One paragraph that opens with the market score, references the strongest signal, and identifies the key opportunity.",

  "productConcept": "A refined product description that directly addresses opportunity gaps and pain points. Reference specific competitor weaknesses.",

  "strategicPositioning": "How to differentiate based on SPECIFIC competitor weaknesses. Name competitors.",

  "competitiveEdge": ["For each top competitor: '[Name] weakness: [X]. Your edge: [Y].'"],

  "coreFeatures": ["5-7 features. Each traces to a pain point or gap. Format: '[Feature] — addresses [complaint/gap]'"],

  "targetUsers": ["3-4 user segments from report data with reasoning."],

  "primaryLaunchSegment": "Which ONE segment is primary for MVP launch and why. Be specific: bigger TAM? Easier to reach? Name the communities/channels. Then name which segments are Phase 2 expansions.",

  "monetization": ["2-3 revenue models with specific pricing referencing report benchmarks."],

  "monetizationValidation": [
    "How will you test pricing before launch? (surveys, beta tiers, willingness-to-pay tests)",
    "Unit economics: key cost drivers per user per month, infrastructure costs, margin analysis",
    "Is any premium tier validated or just a guess? How to test demand for it",
    "What metrics prove pricing works? (conversion rate targets, churn thresholds)"
  ],

  "mvpPlan": [
    "Week 1-2: [specific engineering phase with deliverable]",
    "Week 3-4: [phase]",
    "Week 5-6: [phase]",
    "Week 7-8: [phase]",
    "Week 9-10: [phase]",
    "Week 11-14: [testing, stability, beta launch prep]",
    "Total: 10-14 weeks minimum. Be honest about complexity."
  ],

  "mvpPhasing": {
    "mvp": ["Features included in launch — only what's needed to test core hypothesis"],
    "phase2": ["Features deferred to post-launch — explain why each is deferred"]
  },

  "techStack": [
    "Frontend: [specific framework/platform choice] — why this one for this product",
    "Backend: [specific choice, e.g. Supabase, Firebase, custom] — for auth, data, and sync",
    "Key APIs/Services: [specific third-party APIs relevant to this idea] — what they provide",
    "Storage: [database choice and why] — for user data and content",
    "Hosting/Infrastructure: [specific platform] — cost and scaling considerations"
  ],

  "techTradeoffs": [
    "What is the hardest technical challenge for this specific product? Be honest about complexity.",
    "Build vs buy decisions: which components should use third-party services vs custom code?",
    "Performance vs cost tradeoffs specific to this product category",
    "Any other honest tradeoff the founder needs to know about building this"
  ],

  "goToMarket": [
    "Where to find early users: specific subreddits, forums, communities, influencers relevant to this idea",
    "How to communicate the key differentiator: specific messaging and positioning vs named competitors",
    "Retention hooks: what keeps users coming back for this specific product type",
    "Launch strategy: beta invite, Product Hunt, specific channels relevant to this market"
  ],

  "competitiveResponse": [
    "If [named competitor from report] adds similar features, what's your response?",
    "Should you accelerate launch to get first-mover advantage?",
    "Are there partnership opportunities?",
    "What's your moat if a big player enters?"
  ],

  "validationMilestones": [
    "Week 4: Can we prove [core mechanic] actually works? (Test with 5 real users)",
    "Week 8: Do users actually prefer [your approach] over alternatives? (Preference testing)",
    "Week 10: Is [key differentiator] messaging resonating? (Survey early adopters)",
    "Week 12: What's early churn looking like? (Are users sticking around?)",
    "Week 14: Go/no-go decision based on [specific metrics]"
  ]
}`
            },
            {
              role: "user",
              content: `Generate a detailed startup blueprint for "${idea}" using this market analysis data:\n\n${JSON.stringify(reportContext, null, 2)}`
            }
          ],
          temperature: 0.4,
          max_tokens: 8000,
        }),
      });

      if (aiResponse.ok) {
        const aiResult = await aiResponse.json();
        const content = aiResult.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          let cleaned = jsonMatch[0]
            .replace(/,\s*([}\]])/g, '$1')
            .replace(/[\x00-\x1F\x7F]/g, (c: string) => c === '\n' || c === '\r' || c === '\t' ? c : ' ');
          try {
            blueprint = JSON.parse(cleaned);
          } catch (parseErr) {
            console.error("JSON parse failed, attempting repair:", (parseErr as Error).message);
            const reMatch = cleaned.match(/\{[\s\S]*\}/);
            if (reMatch) {
              try { blueprint = JSON.parse(reMatch[0]); } catch (_) { console.error("JSON repair also failed"); }
            }
          }
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
