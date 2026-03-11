import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Perplexity helper ──────────────────────────────────────────────
async function perplexitySearch(
  apiKey: string,
  query: string,
  options?: { recency?: string }
): Promise<{ content: string; citations: string[] }> {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        { role: "system", content: "Return concise, data-rich answers with specific numbers. Always cite sources." },
        { role: "user", content: query },
      ],
      temperature: 0.1,
      ...(options?.recency ? { search_recency_filter: options.recency } : {}),
    }),
  });
  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    citations: data.citations || [],
  };
}

// ── Firecrawl helper ───────────────────────────────────────────────
async function firecrawlScrape(
  apiKey: string,
  url: string
): Promise<{ markdown: string; metadata: any }> {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });
  const data = await res.json();
  return {
    markdown: data.data?.markdown || data.markdown || "",
    metadata: data.data?.metadata || data.metadata || {},
  };
}

async function firecrawlSearch(
  apiKey: string,
  query: string,
  limit = 5
): Promise<{ results: any[] }> {
  const res = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, limit, scrapeOptions: { formats: ["markdown"] } }),
  });
  const data = await res.json();
  return { results: data.data || [] };
}

// ── Serper helper ──────────────────────────────────────────────────
async function serperSearch(
  apiKey: string,
  query: string,
  type: "search" | "news" = "search",
  num = 10
): Promise<{ organic: any[]; searchParameters?: any; knowledgeGraph?: any }> {
  const res = await fetch(`https://google.serper.dev/${type}`, {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num }),
  });
  const data = await res.json();
  return {
    organic: data.organic || [],
    searchParameters: data.searchParameters || {},
    knowledgeGraph: data.knowledgeGraph || null,
  };
}

async function serperAutoComplete(
  apiKey: string,
  query: string
): Promise<{ suggestions: string[] }> {
  const res = await fetch("https://google.serper.dev/autocomplete", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query }),
  });
  const data = await res.json();
  return { suggestions: (data.suggestions || []).map((s: any) => s.value || s) };
}

// ── GitHub helper (authenticated for higher rate limits) ────────────────────
async function githubSearch(
  query: string,
  limit = 10
): Promise<{ repos: any[] }> {
  try {
    const ghToken = Deno.env.get("GITHUB_API_TOKEN");
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "GoldRush-Pipeline",
    };
    if (ghToken) {
      // Support both classic (ghp_) and fine-grained (github_pat_) tokens
      const prefix = ghToken.startsWith("ghp_") ? "token" : "Bearer";
      headers["Authorization"] = `${prefix} ${ghToken}`;
    }
    const res = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${limit}`,
      { headers }
    );
    if (!res.ok) {
      console.error("GitHub API error:", res.status);
      return { repos: [] };
    }
    const data = await res.json();
    return {
      repos: (data.items || []).map((r: any) => ({
        name: r.full_name,
        description: r.description || "",
        stars: r.stargazers_count,
        forks: r.forks_count,
        openIssues: r.open_issues_count,
        language: r.language,
        url: r.html_url,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        pushedAt: r.pushed_at,
        watchers: r.watchers_count,
        topics: r.topics || [],
      })),
    };
  } catch (e) {
    console.error("GitHub search error:", e);
    return { repos: [] };
  }
}

// ── Twitter/X helper ────────────────────────────────────────────────
async function twitterSearch(
  bearerToken: string,
  query: string,
  maxResults = 50
): Promise<{ tweets: any[]; total_fetched: number }> {
  try {
    const params = new URLSearchParams({
      query: `${query} lang:en -is:retweet`,
      max_results: String(Math.min(Math.max(maxResults, 10), 100)),
      'tweet.fields': 'created_at,public_metrics,author_id',
      'user.fields': 'name,username,public_metrics',
      expansions: 'author_id',
    });
    const res = await fetch(`https://api.x.com/2/tweets/search/recent?${params.toString()}`, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    if (!res.ok) {
      console.error("Twitter search error:", res.status);
      return { tweets: [], total_fetched: 0 };
    }
    const data = await res.json();
    const usersMap: Record<string, any> = {};
    if (data.includes?.users) {
      for (const user of data.includes.users) {
        usersMap[user.id] = user;
      }
    }
    const tweets = (data.data || []).map((t: any) => ({
      id: t.id,
      text: t.text,
      created_at: t.created_at,
      like_count: t.public_metrics?.like_count || 0,
      retweet_count: t.public_metrics?.retweet_count || 0,
      reply_count: t.public_metrics?.reply_count || 0,
      author_name: usersMap[t.author_id]?.name || "Unknown",
      author_username: usersMap[t.author_id]?.username || "unknown",
      author_followers: usersMap[t.author_id]?.public_metrics?.followers_count || 0,
    }));
    // Filter 10+ likes and sort by engagement
    const filtered = tweets
      .filter((t: any) => t.like_count >= 10)
      .sort((a: any, b: any) => (b.like_count + b.retweet_count * 2) - (a.like_count + a.retweet_count * 2))
      .slice(0, 10);
    return { tweets: filtered, total_fetched: tweets.length };
  } catch (e) {
    console.error("Twitter search error:", e);
    return { tweets: [], total_fetched: 0 };
  }
}

async function twitterTweetCounts(
  bearerToken: string,
  query: string
): Promise<{ counts: any[]; total_count: number; volume_change_pct: number }> {
  try {
    const now = new Date(Date.now() - 30 * 1000); // 30s buffer
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 60 * 1000); // +1min buffer
    const params = new URLSearchParams({
      query,
      granularity: 'day',
      start_time: sevenDaysAgo.toISOString(),
      end_time: now.toISOString(),
    });
    const res = await fetch(`https://api.x.com/2/tweets/counts/recent?${params.toString()}`, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    if (!res.ok) {
      console.error("Twitter counts error:", res.status);
      return { counts: [], total_count: 0, volume_change_pct: 0 };
    }
    const data = await res.json();
    const counts = data.data || [];
    let volumeChange = 0;
    if (counts.length >= 2) {
      const half = Math.floor(counts.length / 2);
      const firstTotal = counts.slice(0, half).reduce((s: number, d: any) => s + (d.tweet_count || 0), 0);
      const secondTotal = counts.slice(half).reduce((s: number, d: any) => s + (d.tweet_count || 0), 0);
      if (firstTotal > 0) volumeChange = Math.round(((secondTotal - firstTotal) / firstTotal) * 100);
    }
    return { counts, total_count: data.meta?.total_tweet_count || 0, volume_change_pct: volumeChange };
  } catch (e) {
    console.error("Twitter counts error:", e);
    return { counts: [], total_count: 0, volume_change_pct: 0 };
  }
}

async function twitterUserLookup(
  bearerToken: string,
  username: string
): Promise<{ user: any | null }> {
  try {
    const res = await fetch(
      `https://api.x.com/2/users/by/username/${encodeURIComponent(username)}?user.fields=public_metrics,description`,
      { headers: { Authorization: `Bearer ${bearerToken}` } }
    );
    if (!res.ok) return { user: null };
    const data = await res.json();
    return { user: data.data || null };
  } catch (e) {
    console.error("Twitter user lookup error:", e);
    return { user: null };
  }
}

async function twitterInfluencerSignals(
  bearerToken: string,
  usernames: string[],
  nicheQuery: string
): Promise<{ influencers: any[] }> {
  try {
    const limitedUsernames = usernames.slice(0, 3);
    const headers = { Authorization: `Bearer ${bearerToken}` };
    const nicheWords = nicheQuery.toLowerCase().split(/\s+/);

    // Parallelize influencer lookups instead of sequential
    const results = await Promise.all(
      limitedUsernames.map(async (uname) => {
        try {
          const userRes = await fetch(
            `https://api.x.com/2/users/by/username/${encodeURIComponent(uname)}?user.fields=public_metrics,description`,
            { headers }
          );
          if (!userRes.ok) return null;
          const userData = await userRes.json();
          const user = userData.data;
          if (!user) return null;

          const tweetsRes = await fetch(
            `https://api.x.com/2/users/${user.id}/tweets?max_results=10&tweet.fields=created_at,public_metrics`,
            { headers }
          );
          let nicheTweet = null;
          if (tweetsRes.ok) {
            const tweetsData = await tweetsRes.json();
            const tweets = tweetsData.data || [];
            const matched = tweets.filter((t: any) =>
              nicheWords.some((w: string) => t.text.toLowerCase().includes(w))
            );
            nicheTweet = matched.length > 0
              ? matched.sort((a: any, b: any) => (b.public_metrics?.like_count || 0) - (a.public_metrics?.like_count || 0))[0]
              : tweets[0];
          }

          return {
            name: user.name,
            username: user.username,
            description: user.description || '',
            followers_count: user.public_metrics?.followers_count || 0,
            latest_niche_tweet: nicheTweet ? {
              text: nicheTweet.text,
              created_at: nicheTweet.created_at,
              like_count: nicheTweet.public_metrics?.like_count || 0,
              retweet_count: nicheTweet.public_metrics?.retweet_count || 0,
              id: nicheTweet.id,
            } : null,
          };
        } catch (e) {
          console.error(`Influencer lookup error for @${uname}:`, e);
          return null;
        }
      })
    );

    return { influencers: results.filter(Boolean) as any[] };
  } catch (e) {
    console.error("Twitter influencer signals error:", e);
    return { influencers: [] };
  }
}

// ── Hacker News helper ──────────────────────────────────────────────
async function hackerNewsSearch(
  query: string,
  limit = 10
): Promise<{ hits: any[] }> {
  try {
    const res = await fetch(
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${limit}`
    );
    if (!res.ok) return { hits: [] };
    const data = await res.json();
    return {
      hits: (data.hits || []).map((h: any) => ({
        title: h.title,
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        points: h.points || 0,
        comments: h.num_comments || 0,
        author: h.author,
        createdAt: h.created_at,
        hnUrl: `https://news.ycombinator.com/item?id=${h.objectID}`,
      })),
    };
  } catch (e) {
    console.error("Hacker News search error:", e);
    return { hits: [] };
  }
}

// ── Retry wrapper ───────────────────────────────────────────────────
async function withRetry<T>(fn: () => Promise<T>, retries = 1, delayMs = 2000): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (retries > 0) {
      console.warn(`Retrying after ${delayMs}ms...`);
      await new Promise(r => setTimeout(r, delayMs));
      return withRetry(fn, retries - 1, delayMs);
    }
    throw e;
  }
}

// ── Product Hunt helper ─────────────────────────────────────────────
async function productHuntSearch(
  apiKey: string,
  topic: string,
  first = 10
): Promise<{ products: any[] }> {
  const query = `
    query {
      posts(order: VOTES, topic: "${topic}", first: ${first}) {
        edges {
          node {
            id
            name
            tagline
            votesCount
            createdAt
            url
            website
            topics {
              edges {
                node { name }
              }
            }
          }
        }
      }
    }
  `;

  // Try topic-based first, fall back to keyword search
  const res = await fetch("https://api.producthunt.com/v2/api/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query }),
  });

  const data = await res.json();
  let products = (data.data?.posts?.edges || []).map((e: any) => e.node);

  // If topic query returned nothing, try a broader keyword search
  if (products.length === 0) {
    const fallbackQuery = `
      query {
        posts(order: VOTES, first: ${first}) {
          edges {
            node {
              id
              name
              tagline
              votesCount
              createdAt
              url
              website
            }
          }
        }
      }
    `;
    const res2 = await fetch("https://api.producthunt.com/v2/api/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query: fallbackQuery }),
    });
    const data2 = await res2.json();
    products = (data2.data?.posts?.edges || []).map((e: any) => e.node);
    // Filter by keyword match in name/tagline
    const kw = topic.toLowerCase();
    products = products.filter((p: any) =>
      (p.name || "").toLowerCase().includes(kw) ||
      (p.tagline || "").toLowerCase().includes(kw)
    );
  }

  return {
    products: products.map((p: any) => ({
      name: p.name,
      tagline: p.tagline,
      upvotes: p.votesCount,
      launchDate: p.createdAt,
      url: p.url || `https://www.producthunt.com/posts/${(p.name || "").toLowerCase().replace(/\s+/g, "-")}`,
      website: p.website,
    })),
  };
}

// ── Main pipeline ──────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let capturedAnalysisId: string | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { analysisId, idea } = await req.json();
    capturedAnalysisId = analysisId;
    if (!analysisId || !idea) {
      return new Response(JSON.stringify({ error: "Missing analysisId or idea" }), { status: 400, headers: corsHeaders });
    }

    // ── Input validation ──
    const trimmedIdea = idea.trim();
    if (trimmedIdea.length < 10) {
      return new Response(JSON.stringify({ error: "Idea must be at least 10 characters" }), { status: 400, headers: corsHeaders });
    }
    if (trimmedIdea.length > 500) {
      return new Response(JSON.stringify({ error: "Idea must be under 500 characters" }), { status: 400, headers: corsHeaders });
    }
    // Strip HTML/script tags
    const sanitizedIdea = trimmedIdea.replace(/<[^>]*>/g, '').replace(/javascript:/gi, '');

    // ── Get user_id from analysis record ──
    const { data: analysisRecord } = await supabase.from("analyses").select("user_id").eq("id", analysisId).single();
    const pipelineUserId = analysisRecord?.user_id;

    if (pipelineUserId) {
      // ── Suspension check ──
      const { data: profileData } = await supabase.from("profiles").select("suspended").eq("id", pipelineUserId).single();
      if (profileData?.suspended) {
        await supabase.from("analyses").update({ status: "failed" }).eq("id", analysisId);
        return new Response(JSON.stringify({ error: "Account suspended" }), { status: 403, headers: corsHeaders });
      }

      // ── Rate limiting ──
      const { data: countData } = await supabase.rpc("analyses_count_last_hour", { _user_id: pipelineUserId });
      const hourlyCount = countData ?? 0;
      // Check subscription plan for limit
      const { data: subData } = await supabase.from("subscriptions").select("plan").eq("user_id", pipelineUserId).single();
      const maxPerHour = subData?.plan === "pro" || subData?.plan === "agency" ? 10 : 3;
      if (hourlyCount > maxPerHour) {
        await supabase.from("analyses").update({ status: "failed" }).eq("id", analysisId);
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), { status: 429, headers: corsHeaders });
      }
    }

    const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const serperKey = Deno.env.get("SERPER_API_KEY");
    const productHuntKey = Deno.env.get("PRODUCTHUNT_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const twitterBearerToken = Deno.env.get("TWITTER_BEARER_TOKEN");

    // ── Step 1: Fetching real market data ──
    await supabase.from("analyses").update({ status: "fetching" }).eq("id", analysisId);

    // ══════════════════════════════════════════════════════════════════
    // SEMANTIC KEYWORD GENERATION
    // Replace naive word splitting with AI-generated domain-specific queries.
    // This single call fixes keyword quality for ALL downstream sources.
    // ══════════════════════════════════════════════════════════════════
    let semanticQueries: string[] = [];
    let primaryKeywords = sanitizedIdea; // fallback

    if (lovableKey) {
      try {
        const semanticStart = Date.now();
        const semanticRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: `You generate search queries for market research. Given a startup idea, return 5 diverse search queries that someone would use to find competing products, market data, and user discussions about this type of product.

Rules:
- Each query should be 2-5 words, using natural language people actually search
- Include variations: category terms, synonym phrases, "app for X" patterns, and "[problem] solution"
- Do NOT just split the idea into words — generate semantically meaningful queries
- The first query should be the most direct product category search
- Include at least one query focused on the user problem (not the solution)
- Think about what a user looking for this type of product would actually type into Google

Return ONLY a JSON array of 5 strings. Example for "AI voice workout coach app":
["AI fitness coach app", "voice guided workout", "hands-free personal trainer", "workout motivation app", "exercise without looking at phone"]`
              },
              { role: "user", content: `Startup idea: "${sanitizedIdea}"` }
            ],
            temperature: 0.3,
            max_tokens: 300,
          }),
        });

        if (semanticRes.ok) {
          const semanticData = await semanticRes.json();
          const semanticContent = semanticData.choices?.[0]?.message?.content || "[]";
          const semanticMatch = semanticContent.match(/\[[\s\S]*?\]/);
          if (semanticMatch) {
            const parsed = JSON.parse(semanticMatch[0]);
            if (Array.isArray(parsed) && parsed.length >= 3) {
              semanticQueries = parsed.slice(0, 5).map((q: any) => String(q).trim()).filter(Boolean);
              primaryKeywords = semanticQueries[0] || primaryKeywords;
              console.log(`[SEMANTIC KEYWORDS] Generated ${semanticQueries.length} queries in ${Date.now() - semanticStart}ms: ${JSON.stringify(semanticQueries)}`);
            }
          }
        } else {
          console.warn("[SEMANTIC KEYWORDS] AI call failed, falling back to naive extraction");
        }
      } catch (semErr) {
        console.warn("[SEMANTIC KEYWORDS] Error:", semErr);
      }
    }

    // Fallback: if semantic generation failed, use improved naive extraction
    if (semanticQueries.length === 0) {
      const naiveWords = sanitizedIdea.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/)
        .filter((w: string) => w.length > 2 && !['the','and','for','with','app','tool','that','this','built','from','into','like','using','based'].includes(w.toLowerCase()));
      primaryKeywords = naiveWords.slice(0, 4).join(" ");
      semanticQueries = [primaryKeywords];
      console.log(`[SEMANTIC KEYWORDS] Fallback to naive: "${primaryKeywords}"`);
    }

    const rawData: Record<string, any> = {
      perplexityTrends: null,
      perplexityMarket: null,
      perplexityVC: null,
      perplexityRevenue: null,
      perplexityChurn: null,
      perplexityBuildCosts: null,
      perplexityCompetitors: null,
      firecrawlAppStore: null,
      firecrawlReddit: null,
      serperTrends: null,
      serperTrendsMonthly: null,
      serperNews: null,
      serperReddit: null,
      serperAutoComplete: null,
      serperCompetitors: null,
      productHunt: null,
      github: null,
      hackerNews: null,
      twitterSentiment: null,
      twitterCounts: null,
      twitterInfluencers: null,
      semanticQueries,
      sources: [],
    };

    // ── Pipeline metrics tracker ──
    const pipelineMetrics: Record<string, { status: string; durationMs: number; signalCount: number; error?: string }> = {};

    async function trackSource(name: string, fn: () => Promise<number>): Promise<void> {
      const start = Date.now();
      try {
        const signalCount = await fn();
        pipelineMetrics[name] = { status: "ok", durationMs: Date.now() - start, signalCount };
      } catch (e: any) {
        pipelineMetrics[name] = { status: "error", durationMs: Date.now() - start, signalCount: 0, error: e?.message || String(e) };
        console.error(`[PIPELINE] ${name} error:`, e);
      }
    }

    // Run Perplexity searches in parallel
    const perplexityPromises: Promise<void>[] = [];

    if (perplexityKey) {
      perplexityPromises.push(
        trackSource("perplexity_trends", async () => {
          const r = await perplexitySearch(perplexityKey, `What are the current search trends and growth data for "${idea}"? Include Google Trends data, YoY search volume changes, trending keywords, and social media discussion volume. Provide specific numbers and percentages.`, { recency: "month" });
          rawData.perplexityTrends = r; rawData.sources.push(...r.citations.map((c: string) => ({ url: c, type: "perplexity" })));
          return r.citations.length;
        })
      );

      perplexityPromises.push(
        trackSource("perplexity_market", async () => {
          const r = await perplexitySearch(perplexityKey, `Market analysis for "${idea}": How many competitors exist? What is the market saturation? Who are the top 5 competitors by market share? What are their ratings, review counts, and approximate downloads on app stores? What are their main weaknesses according to user reviews?`);
          rawData.perplexityMarket = r; rawData.sources.push(...r.citations.map((c: string) => ({ url: c, type: "perplexity" })));
          return r.citations.length;
        })
      );

      perplexityPromises.push(
        trackSource("perplexity_vc", async () => {
          const r = await perplexitySearch(perplexityKey, `What is the recent VC funding and investment activity in the "${idea}" space? Include total funding amounts, notable rounds, number of startups, and any accelerator activity (YC, etc). Provide specific dollar amounts and dates.`, { recency: "year" });
          rawData.perplexityVC = r; rawData.sources.push(...r.citations.map((c: string) => ({ url: c, type: "perplexity" })));
          return r.citations.length;
        })
      );

      perplexityPromises.push(
        trackSource("perplexity_revenue", async () => {
          const r = await perplexitySearch(perplexityKey, `What is the typical revenue and pricing for apps/products in the "${idea}" category? Include MRR ranges, pricing tiers, conversion rates, and revenue benchmarks for apps with 10K+ users. Provide specific dollar amounts.`);
          rawData.perplexityRevenue = r; rawData.sources.push(...r.citations.map((c: string) => ({ url: c, type: "perplexity" })));
          return r.citations.length;
        })
      );

      perplexityPromises.push(
        trackSource("perplexity_churn", async () => {
          const r = await perplexitySearch(perplexityKey, `What are the monthly subscription churn rates for apps and products in the "${idea}" category? Include specific churn percentages, retention data, and average revenue per user (ARPU) for subscription-based products in this space.`, { recency: "year" });
          rawData.perplexityChurn = r; rawData.sources.push(...r.citations.map((c: string) => ({ url: c, type: "perplexity" })));
          return r.citations.length;
        })
      );

      perplexityPromises.push(
        trackSource("perplexity_build_costs", async () => {
          const r = await perplexitySearch(perplexityKey, `What are the typical technology costs and infrastructure requirements to build a product like "${idea}"? Include API costs, hosting costs, third-party service pricing, and any specialized technology needed. What are the main technical challenges and cost drivers?`);
          rawData.perplexityBuildCosts = r; rawData.sources.push(...r.citations.map((c: string) => ({ url: c, type: "perplexity" })));
          return r.citations.length;
        })
      );

      // ── DEDICATED PERPLEXITY COMPETITOR QUERY ──
      // Specifically ask Perplexity for a structured competitor list
      perplexityPromises.push(
        trackSource("perplexity_competitors", async () => {
          const r = await perplexitySearch(perplexityKey, `List the top 10 apps, tools, or products that directly compete with or are alternatives to "${idea}". For each competitor, provide: the exact product name, its app store rating (if applicable), approximate number of downloads or users, its primary weakness according to user reviews, and its pricing model. Focus on real, currently active products. If fewer than 10 exist, list all that you can find.`);
          rawData.perplexityCompetitors = r;
          rawData.sources.push(...r.citations.map((c: string) => ({ url: c, type: "perplexity_competitors" })));
          return r.citations.length;
        })
      );
    }

    // Run Firecrawl searches in parallel
    const firecrawlPromises: Promise<void>[] = [];

    if (firecrawlKey) {
      firecrawlPromises.push(
        trackSource("firecrawl_appstore", async () => {
          const r = await withRetry(() => firecrawlSearch(firecrawlKey, `${sanitizedIdea} app site:apps.apple.com OR site:play.google.com`, 5));
          rawData.firecrawlAppStore = r; rawData.sources.push(...r.results.map((x: any) => ({ url: x.url, type: "firecrawl" })));
          return r.results.length;
        })
      );

      firecrawlPromises.push(
        trackSource("firecrawl_reddit", async () => {
          const r = await withRetry(() => firecrawlSearch(firecrawlKey, `${sanitizedIdea} reviews complaints pain points site:reddit.com`, 5));
          rawData.firecrawlReddit = r; rawData.sources.push(...r.results.map((x: any) => ({ url: x.url, type: "firecrawl" })));
          return r.results.length;
        })
      );
    }

    // Run Serper searches in parallel (Google Trends + Reddit fallback + Competitor Discovery)
    const serperPromises: Promise<void>[] = [];

    if (serperKey) {
      // Extract shorter keywords for better Serper hit rate
      const serperKeywords = idea.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter((w: string) => w.length > 2).slice(0, 4).join(" ");

      serperPromises.push(
        trackSource("serper_trends", async () => {
          const r = await serperSearch(serperKey, `${serperKeywords} search trends growth`, "search", 10);
          rawData.serperTrends = r; rawData.sources.push(...r.organic.map((o: any) => ({ url: o.link, type: "serper" })));
          return r.organic.length;
        })
      );

      serperPromises.push(
        trackSource("serper_trends_monthly", async () => {
          const r = await serperSearch(serperKey, `${serperKeywords} market size demand`, "search", 10);
          rawData.serperTrendsMonthly = r; rawData.sources.push(...r.organic.map((o: any) => ({ url: o.link, type: "serper" })));
          return r.organic.length;
        })
      );

      serperPromises.push(
        trackSource("serper_news", async () => {
          const r = await serperSearch(serperKey, serperKeywords, "news", 10);
          rawData.serperNews = r; rawData.sources.push(...r.organic.map((o: any) => ({ url: o.link, type: "serper" })));
          return r.organic.length;
        })
      );

      serperPromises.push(
        trackSource("serper_reddit", async () => {
          const r = await serperSearch(serperKey, `${serperKeywords} site:reddit.com`, "search", 10);
          rawData.serperReddit = r; rawData.sources.push(...r.organic.map((o: any) => ({ url: o.link, type: "serper" })));
          return r.organic.length;
        })
      );

      serperPromises.push(
        trackSource("serper_autocomplete", async () => {
          const r = await serperAutoComplete(serperKey, idea);
          rawData.serperAutoComplete = r;
          return r.suggestions.length;
        })
      );

      // ── PHASE 1 FIX 1: Dedicated Competitor Discovery Queries ──
      // Run 5 targeted competitor queries to ensure we find real alternatives
      rawData.serperCompetitors = { allResults: [] as any[] };

      const competitorQueryTemplates = [
        `${serperKeywords} competitors alternatives`,
        `apps like ${serperKeywords}`,
        `${serperKeywords} vs`,
        `${serperKeywords} alternative`,
        `${serperKeywords} review comparison`,
      ];

      for (const cq of competitorQueryTemplates) {
        serperPromises.push(
          trackSource(`serper_competitor_${competitorQueryTemplates.indexOf(cq)}`, async () => {
            const r = await serperSearch(serperKey, cq, "search", 10);
            rawData.serperCompetitors.allResults.push(...r.organic.map((o: any) => ({
              ...o,
              _query: cq,
            })));
            rawData.sources.push(...r.organic.map((o: any) => ({ url: o.link, type: "serper_competitor" })));
            return r.organic.length;
          })
        );
      }
    }

    // Run Product Hunt search — use broader keyword extraction
    const productHuntPromises: Promise<void>[] = [];

    if (productHuntKey) {
      const ideaWords = idea.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w: string) => w.length > 2 && !['the','and','for','with','app','tool','that','this','built','from','into'].includes(w));
      const coreKeywords = ideaWords.slice(0, 3);
      const phSearches = [
        coreKeywords.join(" "),
        coreKeywords.slice(0, 2).join(" "),
        coreKeywords.length > 2 ? `${coreKeywords[0]} ${coreKeywords[2]}` : coreKeywords[0],
      ].filter((v, i, a) => a.indexOf(v) === i);

      const phResults: any[] = [];
      for (const kw of phSearches) {
        productHuntPromises.push(
          productHuntSearch(productHuntKey, kw, 5)
            .then(r => { phResults.push(...r.products); })
            .catch(e => console.error("Product Hunt error:", e))
        );
      }
      productHuntPromises.push(
        trackSource("producthunt", async () => {
          await Promise.all(productHuntPromises.slice(0, -1));
          const seen = new Set<string>();
          const unique = phResults.filter(p => {
            if (seen.has(p.name)) return false;
            seen.add(p.name);
            return true;
          }).sort((a: any, b: any) => (b.upvotes || 0) - (a.upvotes || 0)).slice(0, 5);
          rawData.productHunt = { products: unique };
          rawData.sources.push(...unique.map((p: any) => ({ url: p.url, type: "producthunt" })));
          return unique.length;
        })
      );
    }

    // Run GitHub search — use broader keyword extraction with multiple queries
    const githubPromises: Promise<void>[] = [];
    const ghWords = idea.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w: string) => w.length > 2 && !['the','and','for','with','app','tool','that','this','built','from','into'].includes(w));
    const ghKeywords = ghWords.slice(0, 3);
    const ghSearches = [
      ghKeywords.join(" "),
      ghKeywords.slice(0, 2).join(" "),
      ghKeywords.length > 2 ? `${ghKeywords[0]} ${ghKeywords[2]}` : ghKeywords[0],
    ].filter((v, i, a) => a.indexOf(v) === i);

    const ghResults: any[] = [];
    for (const kw of ghSearches) {
      githubPromises.push(
        githubSearch(kw, 5)
          .then(r => { ghResults.push(...r.repos); })
          .catch(e => console.error("GitHub error:", e))
      );
    }
    githubPromises.push(
      trackSource("github", async () => {
        await Promise.all(githubPromises.slice(0, -1));
        const seen = new Set<string>();
        const unique = ghResults.filter(r => {
          if (seen.has(r.name)) return false;
          seen.add(r.name);
          return true;
        }).sort((a: any, b: any) => (b.stars || 0) - (a.stars || 0)).slice(0, 10);
        rawData.github = { repos: unique };
        rawData.sources.push(...unique.map((repo: any) => ({ url: repo.url, type: "github" })));
        return unique.length;
      })
    );

    // Run Twitter/X searches in parallel
    const twitterPromises: Promise<void>[] = [];
    if (twitterBearerToken) {
      // Use broader keyword without quotes for better Twitter coverage
      const twitterKeywords = idea.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter((w: string) => w.length > 2).slice(0, 3).join(" ");

      twitterPromises.push(
        trackSource("twitter_sentiment", async () => {
          const r = await twitterSearch(twitterBearerToken, twitterKeywords, 50);
          rawData.twitterSentiment = r;
          rawData.sources.push(...r.tweets.map((t: any) => ({ url: `https://x.com/${t.author_username}/status/${t.id}`, type: "twitter" })));
          return r.tweets.length;
        })
      );
      
      twitterPromises.push(
        trackSource("twitter_counts", async () => {
          const r = await twitterTweetCounts(twitterBearerToken, twitterKeywords);
          rawData.twitterCounts = r;
          return r.total_count;
        })
      );

      rawData.twitterInfluencerNicheQuery = twitterKeywords;
    }

    // Run Hacker News search
    const hnPromises: Promise<void>[] = [];
    const hnKeywords = sanitizedIdea.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter((w: string) => w.length > 2).slice(0, 3).join(" ");
    hnPromises.push(
      trackSource("hackernews", async () => {
        const r = await hackerNewsSearch(hnKeywords, 10);
        rawData.hackerNews = r;
        rawData.sources.push(...r.hits.map((h: any) => ({ url: h.hnUrl, type: "hackernews" })));
        return r.hits.length;
      })
    );

    const fetchStart = Date.now();
    await Promise.all([...perplexityPromises, ...firecrawlPromises, ...serperPromises, ...productHuntPromises, ...githubPromises, ...twitterPromises, ...hnPromises]);
    const totalFetchDurationMs = Date.now() - fetchStart;

    // ── Post-fetch: Extract founder X handles from competitor data and look them up ──
    if (twitterBearerToken && lovableKey && rawData.perplexityMarket?.content) {
      await trackSource("twitter_influencers", async () => {
        const extractRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: "Extract up to 3 X/Twitter usernames (handles without @) of founders, CEOs, or key people building products in the space described. Return ONLY a JSON array of strings like [\"username1\",\"username2\"]. If none found, return []." },
              { role: "user", content: `Market data:\n${rawData.perplexityMarket.content}\n\nIdea: ${idea}` },
            ],
            temperature: 0,
            max_tokens: 200,
          }),
        });
        if (!extractRes.ok) return 0;
        const extractData = await extractRes.json();
        const content = extractData.choices?.[0]?.message?.content || "[]";
        const jsonMatch = content.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          const usernames: string[] = JSON.parse(jsonMatch[0]);
          if (usernames.length > 0) {
            const nicheQuery = idea.split(/\s+/).slice(0, 4).join(" ");
            const influencerResult = await twitterInfluencerSignals(twitterBearerToken, usernames, nicheQuery);
            rawData.twitterInfluencers = influencerResult;
            rawData.sources.push(...influencerResult.influencers.map((inf: any) => ({ url: `https://x.com/${inf.username}`, type: "twitter" })));
            return influencerResult.influencers.length;
          }
        }
        return 0;
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // PHASE 1 FIX 2: POST-FETCH RELEVANCE FILTERING
    // Score each collected item for relevance to the user's idea.
    // Items scoring below 5/10 are filtered out before AI analysis.
    // ══════════════════════════════════════════════════════════════════
    if (lovableKey) {
      const filterStart = Date.now();

      // Build items to score: GitHub repos, HN hits, Product Hunt, competitor search results
      const itemsToScore: { source: string; index: number; title: string; description: string }[] = [];

      (rawData.github?.repos || []).forEach((r: any, i: number) => {
        itemsToScore.push({ source: "github", index: i, title: r.name, description: r.description || "" });
      });
      (rawData.hackerNews?.hits || []).forEach((h: any, i: number) => {
        itemsToScore.push({ source: "hackernews", index: i, title: h.title, description: "" });
      });
      (rawData.productHunt?.products || []).forEach((p: any, i: number) => {
        itemsToScore.push({ source: "producthunt", index: i, title: p.name, description: p.tagline || "" });
      });

      if (itemsToScore.length > 0) {
        try {
          const scoringRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content: `You are a relevance scorer. Given a startup idea and a list of search results, score each result from 0-10 for how relevant it is to the idea. 0 = completely unrelated, 10 = directly about this exact topic. Return ONLY a JSON array of numbers, one score per item, in the same order. Example: [8, 2, 6, 1, 9]`,
                },
                {
                  role: "user",
                  content: `Startup idea: "${idea}"\n\nResults to score:\n${itemsToScore.map((item, i) => `${i + 1}. [${item.source}] ${item.title} — ${item.description}`).join("\n")}`,
                },
              ],
              temperature: 0,
              max_tokens: 500,
            }),
          });

          if (scoringRes.ok) {
            const scoringData = await scoringRes.json();
            const scoresContent = scoringData.choices?.[0]?.message?.content || "[]";
            const scoresMatch = scoresContent.match(/\[[\s\S]*?\]/);
            if (scoresMatch) {
              const scores: number[] = JSON.parse(scoresMatch[0]);
              let filteredCount = 0;

              // Apply relevance threshold of 5
              const toRemove: Record<string, Set<number>> = { github: new Set(), hackernews: new Set(), producthunt: new Set() };
              itemsToScore.forEach((item, idx) => {
                const score = scores[idx] ?? 5; // default to 5 if missing
                if (score < 5) {
                  toRemove[item.source]?.add(item.index);
                  filteredCount++;
                }
              });

              // Filter GitHub repos
              if (toRemove.github.size > 0 && rawData.github?.repos) {
                const before = rawData.github.repos.length;
                rawData.github.repos = rawData.github.repos.filter((_: any, i: number) => !toRemove.github.has(i));
                console.log(`[RELEVANCE FILTER] GitHub: ${before} -> ${rawData.github.repos.length} repos (removed ${toRemove.github.size} irrelevant)`);
              }

              // Filter HN hits
              if (toRemove.hackernews.size > 0 && rawData.hackerNews?.hits) {
                const before = rawData.hackerNews.hits.length;
                rawData.hackerNews.hits = rawData.hackerNews.hits.filter((_: any, i: number) => !toRemove.hackernews.has(i));
                console.log(`[RELEVANCE FILTER] HackerNews: ${before} -> ${rawData.hackerNews.hits.length} hits (removed ${toRemove.hackernews.size} irrelevant)`);
              }

              // Filter Product Hunt products
              if (toRemove.producthunt.size > 0 && rawData.productHunt?.products) {
                const before = rawData.productHunt.products.length;
                rawData.productHunt.products = rawData.productHunt.products.filter((_: any, i: number) => !toRemove.producthunt.has(i));
                console.log(`[RELEVANCE FILTER] ProductHunt: ${before} -> ${rawData.productHunt.products.length} products (removed ${toRemove.producthunt.size} irrelevant)`);
              }

              console.log(`[RELEVANCE FILTER] Total: scored ${itemsToScore.length} items, filtered ${filteredCount} irrelevant in ${Date.now() - filterStart}ms`);
              rawData.relevanceFilterApplied = true;
              rawData.relevanceFilterStats = { scored: itemsToScore.length, filtered: filteredCount };
            }
          } else {
            console.warn("[RELEVANCE FILTER] AI scoring call failed, skipping filter");
          }
        } catch (filterErr) {
          console.warn("[RELEVANCE FILTER] Error during relevance scoring:", filterErr);
        }
      }
    }

    // Deduplicate competitor search results
    if (rawData.serperCompetitors?.allResults?.length > 0) {
      const seen = new Set<string>();
      rawData.serperCompetitors.allResults = rawData.serperCompetitors.allResults.filter((r: any) => {
        const key = r.link || r.title;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      console.log(`[COMPETITOR DISCOVERY] ${rawData.serperCompetitors.allResults.length} unique competitor search results collected`);
    }

    // Log pipeline metrics summary
    const totalSignals = Object.values(pipelineMetrics).reduce((s, m) => s + m.signalCount, 0);
    const failedSources = Object.entries(pipelineMetrics).filter(([, m]) => m.status === "error").map(([k]) => k);
    console.log(`[PIPELINE METRICS] Total fetch: ${totalFetchDurationMs}ms | Sources: ${Object.keys(pipelineMetrics).length} | Signals: ${totalSignals} | Failed: ${failedSources.length > 0 ? failedSources.join(", ") : "none"}`);
    console.log(`[PIPELINE METRICS DETAIL]`, JSON.stringify(pipelineMetrics));

    // ── Source Failure Alerting: notify admins if >2 sources failed ──
    if (failedSources.length > 2) {
      try {
        const { data: adminEmails } = await supabase.from("admin_emails").select("email");
        if (adminEmails && adminEmails.length > 0) {
          // Look up admin user IDs from profiles
          const adminEmailList = adminEmails.map((a: any) => a.email);
          const { data: adminProfiles } = await supabase
            .from("profiles")
            .select("id")
            .in("email", adminEmailList);

          if (adminProfiles && adminProfiles.length > 0) {
            const notifications = adminProfiles.map((p: any) => ({
              user_id: p.id,
              title: `Pipeline Alert: ${failedSources.length} sources failed`,
              message: `Analysis "${idea.slice(0, 50)}..." had ${failedSources.length} source failures: ${failedSources.join(", ")}. Total signals: ${totalSignals}. Review in Admin > Pipeline.`,
            }));
            await supabase.from("notifications").insert(notifications);
            console.log(`[ALERT] Notified ${adminProfiles.length} admin(s) about ${failedSources.length} source failures`);
          }
        }
      } catch (alertErr) {
        console.error("[ALERT] Failed to send failure notification:", alertErr);
      }
    }

    // ── Zero-signal warning: alert if total signals are critically low ──
    if (totalSignals < 10) {
      try {
        const { data: adminEmails } = await supabase.from("admin_emails").select("email");
        if (adminEmails && adminEmails.length > 0) {
          const adminEmailList = adminEmails.map((a: any) => a.email);
          const { data: adminProfiles } = await supabase
            .from("profiles")
            .select("id")
            .in("email", adminEmailList);

          if (adminProfiles && adminProfiles.length > 0) {
            const notifications = adminProfiles.map((p: any) => ({
              user_id: p.id,
              title: `Low Signal Alert: only ${totalSignals} signals collected`,
              message: `Analysis "${idea.slice(0, 50)}..." collected only ${totalSignals} signals across all sources. This may produce a low-quality report. Review in Admin > Pipeline.`,
            }));
            await supabase.from("notifications").insert(notifications);
            console.log(`[ALERT] Notified admin(s) about low signal count: ${totalSignals}`);
          }
        }
      } catch (alertErr) {
        console.error("[ALERT] Failed to send low-signal notification:", alertErr);
      }
    }

    // ── Data sufficiency check ──
    const sourcesWithData = Object.values(pipelineMetrics).filter(m => m.status === "ok" && m.signalCount > 0).length;
    if (sourcesWithData < 2) {
      console.warn(`[DATA SUFFICIENCY] Only ${sourcesWithData} sources returned data. Skipping AI — insufficient data.`);
      await supabase.from("analyses").update({
        status: "failed",
        report_data: {
          error: "insufficient_data",
          message: "Too few data sources returned results to produce a reliable analysis. Try a different idea or rephrase your concept.",
          pipelineMetrics: { totalFetchDurationMs, totalSignals, failedSources, sources: pipelineMetrics, timestamp: new Date().toISOString() },
        },
        updated_at: new Date().toISOString(),
      }).eq("id", analysisId);
      return new Response(JSON.stringify({ error: "Insufficient data to analyze" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Step 2: Analyzing with AI (grounded in real data) ──
    await supabase.from("analyses").update({ status: "analyzing" }).eq("id", analysisId);

    if (!lovableKey) {
      console.error("LOVABLE_API_KEY not found");
      await supabase.from("analyses").update({ status: "failed" }).eq("id", analysisId);
      return new Response(JSON.stringify({ error: "AI key missing" }), { status: 500, headers: corsHeaders });
    }

    // Build context from real data
    const realDataContext = `
=== REAL MARKET DATA COLLECTED ===

--- TREND & SEARCH DATA (from Perplexity Sonar with citations) ---
${rawData.perplexityTrends ? rawData.perplexityTrends.content : "No trend data available — mark as AI Estimated"}
Citations: ${rawData.perplexityTrends?.citations?.join(", ") || "none"}

--- MARKET & COMPETITOR DATA (from Perplexity Sonar with citations) ---
${rawData.perplexityMarket ? rawData.perplexityMarket.content : "No market data available — mark as AI Estimated"}
Citations: ${rawData.perplexityMarket?.citations?.join(", ") || "none"}

--- APP STORE LISTINGS (from Firecrawl web scraping) ---
${rawData.firecrawlAppStore?.results?.map((r: any) => `URL: ${r.url}\nTitle: ${r.title || "N/A"}\nContent: ${(r.markdown || "").slice(0, 1500)}`).join("\n---\n") || "No app store data scraped — mark competitor data as AI Estimated"}

--- REDDIT DISCUSSIONS (from Firecrawl web scraping) ---
${rawData.firecrawlReddit?.results?.map((r: any) => `URL: ${r.url}\nTitle: ${r.title || "N/A"}\nContent: ${(r.markdown || "").slice(0, 1500)}`).join("\n---\n") || "No Reddit data scraped — mark sentiment data as AI Estimated"}

--- VC FUNDING DATA (from Perplexity Sonar with citations) ---
${rawData.perplexityVC ? rawData.perplexityVC.content : "No VC data available — mark as AI Estimated"}
Citations: ${rawData.perplexityVC?.citations?.join(", ") || "none"}

--- REVENUE BENCHMARK DATA (from Perplexity Sonar with citations) ---
${rawData.perplexityRevenue ? rawData.perplexityRevenue.content : "No revenue data available — mark as AI Estimated"}
Citations: ${rawData.perplexityRevenue?.citations?.join(", ") || "none"}

--- GOOGLE SEARCH & TRENDS DATA (from Serper.dev — real Google results) ---
${rawData.serperTrends?.organic?.map((r: any) => `Title: ${r.title}\nURL: ${r.link}\nSnippet: ${r.snippet || "N/A"}`).join("\n---\n") || "No Serper trends data available"}
${rawData.serperTrends?.knowledgeGraph ? `Knowledge Graph: ${JSON.stringify(rawData.serperTrends.knowledgeGraph)}` : ""}

--- MONTHLY SEARCH INTEREST TREND (from Serper.dev — Google search data for month-over-month interest) ---
${rawData.serperTrendsMonthly?.organic?.map((r: any) => `Title: ${r.title}\nURL: ${r.link}\nSnippet: ${r.snippet || "N/A"}`).join("\n---\n") || "No monthly trend data available"}

--- NEWS COVERAGE TIMELINE (from Serper.dev — recent news articles with dates for temporal interest mapping) ---
${rawData.serperNews?.organic?.map((r: any) => `Title: ${r.title}\nURL: ${r.link}\nDate: ${r.date || "N/A"}\nSnippet: ${r.snippet || "N/A"}`).join("\n---\n") || "No news coverage data available"}

--- GOOGLE AUTOCOMPLETE SUGGESTIONS (from Serper.dev) ---
${rawData.serperAutoComplete?.suggestions?.join(", ") || "No autocomplete data available"}

--- REDDIT DISCUSSIONS via GOOGLE (from Serper.dev — site:reddit.com fallback) ---
${rawData.serperReddit?.organic?.map((r: any) => `Title: ${r.title}\nURL: ${r.link}\nSnippet: ${r.snippet || "N/A"}`).join("\n---\n") || "No Serper Reddit data available"}

--- DEDICATED COMPETITOR DISCOVERY (from Serper.dev — targeted competitor queries) ---
${rawData.serperCompetitors?.allResults?.length > 0
  ? `${rawData.serperCompetitors.allResults.length} competitor search results found:\n${rawData.serperCompetitors.allResults.slice(0, 20).map((r: any) => `Title: ${r.title}\nURL: ${r.link}\nSnippet: ${r.snippet || "N/A"}\nQuery: ${r._query || "N/A"}`).join("\n---\n")}`
  : "No competitor discovery results found — this is unusual and suggests a very new or niche market"}
IMPORTANT: Use this competitor data to validate and supplement competitor counts. If these results show real competing products, do NOT report 0 competitors.
${rawData.relevanceFilterApplied ? `\n[RELEVANCE FILTER APPLIED] ${rawData.relevanceFilterStats?.filtered || 0} irrelevant results were removed from GitHub, HN, and Product Hunt before this analysis.` : ""}

--- PRODUCT HUNT LAUNCHES (from Product Hunt API — real launch data) ---
${rawData.productHunt?.products?.length > 0
  ? rawData.productHunt.products.map((p: any) => `Name: ${p.name}\nTagline: ${p.tagline}\nUpvotes: ${p.upvotes}\nLaunch Date: ${p.launchDate}\nURL: ${p.url}`).join("\n---\n")
  : "No similar products found on Product Hunt — this could indicate a blue ocean opportunity"}
Total PH products found: ${rawData.productHunt?.products?.length ?? 0}

--- GITHUB REPOSITORIES (from GitHub API — real open-source data) ---
${rawData.github?.repos?.length > 0
  ? rawData.github.repos.map((r: any) => `Repo: ${r.name}\nStars: ${r.stars}\nForks: ${r.forks}\nOpen Issues: ${r.openIssues}\nLanguage: ${r.language}\nLast Push: ${r.pushedAt}\nURL: ${r.url}\nTopics: ${(r.topics || []).join(", ")}`).join("\n---\n")
  : "No relevant GitHub repositories found — limited open-source competition"}
Total GitHub repos found: ${rawData.github?.repos?.length ?? 0}

--- X/TWITTER SENTIMENT DATA (from X API v2 — real public posts) ---
${rawData.twitterSentiment?.tweets?.length > 0
  ? rawData.twitterSentiment.tweets.map((t: any) => `Tweet: "${t.text}"\nAuthor: @${t.author_username} (${t.author_name}, ${t.author_followers.toLocaleString()} followers)\nLikes: ${t.like_count} | Retweets: ${t.retweet_count} | Replies: ${t.reply_count}\nDate: ${t.created_at}\nURL: https://x.com/${t.author_username}/status/${t.id}`).join("\n---\n")
  : "No X/Twitter sentiment data available — X API not configured or returned no results"}
Total tweets analyzed: ${rawData.twitterSentiment?.total_fetched ?? 0}
High-engagement tweets (10+ likes): ${rawData.twitterSentiment?.tweets?.length ?? 0}

--- X/TWITTER TWEET VOLUME (from X API v2 — daily tweet counts over 7 days) ---
${rawData.twitterCounts?.counts?.length > 0
  ? `Daily counts: ${rawData.twitterCounts.counts.map((c: any) => `${c.start?.split("T")[0]}: ${c.tweet_count}`).join(", ")}
Total tweets in 7 days: ${rawData.twitterCounts.total_count}
Volume change (week-over-week): ${rawData.twitterCounts.volume_change_pct > 0 ? "+" : ""}${rawData.twitterCounts.volume_change_pct}%`
  : "No X/Twitter volume data available"}

--- X/TWITTER INFLUENCER & FOUNDER SIGNALS (from X API v2 — real founder profiles and tweets) ---
${rawData.twitterInfluencers?.influencers?.length > 0
  ? rawData.twitterInfluencers.influencers.map((inf: any) => `Founder: ${inf.name} (@${inf.username})\nFollowers: ${inf.followers_count?.toLocaleString()}\nBio: ${inf.description}\nLatest Niche Tweet: "${inf.latest_niche_tweet?.text || 'N/A'}"\nLikes: ${inf.latest_niche_tweet?.like_count || 0} | Retweets: ${inf.latest_niche_tweet?.retweet_count || 0}\nTweet URL: ${inf.latest_niche_tweet?.id ? `https://x.com/${inf.username}/status/${inf.latest_niche_tweet.id}` : 'N/A'}`).join("\n---\n")
  : "No influencer/founder signals found — no relevant X accounts identified"}
Total influencers found: ${rawData.twitterInfluencers?.influencers?.length ?? 0}

--- HACKER NEWS DISCUSSIONS (from HN Algolia API — developer buzz signals) ---
${rawData.hackerNews?.hits?.length > 0
  ? rawData.hackerNews.hits.map((h: any) => `Title: ${h.title}\nPoints: ${h.points}\nComments: ${h.comments}\nAuthor: ${h.author}\nDate: ${h.createdAt}\nHN URL: ${h.hnUrl}\nLink: ${h.url || "self-post"}`).join("\n---\n")
  : "No Hacker News discussions found — limited developer community buzz"}
Total HN stories found: ${rawData.hackerNews?.hits?.length ?? 0}

--- CHURN & RETENTION BENCHMARKS (from Perplexity Sonar — category-specific retention data) ---
${rawData.perplexityChurn ? rawData.perplexityChurn.content : "No churn data available — mark as AI Estimated"}
Citations: ${rawData.perplexityChurn?.citations?.join(", ") || "none"}

--- BUILD COMPLEXITY & TECHNOLOGY COSTS (from Perplexity Sonar — technical feasibility data) ---
${rawData.perplexityBuildCosts ? rawData.perplexityBuildCosts.content : "No build cost data available — mark as AI Estimated"}
Citations: ${rawData.perplexityBuildCosts?.citations?.join(", ") || "none"}
`;

    // Unique source URLs for the report
    const uniqueSources = [...new Set(rawData.sources.map((s: any) => s.url).filter(Boolean))];

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are the AI analysis engine for Gold Rush, a market validation platform for app developers.

Your job is to produce a structured JSON report that is:
- Brutally honest (do not hype ideas)
- Simple enough for a non-technical founder to act on immediately
- 100% grounded in the real data provided — never invent statistics

Your role is to interpret signals of demand, competition, user pain, and opportunity using the evidence provided. Never exaggerate trends. Never fill gaps with optimistic assumptions.

═══════════════════════════════════════
SECTION 1: DATA TRUST RULES (READ FIRST)
═══════════════════════════════════════

Every metric in the report MUST follow this trust hierarchy.

TIER 1 — HARD DATA (label as "verified")
Sources: Firecrawl App Store scrapes, GitHub API, Product Hunt GraphQL, Serper Google search results
Rules:
- Use exact numbers whenever possible
- Do not aggressively round numbers
- Always include the source URL
- These signals carry the highest weight in analysis
- If Tier 1 data exists, it MUST drive the conclusions

TIER 2 — SOFT DATA (label as "reported")
Sources: Perplexity Sonar citations, X/Twitter counts, Reddit thread summaries
Rules:
- Always attribute the source
- Use phrases such as: "reported by", "according to", "based on analysis of"
- These signals provide context, not primary evidence
- Perplexity summaries must never dominate the analysis
- AI summaries should explain evidence, not replace it

TIER 3 — AI ESTIMATED (label as "estimated")
Sources: Any inference caused by missing or incomplete data, any fallback response where a primary source returned nothing
Rules:
- You MUST clearly flag with: "AI estimate — no primary source confirmed."
- Estimated signals must never be presented as verified facts
- Never present AI-estimated data with the same visual weight as verified data

LIMITED DATA RULE: If a source returned fewer than 3 signals, output: "Limited data returned from [source]. Treat with caution."

SOURCE BALANCE RULE: Perplexity summaries must never dominate the analysis. If Tier 1 data exists, it must drive the conclusions. AI summaries should explain evidence, not replace it.

CONFLICTING SIGNALS RULE: If two Tier 1 sources contradict each other — for example, Serper shows rising search interest but X shows declining tweet volume — you MUST surface the conflict explicitly. Do not average conflicting signals. Do not silently pick one and ignore the other. Output the conflict in the relevant section like this: "Conflicting signals detected: [Source A] shows [finding]. [Source B] shows [finding]. This uncertainty is reflected in the confidence level." Then lower the confidence level for that section accordingly.

═══════════════════════════════════════
SECTION 2: SCORING RULES
═══════════════════════════════════════

Score each category from 0-20 strictly based on evidence. Never inflate scores to be encouraging. Never deflate scores to appear conservative.

Categories:
- Trend Momentum: Is attention increasing across search, social, news, or developer activity?
- Market Saturation: How crowded is the space? Are incumbents dominant?
- Sentiment: Do real users complain about existing solutions? Is the pain genuine?
- Growth: Is the broader industry expanding?
- Opportunity: Is there a clear gap competitors fail to solve?

CRITICAL RULE — NARRATIVE MUST MATCH SCORE: Your written explanation for each category MUST align with its score. If Opportunity = 10/20 — the explanation must clearly explain why the opportunity is weak. Never write bullish text under a low score. Never write cautious text under a high score. Contradiction between score and narrative destroys user trust.

Overall Score = sum of all categories (0-100)
Verdict thresholds (non-negotiable):
>=75 -> Build Now
>=55 -> Build, But Niche Down
>=40 -> Validate Further
<40  -> Do Not Build Yet

DEMAND OVERRIDE RULE: If BOTH of these signals are weak: search demand AND user complaints / pain signals — then Opportunity must not exceed 10/20. DEFINITION OF WEAK: Fewer than 5 corroborating signals across Tier 1 and Tier 2 sources combined. Strong ideas require real user demand.

PAIN SIGNAL PRIORITY: User frustration is often a stronger signal than popularity. Look for: repeated complaints, feature requests, workflow failures, pricing frustration, users actively searching for alternatives. High complaint density = strong opportunity signal.

═══════════════════════════════════════
SECTION 3: COMPETITOR CLASSIFICATION
═══════════════════════════════════════

When analyzing competitors, classify each as: direct competitor, feature overlap, adjacent tool, or irrelevant. Only direct competitors and feature overlap tools should affect the Market Saturation score. Do not inflate competition by including unrelated tools. Limit competitor list to three most relevant.

═══════════════════════════════════════
SECTION 4: LANGUAGE RULES
═══════════════════════════════════════

Write for a smart non-technical founder who has never read a market report before.

BANNED terms — never use these without plain-English translation:
- CAGR -> say "annual growth rate" and explain it
- ARPU -> say "average monthly revenue per user"
- TAM -> say "total market size"
- SAM -> say "the portion of that market you can realistically reach"
- SOM -> say "the share you could realistically capture"
- robust, synergies, leverage, scalable -> cut entirely

If a number appears, explain what it means in plain English.
Sentence rules: Maximum 20 words per sentence. Every insight must answer: "What does this mean for someone building this product?"
Signal clarity rules: If signal is weak, write: "This signal is weak — do not rely on it alone." If signal is strong, write: "This is a real signal backed by [source]."

═══════════════════════════════════════
SECTION 5: WHAT YOU MUST NEVER DO
═══════════════════════════════════════

Never invent a statistic without a Tier 1 or Tier 2 source.
Never present a Perplexity-generated stat as primary research.
Never write bullish narrative under a low score.
Never write cautious narrative under a high score.
Never skip the Data Quality Summary.
Never present AI estimates with the same authority as verified data.
Never use emoji or special characters in any output field (they break PDF rendering).
Use plain text labels only: [RISK] [STRENGTH] [GAP] [WARNING]
Never omit a source URL when one is available.
Never average or silently resolve conflicting signals — surface them explicitly.
Apply the three-field estimated threshold recursively to every leaf-level metric in every nested section.

═══════════════════════════════════════
SECTION 6: JSON OUTPUT CONTRACT
═══════════════════════════════════════

Return valid JSON only. No markdown fences. No preamble. No trailing commas. No special characters or emoji in any string value.

The three required fields apply RECURSIVELY to every leaf-level metric in every nested section:
- dataTier ("verified" | "reported" | "estimated")
- sourceUrl (string URL or null)
- signalNote (plain English note on reliability)

If any category has more than 3 "estimated" fields, force confidenceLevel for that category to "Low" regardless of score.

Produce the JSON report with this EXACT structure:

{
  "idea": "the idea text",
  "overallScore": 0-100,
  "signalStrength": "Strong" or "Moderate" or "Weak",
  "scoreExplanation": "1-2 sentence explanation referencing specific data points",
  "dataSources": ["list of all source URLs used"],
  "dataQualitySummary": [
    {"sourceName": "source", "dataTier": "tier", "signalCount": "X signals", "reliabilityNote": "string"}
  ],
  "signalCards": [
    {
      "title": "Trend Momentum",
      "source": "Serper.dev + Perplexity Sonar — Google Trends & Search Volume",
      "dataSource": "serper" or "perplexity" or "ai_estimated",
      "sourceUrls": ["citation URLs"],
      "icon": "TrendingUp",
      "type": "metrics",
      "confidence": "High" or "Medium" or "Low",
      "evidenceCount": number,
      "metrics": [{"label": "Google Search Volume", "value": "string", "dataSource": "serper" or "perplexity" or "ai_estimated", "sourceUrl": "url or null", "dataTier": "verified" or "reported" or "estimated", "signalNote": "string"}, {"label": "Search Growth (90d)", "value": "string", "dataSource": "string", "sourceUrl": "url or null", "dataTier": "string", "signalNote": "string"}, {"label": "News Coverage", "value": "X articles in last 30 days", "dataSource": "serper", "sourceUrl": "url or null", "dataTier": "verified", "signalNote": "string"}, {"label": "Trending Keywords", "value": "string", "dataSource": "serper" or "ai_estimated", "sourceUrl": null, "dataTier": "string", "signalNote": "string"}, {"label": "X Buzz", "value": "X tweets in 7 days, +Y% volume change", "dataSource": "twitter", "sourceUrl": null, "dataTier": "reported", "signalNote": "string"}],
      "sparkline": [{"name": "W1", "value": number}, ...12 data points],
      "twitterVolumeSparkline": [{"name": "Mon", "value": number}, ...7 daily points] ,
      "googleTrendsSparkline": [{"name": "Apr", "value": number}, ...12 monthly points],
      "evidence": ["real quotes with source URLs"],
      "insight": "one sentence — max 20 words"
    },
    {
      "title": "Market Saturation",
      "source": "Firecrawl — App Store Scraping",
      "dataSource": "firecrawl" or "perplexity" or "ai_estimated",
      "sourceUrls": ["scraped URLs"],
      "icon": "PieChart",
      "type": "metrics",
      "confidence": "High" or "Medium" or "Low",
      "evidenceCount": number,
      "metrics": [{"label": "string", "value": "string", "dataSource": "string", "sourceUrl": "url or null", "dataTier": "string", "signalNote": "string"}],
      "donut": [{"name": "Top 5", "value": number}, {"name": "Others", "value": number}],
      "evidence": ["strings with source"],
      "insight": "one sentence — max 20 words"
    },
    {
      "title": "Competitor Snapshot",
      "source": "Firecrawl — App Store Scraping",
      "dataSource": "firecrawl" or "perplexity" or "ai_estimated",
      "sourceUrls": ["scraped URLs"],
      "icon": "Users",
      "type": "competitors",
      "confidence": "High" or "Medium" or "Low",
      "evidenceCount": number,
      "competitors": [{"name": "REAL app name", "classification": "direct" or "feature_overlap" or "adjacent", "rating": "REAL rating", "reviews": "REAL count", "downloads": "estimate", "weakness": "from REAL reviews", "whatTheyDoWell": "honest assessment", "dataSource": "firecrawl" or "perplexity" or "ai_estimated", "sourceUrl": "url or null", "dataTier": "string", "signalNote": "string"}],
      "evidence": ["strings"],
      "insight": "one sentence — max 20 words"
    },
    {
      "title": "Sentiment & Pain Points",
      "source": "Firecrawl + X API — Reddit, App Reviews & X Posts",
      "dataSource": "firecrawl" or "twitter" or "ai_estimated",
      "sourceUrls": ["URLs"],
      "icon": "MessageCircle",
      "type": "sentiment",
      "confidence": "High" or "Medium" or "Low",
      "evidenceCount": number,
      "sentiment": {"complaints": ["REAL complaints"], "loves": ["REAL praise"], "emotion": "string", "complaintCount": number, "positiveCount": number, "complaintsSourceUrl": "url or null", "lovesSourceUrl": "url or null"},
      "twitterSentiment": [{"text": "actual tweet", "authorName": "name", "authorUsername": "handle", "followerCount": number, "likeCount": number, "retweetCount": number, "tweetUrl": "url"}],
      "evidence": ["REAL quotes with URLs"],
      "insight": "one sentence — max 20 words"
    },
    {
      "title": "Growth Signals",
      "source": "Product Hunt + GitHub + X API + Perplexity Sonar",
      "dataSource": "producthunt" or "github" or "twitter" or "perplexity" or "ai_estimated",
      "sourceUrls": ["URLs"],
      "icon": "Zap",
      "type": "metrics",
      "confidence": "High" or "Medium" or "Low",
      "evidenceCount": number,
      "metrics": [
        {"label": "PH Similar Launches", "value": "count", "dataSource": "producthunt", "sourceUrl": "url or null", "dataTier": "verified", "signalNote": "string"},
        {"label": "Top PH Upvotes", "value": "count", "dataSource": "producthunt", "sourceUrl": "url", "dataTier": "verified", "signalNote": "string"},
        {"label": "GitHub Stars (top repo)", "value": "count", "dataSource": "github", "sourceUrl": "url", "dataTier": "verified", "signalNote": "string"},
        {"label": "GitHub Repos Found", "value": "count", "dataSource": "github", "sourceUrl": null, "dataTier": "verified", "signalNote": "string"},
        {"label": "Search Growth (90d)", "value": "percentage", "dataSource": "perplexity" or "serper", "sourceUrl": "url or null", "dataTier": "string", "signalNote": "string"},
        {"label": "Builder Activity", "value": "string", "dataSource": "github", "sourceUrl": "url or null", "dataTier": "verified", "signalNote": "string"}
      ],
      "productHuntLaunches": [{"name": "name", "tagline": "tagline", "upvotes": number, "launchDate": "YYYY-MM-DD", "url": "url"}],
      "influencerSignals": [{"name": "Name", "username": "handle", "followers_count": number, "description": "bio", "latest_niche_tweet": {"text": "text", "like_count": number, "retweet_count": number, "id": "id"}}],
      "lineChart": [{"name": "month", "value": number}, ...9 data points],
      "evidence": ["PH + GitHub + influencer evidence with URLs"],
      "insight": "one sentence — max 20 words"
    }
  ],
  "opportunity": {"featureGaps": ["specific gaps"], "underservedUsers": ["who and why"], "positioning": "string", "builderAngle": "one sentence on positioning", "noOpportunityFound": false},
  "revenueBenchmark": {"summary": "string", "range": "string", "basis": "string", "dataSource": "perplexity" or "ai_estimated", "sourceUrls": ["urls"]},
  "proofDashboard": {
    "searchDemand": {"keyword": "keyword", "monthlySearches": "volume", "trend": "Rising / Stable / Declining", "confidence": "High/Medium/Low", "source": "source", "relatedKeywords": ["5 terms"]},
    "developerActivity": {"repoCount": "count", "totalStars": "count", "recentCommits": "assessment", "trend": "Increasing/Stable/Declining", "confidence": "High/Medium/Low"},
    "socialActivity": {"twitterMentions": "count", "redditThreads": "count", "sentimentScore": "Positive/Mixed/Negative", "hnPhLaunches": "count", "confidence": "High/Medium/Low"},
    "appStoreSignals": {"relatedApps": "count", "avgRating": "rating", "downloadEstimate": "estimate", "marketGap": "gap description", "confidence": "High/Medium/Low"}
  },
  "keywordDemand": {"keywords": [{"keyword": "term", "volume": "vol", "difficulty": "Low/Medium/High", "trend": "Rising/Stable/Declining"}], "confidence": "High/Medium/Low", "source": "source"},
  "appStoreIntelligence": {"apps": [{"name": "name", "platform": "iOS/Android/Both", "rating": "rating", "reviews": "count", "downloads": "estimate", "url": "url or null"}], "insight": "max 20 words", "confidence": "High/Medium/Low", "source": "source"},
  "recommendedStrategy": {"positioning": "specific", "suggestedPricing": "with reasoning", "differentiators": ["4-6 items"], "primaryTarget": "ONE segment and why", "channels": ["3-5 real channels"], "confidence": "Medium"},
  "nicheAnalysis": {"samEstimate": "dollar amount", "samPercentage": "X-Y%", "samReasoning": "why this percentage", "competitorClarity": "what exists vs not", "directCompetitors": 0, "competitorDetail": "specifics", "xSignalInterpretation": "interpret volume", "xVolumeContext": "context vs similar niches", "dataSource": "perplexity" or "ai_estimated", "sourceUrls": ["urls"]},
  "unitEconomics": {"churnBenchmarks": [{"name": "name", "churnRate": "X%/mo", "source": "source"}], "churnImplication": "what it means", "realisticArpu": "$X/mo", "arpuReasoning": "rationale", "privacyPremium": "can you charge more", "ltvEstimate": "$X", "dataSource": "perplexity" or "ai_estimated", "sourceUrls": ["urls"]},
  "buildComplexity": {"mvpTimeline": "X-Y weeks", "mvpScope": ["4-5 features"], "techChallenges": ["3-4 challenges"], "estimatedCost": "$X-Y", "voiceApiCosts": "pricing", "onDeviceNote": "feasibility", "dataSource": "ai_estimated", "sourceUrls": []},
  "scoreBreakdown": [{"label": "Trend Momentum", "value": 0-20, "weight": "20%"}, {"label": "Market Saturation", "value": 0-20, "weight": "20%"}, {"label": "Sentiment", "value": 0-20, "weight": "20%"}, {"label": "Growth", "value": 0-20, "weight": "20%"}, {"label": "Opportunity", "value": 0-20, "weight": "20%"}],
  "keyStats": [{"value": "number", "label": "description", "change": "+X% or null", "sentiment": "positive/negative/neutral"}] — MUST return EXACTLY 4 items. Use these categories: (1) Signal Score, (2) Data Points collected, (3) Revenue estimate or market size, (4) Competition count or growth metric. Never return fewer than 4.,
  "userQuotes": [{"text": "REAL quote", "source": "subreddit or review", "sourceUrl": "URL or null", "upvotes": "count or null", "platform": "reddit/app_store/twitter/other"}],
  "githubRepos": [{"name": "owner/repo", "description": "desc", "stars": number, "forks": number, "openIssues": number, "language": "lang", "url": "url", "updatedAt": "ISO date", "pushedAt": "ISO date", "topics": ["topics"]}],
  "methodology": {"totalSources": 0, "perplexityQueries": 4, "firecrawlScrapes": 0, "serperSearches": 0, "productHuntQueries": 0, "githubSearches": 0, "twitterSearches": 0, "dataPoints": 0, "analysisDate": "YYYY-MM-DD", "confidenceNote": "overall data quality note"},
  "blueprint": {"productConcept": "string", "strategicPositioning": "string", "coreFeatures": ["5-7 items"], "targetUsers": ["3-4 items"], "monetization": ["2-3 items"], "mvpPlan": ["5-6 items"]},
  "marketExploitMap": {"competitorWeaknesses": ["4-6 concrete weaknesses"], "competitorStrengths": ["3-5 honest strengths"], "topComplaints": [{"complaint": "specific", "frequency": "High/Medium/Low"}], "topPraise": [{"praise": "specific", "frequency": "High/Medium/Low"}], "whereToWin": ["4-6 opportunities"], "attackAngle": "1-2 sentence positioning", "confidence": "High/Medium/Low"},
  "competitorMatrix": {"features": ["Speed", "Pricing", "App Store Data", "Search Demand Signals", "Social Sentiment", "Build Feasibility", "Report Depth", "Founder Actionability"], "competitors": [{"name": "name", "classification": "direct/feature_overlap/adjacent", "isYou": false, "scores": {"Speed": "Strong/Medium/Weak/No"}}, {"name": "Your Idea", "isYou": true, "scores": {}}], "confidence": "Medium"},
  "founderDecision": {"decision": "Build Now" or "Build, But Niche Down" or "Validate Further" or "Do Not Build Yet", "reasoning": "1-2 sentences — narrative MUST match verdict threshold", "whyFactors": ["3-5 data-backed reasons"], "nextStep": "ONE concrete action achievable within five days — name a real channel or method. NOT 'do more research'", "riskLevel": "Low/Medium/High", "speedToMvp": "Fast/Medium/Slow", "commercialClarity": "Clear/Moderate/Weak", "confidence": "Medium"},
  "killShotAnalysis": {"risks": [{"risk": "specific risk referencing data", "severity": "High/Medium/Low", "mitigation": "one sentence — how to survive it"}], "riskLevel": "Low/Medium/High", "interpretation": "2-3 sentences — manageable or deal-breakers? Reference data.", "confidence": "Medium"},
  "scoreExplanationData": {"summary": "1-2 sentences", "factors": [{"category": "Demand Strength", "explanation": "narrative must match score"}, {"category": "Competition Density", "explanation": "string"}, {"category": "User Sentiment", "explanation": "string"}, {"category": "Market Growth", "explanation": "string"}, {"category": "Opportunity Gap", "explanation": "if <=10, explain weakness clearly"}], "confidence": "Medium"}
}

CRITICAL REMINDERS:
- If real data is not available, set dataSource to "ai_estimated", dataTier to "estimated", sourceUrl to null, signalNote to "AI estimate — no primary source confirmed."
- Never present estimated data as if from a real source.
- Score honestly. Narrative MUST match scores. Bullish text under low scores is forbidden.
- If BOTH search demand AND pain signals are weak (<5 corroborating signals), cap Opportunity at 10/20.
- Return ONLY the JSON, no markdown formatting.`,
          },
          {
            role: "user",
            content: `Analyze this startup idea: "${idea}"\n\nHere is the real market data collected:\n${realDataContext}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 16000,
      }),
    });

    let reportData = null;
    let overallScore = 0;
    let signalStrength = "Weak";

    if (aiResponse.ok) {
      const aiResult = await aiResponse.json();
      const content = aiResult.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        // Sanitize: remove trailing commas before } or ]
        let cleaned = jsonMatch[0]
          .replace(/,\s*([}\]])/g, '$1')
          .replace(/[\x00-\x1F\x7F]/g, (c) => c === '\n' || c === '\r' || c === '\t' ? c : ' ');
        try {
          reportData = JSON.parse(cleaned);
        } catch (parseErr) {
          console.error("JSON parse failed, attempting repair:", (parseErr as Error).message);
          // Try more aggressive cleanup: strip any non-JSON prefix/suffix
          const reMatch = cleaned.match(/\{[\s\S]*\}/);
          if (reMatch) {
            try {
              reportData = JSON.parse(reMatch[0]);
            } catch (_) {
              console.error("JSON repair also failed, using fallback");
            }
          }
        }
        // Inject the collected source URLs into the report
        reportData.dataSources = uniqueSources;
        // Always set analysis date to actual current date
        if (reportData.methodology) {
          reportData.methodology.analysisDate = new Date().toISOString().split('T')[0];
        }

        // ══════════════════════════════════════════════════════════════
        // DETERMINISTIC POST-AI VALIDATION
        // These checks enforce scoring rules in CODE, not just the prompt.
        // ══════════════════════════════════════════════════════════════

        // 1. Enforce overallScore = sum of scoreBreakdown values
        if (reportData.scoreBreakdown && Array.isArray(reportData.scoreBreakdown) && reportData.scoreBreakdown.length === 5) {
          const computedSum = reportData.scoreBreakdown.reduce((sum: number, cat: any) => sum + (Number(cat.value) || 0), 0);
          if (reportData.overallScore !== computedSum) {
            console.warn(`[SCORE VALIDATION] overallScore mismatch: AI returned ${reportData.overallScore}, computed sum is ${computedSum}. Correcting.`);
            reportData.overallScore = computedSum;
          }
        }

        // 2. Enforce verdict thresholds deterministically
        const finalScore = reportData.overallScore || 0;
        const correctVerdict = finalScore >= 75 ? "Build Now"
          : finalScore >= 55 ? "Build, But Niche Down"
          : finalScore >= 40 ? "Validate Further"
          : "Do Not Build Yet";

        if (reportData.founderDecision) {
          if (reportData.founderDecision.decision !== correctVerdict) {
            console.warn(`[VERDICT VALIDATION] AI verdict "${reportData.founderDecision.decision}" doesn't match score ${finalScore}. Correcting to "${correctVerdict}".`);
            reportData.founderDecision.decision = correctVerdict;
          }
        }

        // Also enforce signalStrength consistency
        const correctSignalStrength = finalScore >= 70 ? "Strong" : finalScore >= 45 ? "Moderate" : "Weak";
        if (reportData.signalStrength !== correctSignalStrength) {
          console.warn(`[SIGNAL VALIDATION] signalStrength "${reportData.signalStrength}" doesn't match score ${finalScore}. Correcting to "${correctSignalStrength}".`);
          reportData.signalStrength = correctSignalStrength;
        }

        // 3. Demand Override Rule — code-level enforcement
        // If BOTH search demand AND user pain signals are weak (<5 signals combined),
        // cap Opportunity at 10/20
        const countDemandSignals = (): number => {
          let count = 0;
          // Tier 1 search signals: Serper results
          count += rawData.serperTrends?.organic?.length ?? 0;
          count += rawData.serperAutoComplete?.suggestions?.length ?? 0;
          // Tier 1: App Store results
          count += rawData.firecrawlAppStore?.results?.length ?? 0;
          return count;
        };

        const countPainSignals = (): number => {
          let count = 0;
          // Tier 1: Reddit scrapes
          count += rawData.firecrawlReddit?.results?.length ?? 0;
          // Tier 2: Reddit via Serper
          count += rawData.serperReddit?.organic?.length ?? 0;
          // Tier 2: Twitter complaints
          count += rawData.twitterSentiment?.tweets?.length ?? 0;
          return count;
        };

        const demandSignalCount = countDemandSignals();
        const painSignalCount = countPainSignals();
        const totalDemandAndPain = demandSignalCount + painSignalCount;

        if (totalDemandAndPain < 5) {
          const opportunityEntry = reportData.scoreBreakdown?.find((b: any) => b.label === "Opportunity");
          if (opportunityEntry && Number(opportunityEntry.value) > 10) {
            console.warn(`[DEMAND OVERRIDE] Only ${totalDemandAndPain} demand+pain signals (${demandSignalCount} demand, ${painSignalCount} pain). Capping Opportunity from ${opportunityEntry.value} to 10.`);
            const reduction = Number(opportunityEntry.value) - 10;
            opportunityEntry.value = 10;
            reportData.overallScore = (reportData.overallScore || 0) - reduction;

            // Re-apply verdict after score adjustment
            const adjustedScore = reportData.overallScore;
            const adjustedVerdict = adjustedScore >= 75 ? "Build Now"
              : adjustedScore >= 55 ? "Build, But Niche Down"
              : adjustedScore >= 40 ? "Validate Further"
              : "Do Not Build Yet";
            if (reportData.founderDecision) {
              reportData.founderDecision.decision = adjustedVerdict;
            }
            reportData.signalStrength = adjustedScore >= 70 ? "Strong" : adjustedScore >= 45 ? "Moderate" : "Weak";
          }
        }

        // ══════════════════════════════════════════════════════════════
        // PHASE 1 FIX 3: COMPETITOR COUNT VALIDATION
        // Cross-check: if AI says 0 competitors but competitor discovery
        // found results, flag inconsistency and lower confidence.
        // ══════════════════════════════════════════════════════════════
        const competitorDiscoveryCount = rawData.serperCompetitors?.allResults?.length ?? 0;
        const aiCompetitorCount = reportData.nicheAnalysis?.directCompetitors ?? -1;
        const competitorSnapshotCard = (reportData.signalCards || []).find((c: any) => c.title === "Competitor Snapshot");
        const aiCompetitorListCount = competitorSnapshotCard?.competitors?.length ?? 0;

        if (aiCompetitorCount === 0 && (competitorDiscoveryCount >= 3 || aiCompetitorListCount > 0)) {
          console.warn(`[COMPETITOR VALIDATION] AI reported 0 direct competitors but competitor discovery found ${competitorDiscoveryCount} results and competitor snapshot has ${aiCompetitorListCount} entries. Correcting.`);

          // Fix the niche analysis competitor count
          if (reportData.nicheAnalysis) {
            reportData.nicheAnalysis.directCompetitors = Math.max(aiCompetitorListCount, Math.min(competitorDiscoveryCount, 5));
            reportData.nicheAnalysis.competitorClarity = `[AUTO-CORRECTED] Originally reported 0 competitors, but ${competitorDiscoveryCount} competitor search results were found. ${reportData.nicheAnalysis.competitorClarity || ""}`;
          }

          // Lower confidence on the competitor snapshot card
          if (competitorSnapshotCard) {
            if (competitorSnapshotCard.confidence === "High") {
              competitorSnapshotCard.confidence = "Medium";
            }
          }

          // Lower Market Saturation confidence if it was inflated
          const saturationCard = (reportData.signalCards || []).find((c: any) => c.title === "Market Saturation");
          if (saturationCard && saturationCard.confidence === "High") {
            saturationCard.confidence = "Medium";
            console.warn(`[COMPETITOR VALIDATION] Lowered Market Saturation confidence to Medium due to competitor count inconsistency`);
          }
        }

        // Also validate: if competitor discovery found many results but AI only lists 1-2
        if (competitorDiscoveryCount >= 10 && aiCompetitorListCount <= 1 && competitorSnapshotCard) {
          console.warn(`[COMPETITOR VALIDATION] Competitor discovery found ${competitorDiscoveryCount} results but AI only listed ${aiCompetitorListCount} competitors. Flagging.`);
          if (competitorSnapshotCard.confidence !== "Low") {
            competitorSnapshotCard.confidence = "Medium";
          }
          competitorSnapshotCard.insight = `${competitorSnapshotCard.insight || ""} [Note: ${competitorDiscoveryCount} competitor search results were found — more competitors may exist than listed.]`.trim();
        }

        console.log(`[COMPETITOR VALIDATION] AI competitors: ${aiCompetitorCount}, Discovery results: ${competitorDiscoveryCount}, Snapshot entries: ${aiCompetitorListCount}`);

        // Log validation summary
        console.log(`[VALIDATION COMPLETE] Score: ${reportData.overallScore}, Verdict: ${reportData.founderDecision?.decision}, Signal: ${reportData.signalStrength}, Demand signals: ${demandSignalCount}, Pain signals: ${painSignalCount}`);

        overallScore = reportData.overallScore || 0;
        signalStrength = reportData.signalStrength || "Moderate";

        // ── Fill missing sections with safe defaults so UI always renders ──
        if (!reportData.proofDashboard) {
          reportData.proofDashboard = {
            searchDemand: { keyword: idea.split(" ").slice(0, 3).join(" "), monthlySearches: "Data unavailable", trend: "Stable", confidence: "Low", source: "AI Estimated", relatedKeywords: [] },
            developerActivity: { repoCount: String(rawData.github?.repos?.length ?? 0), totalStars: String((rawData.github?.repos || []).reduce((s: number, r: any) => s + (r.stars || 0), 0)), recentCommits: "See GitHub data", trend: "Stable", confidence: rawData.github?.repos?.length > 0 ? "Medium" : "Low" },
            socialActivity: { twitterMentions: String(rawData.twitterCounts?.total_count ?? 0), redditThreads: String(rawData.serperReddit?.organic?.length ?? 0), sentimentScore: "Mixed", hnPhLaunches: String(rawData.productHunt?.products?.length ?? 0), confidence: "Low" },
            appStoreSignals: { relatedApps: String(rawData.firecrawlAppStore?.results?.length ?? 0), avgRating: "N/A", downloadEstimate: "N/A", marketGap: "Insufficient data to determine", confidence: "Low" },
          };
        }
        if (!reportData.keywordDemand) {
          const suggestions = rawData.serperAutoComplete?.suggestions || [];
          reportData.keywordDemand = {
            keywords: suggestions.slice(0, 5).map((s: string) => ({ keyword: s, volume: "N/A", difficulty: "Medium", trend: "Stable" })),
            confidence: suggestions.length > 0 ? "Medium" : "Low",
            source: suggestions.length > 0 ? "Serper.dev Autocomplete" : "AI Estimated",
          };
          if (reportData.keywordDemand.keywords.length === 0) {
            reportData.keywordDemand.keywords = [{ keyword: idea.split(" ").slice(0, 3).join(" "), volume: "N/A", difficulty: "Medium", trend: "Stable" }];
          }
        }
        if (!reportData.appStoreIntelligence) {
          const apps = (reportData.signalCards || []).find((c: any) => c.title === "Competitor Snapshot")?.competitors || [];
          reportData.appStoreIntelligence = {
            apps: apps.slice(0, 5).map((c: any) => ({ name: c.name, platform: "Both", rating: c.rating || "N/A", reviews: c.reviews || "N/A", downloads: c.downloads || "N/A", url: c.sourceUrl || null })),
            insight: "Based on competitor data collected during analysis.",
            confidence: apps.length > 0 ? "Medium" : "Low",
            source: "Firecrawl + Perplexity Sonar",
          };
        }
        if (!reportData.recommendedStrategy) {
          reportData.recommendedStrategy = {
            positioning: "Differentiate through a focused niche approach based on competitor weaknesses identified in this report.",
            suggestedPricing: "Competitive with existing solutions — see Revenue Benchmark section.",
            differentiators: (reportData.opportunity?.featureGaps || []).slice(0, 4),
            primaryTarget: (reportData.opportunity?.underservedUsers || ["Early adopters"])[0],
            channels: ["Product Hunt launch", "Relevant subreddits", "Content marketing"],
            confidence: "Low",
          };
        }
        if (!reportData.marketExploitMap) {
          const sentimentCard = (reportData.signalCards || []).find((c: any) => c.title === "Sentiment & Pain Points");
          reportData.marketExploitMap = {
            competitorWeaknesses: (sentimentCard?.sentiment?.complaints || []).slice(0, 4),
            competitorStrengths: (sentimentCard?.sentiment?.loves || []).slice(0, 3),
            topComplaints: (sentimentCard?.sentiment?.complaints || []).slice(0, 3).map((c: string) => ({ complaint: c, frequency: "Medium" })),
            topPraise: (sentimentCard?.sentiment?.loves || []).slice(0, 3).map((p: string) => ({ praise: p, frequency: "Medium" })),
            whereToWin: (reportData.opportunity?.featureGaps || []).slice(0, 4),
            attackAngle: reportData.opportunity?.positioning || "Focus on underserved user segments.",
            confidence: "Low",
          };
        }
        if (!reportData.competitorMatrix) {
          const competitors = (reportData.signalCards || []).find((c: any) => c.title === "Competitor Snapshot")?.competitors || [];
          const features = ["Pricing", "UX Quality", "Feature Depth", "Market Presence"];
          reportData.competitorMatrix = {
            features,
            competitors: [
              ...competitors.slice(0, 3).map((c: any) => ({ name: c.name, isYou: false, scores: Object.fromEntries(features.map(f => [f, "Medium"])) })),
              { name: "Your Idea", isYou: true, scores: Object.fromEntries(features.map(f => [f, "Strong"])) },
            ],
            confidence: "Low",
          };
        }
        if (!reportData.founderDecision) {
          const score = reportData.overallScore || 65;
          reportData.founderDecision = {
            decision: score >= 75 ? "Build Now" : score >= 55 ? "Build, But Niche Down" : score >= 40 ? "Validate Further" : "Proceed with Caution",
            reasoning: reportData.scoreExplanation || "See score breakdown for details.",
            whyFactors: ["Review the full report sections for detailed reasoning."],
            nextStep: "Validate with 10 potential users before building an MVP.",
            riskLevel: score >= 70 ? "Low" : score >= 45 ? "Medium" : "High",
            speedToMvp: "Medium",
            commercialClarity: "Moderate",
            confidence: "Low",
          };
        }
        if (!reportData.killShotAnalysis) {
          reportData.killShotAnalysis = {
            risks: [
              { risk: "Established competitors with large user bases", severity: "Medium" },
              { risk: "Market may require significant user acquisition spend", severity: "Medium" },
            ],
            riskLevel: "Medium",
            interpretation: "Standard market risks apply. Review competitor analysis and sentiment sections for specific threats.",
            confidence: "Low",
          };
        }
        if (!reportData.scoreExplanationData) {
          const breakdown = reportData.scoreBreakdown || [];
          reportData.scoreExplanationData = {
            summary: reportData.scoreExplanation || "Score reflects the balance of demand signals, competition density, and market opportunity.",
            factors: [
              { category: "Demand Strength", explanation: `Trend score: ${breakdown.find((b: any) => b.label === "Trend Momentum")?.value ?? "N/A"}/20` },
              { category: "Competition Density", explanation: `Saturation score: ${breakdown.find((b: any) => b.label === "Market Saturation")?.value ?? "N/A"}/20` },
              { category: "User Sentiment", explanation: `Sentiment score: ${breakdown.find((b: any) => b.label === "Sentiment")?.value ?? "N/A"}/20` },
              { category: "Market Growth", explanation: `Growth score: ${breakdown.find((b: any) => b.label === "Growth")?.value ?? "N/A"}/20` },
              { category: "Opportunity Gap", explanation: `Opportunity score: ${breakdown.find((b: any) => b.label === "Opportunity")?.value ?? "N/A"}/20` },
            ],
            confidence: "Low",
          };
        }
      }
    } else {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
    }

    // ── Inject pipeline metrics into report for debugging ──
    if (reportData) {
      reportData.pipelineMetrics = {
        totalFetchDurationMs,
        totalSignals,
        failedSources,
        sources: pipelineMetrics,
        timestamp: new Date().toISOString(),
      };
    }

    // ── Step 3: Complete ──
    await supabase.from("analyses").update({
      status: "complete",
      overall_score: overallScore,
      signal_strength: signalStrength,
      report_data: reportData,
      updated_at: new Date().toISOString(),
    }).eq("id", analysisId);

    // ── Analytics event (fire-and-forget) ──
    if (pipelineUserId) {
      supabase.from("analytics_events").insert({
        event_name: "analysis_completed",
        user_id: pipelineUserId,
        metadata: { analysis_id: analysisId, score: overallScore, signal_strength: signalStrength },
      }).then(() => {});
    }

    // ── Send analysis complete email (fire-and-forget) ──
    if (pipelineUserId) {
      const { data: userProfile } = await supabase.from("profiles").select("email").eq("id", pipelineUserId).single();
      if (userProfile?.email) {
        fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-transactional-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
          body: JSON.stringify({
            type: "analysis_complete",
            to: userProfile.email,
            data: { idea: sanitizedIdea, score: overallScore, analysisId },
          }),
        }).catch((e) => console.error("[pipeline] Email send failed:", e));
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Pipeline error:", err);
    try {
      if (capturedAnalysisId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceKey);
        await supabase.from("analyses").update({ status: "failed" }).eq("id", capturedAnalysisId);
      }
    } catch (_) {}
    return new Response(JSON.stringify({ error: "Pipeline failed" }), { status: 500, headers: corsHeaders });
  }
});
