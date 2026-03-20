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


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let analysisId: string | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    analysisId = body.analysisId;
    if (!analysisId) {
      return new Response(JSON.stringify({ error: "Missing analysisId" }), { status: 400, headers: corsHeaders });
    }

    // ── Read Phase 1 data from analyses row ──
    const { data: analysisRow, error: readError } = await supabase
      .from("analyses")
      .select("idea, user_id, report_data")
      .eq("id", analysisId)
      .single();

    if (readError || !analysisRow) {
      throw new Error("Failed to read analysis record: " + (readError?.message || "not found"));
    }

    const phase1Data = (analysisRow.report_data as any)?._phase1Data;
    if (!phase1Data) {
      throw new Error("raw_data not found — Phase 1 may have failed");
    }

    const idea = analysisRow.idea;
    const pipelineUserId = analysisRow.user_id;

    // ── Destructure Phase 1 data ──
    const rawData = phase1Data.rawData;
    const evidenceBlock = phase1Data.evidenceBlock;
    const evidenceCoverage = phase1Data.evidenceCoverage;
    const evidenceConfidences = phase1Data.evidenceConfidences;
    const totalEvidence = phase1Data.totalEvidence;
    const pipelineMetrics = phase1Data.pipelineMetrics;
    const totalFetchDurationMs = phase1Data.totalFetchDurationMs;
    const totalSignals = phase1Data.totalSignals;
    const failedSources = phase1Data.failedSources;
    const semanticQueries = phase1Data.semanticQueries;
    const primaryKeywords = phase1Data.primaryKeywords;
    const ideaHash = phase1Data.ideaHash;
    const sanitizedIdea = phase1Data.sanitizedIdea;

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

    // ══════════════════════════════════════════════════════════════════
    // COMPETITOR PRICING SCRAPING VIA FIRECRAWL (moved from Phase 1)
    // For the top 3 validated competitors with URLs, scrape their
    // pricing pages using Firecrawl to get Tier 1 revenue data.
    // ══════════════════════════════════════════════════════════════════
    if (firecrawlKey && rawData.validatedCompetitors?.length > 0) {
      const topCompsWithUrls = rawData.validatedCompetitors
        .filter((c: any) => c.url && !c.url.includes("reddit.com") && !c.url.includes("news.ycombinator"))
        .slice(0, 3);

      if (topCompsWithUrls.length > 0) {
        console.log(`[PHASE 2 PRICING SCRAPE] Attempting to scrape pricing for ${topCompsWithUrls.length} competitors`);
        rawData.competitorPricing = [];

        const pricingPromises = topCompsWithUrls.map(async (comp: any) => {
          try {
            let pricingUrl = "";
            try {
              const baseUrl = new URL(comp.url);
              if (baseUrl.hostname.includes("apps.apple.com") || baseUrl.hostname.includes("play.google.com") || baseUrl.hostname.includes("producthunt.com") || baseUrl.hostname.includes("github.com")) {
                // Use Firecrawl search to find the pricing page
                const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
                  method: "POST",
                  headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
                  body: JSON.stringify({ query: `"${comp.name}" pricing plans`, limit: 3, scrapeOptions: { formats: ["markdown"] } }),
                });
                const searchData = await searchRes.json();
                const pricingResult = (searchData.data || []).find((r: any) =>
                  (r.url || "").toLowerCase().includes("pricing") ||
                  (r.title || "").toLowerCase().includes("pricing")
                );
                if (pricingResult) pricingUrl = pricingResult.url;
              } else {
                pricingUrl = `${baseUrl.origin}/pricing`;
              }
            } catch {
              return null;
            }

            if (!pricingUrl) return null;

            console.log(`[PHASE 2 PRICING SCRAPE] Scraping pricing for "${comp.name}" from: ${pricingUrl}`);
            const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
              method: "POST",
              headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ url: pricingUrl, formats: ["markdown"], onlyMainContent: true }),
            });
            const scrapeData = await scrapeRes.json();
            const md = scrapeData.data?.markdown || scrapeData.markdown || "";

            if (md && md.length > 50) {
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
              console.log(`[PHASE 2 PRICING SCRAPE] "${comp.name}": Found ${priceMatches.length} prices, ${planMatches.length} plan names`);
              return pricingData;
            }
            return null;
          } catch (e) {
            console.warn(`[PHASE 2 PRICING SCRAPE] Failed for "${comp.name}":`, e);
            return null;
          }
        });

        await Promise.all(pricingPromises);
        const scrapedCount = rawData.competitorPricing.filter(Boolean).length;
        console.log(`[PHASE 2 PRICING SCRAPE] Successfully scraped pricing for ${scrapedCount}/${topCompsWithUrls.length} competitors`);

        // Add pricing data to evidence block if we got results
        if (scrapedCount > 0 && evidenceBlock?.pricingSignals) {
          for (const pd of rawData.competitorPricing) {
            if (pd && pd.rawPrices?.length > 0) {
              evidenceBlock.pricingSignals.push({
                signal: `${pd.competitorName} Pricing (scraped)`,
                value: `Plans: ${pd.planNames.join(", ") || "N/A"} | Prices: ${pd.rawPrices.join(", ")}`,
                source: "Firecrawl Pricing Scrape",
                sourceUrl: pd.url || null,
                tier: "verified",
              });
            }
          }
        }

        if (pipelineMetrics) {
          pipelineMetrics["firecrawl_pricing"] = {
            status: scrapedCount > 0 ? "ok" : "empty",
            durationMs: 0,
            signalCount: scrapedCount,
          };
        }
      }
    }

    console.log("[PHASE 2] Starting GPT-4o analysis for", analysisId, "| Evidence:", totalEvidence, "signals");

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

Score categories with these MAX values (non-uniform weights):
- Trend Momentum: 0-25 (Is attention increasing across search, social, news, or developer activity?)
- Market Saturation: 0-20 (How crowded is the space? Are incumbents dominant?)
- Sentiment: 0-20 (Do real users complain about existing solutions? Is the pain genuine?)
- Growth: 0-15 (Is the broader industry expanding?)
- Opportunity: 0-20 (Is there a clear gap competitors fail to solve?)

Score strictly based on evidence. Never inflate scores to be encouraging. Never deflate scores to appear conservative.

CRITICAL RULE — NARRATIVE MUST MATCH SCORE: Your written explanation for each category MUST align with its score. If Opportunity = 10/20 — the explanation must clearly explain why the opportunity is weak. Never write bullish text under a low score. Never write cautious text under a high score. Contradiction between score and narrative destroys user trust.

Overall Score = sum of all categories (0-100)
Verdict thresholds (non-negotiable):
>=75 -> Build Now
>=55 -> Build, But Niche Down
>=40 -> Validate Further
<40  -> Do Not Build Yet

═══════════════════════════════════════
SECTION 2A: CONCEPT VIABILITY CHECK (MUST APPLY BEFORE SCORING)
═══════════════════════════════════════

Before scoring individual categories, evaluate the IDEA ITSELF for fundamental viability:

1. DEAD/DECLINING TREND PENALTY:
   If the idea is built on a technology, trend, or market that has PEAKED AND DECLINED (e.g., NFTs post-2022, Google Glass, QR code startups pre-COVID, metaverse apps post-2023), apply these rules:
   - Cap Trend Momentum at 8/25 maximum
   - Cap Growth at 5/15 maximum
   - Add a kill shot risk: "[trend] has declined significantly since peak"
   - State clearly in scoreExplanation: "This idea relies on [declining trend], which peaked in [year]."

2. MARKET MASHUP PENALTY:
   If the idea combines multiple large markets (e.g., "social network + NFTs + pets + crypto"), you MUST evaluate demand for the INTERSECTION, not the individual components.
   - Finding "pet apps exist" and "NFT platforms exist" does NOT validate "pet NFT apps"
   - Search for evidence of the SPECIFIC COMBINATION. If no one is searching for the combined concept, the demand signal is WEAK regardless of individual market sizes.
   - Cap Trend Momentum at 10/25 if demand evidence only exists for individual components, not the intersection.

3. ABSURDITY / GIMMICK CHECK:
   If the idea sounds like a parody, combines unrelated concepts with no proven user need, or solves a problem nobody has expressed:
   - Score Opportunity no higher than 8/20
   - Score Sentiment no higher than 8/20 (no real user pain to validate)
   - State clearly: "No evidence that users want this specific combination of features."

4. SIGNAL CONTAMINATION GUARD:
   When evidence comes from ADJACENT but not IDENTICAL markets, downweight it:
   - "Pet apps" signals do NOT validate "pet NFT apps"
   - "Crypto trading" signals do NOT validate "pet token trading"
   - Only count signals that specifically reference the COMBINED concept or its close variants
   - If >70% of signals are from adjacent markets rather than the actual idea, flag: "Most signals come from adjacent markets, not this specific concept."

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
  "buildComplexity": {"mvpTimeline": "X-Y weeks", "mvpScope": ["4-5 features"], "techChallenges": ["3-4 challenges"], "estimatedCost": "$X-Y", "voiceApiCosts": "pricing or N/A if not relevant", "onDeviceNote": "feasibility or N/A if not relevant", "complexityScore": 1-10, "vibeCoderFeasibility": "Easy" or "Moderate" or "Hard" or "Do Not Attempt", "complexityFactors": ["list of factors that increase complexity such as: third-party API dependencies, real-time features, hardware requirements, AI model training, two-sided marketplace dynamics, regulatory requirements, native mobile features"], "buildEstimateComparison": {"traditional": {"timeRange": "X-Y weeks", "costRange": "$X-$Y", "skillsRequired": ["2-4 skills needed e.g. Full-stack developer, DevOps engineer, UI/UX designer"]}, "aiAssisted": {"timeRange": "X-Y weeks", "costRange": "$X-$Y", "skillsRequired": ["2-4 skills needed e.g. Prompt engineering, API integration, Basic frontend"]}}, "dataSource": "ai_estimated", "sourceUrls": []},
  "reviewIntelligence": {"complaintClusters": [{"theme": "recurring complaint theme", "complaints": ["specific complaints in this cluster"], "frequency": number, "severity": "High" or "Medium" or "Low", "opportunityLevel": "High Opportunity" or "Moderate Opportunity" or "Already Solved", "exploitableGap": "why this is or isn't exploitable"}], "topAttackAngles": [{"angle": "specific attack angle", "complaint": "the complaint it exploits", "competitorWeakness": "which competitor is weakest here"}], "matrixData": [{"theme": "complaint/praise theme", "frequency": number, "intensity": number, "quadrant": "Critical Pain" or "Minor Annoyance" or "Loved Feature" or "Hidden Gem"}], "differentiationStatements": ["3 specific positioning statements the founder can use"], "totalReviewsAnalyzed": number, "confidence": "High" or "Medium" or "Low"},
  "scoreBreakdown": [{"label": "Trend Momentum", "value": 0-25, "weight": "25%"}, {"label": "Market Saturation", "value": 0-20, "weight": "20%"}, {"label": "Sentiment", "value": 0-20, "weight": "20%"}, {"label": "Growth", "value": 0-15, "weight": "15%"}, {"label": "Opportunity", "value": 0-20, "weight": "20%"}],
  "keyStats": [{"value": "number", "label": "description", "change": "+X% or null", "sentiment": "positive/negative/neutral"}] — MUST return EXACTLY 4 items. Use these categories: (1) Signal Score, (2) Data Points collected, (3) Revenue estimate or market size, (4) Competition count or growth metric. Never return fewer than 4.,
  "userQuotes": [{"text": "REAL quote", "source": "subreddit or review", "sourceUrl": "URL or null", "upvotes": "count or null", "platform": "reddit/app_store/twitter/other"}],
  "githubRepos": [{"name": "owner/repo", "description": "desc", "stars": number, "forks": number, "openIssues": number, "language": "lang", "url": "url", "updatedAt": "ISO date", "pushedAt": "ISO date", "topics": ["topics"]}],
  "methodology": {"totalSources": 0, "perplexityQueries": 4, "firecrawlScrapes": 0, "serperSearches": 0, "productHuntQueries": 0, "githubSearches": 0, "twitterSearches": 0, "dataPoints": 0, "analysisDate": "YYYY-MM-DD", "confidenceNote": "overall data quality note"},
  "blueprint": {"productConcept": "string", "strategicPositioning": "string", "coreFeatures": ["5-7 items"], "targetUsers": ["3-4 items"], "monetization": ["2-3 items"], "mvpPlan": ["5-6 items"]},
  "marketExploitMap": {"competitorWeaknesses": ["4-6 concrete weaknesses"], "competitorStrengths": ["3-5 honest strengths"], "topComplaints": [{"complaint": "specific", "frequency": "High/Medium/Low"}], "topPraise": [{"praise": "specific", "frequency": "High/Medium/Low"}], "whereToWin": ["4-6 opportunities"], "attackAngle": "1-2 sentence positioning", "confidence": "High/Medium/Low"},
  "competitorMatrix": {"features": ["Speed", "Pricing", "App Store Data", "Search Demand Signals", "Social Sentiment", "Build Feasibility", "Report Depth", "Founder Actionability"], "competitors": [{"name": "name", "classification": "direct/feature_overlap/adjacent", "isYou": false, "scores": {"Speed": "Strong/Medium/Weak/No"}}, {"name": "Your Idea", "isYou": true, "scores": {"Speed": "Strong/Medium/Weak/No", "Pricing": "Strong/Medium/Weak/No", "FILL ALL features with realistic assessments based on the idea's strengths": ""}}], "confidence": "Medium"},
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

BUILD COMPLEXITY SCORING INSTRUCTIONS:
- complexityScore (1-10): Evaluate based on third-party API dependencies, real-time features, hardware requirements, AI model training needs, two-sided marketplace dynamics, regulatory requirements (HIPAA, PCI, GDPR), and native mobile features.
- vibeCoderFeasibility mapping: 1-3 = "Easy" (Buildable with Lovable or Cursor in weeks), 4-6 = "Moderate" (Requires some custom backend work), 7-8 = "Hard" (Significant engineering required), 9-10 = "Do Not Attempt" (Enterprise-level complexity).
- complexityFactors: List the specific factors that increase complexity for THIS idea.
- voiceApiCosts and onDeviceNote: Only provide real values if the idea actually involves voice APIs or on-device processing. Otherwise set to "N/A".

BUILD ESTIMATE COMPARISON — AI-ASSISTED COST TIERS (CRITICAL):
The AI-assisted build estimates MUST reflect realistic costs using modern AI coding tools (Lovable, Cursor, Bolt, Replit Agent). Use these tiers:
- complexityScore 1-3 (Easy): AI-assisted cost $500-$2,000, time 1-3 weeks
- complexityScore 4-6 (Moderate): AI-assisted cost $2,000-$10,000, time 3-8 weeks
- complexityScore 7-8 (Hard): AI-assisted cost $10,000-$50,000, time 6-16 weeks
- complexityScore 9-10 (Do Not Attempt): AI-assisted cost $50,000-$200,000, time 12-24+ weeks
Traditional dev costs should be 5-20x higher than AI-assisted costs. Skills for AI-assisted should include "AI code generation", "Prompt engineering", "API integration" rather than traditional dev roles.

REVIEW INTELLIGENCE INSTRUCTIONS:
- Only populate reviewIntelligence if you have at least 12 complaints/reviews to cluster. However, for niche markets with fewer than 5 validated competitors, lower this threshold to 6 complaints/reviews. If fewer than the applicable threshold, set reviewIntelligence to null.
- Cluster complaints into recurring themes with frequency counts and severity ratings.
- Evaluate each cluster as "High Opportunity" (exploitable gap), "Moderate Opportunity" (partial gap), or "Already Solved" (competitors have fixed this).
- Surface top 3 attack angles from the highest-opportunity clusters.
- matrixData: Assign each theme a frequency (0-100 scale) and intensity (0-100 emotional intensity scale). Quadrants: frequency>=50 & intensity>=50 = "Critical Pain", frequency>=50 & intensity<50 = "Minor Annoyance", frequency<50 & intensity>=50 = "Hidden Gem", frequency<50 & intensity<50 = "Loved Feature".
- differentiationStatements: Generate 3 specific positioning statements the founder can use, e.g. "Position as the only X that solves Y" or "Own the Z dimension where [competitor] scores lowest".

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
        temperature: 0.0,
        max_tokens: 16000,
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`OpenAI API error: ${aiResponse.status} - ${errorText}`);
    }

    if (!aiResponse.body) {
      throw new Error("OpenAI streaming response has no body");
    }

    let fullContent = "";
    const reader = aiResponse.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter(line => line.trim() !== "");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) fullContent += delta;
          } catch {
            // Skip malformed chunks
          }
        }
      }
    }

    const content = fullContent;

    let reportData = null;

    if (content) {
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
        // Always override methodology with ACTUAL pipeline counts (AI returns zeros)
        {
          const countSourcesByPrefix = (prefix: string) =>
            Object.entries(pipelineMetrics)
              .filter(([k, v]: [string, any]) => k.startsWith(prefix) && v.signalCount > 0)
              .length;

          const sumSignalsByPrefix = (prefix: string) =>
            Object.entries(pipelineMetrics)
              .filter(([k]: [string, any]) => k.startsWith(prefix))
              .reduce((sum, [, v]: [string, any]) => sum + (v.signalCount || 0), 0);

          const activeSources = Object.values(pipelineMetrics).filter((v: any) => v.signalCount > 0).length;

          reportData.methodology = {
            ...(reportData.methodology || {}),
            analysisDate: new Date().toISOString().split('T')[0],
            totalSources: activeSources,
            dataPoints: totalSignals,
            perplexityQueries: countSourcesByPrefix("perplexity_"),
            firecrawlScrapes: sumSignalsByPrefix("firecrawl_"),
            serperSearches: countSourcesByPrefix("serper_"),
            productHuntQueries: countSourcesByPrefix("producthunt") > 0 ? 1 : 0,
            githubSearches: countSourcesByPrefix("github") > 0 ? 1 : 0,
            twitterSearches: countSourcesByPrefix("twitter_"),
            confidenceNote: reportData.methodology?.confidenceNote || "Overall data quality is strong with verified signals.",
          };
        }

        // Store AI raw score for scoring journey log
        reportData._aiRawScore = reportData.overallScore || 0;

        // ══════════════════════════════════════════════════════════════
        // DETERMINISTIC POST-AI VALIDATION
        // These checks enforce scoring rules in CODE, not just the prompt.
        // ══════════════════════════════════════════════════════════════

        // Track which categories were capped by viability checks — floors must NOT override these
        const viabilityCappedCategories: Set<string> = new Set();

        // 1. Enforce overallScore = sum of scoreBreakdown values
        if (reportData.scoreBreakdown && Array.isArray(reportData.scoreBreakdown) && reportData.scoreBreakdown.length === 5) {
          const computedSum = reportData.scoreBreakdown.reduce((sum: number, cat: any) => sum + (Number(cat.value) || 0), 0);
          if (reportData.overallScore !== computedSum) {
            console.warn(`[SCORE VALIDATION] overallScore mismatch: AI returned ${reportData.overallScore}, computed sum is ${computedSum}. Correcting.`);
            reportData.overallScore = computedSum;
          }
        }

        // 2. Enforce verdict thresholds deterministically
        {
          const finalScore = reportData.overallScore || 0;
          const correctVerdict = computeVerdict(finalScore);
          const correctStrength = computeSignalStrength(finalScore);
          if (reportData.founderDecision?.decision !== correctVerdict) {
            console.warn(`[VERDICT VALIDATION] AI verdict "${reportData.founderDecision?.decision}" doesn't match score ${finalScore}. Correcting to "${correctVerdict}".`);
          }
          if (reportData.signalStrength !== correctStrength) {
            console.warn(`[SIGNAL VALIDATION] signalStrength "${reportData.signalStrength}" doesn't match score ${finalScore}. Correcting to "${correctStrength}".`);
          }
          applyVerdictToReport(reportData);
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
            viabilityCappedCategories.add("Opportunity");
            applyVerdictToReport(reportData);
          }
        }


        // ══════════════════════════════════════════════════════════════
        // CONCEPT VIABILITY CHECK (POST-AI ENFORCEMENT)
        // Detect declining trends, market mashups, and signal contamination.
        // ══════════════════════════════════════════════════════════════
        // Hoist declining trend detection with positional weighting
        // Primary = keyword is central to the idea (first 5 words or >30% of words)
        // Secondary = keyword appears as a modifier ("with web3", "using NFT")
        // Tertiary = incidental mention or negation → skip all penalties
        const ideaLowerForViability = (idea || "").toLowerCase();
        const decliningTrends = ["nft", "metaverse", "web3", "crypto kitties", "play to earn", "p2e", "ico", "defi yield"];
        
        type TrendPosition = "primary" | "secondary" | "tertiary";
        let matchedDecliningTrend: string | null = null;
        let trendPosition: TrendPosition = "tertiary";
        
        const negationPatterns = ["no ", "not ", "without ", "non-", "non ", "beyond ", "instead of ", "replace "];
        
        for (const trend of decliningTrends) {
          if (!ideaLowerForViability.includes(trend)) continue;
          
          // Check for negation — if the keyword is negated, skip entirely
          const trendIndex = ideaLowerForViability.indexOf(trend);
          const precedingText = ideaLowerForViability.slice(Math.max(0, trendIndex - 12), trendIndex);
          const isNegated = negationPatterns.some(neg => precedingText.endsWith(neg));
          if (isNegated) {
            console.log(`[TREND POSITION] "${trend}" is negated in idea — skipping all penalties`);
            continue;
          }
          
          matchedDecliningTrend = trend;
          
          // Determine position: check if keyword appears in first 5 words or makes up >30% of words
          const words = ideaLowerForViability.split(/\s+/).filter(Boolean);
          const first5 = words.slice(0, 5).join(" ");
          const trendWordCount = trend.split(/\s+/).length;
          const trendWordRatio = trendWordCount / words.length;
          
          if (first5.includes(trend) || trendWordRatio > 0.3) {
            trendPosition = "primary";
            console.warn(`[TREND POSITION] "${trend}" is PRIMARY — central to the idea`);
          } else {
            // Secondary: appears as modifier (after "with", "using", "via", "through", "plus", etc.)
            trendPosition = "secondary";
            console.warn(`[TREND POSITION] "${trend}" is SECONDARY — appears as a modifier, not core concept`);
          }
          break; // use first match
        }

        if (reportData.scoreBreakdown && Array.isArray(reportData.scoreBreakdown)) {
          const ideaLower = ideaLowerForViability;
          
          if (matchedDecliningTrend && trendPosition === "primary") {
            console.warn(`[CONCEPT VIABILITY] PRIMARY declining trend detected: "${matchedDecliningTrend}" — applying full penalty cascade`);
            
            const trendEntry = reportData.scoreBreakdown.find((b: any) => b.label === "Trend Momentum");
            if (trendEntry && Number(trendEntry.value) > 8) {
              console.warn(`[DECLINING TREND CAP] Trend capped from ${trendEntry.value} to 8 (declining trend: ${matchedDecliningTrend})`);
              trendEntry.value = 8;
              viabilityCappedCategories.add("Trend Momentum");
            }
            
            const growthEntry = reportData.scoreBreakdown.find((b: any) => b.label === "Growth");
            if (growthEntry && Number(growthEntry.value) > 5) {
              console.warn(`[DECLINING TREND CAP] Growth capped from ${growthEntry.value} to 5 (declining trend: ${matchedDecliningTrend})`);
              growthEntry.value = 5;
              viabilityCappedCategories.add("Growth");
            }

            // Inject kill shot risk if not already present
            if (reportData.killShotAnalysis?.risks && Array.isArray(reportData.killShotAnalysis.risks)) {
              const hasDeclineRisk = reportData.killShotAnalysis.risks.some((r: any) => 
                r.risk?.toLowerCase().includes("declin") || r.risk?.toLowerCase().includes("peak")
              );
              if (!hasDeclineRisk) {
                reportData.killShotAnalysis.risks.unshift({
                  risk: `The ${matchedDecliningTrend.toUpperCase()} market has declined significantly since its 2021-2022 peak. User interest, trading volume, and investor appetite have dropped dramatically.`,
                  severity: "High",
                  mitigation: "Validate that your specific niche still has active users before investing resources."
                });
              }
            }
          } else if (matchedDecliningTrend && trendPosition === "secondary") {
            // Secondary position: keyword is a modifier, not the core idea
            // Apply only a softer trend cap, no growth cap, no kill shot
            console.warn(`[CONCEPT VIABILITY] SECONDARY declining trend "${matchedDecliningTrend}" — applying soft trend cap only`);
            
            const trendEntry = reportData.scoreBreakdown.find((b: any) => b.label === "Trend Momentum");
            if (trendEntry && Number(trendEntry.value) > 15) {
              console.warn(`[DECLINING TREND SOFT CAP] Trend capped from ${trendEntry.value} to 15 (secondary mention: ${matchedDecliningTrend})`);
              trendEntry.value = 15;
            }
          }

          // 2. MARKET MASHUP DETECTION
          // Ideas that combine 3+ distinct market categories get penalized
          // unless the INTERSECTION has dedicated demand
          const marketCategories = [
            { keywords: ["social network", "social media", "community"], label: "social" },
            { keywords: ["nft", "token", "blockchain", "crypto", "web3"], label: "crypto" },
            { keywords: ["pet", "animal", "dog", "cat"], label: "pets" },
            { keywords: ["game", "gaming", "play"], label: "gaming" },
            { keywords: ["fitness", "workout", "exercise"], label: "fitness" },
            { keywords: ["dating", "match", "romance"], label: "dating" },
            { keywords: ["food", "recipe", "cooking", "restaurant"], label: "food" },
          ];
          
          const matchedCategories = marketCategories.filter(cat => 
            cat.keywords.some(kw => ideaLower.includes(kw))
          );

          if (matchedCategories.length >= 3) {
            console.warn(`[CONCEPT VIABILITY] Market mashup detected: ${matchedCategories.map(c => c.label).join(" + ")} (${matchedCategories.length} categories)`);
            
            // Check if direct search demand exists for the combination
            const directDemandSignals = (rawData.serperTrends?.organic || []).filter((r: any) => {
              const title = (r.title || "").toLowerCase();
              const snippet = (r.snippet || "").toLowerCase();
              // Must mention at least 2 of the matched categories
              const matchCount = matchedCategories.filter(cat => 
                cat.keywords.some(kw => title.includes(kw) || snippet.includes(kw))
              ).length;
              return matchCount >= 2;
            }).length;

            if (directDemandSignals < 3) {
              console.warn(`[MASHUP PENALTY] Only ${directDemandSignals} signals reference the actual combination. Applying caps.`);
              
              const trendEntry = reportData.scoreBreakdown.find((b: any) => b.label === "Trend Momentum");
              if (trendEntry && Number(trendEntry.value) > 10) {
                console.warn(`[MASHUP CAP] Trend capped from ${trendEntry.value} to 10`);
                trendEntry.value = 10;
                viabilityCappedCategories.add("Trend Momentum");
              }
              
              const oppEntry = reportData.scoreBreakdown.find((b: any) => b.label === "Opportunity");
              if (oppEntry && Number(oppEntry.value) > 10) {
                console.warn(`[MASHUP CAP] Opportunity capped from ${oppEntry.value} to 10`);
                oppEntry.value = 10;
                viabilityCappedCategories.add("Opportunity");
              }
              
              const sentEntry = reportData.scoreBreakdown.find((b: any) => b.label === "Sentiment");
              if (sentEntry && Number(sentEntry.value) > 10) {
                console.warn(`[MASHUP CAP] Sentiment capped from ${sentEntry.value} to 10 (no user pain for this specific combination)`);
                sentEntry.value = 10;
                viabilityCappedCategories.add("Sentiment");
              }
            }
          }

          // Recalculate score after concept viability checks
          const viabilitySum = reportData.scoreBreakdown.reduce((sum: number, cat: any) => sum + (Number(cat.value) || 0), 0);
          if (viabilitySum !== reportData.overallScore) {
            console.warn(`[CONCEPT VIABILITY] Score adjusted: ${reportData.overallScore} -> ${viabilitySum}`);
            reportData.overallScore = viabilitySum;
            reportData._viabilityScore = viabilitySum;
            applyVerdictToReport(reportData);
          }
        }

        // Each scoring category has a max score (ceiling) based on how
        // many real signals were collected. No data = low ceiling.
        // ══════════════════════════════════════════════════════════════
        // IMPROVEMENT #1: EVIDENCE-WEIGHTED SIGNAL COUNTS
        // Tier-weighted effective counts prevent large volumes of weak
        // signals from inflating ceilings/floors.
        // Tier 1 (Firecrawl, Serper verified) = 0.9 weight per signal
        // Tier 2 (ProductHunt, GitHub, Twitter) = 0.7 weight per signal
        // Tier 3 (Perplexity, HN) = 0.4 weight per signal
        // ══════════════════════════════════════════════════════════════
        if (reportData.scoreBreakdown && Array.isArray(reportData.scoreBreakdown)) {
          const w = (count: number, tier: number): number => {
            const weight = tier === 1 ? 0.9 : tier === 2 ? 0.7 : 0.4;
            return count * weight;
          };

          // Raw counts (kept for logging)
          const rawTrendSignals =
            (rawData.serperTrends?.organic?.length ?? 0) +
            (rawData.serperTrendsMonthly?.organic?.length ?? 0) +
            (rawData.serperNews?.organic?.length ?? 0) +
            (rawData.perplexityTrends?.citations?.length ?? 0);
          const rawMarketSignals =
            (rawData.firecrawlAppStore?.results?.length ?? 0) +
            (rawData.serperCompetitors?.allResults?.length ?? 0) +
            (rawData.validatedCompetitors?.length ?? 0) +
            (rawData.perplexityMarket?.citations?.length ?? 0);
          const rawSentimentSignals =
            (rawData.firecrawlReddit?.results?.length ?? 0) +
            (rawData.serperReddit?.organic?.length ?? 0) +
            (rawData.twitterSentiment?.tweets?.length ?? 0) +
            (rawData.hackerNews?.hits?.length ?? 0);
          const rawGrowthSignals =
            (rawData.productHunt?.products?.length ?? 0) +
            (rawData.github?.repos?.length ?? 0) +
            (rawData.perplexityVC?.citations?.length ?? 0);
          const rawOpportunitySignals =
            (rawData.serperAutoComplete?.suggestions?.length ?? 0) +
            (rawData.perplexityRevenue?.citations?.length ?? 0) +
            (rawData.perplexityChurn?.citations?.length ?? 0) +
            (rawData.perplexityBuildCosts?.citations?.length ?? 0);

          // Effective weighted counts
          const trendSignals = Math.round(
            w(rawData.serperTrends?.organic?.length ?? 0, 1) +
            w(rawData.serperTrendsMonthly?.organic?.length ?? 0, 1) +
            w(rawData.serperNews?.organic?.length ?? 0, 1) +
            w(rawData.perplexityTrends?.citations?.length ?? 0, 3)
          );
          const marketSignals = Math.round(
            w(rawData.firecrawlAppStore?.results?.length ?? 0, 1) +
            w(rawData.serperCompetitors?.allResults?.length ?? 0, 1) +
            w(rawData.validatedCompetitors?.length ?? 0, 1) +
            w(rawData.perplexityMarket?.citations?.length ?? 0, 3)
          );
          const sentimentSignals = Math.round(
            w(rawData.firecrawlReddit?.results?.length ?? 0, 1) +
            w(rawData.serperReddit?.organic?.length ?? 0, 1) +
            w(rawData.twitterSentiment?.tweets?.length ?? 0, 2) +
            w(rawData.hackerNews?.hits?.length ?? 0, 3)
          );
          const growthSignals = Math.round(
            w(rawData.productHunt?.products?.length ?? 0, 2) +
            w(rawData.github?.repos?.length ?? 0, 2) +
            w(rawData.perplexityVC?.citations?.length ?? 0, 3)
          );
          const opportunitySignals = Math.round(
            w(rawData.serperAutoComplete?.suggestions?.length ?? 0, 1) +
            w(rawData.perplexityRevenue?.citations?.length ?? 0, 3) +
            w(rawData.perplexityChurn?.citations?.length ?? 0, 3) +
            w(rawData.perplexityBuildCosts?.citations?.length ?? 0, 3)
          );

          // Ceiling rules: 0 signals → max 5, 1-2 → max 10, 3-4 → max 15, 5+ → no cap (uses category max)
          const computeCeiling = (signalCount: number, maxScore: number): number => {
            if (signalCount === 0) return Math.min(5, maxScore);
            if (signalCount <= 2) return Math.min(10, maxScore);
            if (signalCount <= 4) return Math.min(15, maxScore);
            return maxScore;
          };

          // Floor rules: 5-9 signals → min 8, 10+ signals → min 12 (capped to category max)
          const computeFloor = (signalCount: number, maxScore: number): number => {
            if (signalCount >= 10) return Math.min(12, maxScore);
            if (signalCount >= 5) return Math.min(8, maxScore);
            return 0;
          };

          // Category max scores (non-uniform weights)
          const categoryMaxMap: Record<string, number> = {
            "Trend Momentum": 25,
            "Market Saturation": 20,
            "Sentiment": 20,
            "Growth": 15,
            "Opportunity": 20,
          };

          const ceilingMap: Record<string, number> = {
            "Trend Momentum": computeCeiling(trendSignals, categoryMaxMap["Trend Momentum"]),
            "Market Saturation": computeCeiling(marketSignals, categoryMaxMap["Market Saturation"]),
            "Sentiment": computeCeiling(sentimentSignals, categoryMaxMap["Sentiment"]),
            "Growth": computeCeiling(growthSignals, categoryMaxMap["Growth"]),
            "Opportunity": computeCeiling(opportunitySignals, categoryMaxMap["Opportunity"]),
          };

          const floorMap: Record<string, number> = {
            "Trend Momentum": computeFloor(trendSignals, categoryMaxMap["Trend Momentum"]),
            "Market Saturation": computeFloor(marketSignals, categoryMaxMap["Market Saturation"]),
            "Sentiment": computeFloor(sentimentSignals, categoryMaxMap["Sentiment"]),
            "Growth": computeFloor(growthSignals, categoryMaxMap["Growth"]),
            "Opportunity": computeFloor(opportunitySignals, categoryMaxMap["Opportunity"]),
          };

          // Store raw vs effective for transparency
          reportData._signalWeighting = {
            raw: { trend: rawTrendSignals, market: rawMarketSignals, sentiment: rawSentimentSignals, growth: rawGrowthSignals, opportunity: rawOpportunitySignals },
            effective: { trend: trendSignals, market: marketSignals, sentiment: sentimentSignals, growth: growthSignals, opportunity: opportunitySignals },
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
            // INTEGRITY FIX: Never let floors override viability caps (declining trend, mashup penalties)
            if (floor !== undefined && floor > 0 && Number(category.value) < floor) {
              if (viabilityCappedCategories.has(category.label)) {
                console.warn(`[SIGNAL FLOOR SKIPPED] ${category.label}: viability cap takes priority over floor ${floor}. Keeping at ${category.value}.`);
              } else {
                console.warn(`[SIGNAL FLOOR] ${category.label}: ${signalCount} signals → floor ${floor}/20. Raising from ${category.value}.`);
                category.value = floor;
                floorApplied = true;
              }
            }
          }

          if (ceilingApplied || floorApplied) {
            const newSum = reportData.scoreBreakdown.reduce((sum: number, cat: any) => sum + (Number(cat.value) || 0), 0);
            console.warn(`[SIGNAL BOUNDS] Overall score adjusted: ${reportData.overallScore} -> ${newSum} (ceilings: ${ceilingApplied}, floors: ${floorApplied})`);
            reportData.overallScore = newSum;

            applyVerdictToReport(reportData);
          }

          console.log(`[SIGNAL COUNTS RAW] Trend: ${rawTrendSignals}, Market: ${rawMarketSignals}, Sentiment: ${rawSentimentSignals}, Growth: ${rawGrowthSignals}, Opportunity: ${rawOpportunitySignals}`);
          console.log(`[SIGNAL COUNTS EFFECTIVE] Trend: ${trendSignals}, Market: ${marketSignals}, Sentiment: ${sentimentSignals}, Growth: ${growthSignals}, Opportunity: ${opportunitySignals}`);
          console.log(`[SIGNAL CEILINGS] ${JSON.stringify(ceilingMap)}`);
          console.log(`[SIGNAL FLOORS] ${JSON.stringify(floorMap)}`);
        }

        // Capture score after signal bounds for journey log
        const scoreAfterSignalBounds = reportData.overallScore || 0;

        // ══════════════════════════════════════════════════════════════
        // COMPETITOR COUNT VALIDATION (uses validated competitors)
        // Cross-check: if AI says 0 competitors but validated pipeline
        // found real products, flag inconsistency and lower confidence.
        // Moved BEFORE Low Competition Boost to establish competitor facts first.
        // ══════════════════════════════════════════════════════════════
        const validatedCount = rawData.validatedCompetitors?.length ?? 0;
        const competitorDiscoveryCount = rawData.serperCompetitors?.allResults?.length ?? 0;
        const aiCompetitorCount = reportData.nicheAnalysis?.directCompetitors ?? -1;
        const competitorSnapshotCard = (reportData.signalCards || []).find((c: any) => c.title === "Competitor Snapshot");
        const aiCompetitorListCount = competitorSnapshotCard?.competitors?.length ?? 0;

        if (aiCompetitorCount === 0 && (validatedCount >= 1 || competitorDiscoveryCount >= 3 || aiCompetitorListCount > 0)) {
          console.warn(`[COMPETITOR VALIDATION] AI reported 0 direct competitors but validated pipeline found ${validatedCount} real products (discovery: ${competitorDiscoveryCount}, snapshot: ${aiCompetitorListCount}). Correcting.`);
          if (reportData.nicheAnalysis) {
            reportData.nicheAnalysis.directCompetitors = Math.max(validatedCount, aiCompetitorListCount, Math.min(competitorDiscoveryCount, 5));
            reportData.nicheAnalysis.competitorClarity = `[AUTO-CORRECTED] Originally reported 0 competitors, but ${validatedCount} validated real products were found. ${reportData.nicheAnalysis.competitorClarity || ""}`;
          }
          if (competitorSnapshotCard) {
            if (competitorSnapshotCard.confidence === "High") competitorSnapshotCard.confidence = "Medium";
          }
          const saturationCard = (reportData.signalCards || []).find((c: any) => c.title === "Market Saturation");
          if (saturationCard && saturationCard.confidence === "High") {
            saturationCard.confidence = "Medium";
            console.warn(`[COMPETITOR VALIDATION] Lowered Market Saturation confidence to Medium due to competitor count inconsistency`);
          }
        }
        if (validatedCount >= 5 && aiCompetitorListCount <= 1 && competitorSnapshotCard) {
          console.warn(`[COMPETITOR VALIDATION] Validated pipeline found ${validatedCount} real products but AI only listed ${aiCompetitorListCount} competitors. Flagging.`);
          if (competitorSnapshotCard.confidence !== "Low") competitorSnapshotCard.confidence = "Medium";
          competitorSnapshotCard.insight = `${competitorSnapshotCard.insight || ""} [Note: ${validatedCount} validated competitors were found — more competitors may exist than listed.]`.trim();
        }
        console.log(`[COMPETITOR VALIDATION] AI competitors: ${aiCompetitorCount}, Validated: ${validatedCount}, Discovery: ${competitorDiscoveryCount}, Snapshot: ${aiCompetitorListCount}`);

        // ══════════════════════════════════════════════════════════════
        // GRAVEYARD SIGNAL DETECTION (runs BEFORE Low Competition Boost)
        // When a declining trend is detected AND competition is very low,
        // this is NOT a blue ocean — it's an abandoned market.
        // ══════════════════════════════════════════════════════════════
        let graveyardDetected = false;
        if (matchedDecliningTrend && trendPosition === "primary") {
          const totalCompetitorEvidence = Math.max(validatedCount, aiCompetitorCount, aiCompetitorListCount);
          
          if (totalCompetitorEvidence <= 3) {
            graveyardDetected = true;
            console.warn(`[GRAVEYARD SIGNAL] PRIMARY declining trend "${matchedDecliningTrend}" + only ${totalCompetitorEvidence} competitors detected. This is an abandoned market, not a blue ocean.`);
            if (reportData.scoreBreakdown && Array.isArray(reportData.scoreBreakdown)) {
              const satEntry = reportData.scoreBreakdown.find((b: any) => b.label === "Market Saturation");
              if (satEntry && Number(satEntry.value) > 8) {
                console.warn(`[GRAVEYARD CAP] Market Saturation capped from ${satEntry.value} to 8 (abandoned market signal)`);
                satEntry.value = 8;
              }
              if (satEntry) {
                satEntry.explanation = `${satEntry.explanation || ""} ⚠️ LOW COMPETITION ON A DEAD TREND: Only ${totalCompetitorEvidence} competitor(s) found for a "${matchedDecliningTrend}" idea. Low competition here does not signal opportunity — it means the market was tried and abandoned.`.trim();
              }
            }
            if (reportData.killShotAnalysis?.risks && Array.isArray(reportData.killShotAnalysis.risks)) {
              const hasGraveyardRisk = reportData.killShotAnalysis.risks.some((r: any) =>
                r.risk?.toLowerCase().includes("graveyard") || r.risk?.toLowerCase().includes("abandoned market")
              );
              if (!hasGraveyardRisk) {
                reportData.killShotAnalysis.risks.unshift({
                  risk: `Graveyard Signal: Only ${totalCompetitorEvidence} competitor(s) found in the ${matchedDecliningTrend.toUpperCase()} space. Low competitor count here does not mean opportunity — it means the market was tried and abandoned.`,
                  severity: "High",
                  mitigation: "Search for defunct products in this space to understand why they failed. Only proceed if you can prove sustained user demand exists today."
                });
              }
            }
            const saturationCard = (reportData.signalCards || []).find((c: any) => c.title === "Market Saturation");
            if (saturationCard) {
              saturationCard.confidence = "Low";
              saturationCard.insight = `${saturationCard.insight || ""} ⚠️ Graveyard Signal: Low competition on a declining trend typically indicates an abandoned market, not an open one.`.trim();
            }
          }

          const competitivePressureCard = (reportData.signalCards || []).find((c: any) =>
            c.title === "Competitor Snapshot" || c.title === "Competitive Pressure"
          );
          if (competitivePressureCard) {
            competitivePressureCard.insight = `${competitivePressureCard.insight || ""} Note: Several competitors may have existed during the peak of the "${matchedDecliningTrend}" trend but are no longer active.`.trim();
          }
        }

        // ══════════════════════════════════════════════════════════════
        // LOW COMPETITION BOOST (for non-dead-trend markets)
        // Skipped if graveyard signal was detected — low competition
        // on a dead trend is NOT an opportunity.
        // ══════════════════════════════════════════════════════════════
        if (!matchedDecliningTrend && !graveyardDetected && reportData.scoreBreakdown && Array.isArray(reportData.scoreBreakdown)) {
          const competitorCount = Math.max(
            validatedCount,
            (reportData.signalCards || []).find((c: any) => c.title === "Competitor Snapshot")?.competitors?.length ?? 0
          );
          
          if (competitorCount > 0 && competitorCount < 5) {
            const satEntry = reportData.scoreBreakdown.find((b: any) => b.label === "Market Saturation");
            if (satEntry && Number(satEntry.value) < 16) {
              const boost = competitorCount <= 2 ? 4 : 2;
              const newVal = Math.min(20, Number(satEntry.value) + boost);
              console.warn(`[LOW COMPETITION BOOST] Only ${competitorCount} competitors (no dead trend). Market Saturation boosted from ${satEntry.value} to ${newVal}`);
              const delta = newVal - Number(satEntry.value);
              satEntry.value = newVal;
              reportData.overallScore = (reportData.overallScore || 0) + delta;
              applyVerdictToReport(reportData);
            }
          }
        }

        // ══════════════════════════════════════════════════════════════
        // B2B NICHE MODE
        // Non-consumer ideas (healthcare, compliance, enterprise, B2B)
        // shouldn't be penalized for low GitHub/ProductHunt signals.
        // Boost Growth floor using Serper/Perplexity demand instead.
        // ══════════════════════════════════════════════════════════════
        const b2bKeywords = ["medicaid", "medicare", "compliance", "enterprise", "b2b", "saas", "erp", "hipaa", 
          "nursing home", "assisted living", "hospital", "insurance", "legal", "regulatory", "procurement",
          "accounting", "payroll", "fleet", "logistics", "supply chain", "warehouse"];
        const ideaLower = (idea || "").toLowerCase();
        const b2bMatchCount = b2bKeywords.filter(kw => ideaLower.includes(kw)).length;
        const isB2BIdea = b2bMatchCount >= 2;
        if (b2bMatchCount === 1) {
          console.log(`[B2B NICHE MODE] Only 1 keyword match — insufficient for B2B classification (requires 2+)`);
        }
        
        if (isB2BIdea && reportData.scoreBreakdown && Array.isArray(reportData.scoreBreakdown)) {
          console.log(`[B2B NICHE MODE] Detected B2B/enterprise idea — adjusting Growth weighting`);
          
          const b2bGrowthEvidence = 
            (rawData.serperTrends?.organic?.length ?? 0) +
            (rawData.perplexityMarket?.citations?.length ?? 0) +
            (rawData.perplexityVC?.citations?.length ?? 0) +
            (rawData.serperNews?.organic?.length ?? 0);
          
          const growthEntry = reportData.scoreBreakdown.find((b: any) => b.label === "Growth");
          if (growthEntry && b2bGrowthEvidence >= 5) {
            const b2bFloor = 10;
            if (Number(growthEntry.value) < b2bFloor) {
              const oldVal = Number(growthEntry.value);
              growthEntry.value = b2bFloor;
              const delta = b2bFloor - oldVal;
              reportData.overallScore = (reportData.overallScore || 0) + delta;
              console.warn(`[B2B NICHE BOOST] Growth raised from ${oldVal} to ${b2bFloor} using ${b2bGrowthEvidence} Serper/Perplexity signals`);
              
              applyVerdictToReport(reportData);
            }
          }
        }

        // (Competitor Validation and Graveyard Signal already handled above, before Low Competition Boost)

        // ══════════════════════════════════════════════════════════════
        // DATA QUALITY PENALTY
        // If >50% of metrics in a scoring category are "estimated",
        // reduce that category's score by 30%.
        // ══════════════════════════════════════════════════════════════
        const categoryToCardTitle: Record<string, string[]> = {
          "Trend Momentum": ["Trend Momentum"],
          "Market Saturation": ["Market Saturation"],
          "Sentiment": ["Sentiment & Pain Points"],
          "Growth": ["Growth Signals"],
          "Opportunity": ["Market Saturation", "Sentiment & Pain Points", "Growth Signals"],
        };

        if (reportData.scoreBreakdown && Array.isArray(reportData.scoreBreakdown)) {
          let penaltyApplied = false;
          for (const category of reportData.scoreBreakdown) {
            // Skip data quality penalty for categories already ceilinged to ≤5 (double-penalty prevention)
            const categoryValue = Number(category.value) || 0;
            if (categoryValue <= 5) {
              console.log(`[DATA QUALITY] Skipping penalty for ${category.label} — already at ${categoryValue} (ceiling-bound)`);
              continue;
            }

            const cardTitles = categoryToCardTitle[category.label] || [];
            const cards = (reportData.signalCards || []).filter((c: any) => cardTitles.includes(c.title));
            if (cards.length === 0) continue;

            // Aggregate metrics across all mapped cards
            const allMetrics = cards.flatMap((card: any) => [...(card.metrics || []), ...(card.competitors || [])]);
            const totalMetrics = allMetrics.length;
            if (totalMetrics === 0) continue;

            const estimatedCount = allMetrics.filter((m: any) => 
              m.dataTier === "estimated" || m.dataSource === "ai_estimated" ||
              m.value === "N/A" || m.value === "Insufficient data" || m.value === null
            ).length;

            if (totalMetrics > 0 && estimatedCount / totalMetrics > 0.5) {
              const originalValue = categoryValue;
              const penalty = Math.round(originalValue * 0.3);
              category.value = originalValue - penalty;
              penaltyApplied = true;
              console.warn(`[DATA QUALITY PENALTY] ${category.label}: ${estimatedCount}/${totalMetrics} metrics estimated. Score reduced by ${penalty} (${originalValue} -> ${category.value})`);
              cards.forEach((card: any) => { if (card.confidence !== "Low") card.confidence = "Low"; });
            }
          }

          if (penaltyApplied) {
            const newSum = reportData.scoreBreakdown.reduce((sum: number, cat: any) => sum + (Number(cat.value) || 0), 0);
            console.warn(`[DATA QUALITY PENALTY] Overall score adjusted: ${reportData.overallScore} -> ${newSum}`);
            reportData.overallScore = newSum;

            applyVerdictToReport(reportData);
          }
        }

        // Capture score after data quality penalty for journey log
        const scoreAfterDataQuality = reportData.overallScore || 0;

        // ══════════════════════════════════════════════════════════════
        // BUILD COMPLEXITY — INFORMATIONAL ONLY (no score penalty)
        // Labels are still computed for the report display.
        // ══════════════════════════════════════════════════════════════
        const complexityPenalty = 0;
        if (reportData.buildComplexity) {
          const cs = Number(reportData.buildComplexity.complexityScore) || 0;
          
          // Enforce vibeCoderFeasibility label (informational only)
          if (cs >= 9) reportData.buildComplexity.vibeCoderFeasibility = "Do Not Attempt";
          else if (cs >= 7) reportData.buildComplexity.vibeCoderFeasibility = "Hard";
          else if (cs >= 4) reportData.buildComplexity.vibeCoderFeasibility = "Moderate";
          else reportData.buildComplexity.vibeCoderFeasibility = "Easy";

          // No penalty applied — complexity is advisory only
          reportData.buildComplexity.scorePenalty = 0;
        }

        const scoreAfterComplexity = reportData.overallScore || 0;

        // ══════════════════════════════════════════════════════════════
        // PIONEER MARKET DETECTION (must run BEFORE ECM)
        // Intercepts ECM penalty for legitimately novel ideas with
        // low signal volume but real long-tail keyword demand.
        // ══════════════════════════════════════════════════════════════
        let pioneerMarketFlag = false;
        let ecmSkipped = false;
        {
          const totalEvidenceItems = totalEvidence;
          const validatedCompetitorCount = rawData.validatedCompetitors?.length ?? 0;
          
          // Check for long-tail keyword variants with volume > 0
          const kwData = rawData.serperKeywordIntel?.keywords || reportData.keywordDemand?.keywords || [];
          const hasLongTailWithVolume = kwData.some((kw: any) => {
            const vol = String(kw.volume || "0").replace(/[^0-9]/g, "");
            return parseInt(vol, 10) > 0;
          });

          // Check for declining trend flag
          const hasNoDecline = !matchedDecliningTrend;

          const isPioneer = totalEvidenceItems < 15 
            && validatedCompetitorCount <= 2 
            && hasLongTailWithVolume 
            && hasNoDecline;

          if (isPioneer) {
            pioneerMarketFlag = true;
            ecmSkipped = true;
            reportData.pioneerMarketFlag = true;
            console.warn(`[PIONEER MARKET] Detected — evidence: ${totalEvidenceItems}, competitors: ${validatedCompetitorCount}, long-tail: true, decline: false. ECM penalty will be SKIPPED.`);
          } else {
            console.log(`[PIONEER MARKET] Not detected — evidence: ${totalEvidenceItems}, competitors: ${validatedCompetitorCount}, long-tail: ${hasLongTailWithVolume}, decline: ${!!matchedDecliningTrend}`);
          }
        }

        // ══════════════════════════════════════════════════════════════
        // IMPROVEMENT #2 + #3 + #4: EVIDENCE CONFIDENCE SYSTEM
        // Adjusts the final score when evidence quality is low.
        // Combines: dataTier distribution, unique sources, source
        // diversity, conflicting signals, and manipulation detection.
        // ══════════════════════════════════════════════════════════════
        // NOTE: conflictingSignals is computed later (Improvement #8).
        // We initialize the count reference here so confidence can use it.
        // The full array is populated after evidence-locked validation.
        let earlyConflictCount = 0;
        {
          // Quick pre-check for obvious conflicts (search vs twitter)
          const _searchUp = (rawData.serperTrends?.organic?.length ?? 0) >= 3;
          const _twitterDown = rawData.twitterCounts?.volume_change_pct < -20;
          const _searchWeak = (rawData.serperTrends?.organic?.length ?? 0) <= 1;
          const _twitterUp = rawData.twitterCounts?.volume_change_pct > 20;
          if (_searchUp && _twitterDown) earlyConflictCount++;
          if (_searchWeak && _twitterUp) earlyConflictCount++;
          const _avgRating = (() => {
            const ratings = (rawData.validatedCompetitors || []).map((c: any) => parseFloat(String(c.rating || "0"))).filter((r: number) => r > 0);
            return ratings.length > 0 ? ratings.reduce((s: number, r: number) => s + r, 0) / ratings.length : 0;
          })();
          const _complaintCount = (rawData.firecrawlReddit?.results?.length ?? 0) + (rawData.serperReddit?.organic?.length ?? 0);
          if (_avgRating >= 4.0 && _complaintCount >= 5) earlyConflictCount++;
        }

        let evidenceConfidence = 1.0;
        const confidenceReasons: string[] = [];

        // --- Compute dataTier distribution across all signal card metrics ---
        let tierVerified = 0, tierReported = 0, tierEstimated = 0, tierTotal = 0;
        (reportData.signalCards || []).forEach((card: any) => {
          const allItems = [...(card.metrics || []), ...(card.competitors || [])];
          allItems.forEach((m: any) => {
            tierTotal++;
            if (m.dataTier === "verified") tierVerified++;
            else if (m.dataTier === "reported") tierReported++;
            else tierEstimated++;
          });
        });

        if (tierTotal > 0) {
          const estimatedRatio = tierEstimated / tierTotal;
          const reportedRatio = tierReported / tierTotal;
          if (estimatedRatio > 0.5) {
            evidenceConfidence -= 0.10;
            confidenceReasons.push(`${Math.round(estimatedRatio * 100)}% of metrics are estimated (-0.10)`);
          } else if (reportedRatio > 0.5) {
            evidenceConfidence -= 0.05;
            confidenceReasons.push(`${Math.round(reportedRatio * 100)}% of metrics are reported (-0.05)`);
          }
        }

        // --- Unique source count ---
        const uniqueSourceTypes = new Set<string>();
        Object.entries(pipelineMetrics).forEach(([key, val]: [string, any]) => {
          if (val.signalCount > 0) uniqueSourceTypes.add(key.split("_")[0]);
        });
        if (uniqueSourceTypes.size < 3) {
          evidenceConfidence -= 0.05;
          confidenceReasons.push(`Only ${uniqueSourceTypes.size} unique source types (-0.05)`);
        }

        // --- Conflicting signals penalty (uses early pre-check, full detection runs later) ---
        if (earlyConflictCount > 0) {
          evidenceConfidence -= 0.05;
          confidenceReasons.push(`${earlyConflictCount} conflicting signal(s) detected (-0.05)`);
        }

        // --- IMPROVEMENT #3: Source diversity check ---
        const sourceTotals: Record<string, number> = {};
        let pipelineSignalTotal = 0;
        Object.entries(pipelineMetrics).forEach(([key, val]: [string, any]) => {
          const prefix = key.split("_")[0];
          sourceTotals[prefix] = (sourceTotals[prefix] || 0) + (val.signalCount || 0);
          pipelineSignalTotal += (val.signalCount || 0);
        });
        if (pipelineSignalTotal > 0) {
          for (const [src, count] of Object.entries(sourceTotals)) {
            if (count / pipelineSignalTotal > 0.70) {
              evidenceConfidence -= 0.05;
              confidenceReasons.push(`Source concentration: ${src} provides ${Math.round((count / pipelineSignalTotal) * 100)}% of signals (-0.05)`);
              console.warn(`[SOURCE DIVERSITY] ${src} dominates with ${count}/${pipelineSignalTotal} signals (${Math.round((count / pipelineSignalTotal) * 100)}%)`);
              break; // only penalize once
            }
          }
        }

        // --- IMPROVEMENT #4: Manipulation safety check ---
        let signalIntegrityFlag = false;
        const manipulationWarnings: string[] = [];

        // Check: extremely high signal count from single source
        for (const [src, count] of Object.entries(sourceTotals)) {
          if (count > 80) {
            manipulationWarnings.push(`${src}: ${count} signals (unusually high volume)`);
          }
        }

        // Check: large volume of low-relevance signals (>60% of metrics are estimated)
        if (tierTotal > 5 && tierEstimated / tierTotal > 0.6) {
          manipulationWarnings.push(`${Math.round((tierEstimated / tierTotal) * 100)}% of ${tierTotal} metrics are estimated/unverified`);
        }

        // Check: repeated text in evidence (duplicate signals)
        const evidenceTexts: string[] = [];
        (reportData.signalCards || []).forEach((card: any) => {
          (card.evidence || []).forEach((e: string) => evidenceTexts.push((e || "").toLowerCase().trim()));
        });
        const uniqueEvidence = new Set(evidenceTexts);
        if (evidenceTexts.length > 5 && uniqueEvidence.size < evidenceTexts.length * 0.7) {
          manipulationWarnings.push(`${evidenceTexts.length - uniqueEvidence.size} duplicate evidence strings detected`);
        }

        if (manipulationWarnings.length > 0) {
          signalIntegrityFlag = true;
          evidenceConfidence -= 0.05;
          confidenceReasons.push(`Signal integrity concerns: ${manipulationWarnings.length} issue(s) (-0.05)`);
          console.warn(`[SIGNAL INTEGRITY] Flagged: ${manipulationWarnings.join("; ")}`);
        }

        // Clamp confidence to [0.6, 1.0]
        evidenceConfidence = Math.max(0.6, Math.min(1.0, Math.round(evidenceConfidence * 100) / 100));

        // Apply confidence multiplier to final score (SKIP if Pioneer Market detected)
        const scoreBeforeConfidence = reportData.overallScore || 0;
        if (ecmSkipped) {
          console.warn(`[EVIDENCE CONFIDENCE] SKIPPED — Pioneer Market detected. Score stays at ${scoreBeforeConfidence}`);
          evidenceConfidence = 1.0; // Reset to 1.0 so journey log is accurate
        } else if (evidenceConfidence < 1.0) {
          reportData.overallScore = Math.round(scoreBeforeConfidence * evidenceConfidence);
          console.warn(`[EVIDENCE CONFIDENCE] Score adjusted: ${scoreBeforeConfidence} × ${evidenceConfidence} = ${reportData.overallScore} | Reasons: ${confidenceReasons.join(", ")}`);
          applyVerdictToReport(reportData);
        } else {
          console.log(`[EVIDENCE CONFIDENCE] Full confidence (1.0) — no adjustment`);
        }

        // Expose in report
        reportData.evidenceConfidence = {
          value: evidenceConfidence,
          reasons: ecmSkipped ? ["ECM skipped: Pioneer Market detected"] : confidenceReasons,
          dataTierDistribution: { verified: tierVerified, reported: tierReported, estimated: tierEstimated, total: tierTotal },
          uniqueSourceTypes: [...uniqueSourceTypes],
          manipulationWarnings,
          ecmSkipped: ecmSkipped ? "pioneer_market" : undefined,
        };
        reportData.signalIntegrityFlag = signalIntegrityFlag;

        // ══════════════════════════════════════════════════════════════
        // SCORING JOURNEY LOG + STRUCTURED DATA FOR UI
        // ══════════════════════════════════════════════════════════════
        const aiRawScore = reportData._aiRawScore ?? reportData.overallScore;
        const viabilityScore = reportData._viabilityScore ?? aiRawScore;
        
        reportData.scoringJourney = {
          steps: [
            { label: "AI Raw Score", value: aiRawScore, description: "Initial score from GPT-4o analysis" },
            { label: "Viability Caps", value: viabilityScore, description: viabilityScore !== aiRawScore ? `Declining trend / mashup caps applied (capped: ${[...viabilityCappedCategories].join(", ") || "none"})` : "No viability adjustments needed" },
            { label: "Signal Bounds", value: scoreAfterSignalBounds, description: "Evidence-weighted floors & ceilings enforced per category" },
            { label: "Boosts & Penalties", value: scoreAfterDataQuality, description: scoreAfterSignalBounds !== scoreAfterDataQuality ? "Low competition boost, B2B niche boost, and/or data quality penalty applied" : "No boosts or penalties applied" },
            { label: "Complexity Info", value: scoreAfterComplexity, description: "Build complexity is informational only — no score penalty applied" },
            { label: "Evidence Confidence", value: reportData.overallScore, description: ecmSkipped ? "ECM skipped: Pioneer Market detected — low signal volume indicates early-stage market" : (evidenceConfidence < 1.0 ? `Confidence multiplier: ${evidenceConfidence} (${confidenceReasons.join("; ")})` : "Full evidence confidence — no adjustment") },
          ],
          finalScore: reportData.overallScore,
          complexityPenalty: 0,
          evidenceConfidence,
          pioneerMarketFlag,
          ecmSkipped: ecmSkipped ? "pioneer_market" : undefined,
          viabilityCappedCategories: [...viabilityCappedCategories],
        };
        
        console.log(`[SCORING JOURNEY] AI Raw: ${aiRawScore} → Viability: ${viabilityScore} → Signal Bounds: ${scoreAfterSignalBounds} → Boosts/Penalties: ${scoreAfterDataQuality} → Complexity (${complexityPenalty}): ${scoreAfterComplexity} → Confidence (${evidenceConfidence}): ${reportData.overallScore}`);



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
        reportData.perplexityDominanceBanner = perplexityDominanceBanner;

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

        // Final score and signal strength are read from reportData at save time (lines 4026-4027)

        // ── Populate githubRepos from rawData if AI didn't return them ──
        if (!reportData.githubRepos || !Array.isArray(reportData.githubRepos) || reportData.githubRepos.length === 0) {
          const ghRepos = rawData.github?.repos || [];
          if (ghRepos.length > 0) {
            reportData.githubRepos = ghRepos.slice(0, 10).map((r: any) => ({
              name: r.name || "",
              description: r.description || "",
              stars: r.stars || 0,
              forks: r.forks || 0,
              openIssues: r.openIssues || 0,
              language: r.language || "Unknown",
              url: r.url || "",
              updatedAt: r.updatedAt || null,
              pushedAt: r.pushedAt || null,
              topics: r.topics || [],
            }));
            console.log(`[FIELD POPULATION] githubRepos: populated ${reportData.githubRepos.length} repos from rawData`);
          }
        }

        // ── Populate Competitor Snapshot card from validated competitors if AI returned empty ──
        const compSnapshotCard = (reportData.signalCards || []).find((c: any) => c.title === "Competitor Snapshot");
        if (compSnapshotCard && (!compSnapshotCard.competitors || compSnapshotCard.competitors.length === 0)) {
          const validated = rawData.validatedCompetitors || [];
          if (validated.length > 0) {
            compSnapshotCard.competitors = validated.slice(0, 8).map((c: any) => ({
              name: c.name,
              classification: "direct",
              rating: c.rating ? String(c.rating) : "N/A",
              reviews: "N/A",
              downloads: c.downloads || "N/A",
              weakness: "See user sentiment section",
              whatTheyDoWell: c.description || "Established in market",
              dataSource: c.sources?.[0]?.toLowerCase() || "serper",
              sourceUrl: c.url || null,
              dataTier: c.validationScore >= 4 ? "verified" : "reported",
              signalNote: `Validated via ${c.sources?.join(", ") || "pipeline"} (score ${c.validationScore}/5)`,
            }));
            compSnapshotCard.evidenceCount = compSnapshotCard.competitors.length;
            compSnapshotCard.confidence = validated.length >= 3 ? "High" : validated.length >= 1 ? "Medium" : "Low";
            console.log(`[FIELD POPULATION] Competitor Snapshot: populated ${compSnapshotCard.competitors.length} competitors from validated pipeline`);
          }
        }

        // ── Ensure scoreBreakdown exists with defaults ──
        if (!reportData.scoreBreakdown || !Array.isArray(reportData.scoreBreakdown) || reportData.scoreBreakdown.length !== 5) {
          const total = reportData.overallScore || 50;
          // Distribute proportionally: 25/20/20/15/20
          const trendDefault = Math.round(total * 0.25);
          const satDefault = Math.round(total * 0.20);
          const sentDefault = Math.round(total * 0.20);
          const growthDefault = Math.round(total * 0.15);
          const oppDefault = total - trendDefault - satDefault - sentDefault - growthDefault;
          reportData.scoreBreakdown = [
            { label: "Trend Momentum", value: Math.min(trendDefault, 25), weight: "25%" },
            { label: "Market Saturation", value: Math.min(satDefault, 20), weight: "20%" },
            { label: "Sentiment", value: Math.min(sentDefault, 20), weight: "20%" },
            { label: "Growth", value: Math.min(growthDefault, 15), weight: "15%" },
            { label: "Opportunity", value: Math.min(oppDefault, 20), weight: "20%" },
          ];
          reportData.overallScore = reportData.scoreBreakdown.reduce((s: number, c: any) => s + c.value, 0);
          console.log(`[FIELD POPULATION] scoreBreakdown: generated weighted defaults (25/20/20/15/20)`);
        }

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
          // Prefer real keyword intelligence data if available
          const kwIntel = rawData.serperKeywordIntel;
          if (kwIntel && kwIntel.keywords && kwIntel.keywords.length > 0) {
            reportData.keywordDemand = {
              keywords: kwIntel.keywords.slice(0, 8),
              confidence: kwIntel.confidence || "Medium",
              source: kwIntel.source || "Serper.dev + Google Trends",
            };
            console.log(`[FIELD POPULATION] keywordDemand: populated from keyword intelligence (${kwIntel.keywords.length} keywords)`);
          } else {
            // Fallback to autocomplete suggestions
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
        }
        // If AI generated keywordDemand but with N/A volumes, enrich with real data
        if (reportData.keywordDemand && rawData.serperKeywordIntel?.keywords?.length > 0) {
          const kwIntel = rawData.serperKeywordIntel;
          for (const kw of reportData.keywordDemand.keywords) {
            if (kw.volume === "N/A" || kw.volume === "Unknown") {
              const match = kwIntel.keywords.find((k: any) => k.keyword.toLowerCase() === kw.keyword.toLowerCase());
              if (match && match.volume !== "N/A") {
                kw.volume = match.volume;
                kw.difficulty = match.difficulty;
                kw.trend = match.trend;
              }
            }
          }
          // Upgrade confidence if we enriched with real data
          if (kwIntel.confidence === "High" && reportData.keywordDemand.confidence !== "High") {
            reportData.keywordDemand.confidence = "High";
            reportData.keywordDemand.source = kwIntel.source;
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
            _fallback: true,
            _fallbackWarning: "Insufficient competitor data — manual review required.",
            features,
            competitors: [
              ...competitors.slice(0, 3).map((c: any) => ({ name: c.name, isYou: false, scores: Object.fromEntries(features.map(f => [f, null])) })),
              { name: "Your Idea", isYou: true, scores: Object.fromEntries(features.map(f => [f, null])) },
            ],
            confidence: "Low",
          };
        }
        // Ensure "Your Idea" in competitorMatrix always has scores filled in (only for non-fallback matrices)
        if (reportData.competitorMatrix?.competitors && reportData.competitorMatrix?.features && !reportData.competitorMatrix._fallback) {
          const yourIdea = reportData.competitorMatrix.competitors.find((c: any) => c.isYou);
          if (yourIdea && (!yourIdea.scores || Object.keys(yourIdea.scores).length === 0)) {
            yourIdea.scores = Object.fromEntries(
              reportData.competitorMatrix.features.map((f: string) => [f, "Medium"])
            );
          }
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

    // ── Inject GitHub complexity + Pioneer Market into report ──
    if (reportData) {
      if (rawData.githubComplexity) {
        reportData.githubComplexityScore = rawData.githubComplexity;
      } else {
        reportData.githubComplexityScore = { score: null, reposAnalyzed: 0, signals: [], label: "Insufficient GitHub data to estimate complexity." };
      }
      if (pioneerMarketFlag) {
        reportData.pioneerMarketBanner = "Pioneer Market Detected — Low signal volume may indicate an early-stage or untapped market rather than lack of demand. Treat this score with higher uncertainty but higher upside potential.";
      }
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
        perplexityDominanceBanner: reportData.perplexityDominanceBanner || null,
        fallbackGaps: reportData.fallbackGaps || [],
        queryStrategy: rawData.queryStrategy || null,
        crossValidatedSignals: rawData.crossValidatedSignals || [],
        sourceContamination: rawData.relevanceFilterStats?.sourceContamination || [],
        timestamp: new Date().toISOString(),
      };
    }

    // ── Step 3: Complete ──
    // CRITICAL FIX: Use computed values from reportData, not uninitialized locals
    const finalOverallScore = reportData?.overallScore ?? 0;
    const finalSignalStrength = reportData?.signalStrength ?? "Weak";
    await supabase.from("analyses").update({
      status: "complete",
      overall_score: finalOverallScore,
      signal_strength: finalSignalStrength,
      report_data: reportData,
      idea_hash: ideaHash,
      updated_at: new Date().toISOString(),
    }).eq("id", analysisId);

    // ── Analytics event (fire-and-forget) ──
    if (pipelineUserId) {
      supabase.from("analytics_events").insert({
        event_name: "analysis_completed",
        user_id: pipelineUserId,
        metadata: { analysis_id: analysisId, score: finalOverallScore, signal_strength: finalSignalStrength },
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
            data: { idea: sanitizedIdea, score: finalOverallScore, analysisId },
          }),
        }).catch((e) => console.error("[pipeline] Email send failed:", e));
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Pipeline analyze error:", errorMessage);
    try {
      if (analysisId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceKey);
        await supabase.from("analyses").update({
          status: "failed",
          report_data: {
            error: "pipeline_analyze_error",
            message: errorMessage,
          },
          updated_at: new Date().toISOString(),
        }).eq("id", analysisId);
      }
    } catch (_) {}
    return new Response(JSON.stringify({ error: "Pipeline analysis failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
