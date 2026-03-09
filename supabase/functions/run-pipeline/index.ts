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
      headers["Authorization"] = `Bearer ${ghToken}`;
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

    // ── Step 1: Fetching real market data ──
    await supabase.from("analyses").update({ status: "fetching" }).eq("id", analysisId);

    const rawData: Record<string, any> = {
      perplexityTrends: null,
      perplexityMarket: null,
      perplexityVC: null,
      perplexityRevenue: null,
      firecrawlAppStore: null,
      firecrawlReddit: null,
      serperTrends: null,
      serperTrendsMonthly: null,
      serperNews: null,
      serperReddit: null,
      serperAutoComplete: null,
      productHunt: null,
      github: null,
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

    // Run Product Hunt search
    const productHuntPromises: Promise<void>[] = [];

    if (productHuntKey) {
      // Extract a short keyword from the idea for PH search
      const phKeyword = idea.split(/\s+/).slice(0, 3).join(" ").toLowerCase();
      productHuntPromises.push(
        productHuntSearch(productHuntKey, phKeyword, 10)
          .then(r => {
            rawData.productHunt = r;
            rawData.sources.push(...r.products.map((p: any) => ({ url: p.url, type: "producthunt" })));
          })
          .catch(e => console.error("Product Hunt error:", e))
      );
    }

    // Run GitHub search (public API, no key needed)
    const githubPromises: Promise<void>[] = [];
    const ghKeyword = idea.split(/\s+/).slice(0, 4).join(" ").toLowerCase();
    githubPromises.push(
      githubSearch(ghKeyword, 10)
        .then(r => {
          rawData.github = r;
          rawData.sources.push(...r.repos.map((repo: any) => ({ url: repo.url, type: "github" })));
        })
        .catch(e => console.error("GitHub error:", e))
    );

    await Promise.all([...perplexityPromises, ...firecrawlPromises, ...serperPromises, ...productHuntPromises, ...githubPromises]);

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
1. You have been given REAL market data collected from Perplexity Sonar (grounded web search), Firecrawl (web scraping), Serper.dev (real Google search results), and Product Hunt API (real launch data with upvotes). USE THIS DATA. Do NOT invent numbers.
2. Every data point MUST include a "dataSource" field with one of these values:
   - "perplexity" — if the data came from Perplexity search results
   - "firecrawl" — if the data came from Firecrawl web scraping
   - "serper" — if the data came from Serper.dev Google search results or autocomplete
   - "producthunt" — if the data came from Product Hunt API (launch data, upvotes)
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
      "metrics": [{"label": "Google Search Volume", "value": "string", "dataSource": "serper" or "perplexity" or "ai_estimated", "sourceUrl": "url or null"}, {"label": "Search Growth (90d)", "value": "string", "dataSource": "string", "sourceUrl": "url or null"}, {"label": "Trending Keywords", "value": "string from autocomplete data", "dataSource": "serper" or "ai_estimated", "sourceUrl": null}],
      "sparkline": [{"name": "W1", "value": number}, ...12 data points representing relative search interest over the last 12 weeks],
      "googleTrendsSparkline": [{"name": "Mon1", "value": number}, {"name": "Mon2", "value": number}, ...up to 12 monthly data points] — IMPORTANT: generate this from Serper Google Trends data. Values should represent relative search interest (0-100 scale). Use month abbreviations (Jan, Feb, Mar, etc.) as names. If Serper data is available, base values on real search volume trends. Mark dataSource as "serper" if based on real data.
      "evidence": ["real quotes with source URLs — prefer Serper Google results for trend data"],
      "insight": "one sentence based on real Google search data"
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
      "source": "Firecrawl — Reddit + App Reviews",
      "dataSource": "firecrawl" or "ai_estimated",
      "sourceUrls": ["scraped URLs"],
      "icon": "MessageCircle",
      "type": "sentiment",
      "confidence": "High" or "Medium" or "Low",
      "evidenceCount": number,
      "sentiment": {"complaints": ["REAL complaints from REAL reviews"], "loves": ["REAL praise from REAL reviews"], "emotion": "string", "complaintCount": number, "positiveCount": number},
      "evidence": ["REAL quotes with source URL"],
      "insight": "one sentence"
    },
    {
      "title": "Growth Signals",
      "source": "Product Hunt + GitHub + Perplexity Sonar — Market Research",
      "dataSource": "producthunt" or "github" or "perplexity" or "ai_estimated",
      "sourceUrls": ["citation URLs, PH URLs, and GitHub URLs"],
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
      "lineChart": [{"name": "month", "value": number}, ...9 data points],
      "evidence": ["Include PH launch data AND GitHub data: 'ProductName launched on PH with X upvotes' — URL. 'RepoName has X stars and Y forks on GitHub' — URL. High activity = validated builder interest."],
      "insight": "one sentence referencing PH + GitHub data — e.g. 'X similar products on PH with avg Y upvotes, and Z open-source repos with total W stars, indicating strong builder activity'"
    }
  ],
  "opportunity": {"featureGaps": ["strings"], "underservedUsers": ["strings"], "positioning": "string"},
  "revenueBenchmark": {"summary": "string", "range": "string", "basis": "string", "dataSource": "perplexity" or "ai_estimated", "sourceUrls": ["urls"]},
  "scoreBreakdown": [
    {"label": "Trend Momentum", "value": 0-20},
    {"label": "Market Saturation", "value": 0-20},
    {"label": "Sentiment", "value": 0-20},
    {"label": "Growth", "value": 0-20},
    {"label": "Opportunity", "value": 0-20}
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
        max_tokens: 6000,
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
        reportData = JSON.parse(jsonMatch[0]);
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
