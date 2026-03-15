const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "npm:@supabase/supabase-js@2";

/* ── Helpers ── */
function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

const SOURCE_WEIGHTS: Record<string, number> = {
  product_hunt: 10,
  google_search: 12,
  reddit_pain_points: 6,
  hacker_news: 8,
  github_trending: 7,
  trending_searches: 9,
  growing_niches: 5,
  app_store_trends: 11,
  twitter_buzz: 9,
};

// Data reliability classification
type DataReliability = "verified_api" | "web_scraper" | "ai_estimated";

const SOURCE_RELIABILITY: Record<string, DataReliability> = {
  product_hunt: "verified_api",
  hacker_news: "verified_api",
  github_trending: "verified_api",
  twitter_buzz: "verified_api", // when using real API; overridden to ai_estimated on fallback
  reddit_pain_points: "verified_api", // now using real Reddit JSON API
  google_search: "web_scraper", // Serper scrapes Google results
  app_store_trends: "web_scraper", // Firecrawl scrapes stores
  trending_searches: "ai_estimated", // Perplexity generates these
  growing_niches: "ai_estimated", // Perplexity generates these
};

const CATEGORY_LABELS = [
  "AI & Machine Learning", "Developer Tools", "Productivity", "E-Commerce & Retail",
  "Health & Wellness", "Social & Community", "Fintech & Payments", "Education",
  "Utilities", "Creative Tools", "Infrastructure", "Other",
];

function scoreSignal(
  g: number, d: number, c: number, r: number,
  source?: string, timestamp?: string
): number {
  let base = Math.round(
    clamp(g) * 0.35 + clamp(d) * 0.25 + clamp(c) * 0.20 + clamp(r) * 0.20
  );
  if (source) base += SOURCE_WEIGHTS[source] ?? 0;
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
  reliability?: DataReliability;
}): any[] {
  const now = new Date().toISOString();
  const reliability = opts.reliability || SOURCE_RELIABILITY[source] || "ai_estimated";
  return items.map((item) => {
    const growth = opts.growthField ? parseGrowth(item[opts.growthField]) : (opts.defaultGrowth ?? 50);
    const velocity = opts.velocityField ? (item[opts.velocityField] ?? opts.defaultVelocity ?? 40) : (opts.defaultVelocity ?? 40);
    // Derive recency from actual timestamp if available
    const itemTime = item.createdAt || item.created_at || item.date;
    let recency = 50; // default
    if (itemTime) {
      const ageHours = (Date.now() - new Date(itemTime).getTime()) / (1000 * 60 * 60);
      recency = ageHours < 6 ? 95 : ageHours < 24 ? 80 : ageHours < 72 ? 60 : ageHours < 168 ? 40 : 20;
    } else {
      recency = 70; // no timestamp, assume moderately recent
    }
    // Derive competitionGap from source specifics instead of hardcoding
    let competitionGap = 50; // default
    if (source === "reddit_pain_points") competitionGap = 70; // pain points suggest gap
    else if (source === "growing_niches") competitionGap = 65;
    else if (source === "product_hunt") competitionGap = 35; // existing products = less gap
    else if (source === "github_trending") competitionGap = 40; // OSS exists
    else if (source === "trending_searches") competitionGap = 55;

    const score = scoreSignal(growth, velocity, competitionGap, recency, source, now);
    const momentum = computeMomentum(growth, velocity, recency);
    return {
      ...item,
      _source: source,
      _signalScore: score,
      _confidence: score >= 65 ? "High" : score >= 35 ? "Medium" : "Low",
      _momentum: momentum,
      _timestamp: now,
      _reliability: reliability,
      _recency: recency,
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

  const { section } = await req.json().catch(() => ({ section: "all" }));
  const results: Record<string, unknown> = {};

  // Load previous scores for velocity delta calculation
  let previousScores: Record<string, number> = {};
  try {
    const { data: prevSnapshot } = await supabase
      .from("live_feed_snapshots")
      .select("data_payload")
      .eq("section_name", "enriched_opportunities")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (prevSnapshot?.data_payload && Array.isArray(prevSnapshot.data_payload)) {
      for (const sig of prevSnapshot.data_payload as any[]) {
        const key = (sig.keyword || sig.name || sig.title || "").toLowerCase().trim();
        if (key) previousScores[key] = sig._signalScore ?? 0;
      }
    }
  } catch { /* no previous data, that's fine */ }

  async function askPerplexity(prompt: string): Promise<string> {
    if (!pplxKey) throw new Error("PERPLEXITY_API_KEY not set");
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${pplxKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "You are a data API. Always respond with ONLY valid JSON arrays or objects. No markdown, no explanation, no extra text." },
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
    if (!pplxKey) return "";
    try {
      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${pplxKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "sonar",
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) { await res.text(); return ""; }
      const data = await res.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (e) {
      console.error("askAI fallback error:", e);
      return "";
    }
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

  function parseJsonObject(text: string): any {
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]); } catch { /* fall through */ }
    }
    const arr = parseJsonArray(text);
    if (arr.length > 0) return arr;
    return null;
  }

  try {
    // ── Section 1: Trending Searches (AI-estimated — clearly labeled) ──
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
        items = addSignalMeta(items, "trending_searches", { keywordField: "keyword", growthField: "spike", defaultVelocity: 60, reliability: "ai_estimated" });
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

    // ── Section 2: Product Hunt (Verified API) ──
    if (section === "all" || section === "product_hunt") {
      try {
        const phKey = Deno.env.get("PRODUCTHUNT_API_KEY");
        let posts: any[] = [];
        let phReliability: DataReliability = "verified_api";
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
          phReliability = "ai_estimated";
          const raw = await askPerplexity(`What are the top 5 most upvoted or buzzing product launches on Product Hunt this week (March 2026)? For each, return a JSON object with: "name", "tagline" (max 60 chars), "upvotes" (number), "category". Return ONLY a JSON array.`);
          posts = parseJsonArray(raw).slice(0, 5);
        }
        posts = addSignalMeta(posts, "product_hunt", { keywordField: "name", velocityField: "upvotes", defaultGrowth: 60, reliability: phReliability });
        posts = dedup(posts, "name");
        await saveSnapshot(supabase, "product_hunt", posts);
        results.product_hunt = posts;
      } catch (e) {
        console.error("product_hunt error:", e);
        results.product_hunt = [];
      }
    }

    // ── Section 3: Reddit Pain Points (REAL Reddit JSON API) ──
    if (section === "all" || section === "reddit_pain_points") {
      try {
        let redditItems: any[] = [];
        let redditReliability: DataReliability = "verified_api";
        const subreddits = ["startups", "SaaS", "entrepreneur"];
        
        for (const sub of subreddits) {
          try {
            const redditRes = await fetch(
              `https://www.reddit.com/r/${sub}/hot.json?limit=10`,
              { headers: { "User-Agent": "GoldRush-LiveFeed/1.0" } }
            );
            if (redditRes.ok) {
              const redditData = await redditRes.json();
              const posts = (redditData?.data?.children || [])
                .filter((c: any) => c.data && !c.data.stickied && c.data.score > 5)
                .slice(0, 4)
                .map((c: any) => ({
                  title: (c.data.title || "").slice(0, 150),
                  problemSummary: (c.data.title || "").slice(0, 80),
                  subreddit: `r/${sub}`,
                  upvotes: c.data.score || 0,
                  commentCount: c.data.num_comments || 0,
                  createdAt: new Date((c.data.created_utc || 0) * 1000).toISOString(),
                  url: `https://reddit.com${c.data.permalink || ""}`,
                }));
              redditItems.push(...posts);
            } else {
              console.error(`Reddit r/${sub} API error [${redditRes.status}]`);
            }
          } catch (e) {
            console.error(`Reddit r/${sub} fetch failed:`, e);
          }
        }

        // Sort by engagement (upvotes + comments) and take top 8
        redditItems.sort((a, b) => (b.upvotes + b.commentCount) - (a.upvotes + a.commentCount));
        redditItems = redditItems.slice(0, 8);

        // Fallback to Perplexity only if Reddit API completely fails
        if (redditItems.length === 0) {
          console.log("Reddit API failed completely, falling back to Perplexity");
          redditReliability = "ai_estimated";
          const prompt = `Find 6 real startup pain points trending on Reddit (r/startups, r/SaaS, r/entrepreneur) this week. Return a JSON array where each object has: "title" (max 100 chars), "problemSummary" (8-12 word summary), "subreddit" (e.g. "r/startups"), "upvotes" (number), "url" (full Reddit post URL if available, otherwise null). Return ONLY the JSON array.`;
          redditItems = parseJsonArray(await askPerplexity(prompt)).slice(0, 6);
        }

        redditItems = addSignalMeta(redditItems, "reddit_pain_points", {
          keywordField: "title",
          velocityField: "upvotes",
          defaultGrowth: 45,
          reliability: redditReliability,
        });
        redditItems = dedup(redditItems, "title");
        await saveSnapshot(supabase, "reddit_pain_points", redditItems);
        results.reddit_pain_points = redditItems;
      } catch (e) {
        console.error("reddit_pain_points error:", e);
        results.reddit_pain_points = [];
      }
    }

    // ── Section 4: Growing Niches (AI-estimated) ──
    if (section === "all" || section === "growing_niches") {
      try {
        const raw = await askPerplexity(`What app categories or software niches are seeing the fastest user growth or VC investment this week in March 2026? Give me exactly 5 specific niches. For each, provide a JSON object with "name" (2-4 words) and "description" (one sentence). Return ONLY a JSON array.`);
        let niches = parseJsonArray(raw).slice(0, 5);
        niches = addSignalMeta(niches, "growing_niches", { keywordField: "name", defaultGrowth: 65, defaultVelocity: 55, reliability: "ai_estimated" });
        niches = dedup(niches, "name");
        await saveSnapshot(supabase, "growing_niches", niches);
        results.growing_niches = niches;
      } catch (e) {
        console.error("growing_niches error:", e);
        results.growing_niches = [];
      }
    }

    // ── Section 5: Hacker News (Verified API) ──
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
        hnItems = addSignalMeta(hnItems, "hacker_news", { keywordField: "title", velocityField: "points", defaultGrowth: 50, reliability: "verified_api" });
        hnItems = dedup(hnItems, "title");
        await saveSnapshot(supabase, "hacker_news", hnItems);
        results.hacker_news = hnItems;
      } catch (e) {
        console.error("hacker_news error:", e);
        results.hacker_news = [];
      }
    }

    // ── Section 6: GitHub Trending (Verified API + star velocity) ──
    if (section === "all" || section === "github_trending") {
      try {
        const ghToken = Deno.env.get("GITHUB_API_TOKEN");
        const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json", "User-Agent": "GoldRush-LiveFeed" };
        if (ghToken) headers["Authorization"] = `Bearer ${ghToken}`;
        const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const ghRes = await fetch(`https://api.github.com/search/repositories?q=created:>${since}+stars:>100&sort=stars&order=desc&per_page=8`, { headers });
        const ghData = await ghRes.json();
        let repos = (ghData.items || []).map((r: any) => {
          // Compute star velocity: stars per day since creation
          const ageMs = Date.now() - new Date(r.created_at).getTime();
          const ageDays = Math.max(1, ageMs / (1000 * 60 * 60 * 24));
          const starsPerDay = Math.round(r.stargazers_count / ageDays);
          return {
            name: r.full_name, description: (r.description || "").slice(0, 120),
            stars: r.stargazers_count, forks: r.forks_count, language: r.language,
            url: r.html_url, createdAt: r.created_at,
            starsPerDay,
          };
        });
        // Use starsPerDay as velocity metric
        repos = addSignalMeta(repos, "github_trending", {
          keywordField: "name",
          velocityField: "starsPerDay",
          defaultGrowth: 55,
          reliability: "verified_api",
        });
        repos = dedup(repos, "name");
        await saveSnapshot(supabase, "github_trending", repos);
        results.github_trending = repos;
      } catch (e) {
        console.error("github_trending error:", e);
        results.github_trending = [];
      }
    }

    // ── Section 7: Google Search via Serper (renamed from "Google Trends") ──
    if (section === "all" || section === "google_search") {
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
          combined = addSignalMeta(combined, "google_search", { keywordField: "title", defaultGrowth: 50, defaultVelocity: 45, reliability: "web_scraper" });
          combined = dedup(combined, "title");
          // Save as google_search (new name) but also keep backward compat
          await saveSnapshot(supabase, "google_search", combined);
          results.google_search = combined;
        } else {
          results.google_search = [];
        }
      } catch (e) {
        console.error("google_search error:", e);
        results.google_search = [];
      }
    }

    // ── Section 8: App Store Trends (Web Scraper) ──
    if (section === "all" || section === "app_store_trends") {
      try {
        const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
        let apps: any[] = [];
        let appReliability: DataReliability = "web_scraper";

        if (firecrawlKey) {
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

        if (apps.length === 0 && pplxKey) {
          appReliability = "ai_estimated";
          const raw = await askPerplexity(
            `What are the top 6 trending or fastest-rising apps on the App Store and Google Play right now in March 2026? For each, return a JSON object with: "name" (app name), "platform" ("iOS" or "Android" or "Both"), "snippet" (one sentence about what it does, max 100 chars), "category" (app category). Return ONLY a JSON array.`
          );
          apps = parseJsonArray(raw).slice(0, 6).map((a: any) => ({ ...a, source: "perplexity", url: "" }));
        }

        apps = addSignalMeta(apps, "app_store_trends", { keywordField: "name", defaultGrowth: 60, defaultVelocity: 55, reliability: appReliability });
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

    // ── Section 9: Twitter/X Buzz (Verified API with fallback) ──
    if (section === "all" || section === "twitter_buzz") {
      try {
        const twitterToken = Deno.env.get("TWITTER_BEARER_TOKEN");
        let tweets: any[] = [];
        let twitterReliability: DataReliability = "verified_api";

        if (twitterToken) {
          const queries = ["startup launch 2026", "new SaaS app trending"];
          for (const q of queries) {
            try {
              const twRes = await fetch(
                `https://api.x.com/2/tweets/search/recent?query=${encodeURIComponent(q)} -is:retweet lang:en&max_results=10&tweet.fields=public_metrics,created_at,author_id`,
                { headers: { Authorization: `Bearer ${twitterToken}` } }
              );
              if (twRes.ok) {
                const twData = await twRes.json();
                const items = (twData.data || []).map((t: any) => ({
                  text: (t.text || "").slice(0, 180),
                  likes: t.public_metrics?.like_count ?? 0,
                  retweets: t.public_metrics?.retweet_count ?? 0,
                  replies: t.public_metrics?.reply_count ?? 0,
                  impressions: t.public_metrics?.impression_count ?? 0,
                  createdAt: t.created_at || "",
                  tweetId: t.id || "",
                  source: "twitter_api",
                }));
                tweets.push(...items);
              } else {
                console.error(`Twitter API error [${twRes.status}]:`, await twRes.text());
              }
            } catch (e) {
              console.error("Twitter query failed:", e);
            }
          }
          tweets.sort((a: any, b: any) => (b.likes + b.retweets * 2) - (a.likes + a.retweets * 2));
          tweets = tweets.slice(0, 8);
        }

        if (tweets.length === 0 && pplxKey) {
          twitterReliability = "ai_estimated";
          const raw = await askPerplexity(
            `What are the top 6 buzzing tweets or X/Twitter discussions about startups, new app launches, or SaaS tools right now in March 2026? For each, return a JSON object with: "text" (the tweet or discussion summary, max 150 chars), "likes" (number), "retweets" (number), "replies" (number), "topic" (2-3 word topic). Return ONLY a JSON array.`
          );
          tweets = parseJsonArray(raw).slice(0, 6).map((t: any) => ({ ...t, impressions: 0, tweetId: "", createdAt: new Date().toISOString(), source: "perplexity" }));
        }

        tweets = addSignalMeta(tweets, "twitter_buzz", { keywordField: "text", velocityField: "likes", defaultGrowth: 50, reliability: twitterReliability });
        tweets = tweets.filter((t: any) => (t._signalScore ?? 0) >= MIN_SIGNAL_SCORE);

        if (tweets.length > 0) {
          await saveSnapshot(supabase, "twitter_buzz", tweets);
          results.twitter_buzz = tweets;
        } else {
          results.twitter_buzz = [];
        }
      } catch (e) {
        console.error("twitter_buzz error:", e);
        results.twitter_buzz = [];
      }
    }

    // ── Top Opportunities Aggregator (cross-feed merge) ──
    const allSignals: any[] = [];
    for (const key of ["trending_searches", "product_hunt", "reddit_pain_points", "growing_niches", "hacker_news", "github_trending", "google_search", "app_store_trends", "twitter_buzz"]) {
      const arr = results[key];
      if (Array.isArray(arr)) allSignals.push(...arr);
    }
    const mergedSignals = crossFeedMerge(allSignals, "keyword");
    mergedSignals.sort((a: any, b: any) => (b._signalScore ?? 0) - (a._signalScore ?? 0));

    // ── Compute velocity deltas from previous snapshot ──
    for (const sig of mergedSignals) {
      const key = (sig.keyword || sig.name || sig.title || "").toLowerCase().trim();
      const prevScore = previousScores[key];
      if (prevScore !== undefined) {
        sig._velocityDelta = sig._signalScore - prevScore;
      } else {
        sig._velocityDelta = null; // new signal, no delta
      }
    }

    // ── AI Opportunity Enrichment ──
    if (pplxKey && mergedSignals.length > 0) {
      const topSignals = mergedSignals.slice(0, 12);
      const signalSummaries = topSignals.map((s: any, i: number) => {
        const name = s.keyword || s.name || s.title || s.problemSummary || s.text?.slice(0, 60) || `Signal ${i}`;
        const src = s._source || "unknown";
        const desc = s.snippet || s.tagline || s.description || s.problemSummary || s.text?.slice(0, 80) || "";
        return `${i + 1}. "${name}" (from ${src}): ${desc}`;
      }).join("\n");

      const categoryList = CATEGORY_LABELS.join(", ");

      try {
        const enrichPrompt = `You are a startup opportunity analyst. Below are ${topSignals.length} trending market signals. For EACH signal, analyze the GAP or underserved opportunity it reveals — NOT the existing product/company itself.

SIGNALS:
${signalSummaries}

For each signal, return a JSON array with objects containing:
- "index": the signal number (1-based)
- "category": one of [${categoryList}]
- "opportunityGap": 1-2 sentences describing what's MISSING or underserved in this space. Focus on pain points, underserved segments, or features competitors lack. (max 150 chars)
- "suggestedIdea": a specific, actionable startup idea that fills this gap (max 80 chars, start with an action verb like "Build", "Create", "Launch")
- "whyNow": one sentence explaining why this is timely (max 100 chars)

Return ONLY a valid JSON array.`;

        const enrichRaw = await askPerplexity(enrichPrompt);
        const enrichments = parseJsonArray(enrichRaw);

        for (const enrich of enrichments) {
          const idx = (enrich.index ?? 0) - 1;
          if (idx >= 0 && idx < topSignals.length) {
            topSignals[idx]._category = enrich.category || "Other";
            topSignals[idx]._opportunityGap = enrich.opportunityGap || "";
            topSignals[idx]._suggestedIdea = enrich.suggestedIdea || "";
            topSignals[idx]._whyNow = enrich.whyNow || "";
          }
        }

        for (let i = 0; i < topSignals.length; i++) {
          mergedSignals[i] = topSignals[i];
        }

        for (let i = topSignals.length; i < mergedSignals.length; i++) {
          mergedSignals[i]._category = "Other";
          mergedSignals[i]._opportunityGap = "";
          mergedSignals[i]._suggestedIdea = "";
          mergedSignals[i]._whyNow = "";
        }

        console.log(`Enriched ${enrichments.length} signals with opportunity insights`);
      } catch (e) {
        console.error("Opportunity enrichment failed:", e);
        for (const sig of mergedSignals) {
          sig._category = sig._category || "Other";
          sig._opportunityGap = sig._opportunityGap || "";
          sig._suggestedIdea = sig._suggestedIdea || "";
          sig._whyNow = sig._whyNow || "";
        }
      }
    }

    results.top_opportunities = mergedSignals.slice(0, 8);

    if (mergedSignals.length > 0) {
      await saveSnapshot(supabase, "enriched_opportunities", mergedSignals.slice(0, 12));
    }

    // ── Breakout Idea of the Day ──
    if (section === "all" || section === "breakout_idea") {
      try {
        const candidates = mergedSignals.map((s: any) => ({
          name: s.keyword || s.name || s.title || s.problemSummary || "",
          type: s._source || "unknown",
          signal: s._signalScore ?? 0,
          confidence: s._confidence ?? "Low",
          momentum: s._momentum ?? "Emerging",
          category: s._category || "Other",
          suggestedIdea: s._suggestedIdea || "",
          opportunityGap: s._opportunityGap || "",
          whyNow: s._whyNow || "",
          reliability: s._reliability || "ai_estimated",
        }));

        const qualified = candidates.filter((c: any) =>
          c.signal >= 50 && (c.confidence === "High" || c.confidence === "Medium")
        );

        const pick = qualified[0] || candidates[0] || { name: "AI-Powered Micro-SaaS", type: "trending", signal: 50, confidence: "Medium", momentum: "Rising", category: "AI & Machine Learning", suggestedIdea: "", opportunityGap: "", whyNow: "", reliability: "ai_estimated" };

        let summary = `High signal opportunity based on ${pick.type} data.`;
        if (pick.opportunityGap) {
          summary = pick.opportunityGap;
        } else {
          const aiSummary = await askAI(`In exactly 2 sentences, explain what MARKET GAP exists around "${pick.name}" right now in March 2026. Focus on what's missing or underserved, not on the existing product. Be specific.`);
          if (aiSummary) summary = aiSummary.slice(0, 250);
        }

        const breakout = {
          name: pick.suggestedIdea || pick.name,
          originalSignal: pick.name,
          category: pick.category,
          score: clamp(Math.floor(50 + pick.signal / 10), 0, 95),
          signalStrength: pick.signal > 70 ? "Strong" : pick.signal > 45 ? "Moderate" : "Emerging",
          summary,
          suggestedIdea: pick.suggestedIdea,
          whyNow: pick.whyNow,
          generatedAt: new Date().toISOString(),
          _signalScore: clamp(pick.signal),
          _confidence: pick.confidence,
          _momentum: pick.momentum,
          _reliability: pick.reliability,
        };

        await saveSnapshot(supabase, "breakout_idea", [breakout]);
        results.breakout_idea = breakout;
      } catch (e) {
        console.error("breakout_idea error:", e);
        results.breakout_idea = {};
      }
    }

    // ── Market Gaps Summary ──
    if (section === "all" && pplxKey && mergedSignals.length >= 3) {
      try {
        const gapSignals = mergedSignals.slice(0, 10).map((s: any) => {
          return `- ${s.keyword || s.name || s.title || "?"} (${s._source}, score: ${s._signalScore}, gap: ${s._opportunityGap || "unknown"})`;
        }).join("\n");

        const gapsPrompt = `Based on these trending market signals, identify 4 high-conviction startup opportunities that emerge from PATTERNS across multiple signals. These should be actionable gaps, not just restating what's trending.

SIGNALS:
${gapSignals}

For each opportunity, return a JSON array with objects containing:
- "title": a compelling 4-8 word opportunity title
- "category": one of [${CATEGORY_LABELS.join(", ")}]
- "insight": 2 sentences explaining the gap and why it's underserved (max 200 chars)
- "suggestedIdea": a specific product idea to validate (max 80 chars)
- "confidenceLevel": "High", "Medium", or "Low" based on signal convergence
- "signalSources": array of 2-3 source types that back this up (e.g. ["reddit_pain_points", "trending_searches"])

Return ONLY a valid JSON array of exactly 4 objects.`;

        const gapsRaw = await askPerplexity(gapsPrompt);
        const gaps = parseJsonArray(gapsRaw).slice(0, 5);

        if (gaps.length > 0) {
          await saveSnapshot(supabase, "market_gaps", gaps);
          results.market_gaps = gaps;
        }
      } catch (e) {
        console.error("market_gaps generation error:", e);
      }
    }

    // ── Save source timestamps for per-source freshness ──
    const sourceTimestamps: Record<string, string> = {};
    const now = new Date().toISOString();
    for (const key of Object.keys(results)) {
      if (key !== "top_opportunities") {
        sourceTimestamps[key] = now;
      }
    }
    await saveSnapshot(supabase, "source_timestamps", sourceTimestamps);

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
  if (Array.isArray(data) && data.length === 0) {
    console.log(`Skipping save for ${sectionName} — empty data, preserving existing`);
    return;
  }

  await supabase.from("live_feed_snapshots").insert({
    section_name: sectionName,
    data_payload: data,
  });

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
