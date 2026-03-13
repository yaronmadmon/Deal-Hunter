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
      .filter((t: any) => t.like_count >= 1)
      .sort((a: any, b: any) => (b.like_count + b.retweet_count * 2) - (a.like_count + a.retweet_count * 2))
      .slice(0, 30);
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

  const validated: ValidatedCompetitor[] = [];

  for (const comp of competitors) {
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
async function productHuntSearch(
  apiKey: string,
  topic: string,
  first = 10,
  serperKey?: string | null
): Promise<{ products: any[] }> {
  // Strategy 1: PH GraphQL API — fetch top posts and filter by keyword
  if (apiKey) {
    // Strategy 1a: Topic-based query (more targeted discovery)
    try {
      const topicSlug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const topicQuery = `
        query {
          topic(slug: "${topicSlug}") {
            posts(first: 20) {
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
          const topicPosts = topicData.data.topic.posts.edges.map((e: any) => e.node);
          if (topicPosts.length > 0) {
            console.log(`[PRODUCT HUNT] Topic query "${topicSlug}" found ${topicPosts.length} products`);
            return {
              products: topicPosts.slice(0, first).map((p: any) => ({
                name: p.name,
                tagline: p.tagline,
                upvotes: p.votesCount,
                launchDate: p.createdAt,
                url: p.url || `https://www.producthunt.com/posts/${(p.name || "").toLowerCase().replace(/\s+/g, "-")}`,
                website: p.website,
              })),
            };
          }
        }
      }
    } catch (e) {
      console.warn("[PRODUCT HUNT] Topic query failed:", e);
    }

    // Strategy 1b: Global ranking with keyword filter (original approach)
    try {
      const query = `
        query {
          posts(order: RANKING, first: 20) {
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
          const allPosts = (data.data?.posts?.edges || []).map((e: any) => e.node);
          const kwLower = topic.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
          const matched = allPosts.filter((p: any) =>
            kwLower.some((kw: string) =>
              (p.name || "").toLowerCase().includes(kw) ||
              (p.tagline || "").toLowerCase().includes(kw)
            )
          );

          if (matched.length > 0) {
            console.log(`[PRODUCT HUNT] API found ${matched.length} products for "${topic}"`);
            return {
              products: matched.slice(0, first).map((p: any) => ({
                name: p.name,
                tagline: p.tagline,
                upvotes: p.votesCount,
                launchDate: p.createdAt,
                url: p.url || `https://www.producthunt.com/posts/${(p.name || "").toLowerCase().replace(/\s+/g, "-")}`,
                website: p.website,
              })),
            };
          }
          console.log(`[PRODUCT HUNT] API returned ${allPosts.length} posts but none matched "${topic}"`);
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

  // Strategy 2: Serper site:producthunt.com fallback
  if (serperKey) {
    try {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": serperKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: `${topic} site:producthunt.com`, num: Math.max(first, 10) }),
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

        if (products.length > 0) {
          console.log(`[PRODUCT HUNT] Serper fallback found ${products.length} products for "${topic}"`);
          return { products };
        }
      }
    } catch (e) {
      console.error("[PRODUCT HUNT] Serper fallback error:", e);
    }
  }

  console.log(`[PRODUCT HUNT] No results from API or Serper for "${topic}"`);
  return { products: [] };
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

    if (serperKey) {
      // Use semantic keywords for all Serper queries
      const serperKeywords = primaryKeywords;

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
          const r = await serperSearch(serperKey, serperKeywords, "news", 30);
          rawData.serperNews = r; rawData.sources.push(...r.organic.map((o: any) => ({ url: o.link, type: "serper" })));
          return r.organic.length;
        })
      );

      serperPromises.push(
        trackSource("serper_reddit", async () => {
          const r = await serperSearch(serperKey, `${serperKeywords} site:reddit.com`, "search", 30);
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
          }).sort((a: any, b: any) => (b.upvotes || 0) - (a.upvotes || 0)).slice(0, 5);
          rawData.productHunt = { products: unique };
          rawData.sources.push(...unique.map((p: any) => ({ url: p.url, type: "producthunt" })));
          return unique.length;
        })
      );
    }

    // Run GitHub search — use SEMANTIC keywords
    const githubPromises: Promise<void>[] = [];
    const ghSearches = semanticQueries.length >= 3
      ? semanticQueries.slice(0, 3)
      : [primaryKeywords];

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

    // Run Twitter/X searches in parallel — use SEMANTIC keywords
    const twitterPromises: Promise<void>[] = [];
    if (twitterBearerToken) {
      const twitterKeywords = primaryKeywords;

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

    // Run Hacker News search — use SEMANTIC keywords
    const hnPromises: Promise<void>[] = [];
    hnPromises.push(
      trackSource("hackernews", async () => {
        const r = await hackerNewsSearch(primaryKeywords, 10);
        rawData.hackerNews = r;
        rawData.sources.push(...r.hits.map((h: any) => ({ url: h.hnUrl, type: "hackernews" })));
        return r.hits.length;
      })
    );


    const fetchStart = Date.now();
    await Promise.all([...perplexityPromises, ...firecrawlPromises, ...serperPromises, ...productHuntPromises, ...githubPromises, ...twitterPromises, ...hnPromises]);
    const totalFetchDurationMs = Date.now() - fetchStart;

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
                const score = scores[idx] ?? 5; // default to 5 if missing
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

              // Inject as verified pricing signal
              evidenceBlock.pricingSignals.push({
                signal: `${comp.name} Pricing (scraped)`,
                value: `Plans: ${pricingData.planNames.join(", ") || "See page"}. Prices: ${pricingData.rawPrices.join(", ") || "Not extracted"}`,
                source: "Firecrawl Pricing Scrape",
                sourceUrl: pricingUrl,
                tier: "verified",
              });

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

    // ── Populate technical signals ──
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

    if (!openaiKey) {
      console.error("OPENAI_API_KEY not found");
      await supabase.from("analyses").update({ status: "failed" }).eq("id", analysisId);
      return new Response(JSON.stringify({ error: "AI key missing" }), { status: 500, headers: corsHeaders });
    }

    // ══════════════════════════════════════════════════════════════════
    // EVIDENCE-LOCKED CONTEXT: Pass structured evidence block to AI
    // instead of raw narrative summaries.
    // ══════════════════════════════════════════════════════════════════
    const evidenceContext = `
=== STRUCTURED EVIDENCE BLOCK ===
You may ONLY reference data from this evidence block. Do NOT infer, speculate, or fabricate data beyond what is listed here.

--- EVIDENCE CONFIDENCE LEVELS ---
${Object.entries(evidenceConfidences).map(([k, v]) => `${k}: ${v} (${(evidenceCoverage as any)[k]} signals)`).join("\n")}
Total evidence items: ${totalEvidence}

--- DEMAND SIGNALS (${evidenceBlock.demandSignals.length} items) ---
${evidenceBlock.demandSignals.length > 0
  ? evidenceBlock.demandSignals.map((s: any) => `[${s.tier.toUpperCase()}] ${s.signal}: ${s.value}\n  Source: ${s.source} | URL: ${s.sourceUrl || "none"}`).join("\n")
  : "NO DEMAND SIGNALS COLLECTED. You must state: 'Insufficient data to assess demand.'"}

--- TREND SIGNALS (${evidenceBlock.trendSignals.length} items) ---
${evidenceBlock.trendSignals.length > 0
  ? evidenceBlock.trendSignals.map((s: any) => `[${s.tier.toUpperCase()}] ${s.signal}: ${s.value.slice(0, 500)}\n  Source: ${s.source} | URL: ${s.sourceUrl || "none"}`).join("\n")
  : "NO TREND SIGNALS COLLECTED. You must state: 'Insufficient data to assess trends.'"}

--- VALIDATED COMPETITORS (${evidenceBlock.competitors.length} items) ---
${evidenceBlock.competitors.length > 0
  ? evidenceBlock.competitors.map((c: any) => `[${c.tier.toUpperCase()}] ${c.name}\n  Evidence: ${c.evidenceType} (score ${c.validationScore}/5)\n  Sources: ${c.sources.join(", ")}\n  Rating: ${c.rating || "N/A"} | Downloads: ${c.downloads || "N/A"}\n  URL: ${c.url || "N/A"}\n  Weakness: ${c.weakness || "N/A"}`).join("\n")
  : "NO VALIDATED COMPETITORS FOUND. You must state: 'No verified competitors identified. This may indicate a very niche or very new market.'"}

--- PRODUCT HUNT LAUNCHES (${evidenceBlock.productLaunchSignals.length} items) ---
${evidenceBlock.productLaunchSignals.length > 0
  ? evidenceBlock.productLaunchSignals.map((p: any) => `[VERIFIED] ${p.name}: ${p.tagline}\n  Upvotes: ${p.upvotes} | Launch: ${p.launchDate} | URL: ${p.url}`).join("\n")
  : "NO PRODUCT HUNT LAUNCHES FOUND."}

--- DEVELOPER SIGNALS (${evidenceBlock.developerSignals.length} items) ---
${evidenceBlock.developerSignals.length > 0
  ? evidenceBlock.developerSignals.map((r: any) => `[VERIFIED] ${r.repo}: ${r.stars} stars, ${r.forks} forks\n  Language: ${r.language} | Last push: ${r.lastPush} | URL: ${r.url}`).join("\n")
  : "NO GITHUB REPOS FOUND."}

--- SENTIMENT SIGNALS (${evidenceBlock.sentimentSignals.length} items) ---
${evidenceBlock.sentimentSignals.length > 0
  ? evidenceBlock.sentimentSignals.map((s: any) => `[${s.tier.toUpperCase()}] (${s.platform}) ${s.text.slice(0, 300)}\n  Source: ${s.source} | Engagement: ${s.engagement} | URL: ${s.sourceUrl || "none"}`).join("\n")
  : "NO SENTIMENT SIGNALS COLLECTED. You must state: 'Insufficient data to assess user sentiment.'"}

--- PRICING / REVENUE SIGNALS (${evidenceBlock.pricingSignals.length} items) ---
${evidenceBlock.pricingSignals.length > 0
  ? evidenceBlock.pricingSignals.map((s: any) => `[${s.tier.toUpperCase()}] ${s.signal}: ${s.value.slice(0, 500)}\n  Source: ${s.source} | URL: ${s.sourceUrl || "none"}`).join("\n")
  : "NO PRICING SIGNALS COLLECTED. You must state: 'Insufficient data to estimate revenue.'"}

--- TECHNICAL / BUILD SIGNALS (${evidenceBlock.technicalSignals.length} items) ---
${evidenceBlock.technicalSignals.length > 0
  ? evidenceBlock.technicalSignals.map((s: any) => `[${s.tier.toUpperCase()}] ${s.signal}: ${s.value.slice(0, 500)}\n  Source: ${s.source} | URL: ${s.sourceUrl || "none"}`).join("\n")
  : "NO TECHNICAL SIGNALS COLLECTED."}

--- SEARCH QUERIES USED ---
Primary keywords: "${primaryKeywords}"
Semantic queries: ${JSON.stringify(semanticQueries)}
`;

    // ── PERPLEXITY DOMINANCE CHECK ──
    // Count how many Tier 1 sources returned data vs Perplexity-only
    const tier1SourcesWithData = [
      rawData.firecrawlAppStore?.results?.length > 0,
      rawData.firecrawlReddit?.results?.length > 0,
      rawData.serperTrends?.organic?.length > 0,
      rawData.serperCompetitors?.allResults?.length > 0,
      rawData.github?.repos?.length > 0,
      rawData.productHunt?.products?.length > 0,
    ].filter(Boolean).length;

    const perplexitySourcesWithData = [
      rawData.perplexityTrends?.content,
      rawData.perplexityMarket?.content,
      rawData.perplexityVC?.content,
      rawData.perplexityRevenue?.content,
      rawData.perplexityChurn?.content,
      rawData.perplexityBuildCosts?.content,
      rawData.perplexityCompetitors?.content,
    ].filter(Boolean).length;

    let perplexityDominanceWarning = "";
    if (tier1SourcesWithData <= 2 && perplexitySourcesWithData >= 4) {
      perplexityDominanceWarning = `
[CRITICAL DATA QUALITY WARNING]
Only ${tier1SourcesWithData} Tier 1 sources (Firecrawl, Serper, GitHub, Product Hunt) returned data, while ${perplexitySourcesWithData} Perplexity queries returned data.
This means the analysis is heavily dependent on Perplexity-synthesized information rather than primary evidence.
You MUST:
1. Set overall report confidence to "Low"
2. Flag any metric derived solely from Perplexity as "reported" not "verified"
3. Explicitly state in the scoreExplanation that primary evidence is thin
4. Do NOT give high scores to categories where only Perplexity data exists
`;
      console.warn(`[PERPLEXITY DOMINANCE] Only ${tier1SourcesWithData} Tier 1 sources vs ${perplexitySourcesWithData} Perplexity sources. Injecting dominance warning.`);
    }

    const fullContext = evidenceContext + perplexityDominanceWarning;

    // Unique source URLs for the report
    const uniqueSources = [...new Set(rawData.sources.map((s: any) => s.url).filter(Boolean))];

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are the AI analysis engine for Gold Rush, a market validation platform for app developers.

Your job is to produce a structured JSON report that is:
- Brutally honest (do not hype ideas)
- Simple enough for a non-technical founder to act on immediately
- 100% grounded in the real data provided — never invent statistics

═══════════════════════════════════════
EVIDENCE-LOCKED ANALYSIS RULES (HIGHEST PRIORITY)
═══════════════════════════════════════

You are receiving a STRUCTURED EVIDENCE BLOCK containing only verified and reported signals collected from real data sources.

MANDATORY RULES:
1. You may ONLY make claims supported by evidence in the provided evidence block.
2. If evidence does not exist for a claim, you MUST respond with: "Insufficient data to support this conclusion."
3. Do NOT infer beyond what the evidence shows.
4. Do NOT speculate about market size, revenue, or competitors beyond what is provided.
5. Do NOT estimate metrics when no evidence exists — use "Insufficient data" instead.
6. Do NOT fabricate competitor names, ratings, downloads, or any product data.
7. Only reference signals that appear in the evidence block.

CITED INSIGHTS RULE:
Every insight you generate MUST reference specific evidence from the block. Format:
- Insight: "[Your conclusion]"
- Evidence: "[Specific signal from the evidence block]"
If no evidence supports an insight, write: "Evidence: Insufficient data."

SECTION CONFIDENCE RULES (enforced by evidence counts):
- HIGH confidence → 3+ evidence signals available
- MEDIUM confidence → 2 signals available
- LOW confidence → 1 signal available
- INSUFFICIENT → 0 signals → section must explicitly state "Insufficient data to assess [topic]"

The evidence block header shows confidence levels per category. You MUST respect these. Do NOT assign HIGH confidence to a section with INSUFFICIENT evidence.

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
  "scoreExplanationData": {"summary": "1-2 sentences", "factors": [{"category": "Demand Strength", "explanation": "narrative must match score"}, {"category": "Competition Density", "explanation": "string"}, {"category": "User Sentiment", "explanation": "string"}, {"category": "Market Growth", "explanation": "string"}, {"category": "Opportunity Gap", "explanation": "if <=10, explain weakness clearly"}], "confidence": "Medium"},
  "founderInsight": {
    "summary": "200-300 word plain-English narrative explaining what the signals in the report may indicate when viewed together. Use neutral observational language like 'The signals suggest...', 'This pattern could indicate...', 'The data appears to show...'. Explain whether interest appears growing or stable, whether the market appears crowded or emerging, what sentiment signals indicate about user satisfaction, whether the category appears validated by existing products. Do NOT recommend building. Do NOT predict success. ONLY interpret patterns in the data.",
    "marketReality": "2-4 sentences — explain whether signals suggest people recognize the problem and are looking for solutions.",
    "competitivePressure": "2-4 sentences — explain whether the presence of competitors suggests an active or crowded market.",
    "possibleGaps": "2-4 sentences — describe areas where user sentiment or competitor signals may indicate unmet needs.",
    "signalInterpretation": "2-4 sentences — provide a balanced interpretation of what the combined signals may indicate about market dynamics.",
    "confidence": "High/Medium/Low"
  }
}

CRITICAL REMINDERS:
- If evidence does not exist for a section, set dataSource to "ai_estimated", dataTier to "estimated", sourceUrl to null, signalNote to "Insufficient data — no evidence collected for this metric."
- Never present estimated data as if from a real source.
- Score honestly. Narrative MUST match scores. Bullish text under low scores is forbidden.
- If BOTH search demand AND pain signals are weak (<5 corroborating signals), cap Opportunity at 10/20.
- Return ONLY the JSON, no markdown formatting.
- If a section has 0 evidence signals, its confidence MUST be "Low" and insights must state "Insufficient data."

EVIDENCE-LOCKED SECTION RULES:
- Competitor Snapshot: If evidence.competitors is empty → competitors array must be empty, insight must say "No verified competitors identified."
- Sentiment & Pain Points: If evidence.sentimentSignals is empty → complaints and loves must be empty, insight must say "Insufficient sentiment data."
- Growth Signals: If evidence.productLaunchSignals AND evidence.developerSignals are both empty → metrics must show "N/A", insight must say "Insufficient growth data."
- Trend Momentum: If evidence.demandSignals AND evidence.trendSignals are both empty → metrics must show "N/A", insight must say "Insufficient trend data."
- Revenue / Unit Economics: If evidence.pricingSignals is empty → mark all values as "Insufficient data", dataSource as "ai_estimated".

SOURCE CREDIBILITY WEIGHTING (apply when analyzing evidence):
Weight evidence in this order of trust:
1. Firecrawl app store scrapes (direct product data) — HIGHEST weight
2. Serper Google search results (real search data) — HIGH weight
3. Product Hunt launches (real launch data) — HIGH weight
4. GitHub repos (real developer activity) — MEDIUM weight (only relevant for dev tools)
5. X/Twitter data (real social signals) — MEDIUM weight (short timeframe)
6. Perplexity Sonar summaries (AI-synthesized) — LOW weight for conclusions, useful for context only
7. Hacker News (developer bias) — LOW weight for consumer apps

Never let Perplexity summaries override contradicting Tier 1 evidence. If Perplexity says "large market" but Firecrawl finds 0 apps and Serper finds 0 competitors, trust the Tier 1 evidence.`,
          },
          {
            role: "user",
            content: `Analyze this startup idea: "${idea}"\n\nHere is the structured evidence block collected from real data sources:\n${fullContext}`,
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

        if (!reportData) {
          throw new Error("AI response JSON parsing failed");
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
        // DETERMINISTIC SIGNAL-COUNT FLOORS & CEILINGS
        // Each scoring category has a max score (ceiling) based on how
        // many real signals were collected. No data = low ceiling.
        // ══════════════════════════════════════════════════════════════
        if (reportData.scoreBreakdown && Array.isArray(reportData.scoreBreakdown)) {
          // Count signals per category from rawData
          const trendSignals =
            (rawData.serperTrends?.organic?.length ?? 0) +
            (rawData.serperTrendsMonthly?.organic?.length ?? 0) +
            (rawData.serperNews?.organic?.length ?? 0) +
            (rawData.perplexityTrends?.citations?.length ?? 0);

          const marketSignals =
            (rawData.firecrawlAppStore?.results?.length ?? 0) +
            (rawData.serperCompetitors?.allResults?.length ?? 0) +
            (rawData.validatedCompetitors?.length ?? 0) +
            (rawData.perplexityMarket?.citations?.length ?? 0);

          const sentimentSignals =
            (rawData.firecrawlReddit?.results?.length ?? 0) +
            (rawData.serperReddit?.organic?.length ?? 0) +
            (rawData.twitterSentiment?.tweets?.length ?? 0) +
            (rawData.hackerNews?.hits?.length ?? 0);

          const growthSignals =
            (rawData.productHunt?.products?.length ?? 0) +
            (rawData.github?.repos?.length ?? 0) +
            (rawData.perplexityVC?.citations?.length ?? 0) +
            (rawData.hackerNews?.hits?.length ?? 0);

          const opportunitySignals =
            (rawData.serperAutoComplete?.suggestions?.length ?? 0) +
            (rawData.perplexityRevenue?.citations?.length ?? 0) +
            (rawData.perplexityChurn?.citations?.length ?? 0) +
            demandSignalCount + painSignalCount;

          // Ceiling rules: 0 signals → max 5/20, 1-2 → max 10/20, 3-4 → max 15/20, 5+ → no cap
          const computeCeiling = (signalCount: number): number => {
            if (signalCount === 0) return 5;
            if (signalCount <= 2) return 10;
            if (signalCount <= 4) return 15;
            return 20;
          };

          // Floor rules: 5-9 signals → min 8/20, 10+ signals → min 12/20
          const computeFloor = (signalCount: number): number => {
            if (signalCount >= 10) return 12;
            if (signalCount >= 5) return 8;
            return 0;
          };

          const ceilingMap: Record<string, number> = {
            "Trend Momentum": computeCeiling(trendSignals),
            "Market Saturation": computeCeiling(marketSignals),
            "Sentiment": computeCeiling(sentimentSignals),
            "Growth": computeCeiling(growthSignals),
            "Opportunity": computeCeiling(opportunitySignals),
          };

          const floorMap: Record<string, number> = {
            "Trend Momentum": computeFloor(trendSignals),
            "Market Saturation": computeFloor(marketSignals),
            "Sentiment": computeFloor(sentimentSignals),
            "Growth": computeFloor(growthSignals),
            "Opportunity": computeFloor(opportunitySignals),
          };

          let ceilingApplied = false;
          let floorApplied = false;
          for (const category of reportData.scoreBreakdown) {
            const ceiling = ceilingMap[category.label];
            const floor = floorMap[category.label];
            const signalCount = category.label === "Trend Momentum" ? trendSignals :
              category.label === "Market Saturation" ? marketSignals :
              category.label === "Sentiment" ? sentimentSignals :
              category.label === "Growth" ? growthSignals : opportunitySignals;

            // Apply ceiling (cap overscoring)
            if (ceiling !== undefined && Number(category.value) > ceiling) {
              console.warn(`[SIGNAL CEILING] ${category.label}: only ${signalCount} signals → ceiling ${ceiling}/20. Capping from ${category.value}.`);
              category.value = ceiling;
              ceilingApplied = true;
            }

            // Apply floor (prevent underscoring strong evidence)
            if (floor !== undefined && floor > 0 && Number(category.value) < floor) {
              console.warn(`[SIGNAL FLOOR] ${category.label}: ${signalCount} signals → floor ${floor}/20. Raising from ${category.value}.`);
              category.value = floor;
              floorApplied = true;
            }
          }

          if (ceilingApplied || floorApplied) {
            const newSum = reportData.scoreBreakdown.reduce((sum: number, cat: any) => sum + (Number(cat.value) || 0), 0);
            console.warn(`[SIGNAL BOUNDS] Overall score adjusted: ${reportData.overallScore} -> ${newSum} (ceilings: ${ceilingApplied}, floors: ${floorApplied})`);
            reportData.overallScore = newSum;

            const boundScore = reportData.overallScore;
            const boundVerdict = boundScore >= 75 ? "Build Now"
              : boundScore >= 55 ? "Build, But Niche Down"
              : boundScore >= 40 ? "Validate Further"
              : "Do Not Build Yet";
            if (reportData.founderDecision) {
              reportData.founderDecision.decision = boundVerdict;
            }
            reportData.signalStrength = boundScore >= 70 ? "Strong" : boundScore >= 45 ? "Moderate" : "Weak";
          }

          console.log(`[SIGNAL COUNTS] Trend: ${trendSignals}, Market: ${marketSignals}, Sentiment: ${sentimentSignals}, Growth: ${growthSignals}, Opportunity: ${opportunitySignals}`);
          console.log(`[SIGNAL CEILINGS] Trend: ${ceilingMap["Trend Momentum"]}, Market: ${ceilingMap["Market Saturation"]}, Sentiment: ${ceilingMap["Sentiment"]}, Growth: ${ceilingMap["Growth"]}, Opportunity: ${ceilingMap["Opportunity"]}`);
          console.log(`[SIGNAL FLOORS] Trend: ${floorMap["Trend Momentum"]}, Market: ${floorMap["Market Saturation"]}, Sentiment: ${floorMap["Sentiment"]}, Growth: ${floorMap["Growth"]}, Opportunity: ${floorMap["Opportunity"]}`);
        }

        // ══════════════════════════════════════════════════════════════
        // COMPETITOR COUNT VALIDATION (uses validated competitors)
        // Cross-check: if AI says 0 competitors but validated pipeline
        // found real products, flag inconsistency and lower confidence.
        // ══════════════════════════════════════════════════════════════
        const validatedCount = rawData.validatedCompetitors?.length ?? 0;
        const competitorDiscoveryCount = rawData.serperCompetitors?.allResults?.length ?? 0;
        const aiCompetitorCount = reportData.nicheAnalysis?.directCompetitors ?? -1;
        const competitorSnapshotCard = (reportData.signalCards || []).find((c: any) => c.title === "Competitor Snapshot");
        const aiCompetitorListCount = competitorSnapshotCard?.competitors?.length ?? 0;

        if (aiCompetitorCount === 0 && (validatedCount >= 1 || competitorDiscoveryCount >= 3 || aiCompetitorListCount > 0)) {
          console.warn(`[COMPETITOR VALIDATION] AI reported 0 direct competitors but validated pipeline found ${validatedCount} real products (discovery: ${competitorDiscoveryCount}, snapshot: ${aiCompetitorListCount}). Correcting.`);

          // Fix the niche analysis competitor count — use validated count as ground truth
          if (reportData.nicheAnalysis) {
            reportData.nicheAnalysis.directCompetitors = Math.max(validatedCount, aiCompetitorListCount, Math.min(competitorDiscoveryCount, 5));
            reportData.nicheAnalysis.competitorClarity = `[AUTO-CORRECTED] Originally reported 0 competitors, but ${validatedCount} validated real products were found. ${reportData.nicheAnalysis.competitorClarity || ""}`;
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

        // Also validate: if validated competitors found many but AI only lists 1-2
        if (validatedCount >= 5 && aiCompetitorListCount <= 1 && competitorSnapshotCard) {
          console.warn(`[COMPETITOR VALIDATION] Validated pipeline found ${validatedCount} real products but AI only listed ${aiCompetitorListCount} competitors. Flagging.`);
          if (competitorSnapshotCard.confidence !== "Low") {
            competitorSnapshotCard.confidence = "Medium";
          }
          competitorSnapshotCard.insight = `${competitorSnapshotCard.insight || ""} [Note: ${validatedCount} validated competitors were found — more competitors may exist than listed.]`.trim();
        }

        console.log(`[COMPETITOR VALIDATION] AI competitors: ${aiCompetitorCount}, Validated: ${validatedCount}, Discovery: ${competitorDiscoveryCount}, Snapshot: ${aiCompetitorListCount}`);

        // ══════════════════════════════════════════════════════════════
        // DATA QUALITY PENALTY
        // If >50% of metrics in a scoring category are "estimated",
        // reduce that category's score by 30%.
        // ══════════════════════════════════════════════════════════════
        const categoryToCardTitle: Record<string, string> = {
          "Trend Momentum": "Trend Momentum",
          "Market Saturation": "Market Saturation",
          "Sentiment": "Sentiment & Pain Points",
          "Growth": "Growth Signals",
          "Opportunity": "Competitor Snapshot",
        };

        if (reportData.scoreBreakdown && Array.isArray(reportData.scoreBreakdown)) {
          let penaltyApplied = false;
          for (const category of reportData.scoreBreakdown) {
            const cardTitle = categoryToCardTitle[category.label];
            const card = (reportData.signalCards || []).find((c: any) => c.title === cardTitle);
            if (!card) continue;

            const metrics = card.metrics || card.competitors || [];
            const totalMetrics = metrics.length;
            if (totalMetrics === 0) continue;

            const estimatedCount = metrics.filter((m: any) => 
              m.dataTier === "estimated" || m.dataSource === "ai_estimated"
            ).length;

            if (totalMetrics > 0 && estimatedCount / totalMetrics > 0.5) {
              const originalValue = Number(category.value) || 0;
              const penalty = Math.round(originalValue * 0.3);
              category.value = originalValue - penalty;
              penaltyApplied = true;
              console.warn(`[DATA QUALITY PENALTY] ${category.label}: ${estimatedCount}/${totalMetrics} metrics estimated. Score reduced by ${penalty} (${originalValue} -> ${category.value})`);
              if (card.confidence !== "Low") {
                card.confidence = "Low";
              }
            }
          }

          if (penaltyApplied) {
            const newSum = reportData.scoreBreakdown.reduce((sum: number, cat: any) => sum + (Number(cat.value) || 0), 0);
            console.warn(`[DATA QUALITY PENALTY] Overall score adjusted: ${reportData.overallScore} -> ${newSum}`);
            reportData.overallScore = newSum;

            const penaltyScore = reportData.overallScore;
            const penaltyVerdict = penaltyScore >= 75 ? "Build Now"
              : penaltyScore >= 55 ? "Build, But Niche Down"
              : penaltyScore >= 40 ? "Validate Further"
              : "Do Not Build Yet";
            if (reportData.founderDecision) {
              reportData.founderDecision.decision = penaltyVerdict;
            }
            reportData.signalStrength = penaltyScore >= 70 ? "Strong" : penaltyScore >= 45 ? "Moderate" : "Weak";
          }
        }

        // Perplexity dominance: flag low confidence if triggered
        if (perplexityDominanceWarning && reportData.methodology) {
          reportData.methodology.confidenceNote = `[LOW CONFIDENCE] Only ${tier1SourcesWithData} primary evidence sources returned data. Report relies heavily on AI-synthesized information. ${reportData.methodology.confidenceNote || ""}`.trim();
        }

        // ══════════════════════════════════════════════════════════════
        // EVIDENCE-LOCKED SECTION VALIDATION
        // Enforce that sections without evidence are properly flagged.
        // This runs AFTER AI generation to catch any hallucinations.
        // ══════════════════════════════════════════════════════════════
        const evidenceValidations: string[] = [];

        // Validate Competitor Snapshot against evidence
        const compCard = (reportData.signalCards || []).find((c: any) => c.title === "Competitor Snapshot");
        if (compCard && evidenceBlock.competitors.length === 0) {
          if (compCard.competitors?.length > 0) {
            evidenceValidations.push(`Competitor Snapshot: AI generated ${compCard.competitors.length} competitors but evidence block has 0. Flagging as Low confidence.`);
            compCard.confidence = "Low";
            compCard.insight = "Insufficient verified competitor data. Listed competitors may not be validated. " + (compCard.insight || "");
          }
        }

        // Validate Sentiment section
        const sentCard = (reportData.signalCards || []).find((c: any) => c.title === "Sentiment & Pain Points");
        if (sentCard && evidenceBlock.sentimentSignals.length === 0) {
          sentCard.confidence = "Low";
          sentCard.insight = "Insufficient sentiment data collected. " + (sentCard.insight || "");
          if (sentCard.sentiment) {
            sentCard.sentiment.emotion = "Insufficient data";
          }
          evidenceValidations.push("Sentiment: 0 evidence signals — forced Low confidence.");
        }

        // Validate Growth Signals
        const growthCard = (reportData.signalCards || []).find((c: any) => c.title === "Growth Signals");
        if (growthCard && evidenceBlock.productLaunchSignals.length === 0 && evidenceBlock.developerSignals.length === 0) {
          growthCard.confidence = "Low";
          growthCard.insight = "Insufficient growth data. " + (growthCard.insight || "");
          evidenceValidations.push("Growth: 0 launch + 0 developer signals — forced Low confidence.");
        }

        // Validate Trend Momentum
        const trendCard = (reportData.signalCards || []).find((c: any) => c.title === "Trend Momentum");
        if (trendCard && evidenceBlock.demandSignals.length === 0 && evidenceBlock.trendSignals.length === 0) {
          trendCard.confidence = "Low";
          trendCard.insight = "Insufficient trend data. " + (trendCard.insight || "");
          evidenceValidations.push("Trends: 0 demand + 0 trend signals — forced Low confidence.");
        }

        // Validate Revenue / Unit Economics
        if (reportData.unitEconomics && evidenceBlock.pricingSignals.length === 0) {
          reportData.unitEconomics.dataSource = "ai_estimated";
          reportData.unitEconomics.sourceUrls = [];
          evidenceValidations.push("Unit Economics: 0 pricing signals — marked as ai_estimated.");
        }
        if (reportData.revenueBenchmark && evidenceBlock.pricingSignals.length === 0) {
          reportData.revenueBenchmark.dataSource = "ai_estimated";
          reportData.revenueBenchmark.sourceUrls = [];
          evidenceValidations.push("Revenue Benchmark: 0 pricing signals — marked as ai_estimated.");
        }

        // Inject evidence lock metadata into report
        reportData.evidenceLock = {
          coverage: evidenceCoverage,
          confidences: evidenceConfidences,
          totalEvidence,
          validations: evidenceValidations,
        };

        // ══════════════════════════════════════════════════════════════
        // POST-AI DATATIER INTEGRITY VALIDATION
        // Scan all metrics/sections: if dataTier === "verified" but
        // sourceUrl is null/empty, auto-downgrade to "estimated".
        // ══════════════════════════════════════════════════════════════
        let dataTierDowngrades = 0;

        const downgradeIfMissingUrl = (obj: any, path: string) => {
          if (!obj || typeof obj !== "object") return;

          // Check this object itself
          if (obj.dataTier === "verified" && !obj.sourceUrl) {
            obj.dataTier = "estimated";
            obj.signalNote = (obj.signalNote || "") + " [Auto-downgraded: no source URL for verified claim]";
            dataTierDowngrades++;
            console.warn(`[DATATIER FIX] ${path}: downgraded "verified" → "estimated" (no sourceUrl)`);
          }

          // Recurse into arrays
          if (Array.isArray(obj)) {
            obj.forEach((item: any, i: number) => downgradeIfMissingUrl(item, `${path}[${i}]`));
            return;
          }

          // Recurse into known nested structures
          for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (Array.isArray(val)) {
              val.forEach((item: any, i: number) => downgradeIfMissingUrl(item, `${path}.${key}[${i}]`));
            } else if (val && typeof val === "object" && val.dataTier) {
              downgradeIfMissingUrl(val, `${path}.${key}`);
            }
          }
        };

        // Scan signal cards (metrics, competitors)
        (reportData.signalCards || []).forEach((card: any, ci: number) => {
          (card.metrics || []).forEach((m: any, mi: number) => downgradeIfMissingUrl(m, `signalCards[${ci}].metrics[${mi}]`));
          (card.competitors || []).forEach((c: any, ci2: number) => downgradeIfMissingUrl(c, `signalCards[${ci}].competitors[${ci2}]`));
        });

        // Scan top-level report sections
        for (const sectionKey of ["unitEconomics", "revenueBenchmark", "nicheAnalysis", "buildComplexity", "appStoreIntelligence", "keywordDemand", "proofDashboard"]) {
          if (reportData[sectionKey]) {
            downgradeIfMissingUrl(reportData[sectionKey], sectionKey);
          }
        }

        if (dataTierDowngrades > 0) {
          evidenceValidations.push(`DataTier integrity: ${dataTierDowngrades} "verified" claims downgraded to "estimated" (missing sourceUrl)`);
          console.warn(`[DATATIER FIX] Total downgrades: ${dataTierDowngrades}`);
        }

        if (evidenceValidations.length > 0) {
          console.warn(`[EVIDENCE LOCK] Post-AI validations applied: ${evidenceValidations.join(" | ")}`);
        }

        // ══════════════════════════════════════════════════════════════
        // IMPROVEMENT #8: CONFLICTING SIGNAL DETECTION
        // Detect contradictions between sources and surface them.
        // ══════════════════════════════════════════════════════════════
        const conflictingSignals: { signalA: string; sourceA: string; signalB: string; sourceB: string; category: string }[] = [];

        // Check: Search trends vs Twitter volume
        const searchTrendUp = (rawData.serperTrends?.organic?.length ?? 0) >= 3;
        const twitterVolumeDown = rawData.twitterCounts?.volume_change_pct < -20;
        const twitterVolumeUp = rawData.twitterCounts?.volume_change_pct > 20;
        const searchTrendWeak = (rawData.serperTrends?.organic?.length ?? 0) <= 1;
        if (searchTrendUp && twitterVolumeDown) {
          conflictingSignals.push({
            signalA: `${rawData.serperTrends.organic.length} Google search results found (active search interest)`,
            sourceA: "Serper Google Search",
            signalB: `Twitter volume declined ${rawData.twitterCounts.volume_change_pct}% over 7 days`,
            sourceB: "X API v2",
            category: "Demand",
          });
        }
        if (searchTrendWeak && twitterVolumeUp) {
          conflictingSignals.push({
            signalA: `Only ${rawData.serperTrends?.organic?.length ?? 0} Google search results (weak search interest)`,
            sourceA: "Serper Google Search",
            signalB: `Twitter volume grew +${rawData.twitterCounts.volume_change_pct}% over 7 days`,
            sourceB: "X API v2",
            category: "Demand",
          });
        }

        // Check: High app ratings vs many complaints in Reddit/HN
        const avgRating = (() => {
          const ratings = (rawData.validatedCompetitors || [])
            .map((c: any) => parseFloat(String(c.rating || "0")))
            .filter((r: number) => r > 0);
          return ratings.length > 0 ? ratings.reduce((s: number, r: number) => s + r, 0) / ratings.length : 0;
        })();
        const complaintCount = (rawData.firecrawlReddit?.results?.length ?? 0) + (rawData.serperReddit?.organic?.length ?? 0);
        if (avgRating >= 4.0 && complaintCount >= 5) {
          conflictingSignals.push({
            signalA: `Competitors average ${avgRating.toFixed(1)} star rating (high satisfaction)`,
            sourceA: "App Store / Firecrawl",
            signalB: `${complaintCount} Reddit/forum threads with complaints found`,
            sourceB: "Reddit via Firecrawl + Serper",
            category: "Sentiment",
          });
        }

        // Check: Many competitors found vs low market saturation score
        const satEntry = reportData.scoreBreakdown?.find((b: any) => b.label === "Market Saturation");
        if ((rawData.validatedCompetitors?.length ?? 0) >= 5 && satEntry && Number(satEntry.value) >= 15) {
          conflictingSignals.push({
            signalA: `${rawData.validatedCompetitors.length} validated competitors in market`,
            sourceA: "Competitor Pipeline",
            signalB: `Market Saturation scored ${satEntry.value}/20 (suggests opportunity)`,
            sourceB: "AI Analysis",
            category: "Competition",
          });
        }

        // Check: GitHub buzz vs no Product Hunt presence
        const ghStars = (rawData.github?.repos || []).reduce((s: number, r: any) => s + (r.stars || 0), 0);
        const phProducts = rawData.productHunt?.products?.length ?? 0;
        if (ghStars > 1000 && phProducts === 0) {
          conflictingSignals.push({
            signalA: `${ghStars} total GitHub stars (strong developer interest)`,
            sourceA: "GitHub API",
            signalB: "No Product Hunt launches found (weak consumer visibility)",
            sourceB: "Product Hunt",
            category: "Growth",
          });
        }

        if (conflictingSignals.length > 0) {
          reportData.conflictingSignals = conflictingSignals;
          console.log(`[CONFLICTING SIGNALS] Detected ${conflictingSignals.length} conflicts: ${conflictingSignals.map(c => c.category).join(", ")}`);
        }

        // ══════════════════════════════════════════════════════════════
        // IMPROVEMENT #9: PERPLEXITY DOMINANCE — CODE ENFORCEMENT
        // Calculate actual source attribution percentages post-generation
        // and inject a warning if Perplexity dominates >60%.
        // ══════════════════════════════════════════════════════════════
        const sourceAttribution = { perplexity: 0, tier1: 0, total: 0 };
        (reportData.signalCards || []).forEach((card: any) => {
          const allMetrics = [...(card.metrics || []), ...(card.competitors || [])];
          allMetrics.forEach((m: any) => {
            sourceAttribution.total++;
            const ds = (m.dataSource || "").toLowerCase();
            if (ds.includes("perplexity") || ds === "ai_estimated") {
              sourceAttribution.perplexity++;
            } else {
              sourceAttribution.tier1++;
            }
          });
        });

        const perplexityPct = sourceAttribution.total > 0
          ? Math.round((sourceAttribution.perplexity / sourceAttribution.total) * 100)
          : 0;

        let perplexityDominanceBanner: { percentage: number; message: string } | null = null;
        if (perplexityPct > 60) {
          perplexityDominanceBanner = {
            percentage: perplexityPct,
            message: `${perplexityPct}% of report metrics trace back to AI-synthesized data (Perplexity or estimates). This report would benefit from more primary evidence. Consider validating key claims independently.`,
          };
          console.warn(`[PERPLEXITY DOMINANCE] ${perplexityPct}% of ${sourceAttribution.total} metrics are Perplexity/estimated. Injecting warning banner.`);
          evidenceValidations.push(`Perplexity dominance: ${perplexityPct}% of metrics are AI-synthesized.`);
        }

        // ══════════════════════════════════════════════════════════════
        // IMPROVEMENT #10: FALLBACK GAP FLAGGING
        // Track which primary data sources returned empty/error and
        // inject warnings into the relevant signal card sections.
        // ══════════════════════════════════════════════════════════════
        const sourceToCardMapping: Record<string, string> = {
          "firecrawl_appstore": "Market Saturation",
          "firecrawl_reddit": "Sentiment & Pain Points",
          "serper_trends": "Trend Momentum",
          "serper_news": "Trend Momentum",
          "twitter_sentiment": "Sentiment & Pain Points",
          "twitter_counts": "Trend Momentum",
          "producthunt": "Growth Signals",
          "github": "Growth Signals",
          "hackernews": "Sentiment & Pain Points",
          "perplexity_market": "Market Saturation",
          "perplexity_trends": "Trend Momentum",
          "perplexity_competitors": "Competitor Snapshot",
        };

        const fallbackGaps: { section: string; failedSource: string; status: string }[] = [];
        for (const [sourceName, metrics] of Object.entries(pipelineMetrics)) {
          const m = metrics as { status: string; signalCount: number };
          if (m.status === "error" || m.signalCount === 0) {
            const section = sourceToCardMapping[sourceName];
            if (section) {
              fallbackGaps.push({ section, failedSource: sourceName, status: m.status });
            }
          }
        }

        // Inject fallback warnings into relevant signal cards
        if (fallbackGaps.length > 0) {
          const gapsBySection = new Map<string, string[]>();
          for (const gap of fallbackGaps) {
            const existing = gapsBySection.get(gap.section) || [];
            existing.push(gap.failedSource.replace(/_/g, " "));
            gapsBySection.set(gap.section, existing);
          }

          for (const card of (reportData.signalCards || [])) {
            const gaps = gapsBySection.get(card.title);
            if (gaps && gaps.length > 0) {
              card.fallbackWarning = `Primary source(s) unavailable: ${gaps.join(", ")}. Data in this section may be estimated from secondary sources.`;
              console.log(`[FALLBACK GAP] ${card.title}: ${gaps.join(", ")} returned empty/error`);
            }
          }

          reportData.fallbackGaps = fallbackGaps;
          console.log(`[FALLBACK GAPS] ${fallbackGaps.length} gaps flagged across ${gapsBySection.size} sections`);
        }

        // Log validation summary
        console.log(`[VALIDATION COMPLETE] Score: ${reportData.overallScore}, Verdict: ${reportData.founderDecision?.decision}, Signal: ${reportData.signalStrength}, Demand signals: ${demandSignalCount}, Pain signals: ${painSignalCount}, Evidence: ${totalEvidence}, Conflicts: ${conflictingSignals.length}, Perplexity%: ${perplexityPct}, FallbackGaps: ${fallbackGaps.length}`);

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
      } else {
        throw new Error("AI response did not contain valid JSON payload");
      }
    } else {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      const isCreditsExhausted = aiResponse.status === 402 || errText.includes("Not enough credits") || errText.includes("payment_required");
      const isRateLimit = aiResponse.status === 429 || errText.includes("rate limit");
      const userMessage = isCreditsExhausted
        ? "AI service temporarily unavailable. Please try again in a few minutes."
        : isRateLimit
        ? "Rate limit reached. Please try again in a minute."
        : "Report generation failed due to an AI service error. Please retry.";
      const errorCode = isCreditsExhausted ? "ai_credits_exhausted" : isRateLimit ? "ai_rate_limit" : "ai_gateway_error";
      await supabase.from("analyses").update({
        status: "failed",
        report_data: {
          error: errorCode,
          message: userMessage,
          status: aiResponse.status,
          details: errText?.slice(0, 4000) || null,
        },
        updated_at: new Date().toISOString(),
      }).eq("id", analysisId);
      return new Response(JSON.stringify({ error: userMessage, code: errorCode }), {
        status: isRateLimit ? 429 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Inject pipeline metrics into report for debugging ──
    if (reportData) {
      reportData.pipelineMetrics = {
        totalFetchDurationMs,
        totalSignals,
        failedSources,
        sources: pipelineMetrics,
        semanticQueries,
        primaryKeywords,
        perplexityDominance: perplexityDominanceWarning ? { tier1Sources: tier1SourcesWithData, perplexitySources: perplexitySourcesWithData, warning: true } : null,
        relevanceFilter: rawData.relevanceFilterStats || null,
        competitorPipeline: {
          rawCount: rawData.rawCompetitors?.length ?? 0,
          normalizedCount: rawData.normalizedCompetitors?.length ?? 0,
          validatedCount: rawData.validatedCompetitors?.length ?? 0,
          validatedCompetitors: (rawData.validatedCompetitors || []).map((c: any) => ({
            name: c.name,
            evidenceType: c.evidenceType,
            validationScore: c.validationScore,
            confidenceScore: c.confidenceScore,
            sources: c.sources,
          })),
        },
        evidenceLock: {
          coverage: evidenceCoverage,
          confidences: evidenceConfidences,
          totalEvidence,
        },
        conflictingSignals: reportData.conflictingSignals || [],
        perplexityDominanceBanner: perplexityDominanceBanner || null,
        fallbackGaps: reportData.fallbackGaps || [],
        queryStrategy: rawData.queryStrategy || null,
        crossValidatedSignals: rawData.crossValidatedSignals || [],
        sourceContamination: rawData.relevanceFilterStats?.sourceContamination || [],
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
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Pipeline error:", errorMessage);
    try {
      if (capturedAnalysisId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceKey);
        await supabase.from("analyses").update({
          status: "failed",
          report_data: {
            error: "pipeline_error",
            message: errorMessage,
          },
          updated_at: new Date().toISOString(),
        }).eq("id", capturedAnalysisId);
      }
    } catch (_) {}
    return new Response(JSON.stringify({ error: "Pipeline failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
