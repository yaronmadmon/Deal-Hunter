import { createClient } from "npm:@supabase/supabase-js@2";

// ── Shared verdict + signal strength helpers ───────────────────────
function computeVerdict(score: number): string {
  if (score >= 75) return "Build Now";
  if (score >= 55) return "Build, But Niche Down";
  if (score >= 40) return "Validate Further";
  return "Do Not Build Yet";
}

function computeSignalStrength(score: number): string {
  // Aligned with verdict thresholds for consistency
  if (score >= 75) return "Strong";
  if (score >= 55) return "Moderate";
  return "Weak";
}

function applyVerdictToReport(reportData: any) {
  const score = reportData.overallScore || 0;
  if (reportData.founderDecision) {
    reportData.founderDecision.decision = computeVerdict(score);
  }
  reportData.signalStrength = computeSignalStrength(score);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
  if (!res.ok) {
    console.error(`[SERPER] ${type} search failed (${res.status}): ${await res.text()}`);
    return { organic: [], searchParameters: {}, knowledgeGraph: null };
  }
  const data = await res.json();
  // News endpoint returns { news: [...] } not { organic: [...] }
  const results = type === "news" ? (data.news || []) : (data.organic || []);
  return {
    organic: results,
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
  if (!res.ok) {
    console.error(`[SERPER] autocomplete failed (${res.status}): ${await res.text()}`);
    return { suggestions: [] };
  }
  const data = await res.json();
  return { suggestions: (data.suggestions || []).map((s: any) => s.value || s) };
}

// ── KeywordsEverywhere API helper ──────────────────────────────────
async function fetchKeywordsEverywhere(
  apiKey: string,
  keywords: string[]
): Promise<{ data: { keyword: string; vol: number; cpc: { value: string; currency: string }; competition: number; trend: { monthly: number[] } }[] } | null> {
  try {
    // KE API expects form-encoded data with kw[] for each keyword
    // Build body manually to avoid URLSearchParams encoding [] as %5B%5D
    const kwSlice = keywords.slice(0, 10);
    const bodyParts = [
      "country=us",
      "currency=usd",
      "dataSource=gkp",
      ...kwSlice.map((kw) => `kw[]=${encodeURIComponent(kw)}`),
    ];
    const bodyStr = bodyParts.join("&");

    console.log(`[KE-API] Requesting data for ${kwSlice.length} keywords: ${kwSlice.slice(0, 3).join(", ")}...`);
    console.log(`[KE-API] Request body: ${bodyStr.slice(0, 200)}`);
    const res = await fetch("https://api.keywordseverywhere.com/v1/get_keyword_data", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: bodyStr,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[KE-API] Request failed (${res.status}): ${errText}`);
      return null;
    }

    const data = await res.json();
    console.log(`[KE-API] Successfully retrieved data for ${data.data?.length || 0} keywords`);
    return data;
  } catch (e) {
    console.error("[KE-API] Error:", e);
    return null;
  }
}

function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return String(vol);
}

function deriveTrendFromMonthly(monthly: number[]): string {
  if (!monthly || monthly.length < 4) return "Stable";
  const half = Math.floor(monthly.length / 2);
  const firstHalf = monthly.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const secondHalf = monthly.slice(half).reduce((a, b) => a + b, 0) / (monthly.length - half);
  if (firstHalf === 0 && secondHalf === 0) return "Stable";
  const change = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : (secondHalf > 0 ? 100 : 0);
  if (change > 15) return "Rising";
  if (change < -15) return "Declining";
  return "Stable";
}

function deriveDifficultyFromCompetition(competition: number): string {
  if (competition >= 0.7) return "High";
  if (competition >= 0.3) return "Medium";
  return "Low";
}

// ── Keyword Intelligence: KE primary, Serper/Perplexity fallback ──
async function fetchKeywordIntelligence(
  serperKey: string,
  perplexityKey: string,
  keywords: string[]
): Promise<{ keywords: { keyword: string; volume: string; difficulty: string; trend: string; cpc?: string }[]; confidence: string; source: string }> {
  if (keywords.length === 0) return { keywords: [], confidence: "Low", source: "No data" };

  // ── Primary: KeywordsEverywhere API ──
  const keApiKey = Deno.env.get("KEYWORDS_EVERYWHERE_API_KEY");
  if (keApiKey) {
    const keResult = await fetchKeywordsEverywhere(keApiKey, keywords);
    if (keResult?.data && keResult.data.length > 0) {
      const kwData = keResult.data.map((item) => ({
        keyword: item.keyword,
        volume: formatVolume(item.vol),
        difficulty: deriveDifficultyFromCompetition(item.competition),
        trend: deriveTrendFromMonthly(item.trend?.monthly || []),
        cpc: item.cpc?.value ? `$${item.cpc.value}` : undefined,
      }));
      console.log(`[KEYWORD-INTEL] Using KeywordsEverywhere data (${kwData.length} keywords)`);
      return {
        keywords: kwData,
        confidence: "High",
        source: "Keywords Everywhere (Google Keyword Planner data)",
      };
    }
    console.warn("[KEYWORD-INTEL] KeywordsEverywhere returned no data, falling back to Serper/Perplexity");
  }

  // ── Fallback: Serper + Perplexity (original logic) ──
  const keywordData: { keyword: string; totalResults: number; volume: string; difficulty: string; trend: string }[] = [];
  
  const serperPromises = keywords.slice(0, 8).map(async (kw) => {
    try {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: kw, num: 1 }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[KEYWORD-INTEL] Serper search failed for "${kw}": ${errText}`);
        return { keyword: kw, totalResults: 0 };
      }
      const data = await res.json();
      const totalResults = data.searchInformation?.totalResults || 0;
      return { keyword: kw, totalResults: parseInt(String(totalResults), 10) || 0 };
    } catch (e) {
      console.error(`[KEYWORD-INTEL] Error for "${kw}":`, e);
      return { keyword: kw, totalResults: 0 };
    }
  });

  const serperResults = await Promise.all(serperPromises);
  
  for (const r of serperResults) {
    let difficulty = "Medium";
    if (r.totalResults > 500_000_000) difficulty = "High";
    else if (r.totalResults > 50_000_000) difficulty = "Medium";
    else if (r.totalResults > 0) difficulty = "Low";
    
    keywordData.push({ ...r, volume: "N/A", difficulty, trend: "Stable" });
  }

  if (perplexityKey && keywords.length > 0) {
    try {
      const kwList = keywords.slice(0, 8).join(", ");
      const trendQuery = `For each of these keywords, provide estimated monthly Google search volume and whether the trend is Rising, Stable, or Declining based on Google Trends data from the last 12 months. Keywords: ${kwList}. Return ONLY a JSON array like: [{"keyword":"term","volume":"50K","trend":"Rising"}]. No explanation.`;
      
      const trendRes = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${perplexityKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            { role: "system", content: "You are a search volume analyst. Return ONLY valid JSON arrays. No markdown, no explanation." },
            { role: "user", content: trendQuery },
          ],
          temperature: 0.1,
        }),
      });
      
      const trendData = await trendRes.json();
      const content = trendData.choices?.[0]?.message?.content || "";
      
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]) as { keyword: string; volume: string; trend: string }[];
          for (const p of parsed) {
            const match = keywordData.find(k => k.keyword.toLowerCase() === p.keyword?.toLowerCase());
            if (match) {
              if (p.volume) match.volume = p.volume;
              if (p.trend) match.trend = p.trend;
            }
          }
          console.log(`[KEYWORD-INTEL] Perplexity returned volume data for ${parsed.length} keywords`);
        } catch (parseErr) {
          console.error("[KEYWORD-INTEL] Failed to parse Perplexity trend JSON:", parseErr);
        }
      }
    } catch (e) {
      console.error("[KEYWORD-INTEL] Perplexity trend query failed:", e);
    }
  }

  const hasVolume = keywordData.some(k => k.volume !== "N/A");
  return {
    keywords: keywordData.map(({ keyword, volume, difficulty, trend }) => ({ keyword, volume, difficulty, trend })),
    confidence: hasVolume ? "High" : "Medium",
    source: hasVolume ? "Serper.dev + Google Trends via Perplexity" : "Serper.dev Search Results",
  };
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

// ── GitHub Complexity Calculator (deterministic, no extra API calls) ─
function calculateGitHubComplexity(repos: any[]): { score: number | null; reposAnalyzed: number; signals: string[]; label: string } | null {
  if (!repos || repos.length < 3) {
    return null;
  }

  const top10 = repos.slice(0, 10);
  const repoScores: number[] = [];
  const signals: string[] = [];

  // Hard language multipliers
  const hardLanguages = ["c", "c++", "rust", "java"];
  const easyLanguages = ["python", "javascript", "typescript"];

  // Track dominant language across all repos
  const languageCounts: Record<string, number> = {};

  for (const repo of top10) {
    let score = 0;
    let availableMax = 0;

    // Signal 1: Language count (inferred from primary language + topics)
    const languages = new Set<string>();
    if (repo.language) languages.add(repo.language.toLowerCase());
    // Infer additional languages from topics
    const langTopics = ["python", "javascript", "typescript", "rust", "go", "java", "c", "cpp", "ruby", "swift", "kotlin", "dart", "php", "scala", "elixir"];
    for (const topic of (repo.topics || [])) {
      if (langTopics.includes(topic.toLowerCase())) languages.add(topic.toLowerCase());
    }
    const langCount = languages.size;
    if (langCount >= 5) score += 6;
    else if (langCount >= 3) score += 4;
    else score += 2;
    availableMax += 6;

    // Track dominant language
    for (const lang of languages) {
      languageCounts[lang] = (languageCounts[lang] || 0) + 1;
    }

    // Signal 2: Dependency count (inferred from topics and description)
    const depIndicators = ["docker", "kubernetes", "redis", "postgres", "mongodb", "graphql", "grpc", "aws", "gcp", "azure",
      "terraform", "kafka", "elasticsearch", "nginx", "rabbitmq", "celery", "webpack", "vite", "nextjs", "react",
      "vue", "angular", "django", "flask", "express", "fastapi", "spring", "rails"];
    let depCount = 0;
    const repoText = `${(repo.topics || []).join(" ")} ${repo.description || ""}`.toLowerCase();
    for (const dep of depIndicators) {
      if (repoText.includes(dep)) depCount++;
    }
    if (depCount >= 6) score += 3; // maps to 31+ deps
    else if (depCount >= 3) score += 2; // maps to 11-30 deps
    else score += 1; // maps to 0-10 deps
    availableMax += 3;

    // Signal 3: File depth (skip — GitHub search API doesn't return tree data)
    // We skip this and scale proportionally from the two available signals

    // Scale to 0-10 proportionally based on available signals
    const scaledScore = availableMax > 0 ? (score / availableMax) * 10 : 0;
    repoScores.push(Math.round(scaledScore * 10) / 10);

    if (depCount >= 3) signals.push(`${repo.name}: ${langCount} lang(s), ${depCount} infra deps`);
  }

  if (repoScores.length < 3) return null;

  // Average across repos
  let avgScore = repoScores.reduce((s, v) => s + v, 0) / repoScores.length;

  // Language normalization
  const dominantLang = Object.entries(languageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  if (hardLanguages.includes(dominantLang)) {
    avgScore = Math.min(10, avgScore * 1.2);
    signals.push(`Dominant language: ${dominantLang} (hard — 1.2x multiplier)`);
  } else if (easyLanguages.includes(dominantLang)) {
    avgScore = avgScore * 0.9;
    signals.push(`Dominant language: ${dominantLang} (easy — 0.9x multiplier)`);
  }

  const finalScore = Math.round(avgScore * 10) / 10;

  return {
    score: finalScore,
    reposAnalyzed: top10.length,
    signals: signals.slice(0, 5),
    label: `Based on ${top10.length} similar products in this space, build complexity is estimated at ${finalScore}/10.`,
  };
}

// ── Twitter/X helper ────────────────────────────────────────────────

// Sanitize query for Twitter API v2 — remove operators and special chars that cause 400 errors
function sanitizeTwitterQuery(query: string): string {
  // Remove special Twitter operators and problematic characters
  let clean = query
    .replace(/[""'']/g, '"')          // normalize smart quotes
    .replace(/["]/g, '')              // remove quotes entirely (they create phrase search issues)
    .replace(/[()[\]{}&|!^~*?:\\\/]/g, ' ')  // remove special chars
    .replace(/\b(OR|AND|NOT)\b/g, ' ')       // remove boolean operators
    .replace(/-\w+/g, ' ')                   // remove negation operators
    .replace(/\s+/g, ' ')                    // collapse whitespace
    .trim();
  
  // Twitter query + operators must be under 512 chars; leave room for " lang:en -is:retweet" (20 chars)
  if (clean.length > 400) {
    clean = clean.substring(0, 400).replace(/\s\S*$/, ''); // cut at last word boundary
  }
  
  return clean;
}

async function twitterSearch(
  bearerToken: string,
  query: string,
  maxResults = 50
): Promise<{ tweets: any[]; total_fetched: number }> {
  try {
    const sanitized = sanitizeTwitterQuery(query);
    if (!sanitized || sanitized.length < 2) {
      console.warn("[TWITTER] Query too short after sanitization, skipping");
      return { tweets: [], total_fetched: 0 };
    }
    
    const fullQuery = `${sanitized} lang:en -is:retweet`;
    console.log(`[TWITTER] Search query (${fullQuery.length} chars): "${fullQuery.substring(0, 100)}..."`);
    
    const params = new URLSearchParams({
      query: fullQuery,
      max_results: String(Math.min(Math.max(maxResults, 10), 100)),
      'tweet.fields': 'created_at,public_metrics,author_id',
      'user.fields': 'name,username,public_metrics',
      expansions: 'author_id',
    });
    const res = await fetch(`https://api.x.com/2/tweets/search/recent?${params.toString()}`, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`[TWITTER] Search error ${res.status}: ${errorBody}`);
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
    // Filter by engagement — raise threshold for hype-prone keywords
    const hypeKeywords = ["crypto", "bitcoin", "blockchain", "web3", "nft", "ai agent", "trading bot", "defi", "token"];
    const queryLower = query.toLowerCase();
    const isHypeTopic = hypeKeywords.some(kw => queryLower.includes(kw));
    const likeThreshold = isHypeTopic ? 5 : 1;
    const filtered = tweets
      .filter((t: any) => t.like_count >= likeThreshold)
      .sort((a: any, b: any) => (b.like_count + b.retweet_count * 2) - (a.like_count + a.retweet_count * 2))
      .slice(0, 30);
    if (isHypeTopic) {
      console.log(`[TWITTER HYPE FILTER] Hype topic detected ("${queryLower}"). Like threshold raised to ${likeThreshold}. Kept ${filtered.length}/${tweets.length} tweets.`);
    }
    return { tweets: filtered, total_fetched: tweets.length };
  } catch (e) {
    console.error("[TWITTER] Search error:", e);
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
    const sanitized = sanitizeTwitterQuery(query);
    if (!sanitized || sanitized.length < 2) {
      console.warn("[TWITTER] Counts query too short after sanitization, skipping");
      return { counts: [], total_count: 0, volume_change_pct: 0 };
    }
    console.log(`[TWITTER] Counts query: "${sanitized.substring(0, 80)}..."`);
    const params = new URLSearchParams({
      query: sanitized,
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

// ── Competitor Normalization & Deduplication ────────────────────────
interface RawCompetitor {
  name: string;
  rating?: string | number;
  downloads?: string;
  weaknesses?: string[];
  sources: string[];
  url?: string;
  upvotes?: number;
  description?: string;
}

interface NormalizedCompetitor extends RawCompetitor {
  normalizedName: string;
  confidenceScore: "High" | "Medium" | "Low";
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.com$/, "")
    .replace(/\.(io|co|app|ai|dev|org|net)$/, "")
    .replace(/\b(app|inc|ltd|llc|co|the)\b/gi, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCompetitorsFromSources(rawData: Record<string, any>): RawCompetitor[] {
  const competitors: RawCompetitor[] = [];

  // From Serper competitor results — extract product names from titles
  (rawData.serperCompetitors?.allResults || []).forEach((r: any) => {
    const title = (r.title || "").replace(/\s*[-|–—:].*/g, "").trim();
    if (title && title.length > 1 && title.length < 80) {
      competitors.push({
        name: title,
        sources: ["Serper"],
        url: r.link,
        description: r.snippet || "",
      });
    }
  });

  // From Product Hunt
  (rawData.productHunt?.products || []).forEach((p: any) => {
    if (p.name) {
      competitors.push({
        name: p.name,
        sources: ["Product Hunt"],
        url: p.url || p.website,
        upvotes: p.upvotes,
        description: p.tagline || "",
      });
    }
  });

  // From Firecrawl App Store results
  (rawData.firecrawlAppStore?.results || []).forEach((r: any) => {
    const title = (r.title || "").replace(/on the App Store.*$/i, "").replace(/- Apps on Google Play.*$/i, "").trim();
    if (title && title.length > 1 && title.length < 80) {
      // Try to extract rating from markdown
      const ratingMatch = (r.markdown || "").match(/(\d\.\d)\s*(?:out of 5|★|stars?)/i);
      const downloadsMatch = (r.markdown || "").match(/([\d,.]+[KMB]?\+?)\s*(?:downloads|installs)/i);
      competitors.push({
        name: title,
        sources: ["App Store"],
        url: r.url,
        rating: ratingMatch ? ratingMatch[1] : undefined,
        downloads: downloadsMatch ? downloadsMatch[1] : undefined,
      });
    }
  });

  // From GitHub repos (only if they look like products, not libraries)
  (rawData.github?.repos || []).forEach((r: any) => {
    const repoName = (r.name || "").split("/").pop() || "";
    if (r.stars > 100 && repoName.length > 1) {
      competitors.push({
        name: repoName,
        sources: ["GitHub"],
        url: r.url,
        description: r.description || "",
      });
    }
  });

  return competitors;
}

function normalizeCompetitors(rawCompetitors: RawCompetitor[]): NormalizedCompetitor[] {
  console.log(`[COMPETITOR NORMALIZATION] Raw competitors: ${rawCompetitors.length}`);

  // Step 1: Normalize names
  const withNormalized = rawCompetitors.map(c => ({
    ...c,
    normalizedName: normalizeName(c.name),
  }));

  // Step 2 & 3: Detect duplicates and merge
  const merged = new Map<string, NormalizedCompetitor>();
  let mergedCount = 0;

  for (const comp of withNormalized) {
    if (!comp.normalizedName || comp.normalizedName.length < 2) continue;

    // Find existing entry that matches
    let matchKey: string | null = null;
    for (const [key, existing] of merged) {
      // Exact normalized match
      if (key === comp.normalizedName) { matchKey = key; break; }
      // Domain match
      if (comp.url && existing.url) {
        try {
          const d1 = new URL(comp.url).hostname.replace("www.", "");
          const d2 = new URL(existing.url).hostname.replace("www.", "");
          if (d1 === d2) { matchKey = key; break; }
        } catch {}
      }
      // One name contains the other
      if (key.includes(comp.normalizedName) || comp.normalizedName.includes(key)) {
        matchKey = key; break;
      }
    }

    if (matchKey) {
      // Merge into existing
      const existing = merged.get(matchKey)!;
      // Best rating
      const existingRating = parseFloat(String(existing.rating || "0"));
      const newRating = parseFloat(String(comp.rating || "0"));
      if (newRating > existingRating) existing.rating = comp.rating;
      // Largest downloads
      if (comp.downloads && (!existing.downloads || comp.downloads.length > existing.downloads.length)) {
        existing.downloads = comp.downloads;
      }
      // Merge weaknesses
      if (comp.weaknesses) {
        existing.weaknesses = [...new Set([...(existing.weaknesses || []), ...comp.weaknesses])];
      }
      // Merge sources
      existing.sources = [...new Set([...existing.sources, ...comp.sources])];
      // Keep best description
      if (comp.description && (!existing.description || comp.description.length > existing.description.length)) {
        existing.description = comp.description;
      }
      // Keep URL if missing
      if (!existing.url && comp.url) existing.url = comp.url;
      // Keep upvotes
      if (comp.upvotes && (!existing.upvotes || comp.upvotes > existing.upvotes)) {
        existing.upvotes = comp.upvotes;
      }
      // Use shorter/cleaner name
      if (comp.name.length < existing.name.length && comp.name.length > 2) {
        existing.name = comp.name;
      }
      mergedCount++;
    } else {
      merged.set(comp.normalizedName, {
        ...comp,
        confidenceScore: "Low",
      });
    }
  }

  // Step 4: Add confidence scores
  for (const comp of merged.values()) {
    if (comp.sources.length >= 3) comp.confidenceScore = "High";
    else if (comp.sources.length === 2) comp.confidenceScore = "Medium";
    else comp.confidenceScore = "Low";
  }

  // Step 5: Sort and limit to top 10
  const sorted = [...merged.values()].sort((a, b) => {
    // Sort by source count first, then downloads, then rating
    const sourcesDiff = b.sources.length - a.sources.length;
    if (sourcesDiff !== 0) return sourcesDiff;
    const dlA = parseFloat(String(a.downloads || "0").replace(/[^0-9.]/g, "")) || 0;
    const dlB = parseFloat(String(b.downloads || "0").replace(/[^0-9.]/g, "")) || 0;
    if (dlB !== dlA) return dlB - dlA;
    const rA = parseFloat(String(a.rating || "0"));
    const rB = parseFloat(String(b.rating || "0"));
    return rB - rA;
  }).slice(0, 10);

  console.log(`[COMPETITOR NORMALIZATION] After dedupe: ${sorted.length} | Merged duplicates: ${mergedCount}`);
  return sorted;
}

// ── Competitor Validation (Real Product Check) ──────────────────────
interface ValidatedCompetitor extends NormalizedCompetitor {
  evidenceType: "app_store" | "google_play" | "product_hunt" | "github" | "official_site" | "unknown";
  validationScore: number;
}

async function validateCompetitors(
  competitors: NormalizedCompetitor[],
  serperKey: string | undefined
): Promise<ValidatedCompetitor[]> {
  console.log(`[COMPETITOR VALIDATION] Candidates: ${competitors.length}`);

  // Pre-filter: reject names that look like article titles, not product names
  const articlePatterns = /^(the best |the top |best |top \d|\d+ \w|\d+ best|\d+ useful|\d+ great|\d+ free|\d+ apps?|\d+ tools?|\d+ ways?|how to |\d+ of the |a guide|ultimate guide|review:|comparison|guide to|list of|roundup|versus|things you|everything you|what is |what are |what's |why you|should you|complete guide|which |where to find)/i;
  const maxNameWords = 8; // Real product names are rarely >8 words
  const preFiltered = competitors.filter(c => {
    const words = c.name.trim().split(/\s+/);
    if (words.length > maxNameWords) {
      console.log(`[COMPETITOR VALIDATION] Rejected "${c.name}" — name too long (${words.length} words, likely article title)`);
      return false;
    }
    if (articlePatterns.test(c.name)) {
      console.log(`[COMPETITOR VALIDATION] Rejected "${c.name}" — matches article title pattern`);
      return false;
    }
    return true;
  });
  console.log(`[COMPETITOR VALIDATION] After article-title filter: ${preFiltered.length} (removed ${competitors.length - preFiltered.length})`);

  const validated: ValidatedCompetitor[] = [];

  for (const comp of preFiltered) {
    let evidenceType: ValidatedCompetitor["evidenceType"] = "unknown";
    let validationScore = 0;

    // Check source-based evidence first (no API calls needed)
    if (comp.sources.includes("App Store")) {
      evidenceType = "app_store";
      validationScore = 5;
    } else if (comp.sources.includes("Product Hunt")) {
      evidenceType = "product_hunt";
      validationScore = 4;
    } else if (comp.sources.includes("GitHub")) {
      evidenceType = "github";
      validationScore = 3;
    }

    // Check URL for evidence type
    if (comp.url) {
      const url = comp.url.toLowerCase();
      if (url.includes("apps.apple.com")) {
        evidenceType = "app_store";
        validationScore = Math.max(validationScore, 5);
      } else if (url.includes("play.google.com")) {
        evidenceType = "google_play";
        validationScore = Math.max(validationScore, 5);
      } else if (url.includes("producthunt.com")) {
        evidenceType = "product_hunt";
        validationScore = Math.max(validationScore, 4);
      } else if (url.includes("github.com")) {
        evidenceType = "github";
        validationScore = Math.max(validationScore, 3);
      } else if (!url.includes("reddit.com") && !url.includes("blog") && !url.includes("article") &&
                 !url.includes("news") && !url.includes("medium.com") && !url.includes("wikipedia")) {
        // Likely an official product site
        evidenceType = "official_site";
        validationScore = Math.max(validationScore, 3);
      }
    }

    // If still unknown/low and we have Serper, do a quick verification search
    if (validationScore < 2 && serperKey) {
      try {
        const verifyRes = await serperSearch(serperKey, `"${comp.name}" app OR product OR software OR download`, "search", 5);
        const results = verifyRes.organic || [];

        // Check results for product evidence
        for (const r of results) {
          const link = (r.link || "").toLowerCase();
          const snippet = (r.snippet || "").toLowerCase();
          if (link.includes("apps.apple.com") || link.includes("play.google.com")) {
            evidenceType = link.includes("apple") ? "app_store" : "google_play";
            validationScore = 5;
            if (!comp.url) comp.url = r.link;
            break;
          } else if (link.includes("producthunt.com")) {
            evidenceType = "product_hunt";
            validationScore = 4;
            break;
          } else if (link.includes("github.com")) {
            evidenceType = "github";
            validationScore = Math.max(validationScore, 3);
          } else if (snippet.includes("download") || snippet.includes("sign up") || snippet.includes("pricing") || snippet.includes("free trial")) {
            evidenceType = "official_site";
            validationScore = Math.max(validationScore, 3);
            if (!comp.url) comp.url = r.link;
          }
        }

        // If we found some results but no strong evidence, it's still a search mention
        if (validationScore < 2 && results.length > 0) {
          validationScore = 1;
        }
      } catch (e) {
        console.warn(`[COMPETITOR VALIDATION] Serper verification failed for "${comp.name}":`, e);
        // Keep existing score
      }
    }

    // Multi-source boost: having 2+ sources is itself evidence
    if (comp.sources.length >= 2 && validationScore < 3) {
      validationScore = Math.max(validationScore, 2);
    }

    validated.push({
      ...comp,
      evidenceType,
      validationScore,
    });
  }

  // Remove weak competitors (validationScore < 2)
  const strong = validated.filter(c => c.validationScore >= 2);
  const removed = validated.length - strong.length;

  // Sort by validation score, then source count
  const sorted = strong.sort((a, b) => {
    const scoreDiff = b.validationScore - a.validationScore;
    if (scoreDiff !== 0) return scoreDiff;
    return b.sources.length - a.sources.length;
  }).slice(0, 10);

  console.log(`[COMPETITOR VALIDATION] Validated competitors: ${sorted.length} | Removed weak competitors: ${removed}`);
  return sorted;
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
// Strategy 1: PH GraphQL API (primary). Strategy 2: Serper scraper (fallback).

function phFuzzyMatch(text: string, keywords: string[]): number {
  const lower = (text || "").toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) score++;
  }
  return score;
}

function generateTopicSlugs(topic: string): string[] {
  const words = topic.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 2);
  const slugs = new Set<string>();
  // Full slug
  slugs.add(words.join("-"));
  // Individual meaningful words as topic slugs
  const stopwords = new Set(["app", "tool", "platform", "software", "the", "for", "and", "with", "best", "top", "new"]);
  for (const w of words) {
    if (!stopwords.has(w) && w.length > 3) slugs.add(w);
  }
  // Pairs of consecutive words
  for (let i = 0; i < words.length - 1; i++) {
    if (!stopwords.has(words[i]) && !stopwords.has(words[i + 1])) {
      slugs.add(`${words[i]}-${words[i + 1]}`);
    }
  }
  return Array.from(slugs).slice(0, 8);
}

async function productHuntSearch(
  apiKey: string,
  topic: string,
  first = 10,
  serperKey?: string | null
): Promise<{ products: any[] }> {
  const allProducts: any[] = [];
  const seenNames = new Set<string>();

  const addProduct = (p: any) => {
    const key = (p.name || "").toLowerCase().trim();
    if (key && !seenNames.has(key)) {
      seenNames.add(key);
      allProducts.push(p);
    }
  };

  const mapPost = (p: any) => ({
    name: p.name,
    tagline: p.tagline,
    upvotes: p.votesCount,
    launchDate: p.createdAt,
    url: p.url || `https://www.producthunt.com/posts/${(p.name || "").toLowerCase().replace(/\s+/g, "-")}`,
    website: p.website,
  });

  // Strategy 1a: Try multiple topic slugs
  if (apiKey) {
    const slugs = generateTopicSlugs(topic);
    console.log(`[PRODUCT HUNT] Trying ${slugs.length} topic slugs: ${slugs.join(", ")}`);

    const topicPromises = slugs.map(async (slug) => {
      try {
        const topicQuery = `
          query {
            topic(slug: "${slug}") {
              posts(first: 50) {
                edges {
                  node { id name tagline votesCount createdAt url website }
                }
              }
            }
          }
        `;
        const topicRes = await fetch("https://api.producthunt.com/v2/api/graphql", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ query: topicQuery }),
        });

        if (topicRes.ok) {
          const topicData = await topicRes.json();
          if (!topicData.errors && topicData.data?.topic?.posts?.edges) {
            const posts = topicData.data.topic.posts.edges.map((e: any) => e.node);
            console.log(`[PRODUCT HUNT] Topic "${slug}" returned ${posts.length} posts`);
            return posts;
          }
        } else {
          await topicRes.text(); // consume body
        }
        return [];
      } catch {
        return [];
      }
    });

    const topicResults = await Promise.all(topicPromises);
    const keywords = topic.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
    
    for (const posts of topicResults) {
      // For topic-matched posts, apply light fuzzy filter (at least 1 keyword match)
      for (const p of posts) {
        const score = phFuzzyMatch(`${p.name} ${p.tagline}`, keywords);
        if (score >= 1) {
          addProduct(mapPost(p));
        }
      }
    }

    if (allProducts.length > 0) {
      console.log(`[PRODUCT HUNT] Topic queries found ${allProducts.length} relevant products`);
    }

    // Strategy 1b: Global ranking with fuzzy keyword filter
    if (allProducts.length < first) {
      try {
        const query = `
          query {
            posts(order: RANKING, first: 50) {
              edges {
                node { id name tagline votesCount createdAt url website }
              }
            }
          }
        `;
        const res = await fetch("https://api.producthunt.com/v2/api/graphql", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ query }),
        });

        if (res.ok) {
          const data = await res.json();
          if (!data.errors) {
            const globalPosts = (data.data?.posts?.edges || []).map((e: any) => e.node);
            const scored = globalPosts
              .map((p: any) => ({ post: p, score: phFuzzyMatch(`${p.name} ${p.tagline}`, keywords) }))
              .filter((s: any) => s.score >= 1)
              .sort((a: any, b: any) => b.score - a.score);
            
            for (const { post } of scored) {
              addProduct(mapPost(post));
            }
            console.log(`[PRODUCT HUNT] Global ranking matched ${scored.length} of ${globalPosts.length} posts`);
          } else {
            console.error("[PRODUCT HUNT] GraphQL errors:", JSON.stringify(data.errors));
          }
        } else {
          console.error(`[PRODUCT HUNT] API error (${res.status}): ${await res.text()}`);
        }
      } catch (e) {
        console.error("[PRODUCT HUNT] API error:", e);
      }
    }
  }

  // Strategy 2: Serper site:producthunt.com fallback (always try if we have few results)
  if (serperKey && allProducts.length < first) {
    try {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": serperKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: `${topic} site:producthunt.com`, num: 30 }),
      });
      if (res.ok) {
        const data = await res.json();
        const organic = data.organic || [];
        const products = organic
          .filter((r: any) => (r.link || "").includes("producthunt.com/posts/"))
          .map((r: any) => {
            const titleParts = (r.title || "").split(/\s*[-–—|]\s*/);
            const name = titleParts[0]?.trim() || "";
            const tagline = titleParts.length > 1 ? titleParts.slice(1).filter((p: string) => !p.toLowerCase().includes("product hunt")).join(" - ").trim() : "";
            return {
              name,
              tagline: tagline || r.snippet || "",
              upvotes: null,
              launchDate: null,
              url: r.link,
              website: null,
            };
          })
          .filter((p: any) => p.name && p.name.length > 1);

        for (const p of products) {
          addProduct(p);
        }
        if (products.length > 0) {
          console.log(`[PRODUCT HUNT] Serper fallback found ${products.length} products for "${topic}"`);
        }
      } else {
        console.error(`[PRODUCT HUNT] Serper fallback error (${res.status}): ${await res.text()}`);
      }
    } catch (e) {
      console.error("[PRODUCT HUNT] Serper fallback error:", e);
    }
  }

  const finalCount = allProducts.slice(0, first).length;
  console.log(`[PRODUCT HUNT] Final: ${finalCount} products for "${topic}" (from ${allProducts.length} total deduplicated)`);
  return { products: allProducts.slice(0, first) };
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

    // ── Input validation & sanitization ──
    // Strip common UI button text that gets accidentally appended
    const uiTextPatterns = [
      /\s*Track This Idea\s*/gi,
      /\s*Validate Idea\s*/gi,
      /\s*Starting…?\s*/gi,
      /\s*Re-?analyze\s*/gi,
      /\s*Download PDF\s*/gi,
      /\s*Share Report\s*/gi,
      /\s*Add to Watchlist\s*/gi,
      /\s*View Report\s*/gi,
      /\s*Delete\s*$/gi,
    ];
    let trimmedIdea = idea.trim();
    for (const pattern of uiTextPatterns) {
      trimmedIdea = trimmedIdea.replace(pattern, ' ');
    }
    // Strip everything after common description separators (em-dash, pipe, double-dash)
    trimmedIdea = trimmedIdea.replace(/\s*[—–|]\s*.{20,}$/, '').replace(/\s*--\s*.{20,}$/, '');
    // Strip quoted wrapper if the entire idea is wrapped in quotes
    trimmedIdea = trimmedIdea.replace(/^[""](.+)[""]$/, '$1');
    trimmedIdea = trimmedIdea.replace(/\s+/g, ' ').trim();

    if (trimmedIdea.length < 10) {
      return new Response(JSON.stringify({ error: "Idea must be at least 10 characters" }), { status: 400, headers: corsHeaders });
    }
    if (trimmedIdea.length > 500) {
      return new Response(JSON.stringify({ error: "Idea must be under 500 characters" }), { status: 400, headers: corsHeaders });
    }
    // Strip HTML/script tags
    const sanitizedIdea = trimmedIdea.replace(/<[^>]*>/g, '').replace(/javascript:/gi, '');
    console.log(`[INPUT SANITIZATION] Original: "${idea.slice(0, 100)}" → Sanitized: "${sanitizedIdea.slice(0, 100)}"`);

    // ══════════════════════════════════════════════════════════════════
    // 24-HOUR REPORT CACHE CHECK (must run BEFORE any external API call)
    // Uses SHA-256 hash of the sanitized idea to find matching reports.
    // ══════════════════════════════════════════════════════════════════
    const ideaHashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sanitizedIdea.toLowerCase().trim()));
    const ideaHash = Array.from(new Uint8Array(ideaHashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
    console.log(`[CACHE] SHA-256 hash: ${ideaHash}`);

    {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: cachedAnalysis } = await supabase
        .from("analyses")
        .select("id, report_data, overall_score, signal_strength, created_at")
        .eq("idea_hash", ideaHash)
        .eq("status", "complete")
        .gte("created_at", twentyFourHoursAgo)
        .neq("id", analysisId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (cachedAnalysis?.report_data) {
        console.log(`[CACHE HIT] Found cached report ${cachedAnalysis.id} from ${cachedAnalysis.created_at}`);
        const cachedReportData = typeof cachedAnalysis.report_data === "object" ? cachedAnalysis.report_data : {};
        (cachedReportData as any).cached = true;
        (cachedReportData as any).cachedAt = cachedAnalysis.created_at;
        (cachedReportData as any).cachedFromAnalysisId = cachedAnalysis.id;

        await supabase.from("analyses").update({
          status: "complete",
          overall_score: cachedAnalysis.overall_score,
          signal_strength: cachedAnalysis.signal_strength,
          report_data: cachedReportData,
          idea_hash: ideaHash,
          updated_at: new Date().toISOString(),
        }).eq("id", analysisId);

        // Do NOT deduct a credit for cached results
        return new Response(JSON.stringify({ success: true, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log(`[CACHE MISS] No cached report found for hash ${ideaHash.slice(0, 16)}...`);
    }

    // ── Get user_id from analysis record ──
    const { data: analysisRecord } = await supabase.from("analyses").select("user_id").eq("id", analysisId).single();
    const pipelineUserId = analysisRecord?.user_id;

    if (pipelineUserId) {
      // ── Check if user is admin ──
      const { data: isAdminData } = await supabase.rpc("is_admin", { _user_id: pipelineUserId });
      const isAdminUser = isAdminData === true;

      // ── Suspension check (skip for admins) ──
      if (!isAdminUser) {
        const { data: profileData } = await supabase.from("profiles").select("suspended").eq("id", pipelineUserId).single();
        if (profileData?.suspended) {
          await supabase.from("analyses").update({ status: "failed" }).eq("id", analysisId);
          return new Response(JSON.stringify({ error: "Account suspended" }), { status: 403, headers: corsHeaders });
        }
      }

      // ── Rate limiting (skip for admins) ──
      if (!isAdminUser) {
        const { data: countData } = await supabase.rpc("analyses_count_last_hour", { _user_id: pipelineUserId });
        const hourlyCount = countData ?? 0;
        const { data: subData } = await supabase.from("subscriptions").select("plan").eq("user_id", pipelineUserId).single();
        const maxPerHour = subData?.plan === "pro" || subData?.plan === "agency" ? 10 : 3;
        if (hourlyCount > maxPerHour) {
          await supabase.from("analyses").update({ status: "failed" }).eq("id", analysisId);
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), { status: 429, headers: corsHeaders });
        }
      }
    }

    const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const serperKey = Deno.env.get("SERPER_API_KEY");
    const productHuntKey = Deno.env.get("PRODUCTHUNT_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
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

    if (openaiKey) {
      try {
        const semanticStart = Date.now();
        const semanticRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You generate search queries for market research. Given a startup idea, return a JSON object with 3 query categories to maximize discovery from different angles.

Rules:
- Each query should be 2-5 words, using natural language people actually search
- Do NOT just split the idea into words — generate semantically meaningful queries
- Think about what a user looking for this type of product would actually type into Google

Categories:
1. "broad" (2 queries): General product category searches. Cast a wide net. Example: "fitness tracking app", "workout planner tool"
2. "niche" (2 queries): Specific sub-category or feature-focused searches. Example: "AI voice workout coach", "hands-free gym assistant"
3. "problem" (1 query): Focus on the user problem, NOT the solution. What pain would someone search for? Example: "can't stay motivated at gym"

Return ONLY a JSON object like: {"broad": ["q1", "q2"], "niche": ["q3", "q4"], "problem": ["q5"]}`
              },
              { role: "user", content: `Startup idea: "${sanitizedIdea}"` }
            ],
            temperature: 0.3,
            max_tokens: 400,
          }),
        });

        if (semanticRes.ok) {
          const semanticData = await semanticRes.json();
          const semanticContent = semanticData.choices?.[0]?.message?.content || "{}";
          // Try to parse as structured object first, fallback to array
          const objMatch = semanticContent.match(/\{[\s\S]*\}/);
          const arrMatch = semanticContent.match(/\[[\s\S]*?\]/);
          if (objMatch) {
            try {
              const parsed = JSON.parse(objMatch[0]);
              if (parsed.broad && parsed.niche && parsed.problem) {
                const broad = (parsed.broad || []).map((q: any) => String(q).trim()).filter(Boolean);
                const niche = (parsed.niche || []).map((q: any) => String(q).trim()).filter(Boolean);
                const problem = (parsed.problem || []).map((q: any) => String(q).trim()).filter(Boolean);
                semanticQueries = [...broad, ...niche, ...problem].slice(0, 5);
                rawData.queryStrategy = { broad, niche, problem };
                primaryKeywords = broad[0] || semanticQueries[0] || primaryKeywords;
                console.log(`[SEMANTIC KEYWORDS] Multi-query strategy in ${Date.now() - semanticStart}ms: broad=${JSON.stringify(broad)}, niche=${JSON.stringify(niche)}, problem=${JSON.stringify(problem)}`);
              } else {
                throw new Error("Missing categories");
              }
            } catch {
              // Fallback to flat array
              if (arrMatch) {
                const parsed = JSON.parse(arrMatch[0]);
                if (Array.isArray(parsed) && parsed.length >= 3) {
                  semanticQueries = parsed.slice(0, 5).map((q: any) => String(q).trim()).filter(Boolean);
                  primaryKeywords = semanticQueries[0] || primaryKeywords;
                }
              }
              console.log(`[SEMANTIC KEYWORDS] Fallback to flat array: ${JSON.stringify(semanticQueries)}`);
            }
          } else if (arrMatch) {
            const parsed = JSON.parse(arrMatch[0]);
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
      serperKeywordIntel: null,
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

    const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
      Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
        ),
      ]);

    // Source timeout ceilings: GitHub=5000ms, all others=8000ms
    const SOURCE_TIMEOUTS: Record<string, number> = { github: 5000 };
    const DEFAULT_SOURCE_TIMEOUT = 8000;

    async function trackSource(name: string, fn: () => Promise<number>): Promise<void> {
      const start = Date.now();
      const timeoutMs = SOURCE_TIMEOUTS[name] ?? DEFAULT_SOURCE_TIMEOUT;
      try {
        const signalCount = await withTimeout(fn(), timeoutMs, name);
        pipelineMetrics[name] = { status: "ok", durationMs: Date.now() - start, signalCount };
      } catch (e: any) {
        const isTimeout = e?.message?.includes("timed out after");
        pipelineMetrics[name] = {
          status: isTimeout ? "timeout" : "error",
          durationMs: Date.now() - start,
          signalCount: 0,
          error: e?.message || String(e),
        };
        console.error(`[PIPELINE] ${name} ${isTimeout ? "TIMEOUT" : "error"}:`, e?.message || e);
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
      // Use semantic queries for better app store discovery
      const firecrawlQuery = semanticQueries.length > 1 ? semanticQueries[0] : sanitizedIdea;
      firecrawlPromises.push(
        trackSource("firecrawl_appstore", async () => {
          const r = await withRetry(() => firecrawlSearch(firecrawlKey, `${firecrawlQuery} app site:apps.apple.com OR site:play.google.com`, 20));
          rawData.firecrawlAppStore = r; rawData.sources.push(...r.results.map((x: any) => ({ url: x.url, type: "firecrawl" })));
          return r.results.length;
        })
      );

      firecrawlPromises.push(
        trackSource("firecrawl_reddit", async () => {
          const redditQuery = semanticQueries.length > 1 ? semanticQueries[1] : sanitizedIdea;
          const r = await withRetry(() => firecrawlSearch(firecrawlKey, `${redditQuery} reviews complaints pain points site:reddit.com`, 15));
          rawData.firecrawlReddit = r; rawData.sources.push(...r.results.map((x: any) => ({ url: x.url, type: "firecrawl" })));
          return r.results.length;
        })
      );
    }

    // Run Serper searches in parallel (Google Trends + Reddit fallback + Competitor Discovery)
    const serperPromises: Promise<void>[] = [];

    let keywordIntelPromise: (() => Promise<void>) | null = null;

    if (serperKey) {
      // Use SHORT semantic keywords for Serper queries (not full idea text which can be multi-line)
      const serperKeywords = semanticQueries.length > 0
        ? semanticQueries[0]
        : primaryKeywords.split(/\s+/).slice(0, 5).join(" ");

      serperPromises.push(
        trackSource("serper_trends", async () => {
          const r = await serperSearch(serperKey, `${serperKeywords} search trends growth`, "search", 30);
          rawData.serperTrends = r; rawData.sources.push(...r.organic.map((o: any) => ({ url: o.link, type: "serper" })));
          return r.organic.length;
        })
      );

      serperPromises.push(
        trackSource("serper_trends_monthly", async () => {
          const trendQuery = semanticQueries.length > 2 ? semanticQueries[2] : serperKeywords;
          const r = await serperSearch(serperKey, `${trendQuery} market size demand`, "search", 30);
          rawData.serperTrendsMonthly = r; rawData.sources.push(...r.organic.map((o: any) => ({ url: o.link, type: "serper" })));
          return r.organic.length;
        })
      );

      serperPromises.push(
        trackSource("serper_news", async () => {
          // Use short keywords for news — news endpoint is strict about query length
          const newsQuery = semanticQueries.length > 0 ? semanticQueries[0] : serperKeywords;
          const r = await serperSearch(serperKey, newsQuery, "news", 30);
          rawData.serperNews = r; rawData.sources.push(...r.organic.map((o: any) => ({ url: o.link, type: "serper" })));
          return r.organic.length;
        })
      );

      // serper_reddit: Use BROAD queries for Reddit (site-scoped queries need generic terms)
      {
        const redditQueries: string[] = [];
        // Use the BROAD semantic queries (index 0) — these are generic category terms like "budgeting app"
        if (semanticQueries.length > 0) redditQueries.push(semanticQueries[0]); // broad query
        // Add problem-focused query — great for Reddit where people describe pain
        if (rawData.queryStrategy?.problem?.[0]) redditQueries.push(rawData.queryStrategy.problem[0]);
        // Add a broad keyword-only query as fallback
        if (rawData.queryStrategy?.broad?.[1]) redditQueries.push(rawData.queryStrategy.broad[1]);
        if (redditQueries.length === 0) redditQueries.push(serperKeywords);
        // Deduplicate
        const uniqueRedditQueries = [...new Set(redditQueries)].slice(0, 3);
        console.log(`[SERPER REDDIT] Using ${uniqueRedditQueries.length} broad queries: ${JSON.stringify(uniqueRedditQueries)}`);

        const redditAllResults: any[] = [];
        for (let rqi = 0; rqi < uniqueRedditQueries.length; rqi++) {
          const rq = uniqueRedditQueries[rqi];
          serperPromises.push(
            trackSource(rqi === 0 ? "serper_reddit" : `serper_reddit_${rqi}`, async () => {
              // Use the query WITHOUT site: restriction first, then filter reddit URLs
              // site:reddit.com with specific terms often returns 0
              const r = await serperSearch(serperKey, `${rq} reddit`, "search", 30);
              const redditOnly = r.organic.filter((o: any) => 
                (o.link || "").toLowerCase().includes("reddit.com")
              );
              // Also keep non-reddit results as they may reference reddit discussions
              const allRelevant = redditOnly.length > 0 ? redditOnly : r.organic.slice(0, 10);
              redditAllResults.push(...allRelevant);
              return allRelevant.length;
            })
          );
        }

        rawData._redditAllResults = redditAllResults;
      }

      serperPromises.push(
        trackSource("serper_autocomplete", async () => {
          // Use short keyword for autocomplete, not full multi-line idea
          const autoQuery = semanticQueries.length > 0 ? semanticQueries[0] : primaryKeywords.split(/\s+/).slice(0, 4).join(" ");
          const r = await serperAutoComplete(serperKey, autoQuery);
          rawData.serperAutoComplete = r;
          return r.suggestions.length;
        })
      );

      // ── KEYWORD INTELLIGENCE: Real volume + trend data via Serper + Perplexity ──
      // This runs after serper promises resolve (added to a separate phase below)
      keywordIntelPromise = async () => {
        await Promise.all(serperPromises);
        await trackSource("serper_keyword_intel", async () => {
          const suggestions = rawData.serperAutoComplete?.suggestions || [];
          const allKeywords = [...new Set([...suggestions.slice(0, 5), ...semanticQueries.slice(0, 3)])];
          if (allKeywords.length === 0) {
            allKeywords.push(primaryKeywords.split(/\s+/).slice(0, 4).join(" "));
          }
          const r = await fetchKeywordIntelligence(serperKey, perplexityKey || "", allKeywords);
          rawData.serperKeywordIntel = r;
          return r.keywords.length;
        });
      };

      // ── COMPETITOR DISCOVERY: Use semantic queries for targeted competitor search ──
      rawData.serperCompetitors = { allResults: [] as any[] };

      // Build competitor queries from SEMANTIC keywords, not naive splits
      const competitorQueryTemplates = [
        `${serperKeywords} competitors alternatives`,
        `best ${serperKeywords} apps`,
        `${serperKeywords} vs`,
        `${serperKeywords} alternative 2024 2025`,
        ...(semanticQueries.length > 1 ? [`${semanticQueries[1]} competitors`] : []),
        ...(semanticQueries.length > 2 ? [`best ${semanticQueries[2]} apps`] : []),
      ].slice(0, 6); // max 6 competitor queries

      for (let i = 0; i < competitorQueryTemplates.length; i++) {
        const cq = competitorQueryTemplates[i];
        serperPromises.push(
          trackSource(`serper_competitor_${i}`, async () => {
            const r = await serperSearch(serperKey, cq, "search", 30);
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

    // Run Product Hunt search — use SEMANTIC keywords + Serper site search
    const productHuntPromises: Promise<void>[] = [];

    // Product Hunt works even without PH API key — uses Serper site:producthunt.com
    if (productHuntKey || serperKey) {
      const phSearches = semanticQueries.length >= 3
        ? semanticQueries.slice(0, 3)
        : [primaryKeywords, ...(semanticQueries.length > 1 ? [semanticQueries[1]] : [])].filter((v, i, a) => a.indexOf(v) === i);

      const phResults: any[] = [];
      for (const kw of phSearches) {
        productHuntPromises.push(
          productHuntSearch(productHuntKey || "", kw, 5, serperKey || null)
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
          }).sort((a: any, b: any) => (b.upvotes || 0) - (a.upvotes || 0)).slice(0, 15);
          rawData.productHunt = { products: unique };
          rawData.sources.push(...unique.map((p: any) => ({ url: p.url, type: "producthunt" })));
          return unique.length;
        })
      );
    }

    // Run GitHub search — use SHORT semantic keywords (not full idea text)
    const githubPromises: Promise<void>[] = [];
    const ghSearches = semanticQueries.length >= 3
      ? semanticQueries.slice(0, 3)
      : semanticQueries.length > 0
        ? semanticQueries
        : [primaryKeywords.split(/\s+/).slice(0, 5).join(" ")];

    const ghResults: any[] = [];
    for (const kw of ghSearches) {
      githubPromises.push(
        githubSearch(kw, 30)
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
        }).sort((a: any, b: any) => (b.stars || 0) - (a.stars || 0)).slice(0, 30);
        rawData.github = { repos: unique };
        rawData.sources.push(...unique.map((repo: any) => ({ url: repo.url, type: "github" })));
        return unique.length;
      })
    );

    // Run Twitter/X searches in parallel — use MULTIPLE semantic queries for better coverage
    // Product-search keywords (e.g. "business opportunity detection tool") get zero Twitter hits.
    // Twitter is conversational, so we try up to 3 queries and merge results.
    const twitterPromises: Promise<void>[] = [];
    if (twitterBearerToken) {
      // Build Twitter-optimized query list: prefer broad/problem queries, try multiple
      const twitterQueries: string[] = [];
      if (rawData.queryStrategy) {
        // Structured queries available: problem first (most conversational), then broad
        const { problem = [], broad = [], niche = [] } = rawData.queryStrategy;
        twitterQueries.push(...problem, ...broad, ...niche);
      } else if (semanticQueries.length > 0) {
        twitterQueries.push(...semanticQueries);
      } else {
        twitterQueries.push(primaryKeywords.split(/\s+/).slice(0, 5).join(" "));
      }
      // Dedupe and limit to 3 queries
      const uniqueTwitterQueries = [...new Set(twitterQueries)].slice(0, 3);
      const primaryTwitterQuery = uniqueTwitterQueries[0];
      console.log(`[TWITTER] Using ${uniqueTwitterQueries.length} queries: ${JSON.stringify(uniqueTwitterQueries)}`);

      twitterPromises.push(
        trackSource("twitter_sentiment", async () => {
          // Try multiple queries in sequence, merge results
          const allTweets: any[] = [];
          const seenIds = new Set<string>();
          let totalFetched = 0;
          for (const q of uniqueTwitterQueries) {
            const r = await twitterSearch(twitterBearerToken, q, 50);
            totalFetched += r.total_fetched;
            for (const t of r.tweets) {
              if (!seenIds.has(t.id)) {
                seenIds.add(t.id);
                allTweets.push(t);
              }
            }
            if (allTweets.length >= 20) break; // enough tweets
          }
          // Re-sort merged results by engagement
          allTweets.sort((a, b) => (b.like_count + b.retweet_count * 2) - (a.like_count + a.retweet_count * 2));
          const finalTweets = allTweets.slice(0, 30);
          const result = { tweets: finalTweets, total_fetched: totalFetched };
          rawData.twitterSentiment = result;
          rawData.sources.push(...finalTweets.map((t: any) => ({ url: `https://x.com/${t.author_username}/status/${t.id}`, type: "twitter" })));
          console.log(`[TWITTER] Sentiment merged: ${finalTweets.length} tweets from ${uniqueTwitterQueries.length} queries (${totalFetched} total fetched)`);
          return finalTweets.length;
        })
      );
      
      twitterPromises.push(
        trackSource("twitter_counts", async () => {
          // Try each query until we get non-zero counts
          for (const q of uniqueTwitterQueries) {
            const r = await twitterTweetCounts(twitterBearerToken, q);
            if (r.total_count > 0) {
              rawData.twitterCounts = r;
              console.log(`[TWITTER] Counts found ${r.total_count} tweets for query "${q}"`);
              return r.total_count;
            }
          }
          // All queries returned 0
          rawData.twitterCounts = { counts: [], total_count: 0, volume_change_pct: 0 };
          return 0;
        })
      );

      rawData.twitterInfluencerNicheQuery = primaryTwitterQuery;
    }

    // Run Hacker News search — use SHORT semantic keywords (not full idea text)
    const hnPromises: Promise<void>[] = [];
    const hnQuery = semanticQueries.length > 0 ? semanticQueries[0] : primaryKeywords.split(/\s+/).slice(0, 5).join(" ");
    hnPromises.push(
      trackSource("hackernews", async () => {
        const r = await hackerNewsSearch(hnQuery, 30);
        rawData.hackerNews = r;
        rawData.sources.push(...r.hits.map((h: any) => ({ url: h.hnUrl, type: "hackernews" })));
        return r.hits.length;
      })
    );


    const fetchStart = Date.now();
    await Promise.all([...perplexityPromises, ...firecrawlPromises, ...serperPromises, ...productHuntPromises, ...githubPromises, ...twitterPromises, ...hnPromises]);
    // Run keyword intelligence after serper autocomplete has completed
    if (keywordIntelPromise) {
      await keywordIntelPromise();
    }
    const totalFetchDurationMs = Date.now() - fetchStart;

    // ── Post-fetch: Merge and deduplicate Reddit results from multiple queries ──
    if (rawData._redditAllResults && rawData._redditAllResults.length > 0) {
      const seen = new Set<string>();
      const deduped = rawData._redditAllResults.filter((r: any) => {
        const key = r.link || r.title;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      rawData.serperReddit = { organic: deduped, searchParameters: {}, knowledgeGraph: null };
      rawData.sources.push(...deduped.map((o: any) => ({ url: o.link, type: "serper" })));
      console.log(`[SERPER REDDIT] Merged: ${rawData._redditAllResults.length} total → ${deduped.length} unique results`);
      delete rawData._redditAllResults;
    } else if (!rawData.serperReddit) {
      rawData.serperReddit = { organic: [], searchParameters: {}, knowledgeGraph: null };
    }

    // ── Post-fetch: Extract founder X handles from competitor data and look them up ──
    if (twitterBearerToken && openaiKey && rawData.perplexityMarket?.content) {
      await trackSource("twitter_influencers", async () => {
        const extractRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
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
    // POST-FETCH RELEVANCE FILTERING (EXPANDED)
    // Score each collected item for relevance to the user's idea.
    // Items scoring below 5/10 are filtered out before AI analysis.
    // Now includes: GitHub, HN, Product Hunt, AND Serper competitor results.
    // ══════════════════════════════════════════════════════════════════
    if (openaiKey) {
      const filterStart = Date.now();

      // Build items to score from ALL filterable sources
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
      // NEW: Also score Serper competitor results
      (rawData.serperCompetitors?.allResults || []).forEach((r: any, i: number) => {
        itemsToScore.push({ source: "serper_competitor", index: i, title: r.title || "", description: r.snippet || "" });
      });

      if (itemsToScore.length > 0) {
        try {
          const scoringRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content: `You are a relevance scorer for market research. Given a startup idea and a list of search results, score each result from 0-10 for how relevant it is to validating or competing with the idea.

Scoring guide:
- 10: Directly about this product category or a direct competitor
- 7-9: Closely related product, feature, or market discussion
- 4-6: Tangentially related but in the same broad domain
- 1-3: Different domain, only shares a keyword coincidentally
- 0: Completely unrelated

Be strict: a generic AI/ML repo is NOT relevant to a specific AI fitness app. A general "todo list" project is NOT relevant to an AI-powered project management tool.

Return ONLY a JSON array of numbers, one score per item, in the same order. Example: [8, 2, 6, 1, 9]`,
                },
                {
                  role: "user",
                  content: `Startup idea: "${idea}"\n\nResults to score:\n${itemsToScore.map((item, i) => `${i + 1}. [${item.source}] ${item.title} — ${item.description}`).join("\n")}`,
                },
              ],
              temperature: 0,
              max_tokens: 800,
            }),
          });

          if (scoringRes.ok) {
            const scoringData = await scoringRes.json();
            const scoresContent = scoringData.choices?.[0]?.message?.content || "[]";
            const scoresMatch = scoresContent.match(/\[[\s\S]*?\]/);
            if (scoresMatch) {
              const scores: number[] = JSON.parse(scoresMatch[0]);
              let filteredCount = 0;

              // Apply relevance threshold of 5 — log discarded items for audit
              const toRemove: Record<string, Set<number>> = { github: new Set(), hackernews: new Set(), producthunt: new Set(), serper_competitor: new Set() };
              const discardedItems: { source: string; title: string; score: number }[] = [];

              itemsToScore.forEach((item, idx) => {
                const score = scores[idx] ?? 3; // INTEGRITY FIX: default to BELOW threshold (reject) if AI didn't score this item
                if (score < 5) {
                  toRemove[item.source]?.add(item.index);
                  filteredCount++;
                  discardedItems.push({ source: item.source, title: item.title, score });
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

              // Filter Serper competitor results
              if (toRemove.serper_competitor.size > 0 && rawData.serperCompetitors?.allResults) {
                const before = rawData.serperCompetitors.allResults.length;
                rawData.serperCompetitors.allResults = rawData.serperCompetitors.allResults.filter((_: any, i: number) => !toRemove.serper_competitor.has(i));
                console.log(`[RELEVANCE FILTER] Serper Competitors: ${before} -> ${rawData.serperCompetitors.allResults.length} results (removed ${toRemove.serper_competitor.size} irrelevant)`);
              }

              // Log discarded items for audit trail
              if (discardedItems.length > 0) {
                console.log(`[RELEVANCE FILTER] Discarded items: ${JSON.stringify(discardedItems)}`);
              }

              console.log(`[RELEVANCE FILTER] Total: scored ${itemsToScore.length} items, filtered ${filteredCount} irrelevant in ${Date.now() - filterStart}ms`);
              rawData.relevanceFilterApplied = true;
              rawData.relevanceFilterStats = {
                scored: itemsToScore.length,
                filtered: filteredCount,
                discardedItems: discardedItems.slice(0, 20), // Keep top 20 for report
              };

              // ══════════════════════════════════════════════════════════
              // SOURCE CONTAMINATION FLAGGING
              // If >50% of a source's results were filtered as irrelevant,
              // flag that source as "contaminated" (low confidence).
              // ══════════════════════════════════════════════════════════
              const sourceStats: Record<string, { total: number; filtered: number }> = {};
              itemsToScore.forEach((item, idx) => {
                if (!sourceStats[item.source]) sourceStats[item.source] = { total: 0, filtered: 0 };
                sourceStats[item.source].total++;
                if ((scores[idx] ?? 5) < 5) sourceStats[item.source].filtered++;
              });

              const contaminatedSources: { source: string; total: number; filtered: number; contaminationPct: number }[] = [];
              for (const [source, stats] of Object.entries(sourceStats)) {
                const pct = Math.round((stats.filtered / stats.total) * 100);
                if (stats.total >= 2 && pct > 50) {
                  contaminatedSources.push({ source, total: stats.total, filtered: stats.filtered, contaminationPct: pct });
                  console.warn(`[SOURCE CONTAMINATION] ${source}: ${pct}% of ${stats.total} results irrelevant — flagged as low confidence`);
                }
              }

              rawData.relevanceFilterStats.sourceContamination = contaminatedSources;
              if (contaminatedSources.length > 0) {
                console.log(`[SOURCE CONTAMINATION] ${contaminatedSources.length} sources flagged: ${contaminatedSources.map(s => s.source).join(", ")}`);
              }
            }
          } else {
            console.warn("[RELEVANCE FILTER] AI scoring call failed, skipping filter");
          }
        } catch (filterErr) {
          console.warn("[RELEVANCE FILTER] Error during relevance scoring:", filterErr);
        }
      }
    }

    // ── EVIDENCE SUMMARY LOG (before/after filtering) ──
    const evidenceSummary = {
      github: { before: pipelineMetrics.github?.signalCount || 0, after: rawData.github?.repos?.length || 0 },
      hackerNews: { before: pipelineMetrics.hackernews?.signalCount || 0, after: rawData.hackerNews?.hits?.length || 0 },
      productHunt: { before: pipelineMetrics.producthunt?.signalCount || 0, after: rawData.productHunt?.products?.length || 0 },
      twitter: { before: rawData.twitterSentiment?.total_fetched || 0, after: rawData.twitterSentiment?.tweets?.length || 0 },
      serperCompetitors: { before: Object.keys(pipelineMetrics).filter(k => k.startsWith('serper_competitor_')).reduce((s, k) => s + (pipelineMetrics[k]?.signalCount || 0), 0), after: rawData.serperCompetitors?.allResults?.length || 0 },
      firecrawlAppStore: { before: pipelineMetrics.firecrawl_appstore?.signalCount || 0, after: rawData.firecrawlAppStore?.results?.length || 0 },
      firecrawlReddit: { before: pipelineMetrics.firecrawl_reddit?.signalCount || 0, after: rawData.firecrawlReddit?.results?.length || 0 },
      serperReddit: { before: pipelineMetrics.serper_reddit?.signalCount || 0, after: rawData.serperReddit?.organic?.length || 0 },
      serperNews: { before: pipelineMetrics.serper_news?.signalCount || 0, after: rawData.serperNews?.organic?.length || 0 },
    };
    const totalBefore = Object.values(evidenceSummary).reduce((s, v) => s + v.before, 0);
    const totalAfter = Object.values(evidenceSummary).reduce((s, v) => s + v.after, 0);
    console.log(`[EVIDENCE SUMMARY] Total fetched: ${totalBefore} | After filtering: ${totalAfter} | Dropped: ${totalBefore - totalAfter}`);
    console.log(`[EVIDENCE SUMMARY] Breakdown: ${JSON.stringify(evidenceSummary)}`);
    rawData.evidenceSummary = evidenceSummary;

    // ══════════════════════════════════════════════════════════════════
    // GITHUB COMPLEXITY CALCULATION (deterministic, no extra API calls)
    // ══════════════════════════════════════════════════════════════════
    const githubComplexityResult = calculateGitHubComplexity(rawData.github?.repos || []);
    rawData.githubComplexity = githubComplexityResult;
    if (githubComplexityResult) {
      console.log(`[GITHUB COMPLEXITY] Score: ${githubComplexityResult.score}/10 | Repos analyzed: ${githubComplexityResult.reposAnalyzed} | Signals: ${githubComplexityResult.signals.join("; ")}`);
    } else {
      console.log(`[GITHUB COMPLEXITY] Insufficient GitHub data to estimate complexity (need >= 3 repos)`);
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

    // ══════════════════════════════════════════════════════════════════
    // UPGRADE 1: COMPETITOR NORMALIZATION & DEDUPLICATION
    // Extract competitors from ALL sources, normalize names, merge
    // duplicates, assign confidence scores, and limit to top 10.
    // ══════════════════════════════════════════════════════════════════
    const rawCompetitors = extractCompetitorsFromSources(rawData);
    rawData.rawCompetitors = rawCompetitors;

    const normalizedCompetitors = normalizeCompetitors(rawCompetitors);
    rawData.normalizedCompetitors = normalizedCompetitors;

    // ══════════════════════════════════════════════════════════════════
    // UPGRADE 2: REAL PRODUCT VALIDATION
    // Verify each competitor is a real product (not a blog, article,
    // or hypothetical). Uses URL analysis + Serper verification.
    // Only competitors with validationScore >= 2 survive.
    // ══════════════════════════════════════════════════════════════════
    const validatedCompetitors = await validateCompetitors(normalizedCompetitors, serperKey);
    rawData.validatedCompetitors = validatedCompetitors;

    console.log(`[COMPETITOR PIPELINE] Raw: ${rawCompetitors.length} → Normalized: ${normalizedCompetitors.length} → Validated: ${validatedCompetitors.length}`);

    // ══════════════════════════════════════════════════════════════════
    // UPGRADE 3: COMPETITOR PRICING SCRAPING VIA FIRECRAWL
    // For the top 3 validated competitors with URLs, scrape their
    // pricing pages using Firecrawl to get Tier 1 revenue data.
    // ══════════════════════════════════════════════════════════════════
    if (firecrawlKey && validatedCompetitors.length > 0) {
      const topCompsWithUrls = validatedCompetitors
        .filter((c: any) => c.url && !c.url.includes("reddit.com") && !c.url.includes("news.ycombinator"))
        .slice(0, 3);

      if (topCompsWithUrls.length > 0) {
        console.log(`[PRICING SCRAPE] Attempting to scrape pricing for ${topCompsWithUrls.length} competitors`);
        rawData.competitorPricing = [];

        const pricingPromises = topCompsWithUrls.map(async (comp: any) => {
          try {
            // Try to find the pricing page
            let pricingUrl = "";
            try {
              const baseUrl = new URL(comp.url);
              // Skip app store URLs — try to find the product's own site
              if (baseUrl.hostname.includes("apps.apple.com") || baseUrl.hostname.includes("play.google.com") || baseUrl.hostname.includes("producthunt.com") || baseUrl.hostname.includes("github.com")) {
                // Use Firecrawl search to find the pricing page
                const searchResult = await firecrawlSearch(firecrawlKey, `"${comp.name}" pricing plans`, 3);
                const pricingResult = searchResult.results.find((r: any) =>
                  (r.url || "").toLowerCase().includes("pricing") ||
                  (r.title || "").toLowerCase().includes("pricing")
                );
                if (pricingResult) {
                  pricingUrl = pricingResult.url;
                }
              } else {
                // Direct product URL — try /pricing path first
                pricingUrl = `${baseUrl.origin}/pricing`;
              }
            } catch {
              return null;
            }

            if (!pricingUrl) return null;

            console.log(`[PRICING SCRAPE] Scraping pricing for "${comp.name}" from: ${pricingUrl}`);
            const scrapeResult = await firecrawlScrape(firecrawlKey, pricingUrl);

            if (scrapeResult.markdown && scrapeResult.markdown.length > 50) {
              // Extract pricing data using a simple pattern match
              const md = scrapeResult.markdown;
              const priceMatches = md.match(/\$[\d,.]+(?:\s*\/\s*(?:mo|month|yr|year|user|seat))?/gi) || [];
              const planMatches = md.match(/(?:free|starter|basic|pro|premium|enterprise|business|team|personal|hobby)\s*(?:plan|tier)?/gi) || [];

              const pricingData = {
                competitorName: comp.name,
                url: pricingUrl,
                rawPrices: [...new Set(priceMatches)].slice(0, 8),
                planNames: [...new Set(planMatches)].slice(0, 6),
                markdownSnippet: md.slice(0, 1500),
                scrapedAt: new Date().toISOString(),
              };

              rawData.competitorPricing.push(pricingData);

              console.log(`[PRICING SCRAPE] "${comp.name}": Found ${priceMatches.length} prices, ${planMatches.length} plan names`);
              return pricingData;
            }
            return null;
          } catch (e) {
            console.warn(`[PRICING SCRAPE] Failed for "${comp.name}":`, e);
            return null;
          }
        });

        await Promise.all(pricingPromises);
        const scrapedCount = rawData.competitorPricing.filter(Boolean).length;
        console.log(`[PRICING SCRAPE] Successfully scraped pricing for ${scrapedCount}/${topCompsWithUrls.length} competitors`);

        // Track in pipeline metrics
        pipelineMetrics["firecrawl_pricing"] = {
          status: scrapedCount > 0 ? "ok" : "empty",
          durationMs: 0,
          signalCount: scrapedCount,
        };
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // EVIDENCE-LOCKED ANALYSIS: Build structured evidence block
    // Only verified, categorized signals reach the AI — no narratives.
    // ══════════════════════════════════════════════════════════════════
    const evidenceBlock = {
      demandSignals: [] as { signal: string; value: string; source: string; sourceUrl: string | null; tier: "verified" | "reported" | "estimated" }[],
      competitors: [] as { name: string; rating: string | null; downloads: string | null; evidenceType: string; validationScore: number; sources: string[]; url: string | null; weakness: string | null; tier: "verified" | "reported" }[],
      pricingSignals: [] as { signal: string; value: string; source: string; sourceUrl: string | null; tier: "verified" | "reported" | "estimated" }[],
      productLaunchSignals: [] as { name: string; tagline: string; upvotes: number; launchDate: string; url: string; source: string; tier: "verified" }[],
      developerSignals: [] as { repo: string; stars: number; forks: number; language: string; url: string; lastPush: string; tier: "verified" }[],
      sentimentSignals: [] as { text: string; source: string; sourceUrl: string | null; platform: string; engagement: number; tier: "verified" | "reported" }[],
      trendSignals: [] as { signal: string; value: string; source: string; sourceUrl: string | null; tier: "verified" | "reported" }[],
      technicalSignals: [] as { signal: string; value: string; source: string; sourceUrl: string | null; tier: "reported" | "estimated" }[],
    };

    // ── Populate demand signals ──
    (rawData.serperTrends?.organic || []).forEach((r: any) => {
      evidenceBlock.demandSignals.push({ signal: r.title, value: r.snippet || "", source: "Serper Google Search", sourceUrl: r.link, tier: "verified" });
    });
    (rawData.serperAutoComplete?.suggestions || []).forEach((s: string) => {
      evidenceBlock.demandSignals.push({ signal: "Google Autocomplete", value: s, source: "Serper Autocomplete", sourceUrl: null, tier: "verified" });
    });
    // Add keyword intelligence volume/trend data as verified signals
    (rawData.serperKeywordIntel?.keywords || []).forEach((kw: any) => {
      if (kw.volume && kw.volume !== "N/A") {
        evidenceBlock.demandSignals.push({ signal: `Keyword Volume: ${kw.keyword}`, value: `${kw.volume}/mo (${kw.trend})`, source: "Serper + Google Trends", sourceUrl: null, tier: "verified" });
      }
    });
    (rawData.firecrawlAppStore?.results || []).forEach((r: any) => {
      evidenceBlock.demandSignals.push({ signal: "App Store Listing", value: r.title || r.url, source: "Firecrawl App Store", sourceUrl: r.url, tier: "verified" });
    });
    if (rawData.twitterCounts?.total_count > 0) {
      evidenceBlock.demandSignals.push({ signal: "X/Twitter Volume (7d)", value: `${rawData.twitterCounts.total_count} tweets, ${rawData.twitterCounts.volume_change_pct > 0 ? "+" : ""}${rawData.twitterCounts.volume_change_pct}% change`, source: "X API v2", sourceUrl: null, tier: "verified" });
    }
    (rawData.serperNews?.organic || []).forEach((r: any) => {
      evidenceBlock.trendSignals.push({ signal: r.title, value: r.date || "recent", source: "Serper News", sourceUrl: r.link, tier: "verified" });
    });
    (rawData.serperTrendsMonthly?.organic || []).forEach((r: any) => {
      evidenceBlock.trendSignals.push({ signal: r.title, value: r.snippet || "", source: "Serper Monthly Trends", sourceUrl: r.link, tier: "verified" });
    });

    // ── Populate competitors from validated pipeline ──
    (rawData.validatedCompetitors || []).forEach((c: any) => {
      evidenceBlock.competitors.push({
        name: c.name,
        rating: c.rating || null,
        downloads: c.downloads || null,
        evidenceType: c.evidenceType,
        validationScore: c.validationScore,
        sources: c.sources,
        url: c.url || null,
        weakness: (c.weaknesses || [])[0] || null,
        tier: c.validationScore >= 3 ? "verified" : "reported",
      });
    });

    // ── Populate Product Hunt signals ──
    (rawData.productHunt?.products || []).forEach((p: any) => {
      evidenceBlock.productLaunchSignals.push({
        name: p.name, tagline: p.tagline || "", upvotes: p.upvotes || 0,
        launchDate: p.launchDate || "", url: p.url || "", source: "Product Hunt API", tier: "verified",
      });
    });

    // ── Populate developer signals ──
    (rawData.github?.repos || []).forEach((r: any) => {
      evidenceBlock.developerSignals.push({
        repo: r.name, stars: r.stars || 0, forks: r.forks || 0,
        language: r.language || "unknown", url: r.url, lastPush: r.pushedAt || "", tier: "verified",
      });
    });

    // ── Populate sentiment signals ──
    (rawData.twitterSentiment?.tweets || []).forEach((t: any) => {
      evidenceBlock.sentimentSignals.push({
        text: t.text, source: `@${t.author_username} (${t.author_followers} followers)`,
        sourceUrl: `https://x.com/${t.author_username}/status/${t.id}`,
        platform: "twitter", engagement: (t.like_count || 0) + (t.retweet_count || 0) * 2, tier: "verified",
      });
    });
    (rawData.firecrawlReddit?.results || []).forEach((r: any) => {
      evidenceBlock.sentimentSignals.push({
        text: (r.markdown || "").slice(0, 500), source: r.title || "Reddit",
        sourceUrl: r.url, platform: "reddit", engagement: 0, tier: "verified",
      });
    });
    (rawData.serperReddit?.organic || []).forEach((r: any) => {
      evidenceBlock.sentimentSignals.push({
        text: r.snippet || "", source: r.title || "Reddit via Google",
        sourceUrl: r.link, platform: "reddit", engagement: 0, tier: "reported",
      });
    });
    (rawData.hackerNews?.hits || []).forEach((h: any) => {
      evidenceBlock.sentimentSignals.push({
        text: h.title, source: `HN (${h.points} points, ${h.comments} comments)`,
        sourceUrl: h.hnUrl, platform: "hackernews", engagement: (h.points || 0) + (h.comments || 0), tier: "verified",
      });
    });

    // ── Populate pricing/revenue signals (from Perplexity — tier: reported) ──
    if (rawData.perplexityRevenue?.content) {
      evidenceBlock.pricingSignals.push({ signal: "Revenue Benchmarks", value: rawData.perplexityRevenue.content.slice(0, 800), source: "Perplexity Sonar", sourceUrl: rawData.perplexityRevenue.citations?.[0] || null, tier: "reported" });
    }
    if (rawData.perplexityChurn?.content) {
      evidenceBlock.pricingSignals.push({ signal: "Churn Benchmarks", value: rawData.perplexityChurn.content.slice(0, 800), source: "Perplexity Sonar", sourceUrl: rawData.perplexityChurn.citations?.[0] || null, tier: "reported" });
    }

    // ── Populate scraped pricing signals ──
    (rawData.competitorPricing || []).forEach((pd: any) => {
      if (pd) {
        evidenceBlock.pricingSignals.push({
          signal: `${pd.competitorName || "Competitor"} Pricing (scraped)`,
          value: `Plans: ${pd.planNames?.join(", ") || "See page"}. Prices: ${pd.rawPrices?.join(", ") || "Not extracted"}`,
          source: "Firecrawl Pricing Scrape",
          sourceUrl: pd.url || null,
          tier: "verified",
        });
      }
    });

    if (rawData.perplexityBuildCosts?.content) {
      evidenceBlock.technicalSignals.push({ signal: "Build Cost Analysis", value: rawData.perplexityBuildCosts.content.slice(0, 800), source: "Perplexity Sonar", sourceUrl: rawData.perplexityBuildCosts.citations?.[0] || null, tier: "reported" });
    }

    // ── Populate from Perplexity market/VC/trends as supplementary (tier: reported) ──
    if (rawData.perplexityTrends?.content) {
      evidenceBlock.trendSignals.push({ signal: "Search Trends Summary", value: rawData.perplexityTrends.content.slice(0, 800), source: "Perplexity Sonar", sourceUrl: rawData.perplexityTrends.citations?.[0] || null, tier: "reported" });
    }
    if (rawData.perplexityVC?.content) {
      evidenceBlock.trendSignals.push({ signal: "VC Funding Activity", value: rawData.perplexityVC.content.slice(0, 800), source: "Perplexity Sonar", sourceUrl: rawData.perplexityVC.citations?.[0] || null, tier: "reported" });
    }
    if (rawData.perplexityMarket?.content) {
      evidenceBlock.trendSignals.push({ signal: "Market Overview", value: rawData.perplexityMarket.content.slice(0, 800), source: "Perplexity Sonar", sourceUrl: rawData.perplexityMarket.citations?.[0] || null, tier: "reported" });
    }
    if (rawData.perplexityCompetitors?.content) {
      evidenceBlock.trendSignals.push({ signal: "Competitor Overview", value: rawData.perplexityCompetitors.content.slice(0, 800), source: "Perplexity Sonar", sourceUrl: rawData.perplexityCompetitors.citations?.[0] || null, tier: "reported" });
    }

    // ── Evidence coverage scoring ──
    const evidenceCoverage = {
      demand: evidenceBlock.demandSignals.length,
      competitors: evidenceBlock.competitors.length,
      pricing: evidenceBlock.pricingSignals.length,
      launches: evidenceBlock.productLaunchSignals.length,
      developer: evidenceBlock.developerSignals.length,
      sentiment: evidenceBlock.sentimentSignals.length,
      trends: evidenceBlock.trendSignals.length,
      technical: evidenceBlock.technicalSignals.length,
    };
    const totalEvidence = Object.values(evidenceCoverage).reduce((s, v) => s + v, 0);

    const sectionConfidence = (count: number): "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT" => {
      if (count >= 3) return "HIGH";
      if (count === 2) return "MEDIUM";
      if (count === 1) return "LOW";
      return "INSUFFICIENT";
    };

    const evidenceConfidences = {
      demand: sectionConfidence(evidenceCoverage.demand),
      competitors: sectionConfidence(evidenceCoverage.competitors),
      pricing: sectionConfidence(evidenceCoverage.pricing),
      launches: sectionConfidence(evidenceCoverage.launches),
      developer: sectionConfidence(evidenceCoverage.developer),
      sentiment: sectionConfidence(evidenceCoverage.sentiment),
      trends: sectionConfidence(evidenceCoverage.trends),
      technical: sectionConfidence(evidenceCoverage.technical),
    };

    rawData.evidenceBlock = evidenceBlock;
    rawData.evidenceCoverage = evidenceCoverage;
    rawData.evidenceConfidences = evidenceConfidences;

    console.log(`[EVIDENCE LOCK] Demand signals: ${evidenceCoverage.demand} | Competitors validated: ${evidenceCoverage.competitors} | Pricing signals: ${evidenceCoverage.pricing} | Sentiment signals: ${evidenceCoverage.sentiment} | Trend signals: ${evidenceCoverage.trends} | Developer signals: ${evidenceCoverage.developer} | Launch signals: ${evidenceCoverage.launches} | Technical signals: ${evidenceCoverage.technical}`);
    console.log(`[EVIDENCE LOCK] Evidence coverage score: ${totalEvidence} | Confidences: ${JSON.stringify(evidenceConfidences)}`);

    // ══════════════════════════════════════════════════════════════════
    // MULTI-SOURCE CROSS-VALIDATION SCORING
    // Identify competitor names, keywords, or claims confirmed by 2+
    // independent sources. These get a "cross-validated" tag.
    // ══════════════════════════════════════════════════════════════════
    const crossValidatedSignals: { claim: string; sources: string[]; category: string }[] = [];

    // 1. Cross-validate competitor names across source types
    const competitorSourceMap = new Map<string, Set<string>>();
    for (const comp of (rawData.validatedCompetitors || [])) {
      const key = normalizeName(comp.name);
      if (!competitorSourceMap.has(key)) competitorSourceMap.set(key, new Set());
      (comp.sources || []).forEach((s: string) => competitorSourceMap.get(key)!.add(s));
    }
    for (const [name, srcs] of competitorSourceMap) {
      if (srcs.size >= 2) {
        crossValidatedSignals.push({
          claim: `Competitor "${name}" confirmed by multiple sources`,
          sources: [...srcs],
          category: "Competition",
        });
      }
    }

    // 2. Cross-validate demand: search interest confirmed by social activity
    const hasSearchDemand = (rawData.serperTrends?.organic?.length ?? 0) >= 3;
    const hasSocialDemand = (rawData.twitterCounts?.total_count ?? 0) > 50 || (rawData.hackerNews?.hits?.length ?? 0) >= 2;
    const hasRedditDemand = (rawData.firecrawlReddit?.results?.length ?? 0) >= 2 || (rawData.serperReddit?.organic?.length ?? 0) >= 3;
    if (hasSearchDemand && hasSocialDemand) {
      crossValidatedSignals.push({
        claim: "Market demand confirmed: search interest AND social discussion activity",
        sources: ["Serper Google Search", rawData.twitterCounts?.total_count > 0 ? "X/Twitter" : "Hacker News"],
        category: "Demand",
      });
    }
    if (hasSearchDemand && hasRedditDemand) {
      crossValidatedSignals.push({
        claim: "User pain confirmed: search interest AND Reddit/forum discussions",
        sources: ["Serper Google Search", "Reddit"],
        category: "Sentiment",
      });
    }

    // 3. Cross-validate growth: PH launches + GitHub activity
    const hasPHLaunches = (rawData.productHunt?.products?.length ?? 0) >= 2;
    const hasGHActivity = (rawData.github?.repos?.length ?? 0) >= 3;
    if (hasPHLaunches && hasGHActivity) {
      crossValidatedSignals.push({
        claim: "Developer + product interest confirmed: Product Hunt launches AND active GitHub repos",
        sources: ["Product Hunt", "GitHub"],
        category: "Growth",
      });
    }

    rawData.crossValidatedSignals = crossValidatedSignals;
    if (crossValidatedSignals.length > 0) {
      console.log(`[CROSS-VALIDATION] ${crossValidatedSignals.length} signals confirmed by 2+ sources: ${crossValidatedSignals.map(s => s.category).join(", ")}`);
    }

    // Log pipeline metrics summary
    const totalSignals = Object.values(pipelineMetrics).reduce((s, m) => s + m.signalCount, 0);
    const failedSources = Object.entries(pipelineMetrics).filter(([, m]) => m.status === "error").map(([k]) => k);
    console.log(`[PIPELINE METRICS] Total fetch: ${totalFetchDurationMs}ms | Sources: ${Object.keys(pipelineMetrics).length} | Signals: ${totalSignals} | Failed: ${failedSources.length > 0 ? failedSources.join(", ") : "none"}`);
    console.log(`[PIPELINE METRICS DETAIL]`, JSON.stringify(pipelineMetrics));

    // ── Source Failure & Degradation Alerting ──
    // Categorize sources: down (error), degraded (ok but 0 signals)
    const downSources = Object.entries(pipelineMetrics).filter(([, m]) => m.status === "error");
    const degradedSources = Object.entries(pipelineMetrics).filter(([, m]) => m.status === "ok" && m.signalCount === 0);
    const alertSources: { name: string; status: string; detail: string }[] = [];

    for (const [name, m] of downSources) {
      alertSources.push({ name, status: "🔴 Down", detail: m.error || "Unknown error" });
    }
    for (const [name] of degradedSources) {
      alertSources.push({ name, status: "🟡 Degraded", detail: "Returned 0 signals" });
    }

    if (alertSources.length > 0) {
      try {
        const { data: adminEmails } = await supabase.from("admin_emails").select("email");
        if (adminEmails && adminEmails.length > 0) {
          const adminEmailList = adminEmails.map((a: any) => a.email);
          const { data: adminProfiles } = await supabase
            .from("profiles")
            .select("id")
            .in("email", adminEmailList);

          if (adminProfiles && adminProfiles.length > 0) {
            const downCount = downSources.length;
            const degradedCount = degradedSources.length;
            const statusSummary = [
              downCount > 0 ? `${downCount} down` : "",
              degradedCount > 0 ? `${degradedCount} degraded` : "",
            ].filter(Boolean).join(", ");

            const sourceDetails = alertSources
              .map(s => `${s.status} ${s.name}: ${s.detail}`)
              .slice(0, 8) // limit detail length
              .join("\n");

            const notifications = adminProfiles.map((p: any) => ({
              user_id: p.id,
              title: `⚠️ Data Source Alert: ${statusSummary}`,
              message: `Pipeline for "${idea.slice(0, 40)}…" detected issues:\n${sourceDetails}\n\nTotal signals: ${totalSignals}. Check Admin → Data Sources.`,
            }));
            await supabase.from("notifications").insert(notifications);
            console.log(`[ALERT] Notified ${adminProfiles.length} admin(s): ${statusSummary}`);
          }
        }
      } catch (alertErr) {
        console.error("[ALERT] Failed to send source health notification:", alertErr);
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

    // ══════════════════════════════════════════════════════════════════
    // PHASE 1 COMPLETE — Save intermediate data and fire Phase 2
    // ══════════════════════════════════════════════════════════════════
    const phase1Data = {
      rawData,
      evidenceBlock,
      evidenceCoverage,
      evidenceConfidences,
      totalEvidence,
      pipelineMetrics,
      totalFetchDurationMs,
      totalSignals,
      failedSources,
      semanticQueries,
      primaryKeywords,
      ideaHash,
      sanitizedIdea,
      pipelineUserId,
      crossValidatedSignals: rawData.crossValidatedSignals || [],
    };

    // Save phase1 data to analyses row for Phase 2 to read
    await supabase.from("analyses").update({
      status: "analyzing",
      report_data: { _phase1Data: phase1Data },
      idea_hash: ideaHash,
      updated_at: new Date().toISOString(),
    }).eq("id", analysisId);

    console.log(`[PHASE 1 COMPLETE] Saved intermediate data. Firing Phase 2 for analysis ${analysisId}`);

    // Fire Phase 2 (run-pipeline-analyze) in the background
    const phase2Url = supabaseUrl;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const phase2Promise = fetch(`${phase2Url}/functions/v1/run-pipeline-analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        apikey: anonKey,
      },
      body: JSON.stringify({ analysisId }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          console.error(`[PHASE 1] run-pipeline-analyze returned ${response.status}: ${body.slice(0, 1000)}`);
        }
      })
      .catch((error) => {
        console.error("[PHASE 1] Failed to trigger run-pipeline-analyze:", error);
      });

    const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void } }).EdgeRuntime;
    if (edgeRuntime?.waitUntil) {
      edgeRuntime.waitUntil(phase2Promise);
    } else {
      phase2Promise.catch(() => {});
    }

    return new Response(JSON.stringify({ success: true, phase: "fetch_complete" }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Pipeline fetch error:", errorMessage);
    try {
      if (capturedAnalysisId) {
        const errSupabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceKey);
        await supabase.from("analyses").update({
          status: "failed",
          report_data: {
            error: "pipeline_fetch_error",
            message: errorMessage,
          },
          updated_at: new Date().toISOString(),
        }).eq("id", capturedAnalysisId);
      }
    } catch (_) {}
    return new Response(JSON.stringify({ error: "Pipeline fetch failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
