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

    // Get analysis report data
    const { data: analysis } = await supabase.from("analyses").select("*").eq("id", analysisId).single();
    if (!analysis || !analysis.report_data) {
      return new Response(JSON.stringify({ error: "No report data found" }), { status: 404, headers: corsHeaders });
    }

    const reportData = analysis.report_data;
    let blueprint = null;

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (lovableApiKey) {
      try {
        const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${lovableApiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `You are a startup strategist. Given a market analysis report, generate a startup blueprint. Return ONLY a JSON object (no markdown) with:
{
  "productConcept": "refined product description based on signals",
  "strategicPositioning": "how to differentiate based on competitor weaknesses and gaps",
  "coreFeatures": ["5-7 features based on pain points"],
  "targetUsers": ["3-4 user segments based on underserved audiences"],
  "monetization": ["2-3 revenue model suggestions"],
  "mvpPlan": ["5-6 week-by-week MVP steps"]
}`
              },
              {
                role: "user",
                content: `Generate a blueprint from this report: ${JSON.stringify(reportData)}`
              }
            ],
            temperature: 0.7,
            max_tokens: 2000,
          }),
        });

        if (aiResponse.ok) {
          const aiResult = await aiResponse.json();
          const content = aiResult.choices?.[0]?.message?.content || "";
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            blueprint = JSON.parse(jsonMatch[0]);
          }
        }
      } catch (aiErr) {
        console.error("Blueprint AI failed:", aiErr);
      }
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
