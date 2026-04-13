# Gold Rush — Claude Code Guide

## Project Overview
Gold Rush is a data-driven startup idea validation SaaS. Users submit an idea, the pipeline fetches market signals from multiple APIs (App Store, GitHub, ProductHunt, Google Trends, Perplexity, Twitter/X, HackerNews, Serper), then an AI analysis engine produces a scored report with competitor matrix, revenue benchmarks, and founder recommendations.

## Tech Stack
- **Frontend**: React 18 + TypeScript, Vite, React Router 6, TanStack Query 5
- **UI**: shadcn-ui (Radix primitives) + Tailwind CSS (dark mode by default)
- **Backend**: Supabase (PostgreSQL + RLS + Auth + Edge Functions)
- **Payments**: Stripe (subscriptions + credits)
- **Email**: Resend API via pgmq queue
- **Error tracking**: Sentry (wired to `ErrorBoundary.componentDidCatch` — all uncaught React errors are captured)
- **Deployment**: Vercel (frontend) + Supabase (edge functions)

## Local Development
```bash
npm install
npm run dev        # starts on port 8080
npm run build      # production build
npm run build:dev  # unoptimized build
npm test           # vitest
```

## Environment Variables
**Frontend `.env`:**
```
VITE_SUPABASE_URL=https://vnileremxagzmlieykgm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
VITE_SUPABASE_PROJECT_ID=vnileremxagzmlieykgm
```

**Supabase Edge Function Secrets** (set in Supabase Dashboard → Settings → Secrets):
```
OPENAI_API_KEY
PERPLEXITY_API_KEY
SERPER_API_KEY
FIRECRAWL_API_KEY
KEYWORDS_EVERYWHERE_API_KEY
PRODUCTHUNT_API_KEY
TWITTER_BEARER_TOKEN
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
```

## Deployment
- **Frontend**: Vercel — push to main branch auto-deploys
- **Edge functions**: `SUPABASE_ACCESS_TOKEN=sbp_... npx supabase functions deploy <name> --project-ref vnileremxagzmlieykgm`
- Deploy all functions at once: `npx supabase functions deploy --project-ref vnileremxagzmlieykgm`

## Project Structure
```
src/
  pages/          # Route pages (Dashboard, Report, Processing, Admin, etc.)
  components/
    report/       # Report display components (14+ files)
    admin/        # Admin dashboard components (admin-only, guarded by AdminGuard)
    ui/           # shadcn-ui primitives
  hooks/          # useAuth, useAdmin, usePageTracking
  integrations/supabase/
    client.ts     # Supabase singleton
    types.ts      # Auto-generated DB types
  lib/            # subscriptionTiers, PDF generation, analytics
supabase/
  config.toml     # verify_jwt = false for all functions
  functions/      # 18 edge functions (includes run-pipeline compatibility wrapper)
  migrations/     # 20+ DB migrations
```

## Pipeline Architecture
The core pipeline is a two-phase async system:

```
User submits idea
  → start-pipeline        (creates DB record, triggers async)
  → run-pipeline-fetch    (collects market data, ~15-20s)
  → run-pipeline-analyze  (AI report generation, ~60-90s)
  → status = "complete" or "partial" (AI truncation fallback)
```

Processing page (`/processing/:id`) uses Supabase Realtime to watch `analyses` table for status changes. Both `"complete"` and `"partial"` statuses navigate to the report page — `"partial"` means the AI was truncated twice and a best-effort report was saved.

**timeout-watchdog** runs every 10 minutes via pg_cron. It marks any analysis stuck in `"fetching"` or `"analyzing"` for >5 minutes as `"failed"`, preventing orphaned rows.

**`_phase1Data` is stripped** from `report_data` before saving to DB. This prevents 50–100KB of raw API responses from bloating the `analyses` table per report.

**24-hour result cache**: `run-pipeline-fetch` hashes the idea text and reuses a completed analysis from the last 24 hours if one exists for the same idea. Cache hit returns instantly without consuming API credits.

### Key pipeline files
- `supabase/functions/run-pipeline-fetch/index.ts` — data collection engine (~2600 lines)
- `supabase/functions/run-pipeline-analyze/index.ts` — AI scoring and report structure (~2500 lines)
- `supabase/functions/timeout-watchdog/index.ts` — marks stuck analyses as failed (scheduled via pg_cron)
- `src/pages/Processing.tsx` — realtime status UI + 5s fallback re-trigger if pipeline was never started

### Active pipeline sources (run-pipeline-fetch)

| Source key | Provider | What it fetches |
|---|---|---|
| `serper_probe` | Serper | Quota check — runs first, gates all Serper calls |
| `serper_trends` | Serper | Google search volume & trending queries |
| `serper_news` | Serper | Recent news articles |
| `serper_reddit` | Serper | Reddit discussions via Google index |
| `serper_autocomplete` | Serper | Google autocomplete demand signals |
| `serper_competitor_0/1` | Serper | Google search for direct competitors |
| `serper_keyword_intel` | Serper | Search volume & CPC (Keywords Everywhere fallback) |
| `firecrawl_competitor_reviews` | Serper + Firecrawl | G2/Capterra/Trustpilot snippets for top 3 competitors |
| `perplexity_vc` | Perplexity | VC funding rounds & investor interest |
| `perplexity_competitors` | Perplexity | Competitor list + market saturation (combined prompt) |
| `perplexity_revenue` | Perplexity | ARR/pricing benchmarks |
| `perplexity_churn` | Perplexity | Retention & churn data |
| `perplexity_build_costs` | Perplexity | Dev time & infra cost estimates |
| `perplexity_trends` | Perplexity | Market trends (only fires when Serper quota exhausted) |
| `github` | GitHub | Open-source repos solving the same problem |
| `hackernews` | HN Algolia | HN discussions and Show HN posts |
| `producthunt` | Product Hunt | Launched products in the same category |
| `itunes_appstore` | iTunes Search API | iOS app competitors — free, no key needed |
| `twitter_counts` | Twitter/X | Weekly tweet volume (works on free tier) |
| `twitter_sentiment` | Twitter/X | Real tweets (requires X API Basic, $100/mo) |
| `twitter_influencers` | Twitter/X | Founder/builder profiles in the space |

**Removed sources:**
- `reddit_json` — removed: Reddit blocks Supabase cloud IPs, always returned 0. `serper_reddit` covers Reddit via Google.
- `firecrawl_reddit` — removed: Firecrawl search index doesn't cover Reddit well.
- `firecrawl_appstore` — replaced by `itunes_appstore` (free, more reliable).

### Serper quota gating
A probe query runs **before** all other Serper calls. If it returns 0 results, `serperActive = false` and all Serper calls are skipped. `perplexity_trends` fires as fallback when `!serperActive`.

### Competitor name extraction
`extractCompetitorsFromSources` extracts competitor names from the URL **domain** (not page title). Title-based extraction produced garbage like "Project Management Tools for Teams" or "The All". Domain extraction gives "Wrike", "Monday", "Toggl".

- `nonProductDomains` blocklist filters: reddit, google, apple, pcmag, techcrunch, g2, capterra, etc.
- Domain prefix/suffix stripping: `withmoxie` → "Moxie", `paymoapp` → "Paymo", `getclickup` → "Clickup"
- `genericPhrases` filter rejects category descriptions (e.g. "project management software")
- `maxNameWords = 5` — real product names rarely exceed 5 words

### Competitor review pipeline
After `validatedCompetitors` is built, the pipeline runs 3 Serper searches (`"CompetitorName" site:g2.com OR site:capterra.com OR site:trustpilot.com`) and stores the organic snippets as `rawData.firecrawlCompetitorReviews`. No scraping needed — Serper snippets contain ratings and review text. G2/Capterra block scrapers directly.

### Source timeouts (in run-pipeline-fetch)
```typescript
const SOURCE_TIMEOUTS = {
  github: 5000,
  firecrawl_appstore: 18000,
  perplexity_build_costs: 15000,
  perplexity_market: 15000,
  perplexity_revenue: 15000,
};
const DEFAULT_SOURCE_TIMEOUT = 8000;
```

### pipelineMetrics
Every completed analysis has `report_data.pipelineMetrics.sources` — an object keyed by source name with `{ status, durationMs, signalCount, error? }`. Use this to diagnose API issues.

Possible `status` values: `"ok"` | `"error"` | `"timeout"` | `"quota_exhausted"` | `"skipped"`

### Pipeline alerting
When any source fails with a billing/auth error (401, 402, 403, 429, quota keywords), `run-pipeline-fetch` sends an email alert to `yaronmadmon@gmail.com` via Resend. Deduplicated to at most **one email per hour** (checked via `email_send_log`). Also creates an in-app notification for admin users.

Triggers on: quota exhaustion, HTTP 401/402/403/429, "unauthorized", "billing", "rate limit", "exhausted" in error messages.

Does NOT trigger on: 0 signal counts (normal for niche ideas), timeouts.

## Key Patterns

### Auth
- Supabase Auth with email/password + Google/GitHub OAuth
- All user tables protected by RLS
- `useAuth` hook: `{ user, loading, profile, subscription }`
- Admin check: `useAdmin` hook reads `profiles.is_admin`
- Admin pages are wrapped by `AdminGuard` — accessible only to `yaronmadmon@gmail.com`

### Subscription tiers (src/lib/subscriptionTiers.ts)
- Free: 1 analysis
- Starter ($9/mo): 10/mo
- Pro ($29/mo): unlimited

### Semantic keyword generation
`run-pipeline-fetch` calls OpenAI `gpt-4o-mini` to generate a `queryStrategy` with:
- `broad[]` — 2 wide category queries
- `niche[]` — 2 feature-specific queries
- `problem[]` — 1 user-pain query

These drive all downstream searches (Serper, ProductHunt, GitHub, etc.). `primaryKeywords = broad[0]`.

### ProductHunt search
Uses PH GraphQL API if `PRODUCTHUNT_API_KEY` is set; falls back to Serper `site:producthunt.com`. URL filter accepts any PH path that isn't a topic/collection/story page.

### Twitter/X
`twitter_counts` works on free tier (counts endpoint). `twitter_sentiment` and `twitter_influencers` require X API Basic ($100/mo). All three fail gracefully with 0 signals if not available. API errors now throw (not silently return 0) so they show as `status: "error"` in pipelineMetrics.

`twitter_influencers` reads from `rawData.perplexityCompetitors` to find founder handles (was previously reading from `rawData.perplexityMarket` which was removed).

## Admin Dashboard
Located at `/admin` — accessible only to `yaronmadmon@gmail.com`.

Key admin components:
- `DataSourceHealth.tsx` — API health monitor, grouped by provider (Serper, Perplexity, Twitter, Firecrawl, free APIs). Shows alert banner when APIs are down, direct billing dashboard links per provider, pulsing red dot for active errors.
- `PipelineMetrics.tsx` — per-run metrics with charts (avg duration, avg signals by source), failure rates, drill-down into individual runs.
- `AnalysisManagement.tsx` — view/manage all user analyses.
- `UserManagement.tsx` — manage users, credits, suspensions.

## Database Tables
| Table | Purpose |
|-------|---------|
| `analyses` | Core table — idea, status, report_data (JSONB), blueprint_data |
| `profiles` | User metadata, credits, is_admin flag |
| `subscriptions` | Stripe subscription records |
| `credits_log` | Credit transaction history |
| `watchlist` | Saved ideas per user |
| `notifications` | User notifications |
| `feedback` | In-app feedback |
| `reviews` | App reviews |
| `analytics_events` | Page/event tracking |
| `live_feed_snapshots` | Market signal snapshots |
| `email_send_log` | Email delivery audit (also used for alert deduplication) |
| `x_api_cache` | Twitter API response cache |

## Pages
| Route | Page |
|-------|------|
| `/` | Landing |
| `/auth` | Login/signup |
| `/dashboard` | Main workspace |
| `/processing/:id` | Pipeline progress |
| `/report/:id` | Full analysis report |
| `/watchlist` | Saved ideas |
| `/live` | Live feed |
| `/pricing` | Subscription plans |
| `/settings` | User settings |
| `/buy-credits` | Credit purchase |
| `/admin` | Admin dashboard (admin only) |
| `/sample-report` | Demo report |

## Common Tasks

### Check why an analysis has low signal counts
```javascript
// Query analyses table:
report_data->pipelineMetrics->sources
// Each source has: { status, durationMs, signalCount, error? }
```

### Trigger a fresh pipeline run (bypasses 24h cache — use a unique idea string)
```bash
# 1. Create analysis row
curl -X POST "https://vnileremxagzmlieykgm.supabase.co/rest/v1/analyses" \
  -H "apikey: <service_role_key>" \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"idea":"your idea here","status":"pending","user_id":"<user_id>"}'

# 2. Trigger pipeline
curl -X POST https://vnileremxagzmlieykgm.supabase.co/functions/v1/start-pipeline \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{"analysisId":"<id from step 1>","idea":"your idea here"}'
```

### Deploy a single edge function
```bash
SUPABASE_ACCESS_TOKEN=sbp_... npx supabase functions deploy run-pipeline-fetch --project-ref vnileremxagzmlieykgm
```

### Query DB with service role key
```bash
curl "https://vnileremxagzmlieykgm.supabase.co/rest/v1/analyses?select=*&order=created_at.desc&limit=5" \
  -H "apikey: <service_role_key>" \
  -H "Authorization: Bearer <service_role_key>"
```

### Get the service role key
```bash
curl -s "https://api.supabase.com/v1/projects/vnileremxagzmlieykgm/api-keys" \
  -H "Authorization: Bearer sbp_1f39456f2e8061819dd25b670abcb7d6a564e9a8" \
  | python -m json.tool
# Use the "service_role" entry's api_key value
```
