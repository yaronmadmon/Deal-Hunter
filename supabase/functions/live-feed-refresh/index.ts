const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ── Helpers ── */
function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

const SOURCE_WEIGHTS: Record<string, number> = {
  product_hunt: 10,
  google_trends: 12,
  reddit_pain_points: 6,
  hacker_news: 8,
  github_trending: 7,
  trending_searches: 9,
  growing_niches: 5,
  app_store_trends: 11,
};

function scoreSignal(g: number, d: number, c: number, r: number, source?: string, timestamp?: string): number {
  let base = Math.round(
    clamp(g) * 0.35 + clamp(d) * 0.25 + clamp(c) * 0.20 + clamp(r) * 0.20
  );
  if (source) base += SOURCE_WEIGHTS[source] ?? 0;
  // Recency boost
  if (timestamp) {
    const age = Date.now() - new Date(timestamp).getTime();
    if (age < 24 * 60 * 60 * 1000) base += 10;
  }
  return clamp(base);
}

function parseGrowth(spike: string | number | undefined): number {
  if (typeof spike === "number") return spike;
  if (!spike) return 0;
  const num = parseInt(String(spike).replace(/[^0-9-]/g, ""), 10);
  return isNaN(num) ? 0 : num;
}

function computeMomentum(growth: number, velocity: number, recency: number): "Exploding" | "Rising" | "Emerging" {
  const c = growth * 0.5 + velocity * 0.3 + recency * 0.2;
  if (c >= 70) return "Exploding";
  if (c >= 40) return "Rising";
  return "Emerging";
}

function dedup<T extends Record<string, any>>(items: T[], keyField: string): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    const key = String(item[keyField] || "").toLowerCase().trim();
    if (!key) { seen.set(String(Math.random()), item); continue; }
    const existing = seen.get(key);
    if (!existing || (item._signalScore ?? 0) > (existing._signalScore ?? 0)) {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values());
}

/* ── Cross-feed merge by word similarity ── */
function wordSet(s: string): Set<string> {
  return new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean));
}
function similarity(a: string, b: string): number {
  const sa = wordSet(a); const sb = wordSet(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  return inter / Math.max(sa.size, sb.size);
}
function crossFeedMerge(signals: any[], keyField = "keyword"): any[] {
  const merged: any[] = [];
  for (const sig of signals) {
    const key = String(sig[keyField] || sig.title || sig.name || "");
    if (!key) { merged.push(sig); continue; }
    let found = false;
    for (let i = 0; i < merged.length; i++) {
      const e = merged[i];
      const eKey = String(e[keyField] || e.title || e.name || "");
      if (similarity(key, eKey) >= 0.75) {
        if ((sig._signalScore ?? 0) > (e._signalScore ?? 0)) {
          merged[i] = { ...sig, _confidence: "High", _mergedSources: [...(e._mergedSources || [e._source]), sig._source] };
        } else {
          merged[i] = { ...e, _confidence: "High", _mergedSources: [...(e._mergedSources || [e._source]), sig._source] };
        }
        found = true; break;
      }
    }
    if (!found) merged.push(sig);
  }
  return merged;
}

function addSignalMeta(items: any[], source: string, opts: {
  keywordField?: string;
  growthField?: string;
  velocityField?: string;
  defaultGrowth?: number;
  defaultVelocity?: number;
}): any[] {
  const now = new Date().toISOString();
  return items.map((item) => {
    const growth = opts.growthField ? parseGrowth(item[opts.growthField]) : (opts.defaultGrowth ?? 50);
    const velocity = opts.velocityField ? (item[opts.velocityField] ?? opts.defaultVelocity ?? 40) : (opts.defaultVelocity ?? 40);
    const recency = 70; // default recency factor
    const score = scoreSignal(growth, velocity, 50, recency, source, now);
    const momentum = computeMomentum(growth, velocity, recency);
    return {
      ...item,
      _source: source,
      _signalScore: score,
      _confidence: score >= 65 ? "High" : score >= 35 ? "Medium" : "Low",
      _momentum: momentum,
      _timestamp: now,
    };
  });
}

const MIN_SIGNAL_SCORE = 10;
const MAX_SNAPSHOTS_PER_SECTION = 3;

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
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (e) {
        console.error("JSON parse failed:", e);
      }
    }
    const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) {
      try { return JSON.parse(codeBlock[1].trim()); } catch (e) {
        console.error("JSON parse failed for code block:", e);
      }
    }
    console.error("Could not parse JSON array:", text.slice(0, 300));
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
        let items = parseJsonArray(raw).slice(0, 6);
        items = addSignalMeta(items, "trending_searches", { keywordField: "keyword", growthField: "spike", defaultVelocity: 60 });
        items = dedup(items, "keyword");
        items = items.filter((i: any) => (i._signalScore ?? 0) >= MIN_SIGNAL_SCORE);
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

    // ── Section 2: Product Hunt ──
    if (section === "all" || section === "product_hunt") {
      try {
        const phKey = Deno.env.get("PRODUCTHUNT_API_KEY");
        let posts: any[] = [];
        if (phKey) {
          try {
            const today = new Date().toISOString().split("T")[0];
            const phRes = await fetch("https://api.producthunt.com/v2/api/graphql", {
              method: "POST",
              headers: { Authorization: `Bearer ${phKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ query: `{ posts(order: VOTES, postedAfter: "${today}T00:00:00Z", first: 5) { edges { node { name tagline votesCount topics { edges { node { name } } } } } } }` }),
            });
            const phData = await phRes.json();
            posts = (phData?.data?.posts?.edges || []).map((e: any) => ({
              name: e.node.name, tagline: e.node.tagline, upvotes: e.node.votesCount,
              category: e.node.topics?.edges?.[0]?.node?.name || "Startup",
            }));
          } catch { console.log("PH API failed, falling back to Perplexity"); }
        }
        if (posts.length === 0) {
          const raw = await askPerplexity(`What are the top 5 most upvoted or buzzing product launches on Product Hunt this week (March 2026)? For each, return a JSON object with: "name", "tagline" (max 60 chars), "upvotes" (number), "category". Return ONLY a JSON array.`);
          posts = parseJsonArray(raw).slice(0, 5);
        }
        posts = addSignalMeta(posts, "product_hunt", { keywordField: "name", velocityField: "upvotes", defaultGrowth: 60 });
        posts = dedup(posts, "name");
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
        const prompt = `Find 6 real startup pain points trending on Reddit (r/startups, r/SaaS, r/entrepreneur) this week. Return a JSON array where each object has: "title" (max 100 chars), "problemSummary" (8-12 word summary), "subreddit", "upvotes" (number). Return ONLY the JSON array.`;
        let items = parseJsonArray(await askPerplexity(prompt)).slice(0, 6);
        if (items.length === 0) {
          console.log("Reddit: Perplexity failed, trying Lovable AI fallback");
          items = parseJsonArray(await askAI(prompt)).slice(0, 6);
        }
        items = addSignalMeta(items, "reddit_pain_points", { keywordField: "title", velocityField: "upvotes", defaultGrowth: 45 });
        items = dedup(items, "title");
        await saveSnapshot(supabase, "reddit_pain_points", items);
        results.reddit_pain_points = items;
      } catch (e) {
        console.error("reddit_pain_points error:", e);
        results.reddit_pain_points = [];
      }
    }

    // ── Section 4: Growing Niches ──
    if (section === "all" || section === "growing_niches") {
      try {
        const raw = await askPerplexity(`What app categories or software niches are seeing the fastest user growth or VC investment this week in March 2026? Give me exactly 5 specific niches. For each, provide a JSON object with "name" (2-4 words) and "description" (one sentence). Return ONLY a JSON array.`);
        let niches = parseJsonArray(raw).slice(0, 5);
        niches = addSignalMeta(niches, "growing_niches", { keywordField: "name", defaultGrowth: 65, defaultVelocity: 55 });
        niches = dedup(niches, "name");
        await saveSnapshot(supabase, "growing_niches", niches);
        results.growing_niches = niches;
      } catch (e) {
        console.error("growing_niches error:", e);
        results.growing_niches = [];
      }
    }

    // ── Section 5: Hacker News ──
    if (section === "all" || section === "hacker_news") {
      try {
        const hnRes = await fetch(`https://hn.algolia.com/api/v1/search?query=startup OR SaaS OR "side project" OR launch&tags=story&hitsPerPage=20&numericFilters=points>30`);
        const hnData = await hnRes.json();
        let hnItems = (hnData.hits || []).slice(0, 8).map((hit: any) => ({
          title: hit.title || "", points: hit.points || 0, comments: hit.num_comments || 0,
          author: hit.author || "",
          url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
          hnUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
          createdAt: hit.created_at || "",
        }));
        hnItems = addSignalMeta(hnItems, "hacker_news", { keywordField: "title", velocityField: "points", defaultGrowth: 50 });
        hnItems = dedup(hnItems, "title");
        await saveSnapshot(supabase, "hacker_news", hnItems);
        results.hacker_news = hnItems;
      } catch (e) {
        console.error("hacker_news error:", e);
        results.hacker_news = [];
      }
    }

    // ── Section 6: GitHub Trending ──
    if (section === "all" || section === "github_trending") {
      try {
        const ghToken = Deno.env.get("GITHUB_API_TOKEN");
        const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json", "User-Agent": "GoldRush-LiveFeed" };
        if (ghToken) headers["Authorization"] = `Bearer ${ghToken}`;
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const ghRes = await fetch(`https://api.github.com/search/repositories?q=created:>${since}+stars:>50&sort=stars&order=desc&per_page=8`, { headers });
        const ghData = await ghRes.json();
        let repos = (ghData.items || []).map((r: any) => ({
          name: r.full_name, description: (r.description || "").slice(0, 120),
          stars: r.stargazers_count, forks: r.forks_count, language: r.language,
          url: r.html_url, createdAt: r.created_at,
        }));
        repos = addSignalMeta(repos, "github_trending", { keywordField: "name", velocityField: "stars", defaultGrowth: 55 });
        repos = dedup(repos, "name");
        await saveSnapshot(supabase, "github_trending", repos);
        results.github_trending = repos;
      } catch (e) {
        console.error("github_trending error:", e);
        results.github_trending = [];
      }
    }

    // ── Section 7: Google Trends via Serper ──
    if (section === "all" || section === "google_trends") {
      try {
        const serperKey = Deno.env.get("SERPER_API_KEY");
        if (serperKey) {
          const [trendsRes, newsRes] = await Promise.all([
            fetch("https://google.serper.dev/search", { method: "POST", headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" }, body: JSON.stringify({ q: "trending startup ideas app 2026", num: 8 }) }),
            fetch("https://google.serper.dev/news", { method: "POST", headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" }, body: JSON.stringify({ q: "startup launch funding SaaS 2026", num: 8 }) }),
          ]);
          const trendsData = await trendsRes.json();
          const newsData = await newsRes.json();
          const trendItems = (trendsData.organic || []).slice(0, 6).map((r: any) => ({ title: r.title, snippet: (r.snippet || "").slice(0, 150), url: r.link, type: "search" as const }));
          const newsItems = (newsData.organic || []).slice(0, 6).map((r: any) => ({ title: r.title, snippet: (r.snippet || "").slice(0, 150), url: r.link, date: r.date || null, type: "news" as const }));
          let combined = [...newsItems, ...trendItems].slice(0, 8);
          combined = addSignalMeta(combined, "google_trends", { keywordField: "title", defaultGrowth: 50, defaultVelocity: 45 });
          combined = dedup(combined, "title");
          await saveSnapshot(supabase, "google_trends", combined);
          results.google_trends = combined;
        } else {
          results.google_trends = [];
        }
      } catch (e) {
        console.error("google_trends error:", e);
        results.google_trends = [];
      }
    }

    // ── Section 8: App Store Trends ──
    if (section === "all" || section === "app_store_trends") {
      try {
        const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
        let apps: any[] = [];

        if (firecrawlKey) {
          // Scrape trending/top apps from App Store and Google Play via Firecrawl search
          const [iosRes, androidRes] = await Promise.all([
            fetch("https://api.firecrawl.dev/v1/search", {
              method: "POST",
              headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ query: "trending new apps 2026 site:apps.apple.com", limit: 5, scrapeOptions: { formats: ["markdown"] } }),
            }).then(r => r.json()).catch(() => ({ data: [] })),
            fetch("https://api.firecrawl.dev/v1/search", {
              method: "POST",
              headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ query: "trending new apps 2026 site:play.google.com", limit: 5, scrapeOptions: { formats: ["markdown"] } }),
            }).then(r => r.json()).catch(() => ({ data: [] })),
          ]);

          const iosApps = (iosRes.data || []).map((r: any) => {
            const title = r.title || r.metadata?.title || "";
            const name = title.replace(/ on the App Store$/, "").replace(/ - Apple$/, "").trim();
            return { name: name || "Unknown App", platform: "iOS", url: r.url || "", snippet: (r.description || r.metadata?.description || "").slice(0, 120), source: "firecrawl" };
          });
          const androidApps = (androidRes.data || []).map((r: any) => {
            const title = r.title || r.metadata?.title || "";
            const name = title.replace(/ - Apps on Google Play$/, "").replace(/ - Google Play$/, "").trim();
            return { name: name || "Unknown App", platform: "Android", url: r.url || "", snippet: (r.description || r.metadata?.description || "").slice(0, 120), source: "firecrawl" };
          });

          apps = [...iosApps, ...androidApps].filter(a => a.name && a.name !== "Unknown App").slice(0, 8);
        }

        // Fallback to Perplexity if Firecrawl returned nothing
        if (apps.length === 0 && pplxKey) {
          const raw = await askPerplexity(
            `What are the top 6 trending or fastest-rising apps on the App Store and Google Play right now in March 2026? For each, return a JSON object with: "name" (app name), "platform" ("iOS" or "Android" or "Both"), "snippet" (one sentence about what it does, max 100 chars), "category" (app category). Return ONLY a JSON array.`
          );
          apps = parseJsonArray(raw).slice(0, 6).map((a: any) => ({ ...a, source: "perplexity", url: "" }));
        }

        apps = addSignalMeta(apps, "app_store_trends", { keywordField: "name", defaultGrowth: 60, defaultVelocity: 55 });
        apps = dedup(apps, "name");
        apps = apps.filter((a: any) => (a._signalScore ?? 0) >= MIN_SIGNAL_SCORE);

        if (apps.length > 0) {
          await saveSnapshot(supabase, "app_store_trends", apps);
          results.app_store_trends = apps;
        } else {
          results.app_store_trends = [];
        }
      } catch (e) {
        console.error("app_store_trends error:", e);
        results.app_store_trends = [];
      }
    }

    // ── Top Opportunities Aggregator (cross-feed merge) ──
    const allSignals: any[] = [];
    for (const key of ["trending_searches", "product_hunt", "reddit_pain_points", "growing_niches", "hacker_news", "github_trending", "google_trends", "app_store_trends"]) {
      const arr = results[key];
      if (Array.isArray(arr)) allSignals.push(...arr);
    }
    const mergedSignals = crossFeedMerge(allSignals, "keyword");
    mergedSignals.sort((a: any, b: any) => (b._signalScore ?? 0) - (a._signalScore ?? 0));
    results.top_opportunities = mergedSignals.slice(0, 5);

    // ── Breakout Idea of the Day ──
    if (section === "all" || section === "breakout_idea") {
      try {
        const candidates = mergedSignals.map((s: any) => ({
          name: s.keyword || s.name || s.title || s.problemSummary || "",
          type: s._source || "unknown",
          signal: s._signalScore ?? 0,
          confidence: s._confidence ?? "Low",
          momentum: s._momentum ?? "Emerging",
        }));

        // Quality filter: score >= 50 AND confidence >= Medium
        const qualified = candidates.filter((c: any) =>
          c.signal >= 50 && (c.confidence === "High" || c.confidence === "Medium")
        );

        const pick = qualified[0] || candidates[0] || { name: "AI-Powered Micro-SaaS", type: "trending", signal: 50, confidence: "Medium", momentum: "Rising" };

        let summary = `High signal opportunity based on ${pick.type} data.`;
        const aiSummary = await askAI(`In exactly 2 sentences, explain why "${pick.name}" is a promising startup opportunity right now in March 2026. Be specific and mention real market data.`);
        if (aiSummary) summary = aiSummary.slice(0, 250);

        const breakout = {
          name: pick.name,
          category: pick.type,
          score: clamp(Math.floor(50 + pick.signal / 10), 0, 95),
          signalStrength: pick.signal > 70 ? "Strong" : pick.signal > 45 ? "Moderate" : "Emerging",
          summary,
          generatedAt: new Date().toISOString(),
          _signalScore: clamp(pick.signal),
          _confidence: pick.confidence,
          _momentum: pick.momentum,
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
  // Empty protection: never overwrite with empty data
  if (Array.isArray(data) && data.length === 0) {
    console.log(`Skipping save for ${sectionName} — empty data, preserving existing`);
    return;
  }

  // Insert new snapshot (keep last N per section)
  await supabase.from("live_feed_snapshots").insert({
    section_name: sectionName,
    data_payload: data,
  });

  // Retain only the latest MAX_SNAPSHOTS_PER_SECTION snapshots
  const { data: rows } = await supabase
    .from("live_feed_snapshots")
    .select("id, created_at")
    .eq("section_name", sectionName)
    .order("created_at", { ascending: false });

  if (rows && rows.length > MAX_SNAPSHOTS_PER_SECTION) {
    const toDelete = rows.slice(MAX_SNAPSHOTS_PER_SECTION).map((r: any) => r.id);
    if (toDelete.length > 0) {
      await supabase.from("live_feed_snapshots").delete().in("id", toDelete);
    }
  }
}
