# Gold Rush — Claude Code Guide

## Project Overview
Gold Rush is a data-driven startup idea validation SaaS. Users submit an idea, the pipeline fetches market signals from multiple APIs (Reddit, App Store, GitHub, ProductHunt, Google Trends, Perplexity, Twitter/X, HackerNews), then an AI analysis engine produces a scored report with competitor matrix, revenue benchmarks, and founder recommendations.

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
    admin/        # Admin dashboard components
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

### Key pipeline files
- `supabase/functions/run-pipeline-fetch/index.ts` — **2600+ lines**, the data collection engine
- `supabase/functions/run-pipeline-analyze/index.ts` — AI scoring and report structure (~2500 lines)
- `supabase/functions/timeout-watchdog/index.ts` — marks stuck analyses as failed (scheduled via pg_cron)
- `src/pages/Processing.tsx` — realtime status UI + 5s fallback re-trigger if pipeline was never started

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

## Key Patterns

### Auth
- Supabase Auth with email/password + Google/GitHub OAuth
- All user tables protected by RLS
- `useAuth` hook: `{ user, loading, profile, subscription }`
- Admin check: `useAdmin` hook reads `profiles.is_admin`

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
Returns 0 signals on free tier — needs X API Basic ($100/mo) for recent search. Currently non-blocking (graceful 0).

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
| `email_send_log` | Email delivery audit |
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
| `/admin` | Admin dashboard |
| `/sample-report` | Demo report |

## Common Tasks

### Check why an analysis has low signal counts
```javascript
// Query analyses table:
report_data->pipelineMetrics->sources
// Each source has: { status, durationMs, signalCount, error? }
```

### Deploy a single edge function
```bash
SUPABASE_ACCESS_TOKEN=sbp_... npx supabase functions deploy run-pipeline-fetch --project-ref vnileremxagzmlieykgm
```

### Test the pipeline programmatically
```bash
# Insert analysis row, then POST to start-pipeline
curl -X POST https://vnileremxagzmlieykgm.supabase.co/functions/v1/start-pipeline \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{"analysisId":"<id>","idea":"<idea text>"}'
```

### Query DB with service role key
```bash
curl "https://vnileremxagzmlieykgm.supabase.co/rest/v1/analyses?select=*&order=created_at.desc&limit=5" \
  -H "apikey: <service_role_key>" \
  -H "Authorization: Bearer <service_role_key>"
```
