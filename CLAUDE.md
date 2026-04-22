# Deal Hunter — Claude Code Guide

## Project Overview
Deal Hunter is a real estate deal-finding SaaS for investors. Users search distressed properties (tax liens, foreclosures, divorces, delinquencies), score every deal with AI, skip-trace owner contact info, and manage leads through a CRM pipeline.

**Origin:** Converted from "Gold Rush" (startup idea validation SaaS). Same Supabase project (`vnileremxagzmlieykgm`), same Stripe/auth/email infra. All Gold Rush tables and edge functions remain intact — additive-only migration strategy.

## Tech Stack
- **Frontend**: React 18 + TypeScript, Vite, React Router 6, TanStack Query 5
- **UI**: shadcn-ui (Radix primitives) + Tailwind CSS (dark mode by default)
- **Backend**: Supabase (PostgreSQL + RLS + Auth + Edge Functions + Realtime)
- **Payments**: Stripe (subscriptions + credits)
- **Email**: Resend API via pgmq queue (`process-email-queue` edge function — uses direct Resend REST API fetch, not a library)
- **Error tracking**: Sentry (wired to `ErrorBoundary.componentDidCatch`)
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
# Deal Hunter (new — must be added)
ATTOM_API_KEY              # api.developer.attomdata.com — 30-day free trial
TRACERFY_API_KEY           # tracerfy.com — $0.02/record skip trace
ANTHROPIC_API_KEY          # claude-sonnet-4-6 for deal scoring in run-deal-analyze

# Reused from Gold Rush (already set in project)
OPENAI_API_KEY             # GPT-4o-mini for adversarial kill pass
PERPLEXITY_API_KEY         # market narrative in run-deal-analyze
SERPER_API_KEY             # owner research, neighborhood, deal killers in run-deal-analyze
FIRECRAWL_API_KEY          # Zillow photo scraping in run-deal-analyze
KEYWORDS_EVERYWHERE_API_KEY # market heat in run-deal-analyze

# Payments / Email (unchanged)
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
PRODUCTHUNT_API_KEY
TWITTER_BEARER_TOKEN
```

## Deployment
- **Frontend**: Vercel — push to main branch auto-deploys
- **Edge functions**: `SUPABASE_ACCESS_TOKEN=sbp_... npx supabase functions deploy <name> --project-ref vnileremxagzmlieykgm`
- Deploy all functions at once: `npx supabase functions deploy --project-ref vnileremxagzmlieykgm`

## Project Structure
```
src/
  pages/
    DealSearch.tsx       # /dashboard — main property search + results grid
    PropertyDetail.tsx   # /property/:id — AI deal report + owner contact + ROI calc
    DealPipeline.tsx     # /pipeline — kanban CRM (7 stages, dropdown-based)
    Processing.tsx       # /processing/:id — realtime batch progress (watches properties table)
    AuctionCalendar.tsx  # /auctions — upcoming foreclosure/sheriff/tax deed auctions
    BuyCredits.tsx       # /buy-credits — skip trace credit packs
    Pricing.tsx          # /pricing — Free / Starter $29 / Pro $79
    Index.tsx            # / — Deal Hunter landing page
    # Legacy Gold Rush pages kept: SampleReport, Auth, Settings, etc.
  components/
    deal/                # 14 Deal Hunter components (see list below)
    report/              # Gold Rush report components — ScoreRing + CollapsibleSection reused
    admin/               # Admin dashboard components
    ui/                  # shadcn-ui primitives (45 components, unchanged)
  hooks/                 # useAuth, useAdmin, usePageTracking
  integrations/supabase/
    client.ts            # Supabase singleton
    types.ts             # Auto-generated DB types (regen after migrations)
  lib/
    subscriptionTiers.ts # Tier config — Starter $29, Pro $79, legacy IDs kept
supabase/
  config.toml            # verify_jwt = false for all functions
  functions/             # 25+ edge functions
  migrations/            # 20+ migrations (Deal Hunter tables in 20260422000001/2)
```

### Deal components (`src/components/deal/`)
| Component | Purpose |
|-----------|---------|
| `DealScoreBadge.tsx` | Score badge — green ≥70 / yellow 40-69 / red <40 |
| `DistressTypeBadge.tsx` | Distress type tags — amber/red/purple/orange by type |
| `DealKillerBadge.tsx` | Hard kill signal display with evidence text |
| `PropertyCard.tsx` | Card in DealSearch grid; shows skeleton for pending status |
| `SearchFilters.tsx` | Left sidebar — location, distress types, price/equity/type filters |
| `PropertyInfoSection.tsx` | Beds/baths/sqft/value grid + photo carousel (if available) |
| `DistressDetailsSection.tsx` | Renders `distress_details` JSONB as human-readable grid |
| `AIAnalysisSection.tsx` | score_rationale, distress_analysis, equity_assessment, opps/risks |
| `IntelligenceSection.tsx` | Market heat, neighborhood sentiment, owner research, public records |
| `OwnerContactSection.tsx` | Skip trace CTA or revealed phone/email/address with copy buttons |
| `ContactLogSection.tsx` | Contact history timeline + add-contact form |
| `ROICalculator.tsx` | 70%-rule pre-filled calculator; net profit, ROI%, max allowable offer |
| `PipelineCard.tsx` | Kanban card with stage dropdown |
| `KanbanColumn.tsx` | One kanban column with header + card list |

---

## Two-Layer Pipeline Architecture

```
LAYER 1 — FOUNDATION (ATTOM Data)
  Verified property facts: address, beds/baths/sqft, estimated value,
  lien amounts, foreclosure stage, equity position, distress types.
  Source: api.gateway.attomdata.com/propertyapi/v1.0.0/allevents/detail

LAYER 2 — INTELLIGENCE (existing Gold Rush API keys reused)
  ├── Market Heat        Keywords Everywhere — "sell my house fast [zip]" volume,
  │                      "cash for houses [city]" CPC → motivated seller ratio
  ├── Owner Research     Serper — "[owner name] court OR bankruptcy" confirms distress
  ├── Neighborhood       Serper Reddit — investor ground-truth sentiment
  ├── Deal Killers       Serper — flood zone, EPA, HOA lien (adversarial)
  ├── Public Records     Serper — lis pendens, tax lien confirmation
  ├── Market Narrative   Perplexity — "[zip] real estate investment 2026"
  └── Photos             Firecrawl — Zillow photo carousel scrape → report_data.photos[]

Claude claude-sonnet-4-6 scores the deal using BOTH layers.
```

### Deal scoring thresholds
| Score | Verdict |
|-------|---------|
| ≥ 70 | Strong Deal |
| 40–69 | Investigate |
| < 40 | Pass |

### Adversarial kill pass (run-deal-analyze)
GPT-4o-mini reads deal killer Serper results before Claude scores. Returns `hardKillSignals[]`:
- 2+ Hard kills → force `deal_verdict='Pass'`, skip Claude call
- 1 Hard kill → downgrade one level after Claude scores

Kill types: `flood_zone`, `environmental`, `title_dispute`, `underwater`, `hoa_overleveraged`

### Deal Hunter pipeline flow
```
User submits search (location + distress types)
  → start-property-search    generates searchBatchId, triggers run-property-fetch async
  → run-property-fetch       ATTOM API → bulk upsert properties (status='scoring')
                             → triggers run-deal-analyze per property (150ms delay)
                             → checkSavedSearchAlerts() for email notifications
  → run-deal-analyze         Layer 2 intelligence (parallel) + adversarial pass + Claude
                             → updates property: deal_score, deal_verdict, report_data, status='complete'

Processing page (/processing/:searchBatchId):
  - Supabase Realtime watches properties table where search_batch_id=eq.${id}
  - Polls every 8s as fallback
  - Navigates to /dashboard when all properties are complete or failed
```

### Key Deal Hunter edge functions
| Function | Purpose |
|----------|---------|
| `start-property-search` | Validates quota, generates searchBatchId, triggers fetch async |
| `run-property-fetch` | ATTOM Layer 1 → bulk upsert → triggers analyze per property |
| `run-deal-analyze` | Layer 2 intelligence + adversarial pass + Claude scoring |
| `skip-trace` | Checks cache → deducts credit → Tracerfy API → stores in owner_contacts |
| `refresh-auction-feed` | Serper auction queries → parses with GPT-4o-mini → live_feed_snapshots |
| `timeout-watchdog` | Marks stuck properties (searching/scoring >5min) as failed |

### report_data structure (properties table)
```json
{
  "deal_score": 82,
  "deal_verdict": "Strong Deal",
  "score_rationale": "...",
  "distress_analysis": "...",
  "equity_assessment": "...",
  "market_heat_assessment": "...",
  "risks": [],
  "opportunities": [],
  "photos": [],
  "intelligence": {
    "marketHeat": { "motivatedSellerVolume": 1200, "investorCompetitionCpc": 4.50, "signal": "High Opportunity" },
    "neighborhoodSentiment": { "snippets": [], "sentiment": "Positive|Mixed|Negative" },
    "ownerResearch": { "courtRecords": [], "distressConfirmed": true },
    "dealKillers": { "floodZone": false, "environmental": false, "killSignals": [] },
    "publicRecordsConfirm": { "lisPendensConfirmed": true, "taxLienConfirmed": true },
    "marketNarrative": "Perplexity summary..."
  },
  "pipelineMetrics": { "sources": { ... } }
}
```

---

## Database Tables

### Deal Hunter tables (added 2026-04-22)
| Table | Purpose |
|-------|---------|
| `properties` | Core deal record — ATTOM data + AI score + report_data JSONB |
| `pipeline_deals` | CRM tracking — stage (new/contacted/negotiating/won/dead), priority |
| `owner_contacts` | Skip trace results — phones, emails, mailing address (UNIQUE per property+user) |
| `contact_log` | Immutable contact history — call/email/sms/visit/note + outcome |
| `saved_searches` | Saved filter presets for email alerts |

### Legacy Gold Rush tables (unchanged — keep for existing users)
| Table | Purpose |
|-------|---------|
| `analyses` | Gold Rush — idea, status, report_data JSONB, blueprint_data |
| `profiles` | User metadata, credits (now = skip trace credits), is_admin flag |
| `subscriptions` | Stripe subscription records |
| `credits_log` | Credit transaction history — has `property_id` nullable FK added |
| `watchlist` | Gold Rush saved ideas |
| `notifications` | User notifications |
| `feedback` | In-app feedback |
| `reviews` | App reviews |
| `analytics_events` | Page/event tracking |
| `live_feed_snapshots` | Auction data stored here (section_name LIKE 'auctions_%') |
| `email_send_log` | Email delivery audit + alert deduplication |
| `x_api_cache` | Twitter API response cache |

### Key DB functions
- `deduct_credit_for_property(p_property_id uuid) RETURNS boolean` — SECURITY DEFINER, locks profile row, decrements credits, logs to credits_log with property_id. Returns false if insufficient credits.

---

## Subscription Tiers (`src/lib/subscriptionTiers.ts`)
| Tier | Price | Searches/mo | Skip Traces/mo |
|------|-------|-------------|----------------|
| Free | — | 3 lifetime | 2 on signup |
| Starter | $29/mo | 50 | 25 |
| Pro | $79/mo | Unlimited | 100 |

**Important:** Legacy Gold Rush price IDs are kept as `_legacy_starter` / `_legacy_pro` in the tier config so existing Stripe subscribers keep access. Only remove after migration is complete.

Skip trace credit packs (one-time, never expire):
- 10 traces: $9 (`price_1T8vKjFDYbFzESfWQMsMJQlV`)
- 25 traces: $19 (`price_1T8vL9FDYbFzESfWzDj8x9HS`)

---

## Pages & Routes
| Route | Page | Notes |
|-------|------|-------|
| `/` | `Index.tsx` | Deal Hunter landing page |
| `/auth` | `Auth.tsx` | Login/signup (unchanged) |
| `/dashboard` | `DealSearch.tsx` | Main search + property grid |
| `/processing/:id` | `Processing.tsx` | Batch progress (watches `properties` by `search_batch_id`) |
| `/property/:id` | `PropertyDetail.tsx` | Full deal report + skip trace + ROI calc |
| `/pipeline` | `DealPipeline.tsx` | Kanban CRM |
| `/auctions` | `AuctionCalendar.tsx` | Foreclosure/sheriff/tax deed auctions |
| `/buy-credits` | `BuyCredits.tsx` | Skip trace credit packs |
| `/pricing` | `Pricing.tsx` | Subscription plans |
| `/settings` | `Settings.tsx` | User settings (unchanged) |
| `/admin` | `Admin.tsx` | Admin dashboard |
| `/payment-success` | `PaymentSuccess.tsx` | Post-Stripe redirect |
| `/reset-password` | `ResetPassword.tsx` | Password reset |
| `/privacy` | `PrivacyPolicy.tsx` | Legal |
| `/terms` | `Terms.tsx` | Legal |

---

## Key Patterns

### Auth
- Supabase Auth with email/password + Google/GitHub OAuth
- All user tables protected by RLS (`auth.uid() = user_id`)
- `useAuth` hook: `{ user, loading, profile, subscription }`
- Admin check: `useAdmin` hook reads `profiles.is_admin`
- Admin pages wrapped by `AdminGuard` — accessible only to `yaronmadmon@gmail.com`

### Skip trace flow
1. `OwnerContactSection` calls `skip-trace` edge function with `{ propertyId }`
2. Function checks `owner_contacts` cache first — returns cached result, no credit charge
3. Calls `deduct_credit_for_property` RPC — returns 402 if credits = 0
4. Calls Tracerfy: `POST https://api.tracerfy.com/v1/skiptrace`
5. On Tracerfy failure: refunds credit (+1 to profiles.credits) before returning 503
6. Stores result in `owner_contacts`, returns to frontend

### Realtime (DealSearch + Processing)
Both pages subscribe to `postgres_changes` on the `properties` table. DealSearch listens with `user_id=eq.${user.id}` to catch live updates as properties complete scoring. Processing listens with `search_batch_id=eq.${id}` and polls every 8s as fallback.

### Email alerts for saved searches
`run-property-fetch` calls `checkSavedSearchAlerts()` after bulk-insert:
1. Fetches all `saved_searches` matching the batch zip/city
2. Filters newly inserted properties against each saved search's `filters` JSONB
3. Deduplicates via `email_send_log` (1 alert per user per zip per 24h)
4. Enqueues via existing `enqueue_email()` RPC with type `'new_deal_alert'`
`send-transactional-email` handles `new_deal_alert` template — lists up to 5 properties with score, verdict, equity, link.

### pipelineMetrics (inherited from Gold Rush)
Every completed property has `report_data.pipelineMetrics.sources` keyed by source name with `{ status, durationMs, signalCount, error? }`. Used by admin DataSourceHealth for per-run API diagnostics.

---

## Admin Dashboard (`/admin`)
Accessible only to `yaronmadmon@gmail.com`.

| Section | Component | Data source |
|---------|-----------|-------------|
| Overview | `AdminOverview` | `properties` + `pipeline_deals` + `credits_log` |
| Properties | `PropertyManagement` | `properties` table — address/score/verdict/equity |
| Pipeline CRM | `WatchlistManagement` | `pipeline_deals` joined with `properties` |
| Credits | `CreditsManagement` | `credits_log` |
| Legacy Analyses | `AnalysisManagement` | `analyses` (Gold Rush) |
| Data Sources | `DataSourceHealth` | `properties.report_data.pipelineMetrics.sources` |
| AI Pipeline | `PipelineMetrics` | Per-run metrics |
| Users | `UserManagement` | `profiles` |

---

## Common Tasks

### Trigger a deal search manually
```bash
# POST to start-property-search
curl -X POST https://vnileremxagzmlieykgm.supabase.co/functions/v1/start-property-search \
  -H "Authorization: Bearer <user_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"location":"Detroit, MI","distressTypes":["tax_lien","foreclosure"]}'
# Returns: { "queued": true, "searchBatchId": "<uuid>" }
```

### Manually score a single property
```bash
curl -X POST https://vnileremxagzmlieykgm.supabase.co/functions/v1/run-deal-analyze \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{"propertyId":"<uuid>"}'
```

### Check deal pipeline health
```sql
-- Properties stuck in scoring for >10 minutes
SELECT id, address, status, updated_at
FROM properties
WHERE status IN ('searching', 'scoring')
AND updated_at < NOW() - INTERVAL '10 minutes';

-- Skip trace credit balance per user
SELECT p.email, p.credits
FROM profiles p
ORDER BY p.credits DESC;
```

### Deploy a Deal Hunter edge function
```bash
SUPABASE_ACCESS_TOKEN=sbp_... npx supabase functions deploy run-deal-analyze --project-ref vnileremxagzmlieykgm
```

### Query properties with service role key
```bash
curl "https://vnileremxagzmlieykgm.supabase.co/rest/v1/properties?select=*&order=created_at.desc&limit=5" \
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

### Regenerate TypeScript types after migrations
```bash
npx supabase gen types typescript --project-id vnileremxagzmlieykgm > src/integrations/supabase/types.ts
```
Until regenerated, new tables are accessed with `as any` casts (intentional during dev).

---

## Legacy Gold Rush Pipeline (still active)

The original Gold Rush startup validation pipeline is fully intact and accessible at the legacy routes. The `analyses` table, all Gold Rush edge functions, and the sample report remain live.

### Gold Rush pipeline flow
```
User submits idea
  → start-pipeline        (creates DB record, triggers async)
  → run-pipeline-fetch    (collects market data ~15-20s, ~2600 lines)
  → run-pipeline-analyze  (AI scoring ~60-90s, ~2500 lines)
  → status = "complete" or "partial"
```

### Gold Rush verdict thresholds
| Score | Verdict |
|-------|---------|
| ≥ 80 | Build Now |
| 70–79 | Strong Conditional |
| 40–69 | Validate Further |
| < 40 | Do Not Build Yet |
| — | Insufficient Data |

### Gold Rush signal tiers
| Tier | Sources | Weight |
|------|---------|--------|
| Tier 1 | Serper organic, Reddit, Twitter, Firecrawl reviews, App Store, ProductHunt, GitHub | 0.9 |
| Tier 2 | HackerNews, VC funding | 0.7 |
| Tier 3 | Perplexity summaries | 0.15 |

For full Gold Rush pipeline documentation (scoring gates, source list, adversarial pass details, calibration history), see git history of CLAUDE.md prior to 2026-04-22.

---

## Changelog

### 2026-04-22 — Gold Rush → Deal Hunter Conversion

**New tables** (migration `20260422000001_deal_hunter_tables.sql`):
- `properties` — core deal record with ATTOM data + AI scoring
- `pipeline_deals` — CRM kanban (7 stages)
- `owner_contacts` — skip trace results, UNIQUE per property+user
- `contact_log` — immutable contact history
- `saved_searches` — filter presets for email alerts
- `credits_log` gets nullable `property_id` FK column (migration `20260422000002`)
- `deduct_credit_for_property` SECURITY DEFINER RPC added

**New edge functions:**
- `start-property-search` — search orchestration, returns searchBatchId
- `run-property-fetch` — ATTOM Layer 1, bulk upsert, triggers analyze, saved search alerts
- `run-deal-analyze` — Layer 2 intelligence + adversarial pass + Claude claude-sonnet-4-6 scoring
- `skip-trace` — Tracerfy integration with credit deduction/refund
- `refresh-auction-feed` — Serper auction data → live_feed_snapshots

**Modified edge functions:**
- `timeout-watchdog` — now also marks stuck `properties` rows as failed
- `send-transactional-email` — added `new_deal_alert` email type + updated branding

**New frontend pages:** `DealSearch`, `PropertyDetail`, `DealPipeline`, `AuctionCalendar`

**New components:** 14 components in `src/components/deal/` including `ROICalculator`

**Routing changes:** `/dashboard` → DealSearch, `/property/:id` → PropertyDetail, `/pipeline` → DealPipeline, `/auctions` → AuctionCalendar. Legacy Gold Rush routes (`/report/:id`, `/sample-report`) remain.

**AppNav:** Rebranded to Deal Hunter, nav items: Deal Search / Pipeline / Auctions / Settings. Credit label: "skip traces".

**Subscription tiers:** Starter $29/mo (50 searches, 25 traces), Pro $79/mo (unlimited, 100 traces). Legacy $9/$29 IDs kept as `_legacy_starter`/`_legacy_pro`.

**Admin:** Added `PropertyManagement` component, updated `WatchlistManagement` to show `pipeline_deals`, updated `AdminOverview` stats to query `properties`.

### 2026-04-15 — Gold Rush Bug Fixes (pre-conversion)
Evidence sufficiency gate tier mismatch fixed, reddit_scrape replaced with second Serper pain query, adversarial quota-padding fixed.

### 2026-04-14 — Gold Rush Integrity & Calibration Overhaul
Adversarial pass added, evidence sufficiency gate, raised verdict thresholds, Perplexity weight 0.4→0.15, floor rules removed, deep signal query strategy expansion.
