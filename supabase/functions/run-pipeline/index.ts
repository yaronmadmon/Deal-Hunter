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
    const influencers: any[] = [];
    const headers = { Authorization: `Bearer ${bearerToken}` };

    for (const uname of limitedUsernames) {
      try {
        const userRes = await fetch(
          `https://api.x.com/2/users/by/username/${encodeURIComponent(uname)}?user.fields=public_metrics,description`,
          { headers }
        );
        if (!userRes.ok) continue;
        const userData = await userRes.json();
        const user = userData.data;
        if (!user) continue;

        const tweetsRes = await fetch(
          `https://api.x.com/2/users/${user.id}/tweets?max_results=10&tweet.fields=created_at,public_metrics`,
          { headers }
        );
        let nicheTweet = null;
        if (tweetsRes.ok) {
          const tweetsData = await tweetsRes.json();
          const tweets = tweetsData.data || [];
          const nicheWords = nicheQuery.toLowerCase().split(/\s+/);
          const matched = tweets.filter((t: any) =>
            nicheWords.some((w: string) => t.text.toLowerCase().includes(w))
          );
          nicheTweet = matched.length > 0
            ? matched.sort((a: any, b: any) => (b.public_metrics?.like_count || 0) - (a.public_metrics?.like_count || 0))[0]
            : tweets[0];
        }

        influencers.push({
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
        });
      } catch (e) {
        console.error(`Influencer lookup error for @${uname}:`, e);
      }
    }
    return { influencers };
  } catch (e) {
    console.error("Twitter influencer signals error:", e);
    return { influencers: [] };
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

    const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const serperKey = Deno.env.get("SERPER_API_KEY");
    const productHuntKey = Deno.env.get("PRODUCTHUNT_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const twitterBearerToken = Deno.env.get("TWITTER_BEARER_TOKEN");

    // ── Step 1: Fetching real market data ──
    await supabase.from("analyses").update({ status: "fetching" }).eq("id", analysisId);

    const rawData: Record<string, any> = {
      perplexityTrends: null,
      perplexityMarket: null,
      perplexityVC: null,
      perplexityRevenue: null,
      perplexityChurn: null,
      perplexityBuildCosts: null,
      firecrawlAppStore: null,
      firecrawlReddit: null,
      serperTrends: null,
      serperTrendsMonthly: null,
      serperNews: null,
      serperReddit: null,
      serperAutoComplete: null,
      productHunt: null,
      github: null,
      twitterSentiment: null,
      twitterCounts: null,
      twitterInfluencers: null,
      sources: [],
    };

    // Run Perplexity searches in parallel
    const perplexityPromises: Promise<void>[] = [];

    if (perplexityKey) {
      perplexityPromises.push(
        perplexitySearch(perplexityKey, `What are the current search trends and growth data for "${idea}"? Include Google Trends data, YoY search volume changes, trending keywords, and social media discussion volume. Provide specific numbers and percentages.`, { recency: "month" })
          .then(r => { rawData.perplexityTrends = r; rawData.sources.push(...r.citations.map((c: string) => ({ url: c, type: "perplexity" }))); })
          .catch(e => console.error("Perplexity trends error:", e))
      );

      perplexityPromises.push(
        perplexitySearch(perplexityKey, `Market analysis for "${idea}": How many competitors exist? What is the market saturation? Who are the top 5 competitors by market share? What are their ratings, review counts, and approximate downloads on app stores? What are their main weaknesses according to user reviews?`)
          .then(r => { rawData.perplexityMarket = r; rawData.sources.push(...r.citations.map((c: string) => ({ url: c, type: "perplexity" }))); })
          .catch(e => console.error("Perplexity market error:", e))
      );

      perplexityPromises.push(
        perplexitySearch(perplexityKey, `What is the recent VC funding and investment activity in the "${idea}" space? Include total funding amounts, notable rounds, number of startups, and any accelerator activity (YC, etc). Provide specific dollar amounts and dates.`, { recency: "year" })
          .then(r => { rawData.perplexityVC = r; rawData.sources.push(...r.citations.map((c: string) => ({ url: c, type: "perplexity" }))); })
          .catch(e => console.error("Perplexity VC error:", e))
      );

      perplexityPromises.push(
        perplexitySearch(perplexityKey, `What is the typical revenue and pricing for apps/products in the "${idea}" category? Include MRR ranges, pricing tiers, conversion rates, and revenue benchmarks for apps with 10K+ users. Provide specific dollar amounts.`)
          .then(r => { rawData.perplexityRevenue = r; rawData.sources.push(...r.citations.map((c: string) => ({ url: c, type: "perplexity" }))); })
          .catch(e => console.error("Perplexity revenue error:", e))
      );

      // Niche-specific: churn rates, ARPU, and build complexity data
      perplexityPromises.push(
        perplexitySearch(perplexityKey, `What are the monthly subscription churn rates for fitness and coaching apps like Peloton, Fitbit Premium, Nike Training Club, and similar? Include specific churn percentages and retention data. Also what is the average ARPU for fitness subscription apps?`, { recency: "year" })
          .then(r => { rawData.perplexityChurn = r; rawData.sources.push(...r.citations.map((c: string) => ({ url: c, type: "perplexity" }))); })
          .catch(e => console.error("Perplexity churn error:", e))
      );

      perplexityPromises.push(
        perplexitySearch(perplexityKey, `Voice API pricing comparison: Whisper API, Deepgram, Google Speech-to-Text, AssemblyAI. Cost per minute of audio processing. On-device speech recognition options for mobile apps (Apple Speech, Android MLKit). Privacy-first voice processing feasibility.`)
          .then(r => { rawData.perplexityBuildCosts = r; rawData.sources.push(...r.citations.map((c: string) => ({ url: c, type: "perplexity" }))); })
          .catch(e => console.error("Perplexity build costs error:", e))
      );
    }

    // Run Firecrawl searches in parallel
    const firecrawlPromises: Promise<void>[] = [];

    if (firecrawlKey) {
      firecrawlPromises.push(
        firecrawlSearch(firecrawlKey, `${idea} app site:apps.apple.com OR site:play.google.com`, 5)
          .then(r => { rawData.firecrawlAppStore = r; rawData.sources.push(...r.results.map((x: any) => ({ url: x.url, type: "firecrawl" }))); })
          .catch(e => console.error("Firecrawl app store error:", e))
      );

      firecrawlPromises.push(
        firecrawlSearch(firecrawlKey, `${idea} reviews complaints pain points site:reddit.com`, 5)
          .then(r => { rawData.firecrawlReddit = r; rawData.sources.push(...r.results.map((x: any) => ({ url: x.url, type: "firecrawl" }))); })
          .catch(e => console.error("Firecrawl reddit error:", e))
      );
    }

    // Run Serper searches in parallel (Google Trends + Reddit fallback)
    const serperPromises: Promise<void>[] = [];

    if (serperKey) {
      // Google search for trends & search volume data
      serperPromises.push(
        serperSearch(serperKey, `"${idea}" Google Trends search volume growth 2025 2026`, "search", 10)
          .then(r => {
            rawData.serperTrends = r;
            rawData.sources.push(...r.organic.map((o: any) => ({ url: o.link, type: "serper" })));
          })
          .catch(e => console.error("Serper trends error:", e))
      );

      // Monthly search interest trend data - search for monthly mentions over the past year
      serperPromises.push(
        serperSearch(serperKey, `"${idea}" trend interest popularity month over month 2025 2026`, "search", 10)
          .then(r => {
            rawData.serperTrendsMonthly = r;
            rawData.sources.push(...r.organic.map((o: any) => ({ url: o.link, type: "serper" })));
          })
          .catch(e => console.error("Serper monthly trends error:", e))
      );

      // News coverage timeline - shows real temporal interest
      serperPromises.push(
        serperSearch(serperKey, `${idea}`, "news", 10)
          .then(r => {
            rawData.serperNews = r;
            rawData.sources.push(...r.organic.map((o: any) => ({ url: o.link, type: "serper" })));
          })
          .catch(e => console.error("Serper news error:", e))
      );

      // Reddit fallback via Serper site:reddit.com search
      serperPromises.push(
        serperSearch(serperKey, `${idea} site:reddit.com reviews opinions`, "search", 10)
          .then(r => {
            rawData.serperReddit = r;
            rawData.sources.push(...r.organic.map((o: any) => ({ url: o.link, type: "serper" })));
          })
          .catch(e => console.error("Serper reddit error:", e))
      );

      // Autocomplete for trending keyword suggestions
      serperPromises.push(
        serperAutoComplete(serperKey, idea)
          .then(r => { rawData.serperAutoComplete = r; })
          .catch(e => console.error("Serper autocomplete error:", e))
      );
    }

    // Run Product Hunt search — use broader keyword extraction
    const productHuntPromises: Promise<void>[] = [];

    if (productHuntKey) {
      // Extract 2-3 core keywords from the idea
      const ideaWords = idea.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w: string) => w.length > 2 && !['the','and','for','with','app','tool','that','this','built','from','into'].includes(w));
      const coreKeywords = ideaWords.slice(0, 3);
      // Run multiple keyword combos and deduplicate
      const phSearches = [
        coreKeywords.join(" "),
        coreKeywords.slice(0, 2).join(" "),
        coreKeywords.length > 2 ? `${coreKeywords[0]} ${coreKeywords[2]}` : coreKeywords[0],
      ].filter((v, i, a) => a.indexOf(v) === i);

      const phResults: any[] = [];
      for (const kw of phSearches) {
        productHuntPromises.push(
          productHuntSearch(productHuntKey, kw, 5)
            .then(r => {
              phResults.push(...r.products);
            })
            .catch(e => console.error("Product Hunt error:", e))
        );
      }
      // Merge after all resolve
      productHuntPromises.push(
        Promise.all(productHuntPromises.slice()).then(() => {
          // Deduplicate by name
          const seen = new Set<string>();
          const unique = phResults.filter(p => {
            if (seen.has(p.name)) return false;
            seen.add(p.name);
            return true;
          }).sort((a: any, b: any) => (b.upvotes || 0) - (a.upvotes || 0)).slice(0, 5);
          rawData.productHunt = { products: unique };
          rawData.sources.push(...unique.map((p: any) => ({ url: p.url, type: "producthunt" })));
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
          .then(r => {
            ghResults.push(...r.repos);
          })
          .catch(e => console.error("GitHub error:", e))
      );
    }
    githubPromises.push(
      Promise.all(githubPromises.slice()).then(() => {
        const seen = new Set<string>();
        const unique = ghResults.filter(r => {
          if (seen.has(r.name)) return false;
          seen.add(r.name);
          return true;
        }).sort((a: any, b: any) => (b.stars || 0) - (a.stars || 0)).slice(0, 10);
        rawData.github = { repos: unique };
        rawData.sources.push(...unique.map((repo: any) => ({ url: repo.url, type: "github" })));
      })
    );

    // Run Twitter/X searches in parallel
    const twitterPromises: Promise<void>[] = [];
    if (twitterBearerToken) {
      const twitterKeyword = idea.split(/\s+/).slice(0, 4).join(" ");
      
      // Sentiment search — top engaged tweets about the niche
      twitterPromises.push(
        twitterSearch(twitterBearerToken, `"${twitterKeyword}" app`, 50)
          .then(r => {
            rawData.twitterSentiment = r;
            rawData.sources.push(...r.tweets.map((t: any) => ({ url: `https://x.com/${t.author_username}/status/${t.id}`, type: "twitter" })));
          })
          .catch(e => console.error("Twitter sentiment error:", e))
      );
      
      // Tweet volume counts over 7 days
      twitterPromises.push(
        twitterTweetCounts(twitterBearerToken, twitterKeyword)
          .then(r => { rawData.twitterCounts = r; })
          .catch(e => console.error("Twitter counts error:", e))
      );

      // Influencer / founder signals — AI will provide usernames from competitor data
      // For now, we pass the niche query so the AI prompt can instruct including influencer data
      rawData.twitterInfluencerNicheQuery = twitterKeyword;
    }

    await Promise.all([...perplexityPromises, ...firecrawlPromises, ...serperPromises, ...productHuntPromises, ...githubPromises, ...twitterPromises]);

    // ── Post-fetch: Extract founder X handles from competitor data and look them up ──
    if (twitterBearerToken && lovableKey && rawData.perplexityMarket?.content) {
      try {
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
        if (extractRes.ok) {
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
            }
          }
        }
      } catch (e) {
        console.error("Influencer extraction error:", e);
      }
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

--- CHURN & RETENTION BENCHMARKS (from Perplexity Sonar — fitness app retention data) ---
${rawData.perplexityChurn ? rawData.perplexityChurn.content : "No churn data available — mark as AI Estimated"}
Citations: ${rawData.perplexityChurn?.citations?.join(", ") || "none"}

--- BUILD COMPLEXITY & VOICE API COSTS (from Perplexity Sonar — technical feasibility data) ---
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
            content: `You are a market analysis AI for Gold Rush, a startup idea validation tool.

CRITICAL RULES:
1. You have been given REAL market data collected from Perplexity Sonar (grounded web search), Firecrawl (web scraping), Serper.dev (real Google search results), Product Hunt API (real launch data with upvotes), GitHub API, and X/Twitter API v2 (real public posts and tweet volume). USE THIS DATA. Do NOT invent numbers.
2. Every data point MUST include a "dataSource" field with one of these values:
   - "perplexity" — if the data came from Perplexity search results
   - "firecrawl" — if the data came from Firecrawl web scraping
   - "serper" — if the data came from Serper.dev Google search results or autocomplete
   - "producthunt" — if the data came from Product Hunt API (launch data, upvotes)
   - "twitter" — if the data came from X/Twitter API (tweets, sentiment, volume)
   - "ai_estimated" — ONLY if the real data sources didn't cover this specific point
3. Every data point MUST include a "sourceUrl" field with the actual citation URL, or null if ai_estimated.
4. Extract REAL numbers from the data provided. If the data says "+34% growth", use that exact number. If the data mentions "500k downloads", use that.
5. For competitor data: use REAL app names, REAL ratings, and REAL review counts from the scraped data. Never invent competitor names.
6. For sentiment: use REAL quotes from Reddit threads and app reviews. Include the actual source URL.
7. For evidence strings: use REAL quotes with their actual source. Format as: "quote text" — Source (URL)

Return a JSON object with this EXACT structure (no markdown, pure JSON):

{
  "idea": "the idea text",
  "overallScore": 0-100,
  "signalStrength": "Strong" or "Moderate" or "Weak",
  "scoreExplanation": "1-2 sentence explanation referencing specific data points",
  "dataSources": ["list of all source URLs used"],
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
      "metrics": [{"label": "Google Search Volume", "value": "string", "dataSource": "serper" or "perplexity" or "ai_estimated", "sourceUrl": "url or null"}, {"label": "Search Growth (90d)", "value": "string", "dataSource": "string", "sourceUrl": "url or null"}, {"label": "News Coverage", "value": "X articles in last 30 days", "dataSource": "serper", "sourceUrl": "url or null"}, {"label": "Trending Keywords", "value": "string from autocomplete data", "dataSource": "serper" or "ai_estimated", "sourceUrl": null}, {"label": "X Buzz", "value": "X tweets in 7 days, +Y% volume change — use twitter volume data if available", "dataSource": "twitter", "sourceUrl": null}],
      "sparkline": [{"name": "W1", "value": number}, ...12 data points representing relative search interest over the last 12 weeks],
      "twitterVolumeSparkline": [{"name": "Mon", "value": number}, ...7 daily data points from X/Twitter tweet counts API] — Include this ONLY if Twitter volume data is available. Use actual daily tweet counts from the X API data. dataSource should be "twitter".
      "googleTrendsSparkline": [{"name": "Apr", "value": number}, {"name": "May", "value": number}, ...12 monthly data points covering the last 12 months] — CRITICAL: You MUST generate this array. Use month abbreviations (Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec, Jan, Feb, Mar) as names. Values are relative search interest on a 0-100 scale. Use the Serper trends data, monthly trend data, and news coverage timeline dates to model realistic month-over-month interest. If news articles cluster in recent months, show an upward trend. If Serper snippets mention growth percentages, reflect those in the curve shape. Always generate 12 data points. dataSource should be "serper".
      "evidence": ["real quotes with source URLs — include news article titles and dates from Serper news data, trend snippets from Serper search results, and X tweet volume data if available"],
      "insight": "one sentence based on real Google search, news coverage, and X buzz data"
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
      "metrics": [{"label": "string", "value": "string", "dataSource": "string", "sourceUrl": "url or null"}],
      "donut": [{"name": "Top 5", "value": number}, {"name": "Others", "value": number}],
      "evidence": ["strings with source"],
      "insight": "one sentence"
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
      "competitors": [{"name": "REAL app name", "rating": "REAL rating", "reviews": "REAL count", "downloads": "REAL or estimated count", "weakness": "from REAL reviews", "dataSource": "firecrawl" or "perplexity" or "ai_estimated", "sourceUrl": "url or null"}],
      "evidence": ["strings"],
      "insight": "one sentence"
    },
    {
      "title": "Sentiment & Pain Points",
      "source": "Firecrawl + X API — Reddit, App Reviews & X Posts",
      "dataSource": "firecrawl" or "twitter" or "ai_estimated",
      "sourceUrls": ["scraped URLs", "tweet URLs"],
      "icon": "MessageCircle",
      "type": "sentiment",
      "confidence": "High" or "Medium" or "Low",
      "evidenceCount": number,
      "sentiment": {"complaints": ["REAL complaints from REAL reviews and X posts"], "loves": ["REAL praise from REAL reviews and X posts"], "emotion": "string", "complaintCount": number, "positiveCount": number, "complaintsSourceUrl": "url or null", "lovesSourceUrl": "url or null"},
      "twitterSentiment": [{"text": "tweet text — use actual tweet content from X data", "authorName": "display name", "authorUsername": "handle", "followerCount": number, "likeCount": number, "retweetCount": number, "tweetUrl": "https://x.com/username/status/id"}] — Include top 10 most engaged tweets if X data is available. These are REAL tweets from the X API. If no X data, omit this field entirely (do NOT include empty array).
      "evidence": ["REAL quotes from Reddit, app reviews, AND X posts with source URL"],
      "insight": "one sentence incorporating both Reddit/review and X sentiment"
    },
    {
      "title": "Growth Signals",
      "source": "Product Hunt + GitHub + X API + Perplexity Sonar — Market Research",
      "dataSource": "producthunt" or "github" or "twitter" or "perplexity" or "ai_estimated",
      "sourceUrls": ["citation URLs, PH URLs, GitHub URLs, and tweet URLs"],
      "icon": "Zap",
      "type": "metrics",
      "confidence": "High" or "Medium" or "Low",
      "evidenceCount": number,
      "metrics": [
        {"label": "PH Similar Launches", "value": "count of similar products found on Product Hunt", "dataSource": "producthunt", "sourceUrl": "url or null"},
        {"label": "Top PH Upvotes", "value": "highest upvote count among similar PH products", "dataSource": "producthunt", "sourceUrl": "PH product url"},
        {"label": "GitHub Stars (top repo)", "value": "star count of most starred related repo", "dataSource": "github", "sourceUrl": "github repo url"},
        {"label": "GitHub Repos Found", "value": "count of related open-source repos", "dataSource": "github", "sourceUrl": null},
        {"label": "Search Growth (90d)", "value": "percentage", "dataSource": "perplexity" or "serper", "sourceUrl": "url or null"},
        {"label": "Builder Activity", "value": "string — use GitHub push dates and fork counts to assess", "dataSource": "github" or "string", "sourceUrl": "url or null"}
      ],
      "productHuntLaunches": [
        {"name": "product name", "tagline": "tagline", "upvotes": number, "launchDate": "YYYY-MM-DD", "url": "https://producthunt.com/posts/..."}
      ],
      "influencerSignals": [
        {"name": "Founder Name", "username": "x_handle", "followers_count": number, "description": "bio snippet", "latest_niche_tweet": {"text": "tweet text", "like_count": number, "retweet_count": number, "id": "tweet_id"}}
      ] — Include up to 3 influencer/founder signals. These are X accounts of founders, CEOs, or influential people building in this niche. Use competitor company names and founder names from the competitor data to identify relevant X usernames. If competitor data mentions specific people or companies, look them up. dataSource should be "twitter". If no influencer data is available, use an empty array.
      "lineChart": [{"name": "month", "value": number}, ...9 data points],
      "evidence": ["Include PH launch data AND GitHub data AND influencer signals: 'ProductName launched on PH with X upvotes' — URL. 'RepoName has X stars and Y forks on GitHub' — URL. '@founder has X followers and is active in this niche' — X URL. High activity = validated builder interest."],
      "insight": "one sentence referencing PH + GitHub + influencer data"
    }
  ],
  "opportunity": {"featureGaps": ["strings"], "underservedUsers": ["strings"], "positioning": "string"},
  "revenueBenchmark": {"summary": "string", "range": "string", "basis": "string", "dataSource": "perplexity" or "ai_estimated", "sourceUrls": ["urls"]},
  "proofDashboard": {
    "searchDemand": {
      "keyword": "primary search keyword for this idea",
      "monthlySearches": "estimated monthly search volume — use real data from Perplexity/Serper",
      "trend": "Rising / Stable / Declining",
      "confidence": "High" or "Medium" or "Low",
      "source": "Perplexity Sonar / Serper.dev",
      "relatedKeywords": ["5 related search terms from autocomplete data"]
    },
    "developerActivity": {
      "repoCount": "number of related GitHub repos found",
      "totalStars": "sum of stars across top repos",
      "recentCommits": "recent push activity assessment",
      "trend": "Increasing / Stable / Declining",
      "confidence": "High" or "Medium" or "Low"
    },
    "socialActivity": {
      "twitterMentions": "tweet count from X data — use real volume data",
      "redditThreads": "number of Reddit discussions found",
      "sentimentScore": "Positive / Mixed / Negative — based on sentiment analysis",
      "hnPhLaunches": "number of related PH launches",
      "confidence": "High" or "Medium" or "Low"
    },
    "appStoreSignals": {
      "relatedApps": "number of competing apps found",
      "avgRating": "average rating across competitors",
      "downloadEstimate": "combined download estimate",
      "marketGap": "brief description of the gap — e.g. 'No privacy-first option exists'",
      "confidence": "High" or "Medium" or "Low"
    }
  },
  "keywordDemand": {
    "keywords": [
      {"keyword": "primary keyword", "volume": "monthly volume estimate", "difficulty": "Low / Medium / High", "trend": "Rising / Stable / Declining"},
      {"keyword": "related keyword 2", "volume": "volume", "difficulty": "difficulty", "trend": "trend"},
      {"keyword": "related keyword 3", "volume": "volume", "difficulty": "difficulty", "trend": "trend"},
      {"keyword": "related keyword 4", "volume": "volume", "difficulty": "difficulty", "trend": "trend"},
      {"keyword": "related keyword 5", "volume": "volume", "difficulty": "difficulty", "trend": "trend"}
    ],
    "confidence": "High" or "Medium" or "Low",
    "source": "Perplexity Sonar + Serper.dev"
  },
  "appStoreIntelligence": {
    "apps": [
      {"name": "REAL app name", "platform": "iOS / Android / Both", "rating": "4.2", "reviews": "18k", "downloads": "500k+", "url": "app store URL or null"}
    ],
    "insight": "What this competitive landscape means for a new entrant",
    "confidence": "High" or "Medium" or "Low",
    "source": "Firecrawl + Perplexity Sonar"
  },
  "recommendedStrategy": {
    "positioning": "How to position this product against incumbents — be specific",
    "suggestedPricing": "Pricing recommendation with reasoning — e.g. '$19-29/mo SaaS based on competitor pricing and value-add'",
    "differentiators": ["4-6 specific differentiation opportunities based on competitor weaknesses and opportunity gaps"],
    "primaryTarget": "The ONE primary user segment to focus on for launch and why",
    "channels": ["3-5 go-to-market channels — e.g. 'r/fitness', 'Privacy-focused forums', 'Product Hunt launch'"],
    "confidence": "Medium"
  },
  "nicheAnalysis": {
    "samEstimate": "dollar amount — the Serviceable Addressable Market for THIS SPECIFIC niche positioning (not the whole TAM). Calculate what % of the total market actually wants the user's specific angle (e.g. voice-first, privacy-conscious). Be specific with a dollar range.",
    "samPercentage": "X-Y% of TAM — the realistic percentage slice",
    "samReasoning": "Explain WHY this percentage — what filters reduce TAM to SAM (geography, willingness to pay for privacy, voice-only preference, etc.)",
    "competitorClarity": "Are there ZERO apps doing exactly this niche, or zero launched on PH? Clarify the difference. Be specific about what exists vs what doesn't.",
    "directCompetitors": 0,
    "competitorDetail": "Name any apps that come close to this exact niche. If none exist, say so clearly and explain whether that's opportunity or warning sign.",
    "xSignalInterpretation": "Instead of just showing volume change %, interpret it: 'This niche is undertalked-about on X, indicating either early-stage opportunity or low consumer interest.' Explain WHICH is more likely based on the other data signals.",
    "xVolumeContext": "Put the X volume in context: compare to similar niches, explain what low/high volume means for this specific idea.",
    "dataSource": "perplexity" or "ai_estimated",
    "sourceUrls": ["urls"]
  },
  "unitEconomics": {
    "churnBenchmarks": [
      {"name": "Peloton Digital", "churnRate": "X%/mo", "source": "source"},
      {"name": "Fitbit Premium", "churnRate": "X%/mo", "source": "source"},
      {"name": "Category Average", "churnRate": "X%/mo", "source": "source"}
    ],
    "churnImplication": "What does this churn rate mean for the user's business? If churn is 70%, explain how that changes unit economics.",
    "realisticArpu": "$X/mo — realistic ARPU for this positioning",
    "arpuReasoning": "Explain pricing rationale given the competitive landscape.",
    "privacyPremium": "Can you charge MORE for premium positioning? How much more? Reference examples.",
    "ltvEstimate": "$X — based on realistic ARPU × expected retention period given churn data",
    "dataSource": "perplexity" or "ai_estimated",
    "sourceUrls": ["urls"]
  },
  "buildComplexity": {
    "mvpTimeline": "X-Y weeks — realistic for a solo founder or small team",
    "mvpScope": ["list of 4-5 MVP features with brief scope notes"],
    "techChallenges": ["list of 3-4 technical challenges specific to this idea"],
    "estimatedCost": "$X-Y — MVP development cost range including API costs for first 3 months",
    "voiceApiCosts": "Relevant API pricing breakdown per user/month",
    "onDeviceNote": "Technical feasibility notes for the specific idea",
    "dataSource": "ai_estimated",
    "sourceUrls": []
  },
  "scoreBreakdown": [
    {"label": "Trend Momentum", "value": 0-20, "weight": "20%"},
    {"label": "Market Saturation", "value": 0-20, "weight": "20%"},
    {"label": "Sentiment", "value": 0-20, "weight": "20%"},
    {"label": "Growth", "value": 0-20, "weight": "20%"},
    {"label": "Opportunity", "value": 0-20, "weight": "20%"}
   ],
  "keyStats": [
    {"value": "bold number", "label": "short description", "change": "+X% or null", "sentiment": "positive or negative or neutral"}
  ],
  "userQuotes": [
    {"text": "REAL quote from a real user", "source": "subreddit or App Store Review", "sourceUrl": "actual URL or null", "upvotes": "1.2k or null", "platform": "reddit or app_store or twitter or other"}
  ],
  "githubRepos": [
    {"name": "owner/repo", "description": "repo description", "stars": 1234, "forks": 56, "openIssues": 12, "language": "TypeScript", "url": "https://github.com/owner/repo", "updatedAt": "ISO date", "pushedAt": "ISO date", "topics": ["topic1", "topic2"]}
  ],
  "methodology": {
    "totalSources": 0,
    "perplexityQueries": 4,
    "firecrawlScrapes": 0,
    "serperSearches": 0,
    "productHuntQueries": 0,
    "githubSearches": 0,
    "twitterSearches": 0,
    "dataPoints": 0,
    "analysisDate": "YYYY-MM-DD",
    "confidenceNote": "Brief note on overall data quality and coverage"
  },
  "blueprint": {
    "productConcept": "string",
    "strategicPositioning": "string",
    "coreFeatures": ["strings 5-7 items"],
    "targetUsers": ["strings 3-4 items"],
    "monetization": ["strings 2-3 items"],
    "mvpPlan": ["strings 5-6 items"]
  }
}

IMPORTANT: If real data is not available for a section, you MUST set dataSource to "ai_estimated" and sourceUrl to null. NEVER present estimated data as if it came from a real source. Be honest about what is real vs estimated.

Score honestly based on the real data. Return ONLY the JSON, no markdown formatting.`,
          },
          {
            role: "user",
            content: `Analyze this startup idea: "${idea}"\n\nHere is the real market data collected:\n${realDataContext}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });

    let reportData = null;
    let overallScore = 65;
    let signalStrength = "Moderate";

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
        overallScore = reportData.overallScore || 65;
        signalStrength = reportData.signalStrength || "Moderate";
      }
    } else {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
    }

    // ── Step 3: Complete ──
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
