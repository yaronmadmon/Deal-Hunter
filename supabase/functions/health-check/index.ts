import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CheckResult {
  name: string;
  displayName: string;
  status: "connected" | "degraded" | "down";
  latencyMs: number;
  error?: string;
}

async function pingEndpoint(
  name: string,
  displayName: string,
  fn: () => Promise<Response>
): Promise<CheckResult> {
  const start = Date.now();
  try {
    const res = await fn();
    const latencyMs = Date.now() - start;
    if (res.ok) {
      return { name, displayName, status: "connected", latencyMs };
    }
    const body = await res.text().catch(() => "");
    return {
      name,
      displayName,
      status: "down",
      latencyMs,
      error: `HTTP ${res.status}: ${body.slice(0, 120)}`,
    };
  } catch (err: any) {
    return {
      name,
      displayName,
      status: "down",
      latencyMs: Date.now() - start,
      error: err.message?.slice(0, 120) || "Unknown error",
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify admin
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("authorization");

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify the caller is admin
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const {
      data: { user },
    } = await anonClient.auth.getUser(token);
    if (user) {
      const { data: isAdmin } = await supabase.rpc("is_admin", {
        _user_id: user.id,
      });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } else {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY") || "";
  const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY") || "";
  const GITHUB_API_TOKEN = Deno.env.get("GITHUB_API_TOKEN") || "";
  const TWITTER_BEARER_TOKEN = Deno.env.get("TWITTER_BEARER_TOKEN") || "";
  const PRODUCTHUNT_API_KEY = Deno.env.get("PRODUCTHUNT_API_KEY") || "";
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";

  // Run all checks in parallel
  const checks = await Promise.all([
    pingEndpoint("perplexity", "Perplexity Sonar", () =>
      fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 5,
        }),
      })
    ),

    pingEndpoint("serper", "Serper Search", () =>
      fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": SERPER_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: "test", num: 1 }),
      })
    ),

    pingEndpoint("github", "GitHub API", () =>
      fetch("https://api.github.com/rate_limit", {
        headers: {
          Authorization: `Bearer ${GITHUB_API_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "GoldRush-HealthCheck",
        },
      })
    ),

    pingEndpoint("twitter", "Twitter / X", () =>
      fetch(
        "https://api.x.com/2/tweets/search/recent?query=test&max_results=10",
        {
          headers: { Authorization: `Bearer ${TWITTER_BEARER_TOKEN}` },
        }
      )
    ),

    pingEndpoint("producthunt", "Product Hunt", () =>
      fetch("https://api.producthunt.com/v2/api/graphql", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PRODUCTHUNT_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: "{ viewer { user { id } } }",
        }),
      })
    ),

    pingEndpoint("firecrawl", "Firecrawl", () =>
      fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "https://example.com",
          formats: ["markdown"],
          timeout: 5000,
        }),
      })
    ),

    pingEndpoint("hackernews", "Hacker News", () =>
      fetch(
        "https://hn.algolia.com/api/v1/search?query=test&hitsPerPage=1"
      )
    ),
  ]);

  return new Response(JSON.stringify({ results: checks, timestamp: new Date().toISOString() }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
