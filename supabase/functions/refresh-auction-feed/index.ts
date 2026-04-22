import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_SNAPSHOTS_PER_COUNTY = 3;

interface AuctionItem {
  address: string;
  auction_date: string | null;
  starting_bid: number | null;
  auction_type: "foreclosure" | "sheriff_sale" | "tax_deed" | "other";
  courthouse: string | null;
  source_url: string | null;
  county: string;
  state: string;
  raw_snippet: string;
}

async function serperSearch(apiKey: string, query: string): Promise<Array<{ title: string; snippet: string; link: string }>> {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 10, tbs: "qdr:m" }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.organic ?? []).slice(0, 8).map((r: any) => ({
      title: r.title ?? "",
      snippet: (r.snippet ?? "").slice(0, 300),
      link: r.link ?? "",
    }));
  } catch {
    return [];
  }
}

async function parseAuctionsWithGPT(
  openaiKey: string,
  snippets: Array<{ title: string; snippet: string; link: string }>,
  county: string,
  state: string
): Promise<AuctionItem[]> {
  if (snippets.length === 0) return [];

  const snippetText = snippets
    .map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet}\nURL: ${s.link}`)
    .join("\n\n");

  const prompt = `You are a real estate data extractor. Extract upcoming foreclosure, sheriff sale, and tax deed auction listings from these search results for ${county} County, ${state}.

SEARCH RESULTS:
${snippetText}

Return a JSON array. For each distinct auction property found, include:
- "address": property street address (or "Unknown" if not found)
- "auction_date": ISO date string "YYYY-MM-DD" or null if unclear
- "starting_bid": numeric dollar amount or null
- "auction_type": one of "foreclosure", "sheriff_sale", "tax_deed", "other"
- "courthouse": courthouse or trustee name or null
- "source_url": the source URL or null
- "raw_snippet": brief excerpt that supports this entry (max 100 chars)

Only include real auction listings, not general articles about auctions. Return [] if no specific listings found.
Return ONLY a valid JSON array.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1500,
        temperature: 0,
      }),
    });
    if (!res.ok) {
      console.error("OpenAI error:", res.status, await res.text().catch(() => ""));
      return [];
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    return (Array.isArray(parsed) ? parsed : []).map((item: any) => ({
      address: item.address ?? "Unknown",
      auction_date: item.auction_date ?? null,
      starting_bid: typeof item.starting_bid === "number" ? item.starting_bid : null,
      auction_type: ["foreclosure", "sheriff_sale", "tax_deed"].includes(item.auction_type)
        ? item.auction_type
        : "other",
      courthouse: item.courthouse ?? null,
      source_url: item.source_url ?? null,
      county,
      state,
      raw_snippet: (item.raw_snippet ?? "").slice(0, 150),
    }));
  } catch (e) {
    console.error("GPT parse error:", e);
    return [];
  }
}

async function saveSnapshot(supabase: any, sectionName: string, data: any[]) {
  if (data.length === 0) return;
  await supabase.from("live_feed_snapshots").insert({ section_name: sectionName, data_payload: data });
  const { data: rows } = await supabase
    .from("live_feed_snapshots")
    .select("id, created_at")
    .eq("section_name", sectionName)
    .order("created_at", { ascending: false });
  if (rows && rows.length > MAX_SNAPSHOTS_PER_COUNTY) {
    const toDelete = rows.slice(MAX_SNAPSHOTS_PER_COUNTY).map((r: any) => r.id);
    if (toDelete.length > 0) {
      await supabase.from("live_feed_snapshots").delete().in("id", toDelete);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const serperKey = Deno.env.get("SERPER_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  if (!serperKey || !openaiKey) {
    return new Response(
      JSON.stringify({ error: "Missing SERPER_API_KEY or OPENAI_API_KEY" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Accept counties from body, or use defaults for testing
  let targets: Array<{ county: string; state: string }> = [];
  try {
    const body = await req.json();
    if (Array.isArray(body.targets) && body.targets.length > 0) {
      targets = body.targets;
    }
  } catch { /* no body — use saved searches */ }

  // If no targets supplied, derive from distinct city/state in saved_searches
  if (targets.length === 0) {
    try {
      const { data: searches } = await supabase
        .from("saved_searches")
        .select("filters")
        .limit(50);
      const seen = new Set<string>();
      for (const row of searches ?? []) {
        const city = row.filters?.city ?? row.filters?.location;
        const state = row.filters?.state ?? "";
        if (city && state) {
          const key = `${city}|${state}`;
          if (!seen.has(key)) { seen.add(key); targets.push({ county: city, state }); }
        }
      }
    } catch { /* ok */ }
  }

  // Fallback: demo markets
  if (targets.length === 0) {
    targets = [
      { county: "Wayne", state: "MI" },
      { county: "Cook", state: "IL" },
    ];
  }

  const results: Record<string, AuctionItem[]> = {};
  const now = new Date();
  const monthYear = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  for (const { county, state } of targets.slice(0, 5)) {
    try {
      const queries = [
        `foreclosure auction "${county} County" ${state} ${monthYear}`,
        `sheriff sale "${county} County" ${state} ${monthYear}`,
        `tax deed auction "${county}" ${state} ${monthYear}`,
      ];

      const allSnippets: Array<{ title: string; snippet: string; link: string }> = [];
      await Promise.all(
        queries.map(async (q) => {
          const snippets = await serperSearch(serperKey, q);
          allSnippets.push(...snippets);
        })
      );

      const items = await parseAuctionsWithGPT(openaiKey, allSnippets, county, state);
      const sectionName = `auctions_${county.toLowerCase().replace(/\s+/g, "_")}_${state.toLowerCase()}`;

      await saveSnapshot(supabase, sectionName, items);
      results[sectionName] = items;
      console.log(`refresh-auction-feed: ${county}, ${state} → ${items.length} auctions`);
    } catch (e) {
      console.error(`refresh-auction-feed error for ${county}, ${state}:`, e);
    }
  }

  return new Response(
    JSON.stringify({ refreshed: Object.keys(results).length, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
