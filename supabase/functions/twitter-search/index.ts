import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface TwitterSearchParams {
  action: 'search' | 'user_lookup' | 'user_tweets' | 'tweet_counts';
  query?: string;
  username?: string;
  user_id?: string;
  max_results?: number;
  granularity?: 'minute' | 'hour' | 'day';
  start_time?: string;
  end_time?: string;
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

    // ── ACTION: Search Recent Tweets ──
    if (action === 'search') {
      const { query, max_results = 50 } = params;
      if (!query) {
        return new Response(
          JSON.stringify({ error: 'Query parameter is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const searchParams = new URLSearchParams({
        query: `${query} lang:en -is:retweet`,
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
        throw new Error(`Twitter API error [${response.status}]: ${errorBody}`);
      }

      const data = await response.json();

      const usersMap: Record<string, any> = {};
      if (data.includes?.users) {
        for (const user of data.includes.users) {
          usersMap[user.id] = user;
        }
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

      // Filter by minimum 10 likes and sort by engagement
      const filtered = tweets
        .filter((t: any) => (t.metrics?.like_count || 0) >= 10)
        .sort((a: any, b: any) => {
          const engA = (a.metrics?.like_count || 0) + (a.metrics?.retweet_count || 0) * 2;
          const engB = (b.metrics?.like_count || 0) + (b.metrics?.retweet_count || 0) * 2;
          return engB - engA;
        })
        .slice(0, 10);

      return new Response(
        JSON.stringify({
          tweets: filtered,
          total_fetched: tweets.length,
          result_count: data.meta?.result_count || 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── ACTION: User Lookup ──
    if (action === 'user_lookup') {
      const { username } = params;
      if (!username) {
        return new Response(
          JSON.stringify({ error: 'Username parameter is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
      return new Response(
        JSON.stringify({ user: data.data || null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── ACTION: User Tweets ──
    if (action === 'user_tweets') {
      const { user_id, max_results = 10 } = params;
      if (!user_id) {
        return new Response(
          JSON.stringify({ error: 'user_id parameter is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
      return new Response(
        JSON.stringify({ tweets: data.data || [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── ACTION: Tweet Counts ──
    if (action === 'tweet_counts') {
      const { query, granularity = 'day' } = params;
      if (!query) {
        return new Response(
          JSON.stringify({ error: 'Query parameter is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const searchParams = new URLSearchParams({
        query,
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

      // Calculate volume change
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

      return new Response(
        JSON.stringify({
          counts,
          total_count: data.meta?.total_tweet_count || 0,
          volume_change_pct: volumeChange,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
