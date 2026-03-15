import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface TwitterSearchParams {
  action: 'search' | 'user_lookup' | 'user_tweets' | 'tweet_counts' | 'influencer_signals';
  query?: string;
  username?: string;
  usernames?: string[];
  user_id?: string;
  max_results?: number;
  granularity?: 'minute' | 'hour' | 'day';
  start_time?: string;
  end_time?: string;
  niche_query?: string;
}

// ── Cache helpers ──
function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

async function getCached(cacheKey: string, action: string): Promise<any | null> {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("x_api_cache")
      .select("data, expires_at")
      .eq("cache_key", cacheKey)
      .eq("action", action)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    return data?.data ?? null;
  } catch {
    return null;
  }
}

async function setCache(cacheKey: string, action: string, payload: any): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    // Delete old entries for this key
    await sb.from("x_api_cache").delete().eq("cache_key", cacheKey).eq("action", action);
    await sb.from("x_api_cache").insert({ cache_key: cacheKey, action, data: payload, expires_at: expires });
  } catch (e) {
    console.error("Cache write error:", e);
  }
}

// Sanitize query for Twitter API v2 — remove operators and special chars that cause 400 errors
function sanitizeTwitterQuery(query: string): string {
  let clean = query
    .replace(/[""'']/g, '"')
    .replace(/["]/g, '')
    .replace(/[()[\]{}&|!^~*?:\\\/]/g, ' ')
    .replace(/\b(OR|AND|NOT)\b/g, ' ')
    .replace(/-\w+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length > 400) {
    clean = clean.substring(0, 400).replace(/\s\S*$/, '');
  }
  return clean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWITTER_BEARER_TOKEN = Deno.env.get('TWITTER_BEARER_TOKEN');
    if (!TWITTER_BEARER_TOKEN) {
      throw new Error('TWITTER_BEARER_TOKEN is not configured');
    }

    const params: TwitterSearchParams = await req.json();
    const { action = 'search' } = params;
    const headers = { Authorization: `Bearer ${TWITTER_BEARER_TOKEN}` };

    // ── ACTION: Search Recent Tweets (cached) ──
    if (action === 'search') {
      const { query, max_results = 50 } = params;
      if (!query) {
        return new Response(JSON.stringify({ error: 'Query parameter is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const sanitized = sanitizeTwitterQuery(query);
      if (!sanitized || sanitized.length < 2) {
        return new Response(JSON.stringify({ tweets: [], total_fetched: 0, error: 'Query too short after sanitization' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const cacheKey = `search:${sanitized}:${max_results}`;
      const cached = await getCached(cacheKey, 'search');
      if (cached) {
        return new Response(JSON.stringify({ ...cached, cached: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const fullQuery = `${sanitized} lang:en -is:retweet`;
      console.log(`[TWITTER-SEARCH] Query (${fullQuery.length} chars): "${fullQuery.substring(0, 100)}"`);

      const searchParams = new URLSearchParams({
        query: fullQuery,
        max_results: String(Math.min(Math.max(max_results, 10), 100)),
        'tweet.fields': 'created_at,public_metrics,author_id',
        'user.fields': 'name,username,public_metrics',
        expansions: 'author_id',
      });

      const response = await fetch(
        `https://api.x.com/2/tweets/search/recent?${searchParams.toString()}`,
        { headers }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[TWITTER-SEARCH] API error ${response.status}: ${errorBody}`);
        throw new Error(`Twitter API error [${response.status}]: ${errorBody}`);
      }

      const data = await response.json();
      const usersMap: Record<string, any> = {};
      if (data.includes?.users) {
        for (const user of data.includes.users) usersMap[user.id] = user;
      }

      const tweets = (data.data || []).map((tweet: any) => ({
        id: tweet.id,
        text: tweet.text,
        created_at: tweet.created_at,
        metrics: tweet.public_metrics,
        author: usersMap[tweet.author_id] ? {
          name: usersMap[tweet.author_id].name,
          username: usersMap[tweet.author_id].username,
          followers_count: usersMap[tweet.author_id].public_metrics?.followers_count || 0,
        } : null,
      }));

      const filtered = tweets
        .filter((t: any) => (t.metrics?.like_count || 0) >= 10)
        .sort((a: any, b: any) => {
          const engA = (a.metrics?.like_count || 0) + (a.metrics?.retweet_count || 0) * 2;
          const engB = (b.metrics?.like_count || 0) + (b.metrics?.retweet_count || 0) * 2;
          return engB - engA;
        })
        .slice(0, 10);

      const result = { tweets: filtered, total_fetched: tweets.length, result_count: data.meta?.result_count || 0 };
      await setCache(cacheKey, 'search', result);

      return new Response(JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── ACTION: User Lookup (cached) ──
    if (action === 'user_lookup') {
      const { username } = params;
      if (!username) {
        return new Response(JSON.stringify({ error: 'Username parameter is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const cacheKey = `user:${username.toLowerCase()}`;
      const cached = await getCached(cacheKey, 'user_lookup');
      if (cached) {
        return new Response(JSON.stringify({ ...cached, cached: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const response = await fetch(
        `https://api.x.com/2/users/by/username/${encodeURIComponent(username)}?user.fields=public_metrics,description,verified`,
        { headers }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Twitter user lookup error [${response.status}]: ${errorBody}`);
      }

      const data = await response.json();
      const result = { user: data.data || null };
      await setCache(cacheKey, 'user_lookup', result);

      return new Response(JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── ACTION: User Tweets (cached) ──
    if (action === 'user_tweets') {
      const { user_id, max_results = 10 } = params;
      if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id parameter is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const cacheKey = `tweets:${user_id}`;
      const cached = await getCached(cacheKey, 'user_tweets');
      if (cached) {
        return new Response(JSON.stringify({ ...cached, cached: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const searchParams = new URLSearchParams({
        max_results: String(Math.min(Math.max(max_results, 5), 100)),
        'tweet.fields': 'created_at,public_metrics',
      });

      const response = await fetch(
        `https://api.x.com/2/users/${encodeURIComponent(user_id)}/tweets?${searchParams.toString()}`,
        { headers }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Twitter user tweets error [${response.status}]: ${errorBody}`);
      }

      const data = await response.json();
      const result = { tweets: data.data || [] };
      await setCache(cacheKey, 'user_tweets', result);

      return new Response(JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── ACTION: Tweet Counts (cached) ──
    if (action === 'tweet_counts') {
      const { query, granularity = 'day' } = params;
      if (!query) {
        return new Response(JSON.stringify({ error: 'Query parameter is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const sanitized = sanitizeTwitterQuery(query);
      if (!sanitized || sanitized.length < 2) {
        return new Response(JSON.stringify({ counts: [], total_count: 0, volume_change_pct: 0 }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const cacheKey = `counts:${sanitized}`;
      const cached = await getCached(cacheKey, 'tweet_counts');
      if (cached) {
        return new Response(JSON.stringify({ ...cached, cached: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const now = new Date(Date.now() - 30 * 1000); // 30s buffer to avoid "too recent" error
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 60 * 1000); // +1min buffer on start

      const searchParams = new URLSearchParams({
        query: sanitized,
        granularity,
        start_time: params.start_time || sevenDaysAgo.toISOString(),
        end_time: params.end_time || now.toISOString(),
      });

      const response = await fetch(
        `https://api.x.com/2/tweets/counts/recent?${searchParams.toString()}`,
        { headers }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Twitter counts error [${response.status}]: ${errorBody}`);
      }

      const data = await response.json();
      const counts = data.data || [];
      let volumeChange = 0;
      if (counts.length >= 2) {
        const firstHalf = counts.slice(0, Math.floor(counts.length / 2));
        const secondHalf = counts.slice(Math.floor(counts.length / 2));
        const firstTotal = firstHalf.reduce((sum: number, d: any) => sum + (d.tweet_count || 0), 0);
        const secondTotal = secondHalf.reduce((sum: number, d: any) => sum + (d.tweet_count || 0), 0);
        if (firstTotal > 0) {
          volumeChange = Math.round(((secondTotal - firstTotal) / firstTotal) * 100);
        }
      }

      const result = { counts, total_count: data.meta?.total_tweet_count || 0, volume_change_pct: volumeChange };
      await setCache(cacheKey, 'tweet_counts', result);

      return new Response(JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── ACTION: Influencer Signals (batch user lookup + tweets, cached, max 3) ──
    if (action === 'influencer_signals') {
      const { usernames = [], niche_query = '' } = params;
      if (!usernames.length) {
        return new Response(JSON.stringify({ influencers: [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const cacheKey = `influencers:${usernames.sort().join(',')}:${niche_query}`;
      const cached = await getCached(cacheKey, 'influencer_signals');
      if (cached) {
        return new Response(JSON.stringify({ ...cached, cached: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Cap at 3 lookups for cost control
      const limitedUsernames = usernames.slice(0, 3);
      const influencers: any[] = [];

      for (const uname of limitedUsernames) {
        try {
          // Look up user
          const userRes = await fetch(
            `https://api.x.com/2/users/by/username/${encodeURIComponent(uname)}?user.fields=public_metrics,description`,
            { headers }
          );
          if (!userRes.ok) continue;
          const userData = await userRes.json();
          const user = userData.data;
          if (!user) continue;

          // Get their recent tweets (max 10)
          const tweetsRes = await fetch(
            `https://api.x.com/2/users/${user.id}/tweets?max_results=10&tweet.fields=created_at,public_metrics`,
            { headers }
          );
          let nicheTweet = null;
          if (tweetsRes.ok) {
            const tweetsData = await tweetsRes.json();
            const tweets = tweetsData.data || [];
            // Find most relevant tweet matching niche
            const nicheWords = niche_query.toLowerCase().split(/\s+/);
            const matched = tweets.filter((t: any) =>
              nicheWords.some((w: string) => t.text.toLowerCase().includes(w))
            );
            nicheTweet = matched.length > 0
              ? matched.sort((a: any, b: any) => (b.public_metrics?.like_count || 0) - (a.public_metrics?.like_count || 0))[0]
              : tweets[0]; // fallback to most recent
          }

          influencers.push({
            name: user.name,
            username: user.username,
            description: user.description || '',
            followers_count: user.public_metrics?.followers_count || 0,
            following_count: user.public_metrics?.following_count || 0,
            tweet_count: user.public_metrics?.tweet_count || 0,
            latest_niche_tweet: nicheTweet ? {
              text: nicheTweet.text,
              created_at: nicheTweet.created_at,
              like_count: nicheTweet.public_metrics?.like_count || 0,
              retweet_count: nicheTweet.public_metrics?.retweet_count || 0,
              reply_count: nicheTweet.public_metrics?.reply_count || 0,
              id: nicheTweet.id,
            } : null,
          });
        } catch (e) {
          console.error(`Influencer lookup error for @${uname}:`, e);
        }
      }

      const result = { influencers };
      await setCache(cacheKey, 'influencer_signals', result);

      return new Response(JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Twitter API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
