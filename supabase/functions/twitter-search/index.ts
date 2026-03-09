import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWITTER_BEARER_TOKEN = Deno.env.get('TWITTER_BEARER_TOKEN');
    if (!TWITTER_BEARER_TOKEN) {
      throw new Error('TWITTER_BEARER_TOKEN is not configured');
    }

    const { query, max_results = 10 } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Search recent tweets using Twitter API v2
    const searchParams = new URLSearchParams({
      query,
      max_results: String(Math.min(Math.max(max_results, 10), 100)),
      'tweet.fields': 'created_at,public_metrics,lang,author_id',
      'user.fields': 'name,username,verified',
      expansions: 'author_id',
    });

    const response = await fetch(
      `https://api.x.com/2/tweets/search/recent?${searchParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${TWITTER_BEARER_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Twitter API error [${response.status}]: ${errorBody}`);
    }

    const data = await response.json();

    // Map users by ID for easy lookup
    const usersMap: Record<string, any> = {};
    if (data.includes?.users) {
      for (const user of data.includes.users) {
        usersMap[user.id] = user;
      }
    }

    // Enrich tweets with author info
    const tweets = (data.data || []).map((tweet: any) => ({
      id: tweet.id,
      text: tweet.text,
      created_at: tweet.created_at,
      metrics: tweet.public_metrics,
      lang: tweet.lang,
      author: usersMap[tweet.author_id] || null,
    }));

    return new Response(
      JSON.stringify({
        tweets,
        result_count: data.meta?.result_count || 0,
        newest_id: data.meta?.newest_id,
        oldest_id: data.meta?.oldest_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Twitter search error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
