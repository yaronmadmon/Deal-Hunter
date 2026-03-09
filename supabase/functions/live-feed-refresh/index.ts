const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const pplxKey = Deno.env.get("PERPLEXITY_API_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  const { section } = await req.json().catch(() => ({ section: "all" }));
  const results: Record<string, unknown> = {};

  async function askPerplexity(prompt: string): Promise<string> {
    if (!pplxKey) throw new Error("PERPLEXITY_API_KEY not set");
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${pplxKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "You are a data API. Always respond with ONLY valid JSON arrays. No markdown, no explanation, no extra text." },
          { role: "user", content: prompt }
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`Perplexity API error [${res.status}]:`, errText);
      throw new Error(`Perplexity API error: ${res.status}`);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    console.log("Perplexity response preview:", content.slice(0, 200));
    return content;
  }

  async function askAI(prompt: string): Promise<string> {
    if (!lovableKey) return "";
    const res = await fetch("https://ai-gateway.lovable.dev/api/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  function parseJsonArray(text: string): any[] {
    // Try to find a JSON array in the text
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (e) {
        console.error("JSON parse failed for matched array:", e, "Raw match:", match[0].slice(0, 200));
      }
    }
    // Try parsing markdown code blocks
    const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) {
      try { return JSON.parse(codeBlock[1].trim()); } catch (e) {
        console.error("JSON parse failed for code block:", e);
      }
    }
    console.error("Could not parse JSON array from response:", text.slice(0, 300));
    return [];
  }

  try {
    // ── Section 1: Trending Searches ──
    if (section === "all" || section === "trending_searches") {
      try {
        const raw = await askPerplexity(
          `What are the top 6 trending tech/startup search terms or app ideas gaining traction RIGHT NOW in March 2026? For each, provide a JSON object with:
- "keyword": the trending term (2-5 words)
- "spike": estimated search growth like "+200%" or "+350%"  
- "snippet": one sentence explaining why it's trending (max 100 chars)
Return ONLY a JSON array, no other text.`
        );
        const items = parseJsonArray(raw).slice(0, 6);
        if (items.length > 0) {
          await saveSnapshot(supabase, "trending_searches", items);
          results.trending_searches = items;
        } else {
          results.trending_searches = [];
        }
      } catch (e) {
        console.error("trending_searches error:", e);
        results.trending_searches = [];
      }
    }

    // ── Section 2: Product Hunt Hot Launches ──
    if (section === "all" || section === "product_hunt") {
      try {
        // Try real PH API first
        const phKey = Deno.env.get("PRODUCTHUNT_API_KEY");
        let posts: any[] = [];

        if (phKey) {
          try {
            const today = new Date().toISOString().split("T")[0];
            const phRes = await fetch("https://api.producthunt.com/v2/api/graphql", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${phKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                query: `{ posts(order: VOTES, postedAfter: "${today}T00:00:00Z", first: 5) { edges { node { name tagline votesCount topics { edges { node { name } } } } } } }`,
              }),
            });
            const phData = await phRes.json();
            posts = (phData?.data?.posts?.edges || []).map((e: any) => ({
              name: e.node.name,
              tagline: e.node.tagline,
              upvotes: e.node.votesCount,
              category: e.node.topics?.edges?.[0]?.node?.name || "Startup",
            }));
          } catch {
            console.log("PH API failed, falling back to Perplexity");
          }
        }

        // Perplexity fallback
        if (posts.length === 0) {
          const raw = await askPerplexity(
            `What are the top 5 most upvoted or buzzing product launches on Product Hunt this week (March 2026)? For each, return a JSON object with:
- "name": product name
- "tagline": short tagline (max 60 chars)
- "upvotes": estimated upvote count (number)
- "category": product category like "AI", "Developer Tools", "Productivity" etc.
Return ONLY a JSON array.`
          );
          posts = parseJsonArray(raw).slice(0, 5);
        }

        await saveSnapshot(supabase, "product_hunt", posts);
        results.product_hunt = posts;
      } catch (e) {
        console.error("product_hunt error:", e);
        results.product_hunt = [];
      }
    }

    // ── Section 3: Reddit Pain Points ──
    if (section === "all" || section === "reddit_pain_points") {
      try {
        const raw = await askPerplexity(
          `Search Reddit communities like r/entrepreneur, r/startups, r/SaaS, and r/Entrepreneur for the most discussed startup pain points and problems this week. Find 6 real trending posts or recurring complaints. For each, return a JSON object with:
- "title": the post title or problem description (max 100 chars)
- "problemSummary": a concise 8-12 word summary of the core problem
- "subreddit": which subreddit e.g. "r/startups"
- "upvotes": approximate upvote count (number)
Return ONLY a JSON array.`
        );
        const items = parseJsonArray(raw).slice(0, 6);
        await saveSnapshot(supabase, "reddit_pain_points", items);
        results.reddit_pain_points = items;
      } catch (e) {
        console.error("reddit_pain_points error:", e);
        results.reddit_pain_points = [];
      }
    }

    // ── Section 4: Fastest Growing Niches ──
    if (section === "all" || section === "growing_niches") {
      try {
        const raw = await askPerplexity(
          `What app categories or software niches are seeing the fastest user growth or VC investment this week in March 2026? Give me exactly 5 specific niches. For each, provide a JSON object with "name" (2-4 words) and "description" (one sentence with specific data points). Return ONLY a JSON array.`
        );
        const niches = parseJsonArray(raw).slice(0, 5);
        await saveSnapshot(supabase, "growing_niches", niches);
        results.growing_niches = niches;
      } catch (e) {
        console.error("growing_niches error:", e);
        results.growing_niches = [];
      }
    }

    // ── Section 5: Breakout Idea of the Day ──
    if (section === "all" || section === "breakout_idea") {
      try {
        const trending = Array.isArray(results.trending_searches) ? results.trending_searches as any[] : [];
        const ph = Array.isArray(results.product_hunt) ? results.product_hunt as any[] : [];
        const reddit = Array.isArray(results.reddit_pain_points) ? results.reddit_pain_points as any[] : [];
        const niches = Array.isArray(results.growing_niches) ? results.growing_niches as any[] : [];

        const candidates = [
          ...trending.map((t: any) => ({ name: t.keyword, type: "trending", signal: parseInt(String(t.spike).replace(/[^0-9]/g, "")) || 100 })),
          ...ph.map((p: any) => ({ name: `${p.name} style app`, type: "product_hunt", signal: (p.upvotes || 0) * 2 })),
          ...reddit.map((r: any) => ({ name: r.problemSummary || r.title, type: "reddit", signal: (r.upvotes || 0) })),
          ...niches.map((n: any) => ({ name: n.name, type: "niche", signal: 150 })),
        ];

        candidates.sort((a, b) => b.signal - a.signal);
        const pick = candidates[0] || { name: "AI-Powered Micro-SaaS", type: "trending", signal: 200 };

        let summary = `High signal opportunity based on ${pick.type} data.`;
        const aiSummary = await askAI(
          `In exactly 2 sentences, explain why "${pick.name}" is a promising startup opportunity right now in March 2026. Be specific and mention real market data.`
        );
        if (aiSummary) summary = aiSummary.slice(0, 250);

        const breakout = {
          name: pick.name,
          category: pick.type,
          score: Math.min(95, Math.floor(50 + pick.signal / 10)),
          signalStrength: pick.signal > 200 ? "Strong" : pick.signal > 100 ? "Moderate" : "Emerging",
          summary,
          generatedAt: new Date().toISOString(),
        };

        await saveSnapshot(supabase, "breakout_idea", [breakout]);
        results.breakout_idea = breakout;
      } catch (e) {
        console.error("breakout_idea error:", e);
        results.breakout_idea = {};
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("live-feed-refresh error:", error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function saveSnapshot(supabase: any, sectionName: string, data: any) {
  // Don't overwrite existing data with empty results
  if (Array.isArray(data) && data.length === 0) {
    console.log(`Skipping save for ${sectionName} — empty data, preserving existing`);
    return;
  }
  await supabase.from("live_feed_snapshots").delete().eq("section_name", sectionName);
  await supabase.from("live_feed_snapshots").insert({
    section_name: sectionName,
    data_payload: data,
  });
}
