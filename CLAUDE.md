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
- **Edge functions**: `npx supabase functions deploy <name> --project-ref vnileremxagzmlieykgm`
  - If CLI is already logged in (`npx supabase projects list` confirms linked project), no `SUPABASE_ACCESS_TOKEN` env var is needed
  - If running in a fresh shell: `SUPABASE_ACCESS_TOKEN=sbp_... npx supabase functions deploy <name> --project-ref vnileremxagzmlieykgm`
- Deploy all functions at once: `npx supabase functions deploy --project-ref vnileremxagzmlieykgm`

## Project Structure
```
src/
  pages/
    DealSearch.tsx       # /dashboard — campaign-first search hub; sidebar of past searches, results grouped by verdict
    PropertyDetail.tsx   # /property/:id — AI deal report + quick-action bar + owner contact + ROI calc + SMS + AI coaching
    DealPipeline.tsx     # /pipeline — kanban CRM (7 stages, dropdown-based)
    Processing.tsx       # /processing/:id — realtime batch progress (watches properties table)
    Inbox.tsx            # /inbox — SMS inbox: all threads, unread counts, AI draft approval
    FollowUpQueue.tsx    # /follow-ups — AI-scheduled follow-up queue (overdue/today/upcoming)
    Meetings.tsx         # /meetings — booked meetings from SMS conversations; calendar export
    TodayView.tsx        # /today — daily operational summary: replies waiting, follow-ups due, meetings today
    MonitoredAreas.tsx   # /monitored — monitored-search schedule management
    AuctionCalendar.tsx  # /auctions — upcoming foreclosure/sheriff/tax deed auctions
    BuyCredits.tsx       # /buy-credits — skip trace credit packs
    Pricing.tsx          # /pricing — Free / Starter $29 / Pro $79
    Index.tsx            # / — Deal Hunter landing page
    # Legacy Gold Rush pages kept: SampleReport, Auth, Settings, etc.
  components/
    deal/                # 20 Deal Hunter components (see list below)
    report/              # Gold Rush report components — ScoreRing + CollapsibleSection reused
    admin/               # Admin dashboard components
    ui/                  # shadcn-ui primitives (45 components, unchanged)
  hooks/
    useAuth.ts           # { user, loading, profile, subscription }
    useAdmin.ts          # admin guard
    useInboxCount.ts     # live unread SMS thread count (realtime subscription)
    useFollowUpCount.ts  # overdue follow-up count
    usePageTracking.ts   # analytics
  integrations/supabase/
    client.ts            # Supabase singleton
    types.ts             # Auto-generated DB types (regen after migrations)
  lib/
    subscriptionTiers.ts # Tier config — Starter $29, Pro $79, legacy IDs kept
    monitoring.ts        # Monitoring helpers
    property-history.ts  # Property history helpers
supabase/
  config.toml            # verify_jwt = false for all functions
  functions/             # 25+ edge functions
  migrations/            # 20+ migrations (Deal Hunter tables in 20260422000001/2)
```

### Deal components (`src/components/deal/`)
| Component | Purpose |
|-----------|---------|
| `DealScoreBadge.tsx` | Score badge — green ≥70 / yellow 40-69 / red <40 |
| `DistressTypeBadge.tsx` | Distress type tags — calmer palette: violet=tax lien, blue=foreclosure |
| `DealKillerBadge.tsx` | Hard kill signal display with evidence text |
| `PropertyCard.tsx` | Card in DealSearch grid — Zillow photo header, owner name, LTV color, opportunity badge, contact buttons (phone/SMS/email when traced), "Get Owner Info" skip-trace button, Street View link, AI Outreach button |
| `SearchFilters.tsx` | Filter panel — location, distress types, price/equity/type filters + saved searches with Monitor toggle and last-checked timestamp |
| `PropertyInfoSection.tsx` | Beds/baths/sqft/value grid + photo carousel (if available) |
| `DistressDetailsSection.tsx` | Renders `distress_details` JSONB as human-readable grid |
| `AIAnalysisSection.tsx` | score_rationale, distress_analysis, equity_assessment, opportunity_analysis, opps/risks; handles mixed string/object Serper items via `toStr()` |
| `IntelligenceSection.tsx` | Market heat, neighborhood sentiment, owner research, public records; handles mixed string/object snippets via `toText()` |
| `OwnerContactSection.tsx` | Skip trace CTA or revealed phone/email/address with copy buttons |
| `ContactLogSection.tsx` | Contact history timeline + add-contact form; triggers `schedule-followup` after each log entry |
| `ROICalculator.tsx` | 70%-rule pre-filled calculator; net profit, ROI%, max allowable offer |
| `PipelineCard.tsx` | Kanban card — stage dropdown, notes display + inline edit |
| `KanbanColumn.tsx` | One kanban column with header + card list |
| `OutreachSection.tsx` | AI-generated email/SMS outreach drafts — Tabs UI, calls `generate-outreach`, Copy button, mailto/sms deep links; SMS gets Twilio compliance footer |
| `PropertyHistorySection.tsx` | Transaction, tax assessment, and listing price history from `report_data.history` |
| `SMSConversationSection.tsx` | Full SMS thread — message bubbles, AI draft approval (send/dismiss/edit), Summarize button (calls generate-outreach summary type), manual reply input |
| `AISalesCoachingSection.tsx` | Collapsible coaching panel — seller motivation, hesitation signals, recommended tone, next best action, equity-based negotiation tip (4 tiers by equity %), objection handling |

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
  └── Photos + History   Firecrawl — Zillow photo carousel + listing price history → report_data.photos[] / report_data.history.listing[]

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
                             → classifyOpportunity() deterministic pre-classification
                             → updates property: deal_score, deal_verdict, report_data (incl. opportunity_type,
                               opportunity_analysis, history.sales, history.assessments, history.listing), status='complete'
                             → EdgeRuntime.waitUntil(autoTraceStrongDeal()) — if verdict = "Strong Deal",
                               auto-traces via Tracerfy (no credit charge) and inserts into owner_contacts

Area monitoring (automated):
  → run-monitored-searches   cron-triggered (hourly); processes saved_searches where is_monitored=true
                             and last_monitored_at is due per monitor_frequency_hours
                             → ATTOM fetch → filter by seen_attom_ids → upsert new properties
                             → triggers run-deal-analyze per new property
                             → updates seen_attom_ids + last_monitored_at

Processing page (/processing/:searchBatchId):
  - Supabase Realtime watches properties table where search_batch_id=eq.${id}
  - Polls every 8s as fallback
  - Navigates to /dashboard when all properties are complete or failed
```

### Key Deal Hunter edge functions
| Function | Purpose |
|----------|---------|
| `start-property-search` | Validates quota, generates searchBatchId, creates `search_campaigns` row, triggers fetch async |
| `run-property-fetch` | ATTOM Layer 1 → bulk upsert → stamps `campaign_id` on each property → triggers analyze per property |
| `run-deal-analyze` | Layer 2 intelligence + adversarial pass + Claude scoring + opportunity classification + history fetch + auto-trace Strong Deals |
| `skip-trace` | Checks cache → deducts credit → Tracerfy API (`tracerfy.com/v1/api/trace/lookup/`) → stores in owner_contacts |
| `generate-outreach` | GPT-4o email/SMS/summary drafts — free, no credits. Input: `{propertyId, outreachType, messages?}`. SMS gets Twilio A2P compliance footer. `outreachType="summary"` returns 2-3 sentence CRM summary of a conversation. |
| `receive-sms` | Twilio inbound webhook — stores AI draft in `sms_threads.ai_draft`, increments `unread_count`, does NOT auto-send; books meetings automatically when homeowner confirms a time |
| `send-sms` | Sends via Twilio, clears `ai_draft`, resets `unread_count` to 0 |
| `schedule-followup` | AI follow-up scheduling — reads contact history + SMS message/reply counts → sets `next_action`, `follow_up_at`, `next_step_brief`, `urgency_flag` on `pipeline_deals` |
| `refresh-owner-basics` | Lightweight ATTOM re-fetch for missing owner/mortgage fields |
| `run-followup-agent` | Processes follow-up queue automation |
| `run-monitored-searches` | Cron-triggered (every 15 min): re-runs due monitored saved searches, finds new ATTOM properties, triggers analyze, emails alert |
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
| `properties` | Core deal record — ATTOM data + AI score + report_data JSONB. Added: `campaign_id` FK → `search_campaigns` |
| `search_campaigns` | Named search batches — `name` (e.g. "Ocean County NJ — May 8"), `filters` JSONB, `property_count`. One row per search run. |
| `pipeline_deals` | CRM tracking — stage, priority, notes. Added: `follow_up_at`, `follow_up_status`, `next_action`, `next_step_brief`, `urgency_flag`, `tags` |
| `owner_contacts` | Skip trace results — phones, emails, mailing address (UNIQUE per property+user) |
| `contact_log` | Immutable contact history — call/email/sms/visit/note + outcome |
| `saved_searches` | Saved filter presets for email alerts + monitoring schedule |
| `sms_threads` | One row per property+user SMS conversation — `homeowner_phone`, `status`, `ai_draft` (pending AI reply awaiting approval), `unread_count`, `last_inbound_at` |
| `sms_messages` | Individual SMS messages — `thread_id`, `direction` (inbound/outbound), `body`, `created_at` |
| `meetings` | Booked meetings detected from SMS conversations — `property_id`, `homeowner_name`, `scheduled_at`, `status` (pending/confirmed/cancelled) |

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
| `/dashboard` | `DealSearch.tsx` | Campaign-first search hub — sidebar of named search batches, results grouped by verdict |
| `/processing/:id` | `Processing.tsx` | Batch progress (watches `properties` by `search_batch_id`) |
| `/property/:id` | `PropertyDetail.tsx` | Full deal report + quick-action bar + skip trace + ROI calc + SMS conversation + AI coaching |
| `/pipeline` | `DealPipeline.tsx` | Kanban CRM |
| `/inbox` | `Inbox.tsx` | SMS inbox — all threads with unread counts and AI draft approval |
| `/follow-ups` | `FollowUpQueue.tsx` | AI-scheduled follow-up queue — overdue / due today / upcoming |
| `/meetings` | `Meetings.tsx` | Booked meetings from SMS conversations — Google Calendar + .ics export |
| `/today` | `TodayView.tsx` | Daily operational summary — replies waiting, follow-ups due, meetings today |
| `/monitored` | `MonitoredAreas.tsx` | Monitored-search schedule management |
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

### 2026-05-08 — CRM Workflow, SMS Inbox, Campaign-First Search

**New tables/columns:**
- `search_campaigns` — named search batches; `properties.campaign_id` FK added
- `pipeline_deals` — added `follow_up_at`, `follow_up_status`, `next_action`, `next_step_brief`, `urgency_flag`, `tags`, `notes` columns
- `sms_threads` — added `ai_draft`, `unread_count`, `last_inbound_at`
- `sms_messages`, `meetings` — new tables for SMS thread messages and booked meetings

**New edge functions:**
- `receive-sms` — Twilio inbound; stores AI draft (does NOT auto-send), increments unread, detects + books meetings
- `send-sms` — sends via Twilio, clears ai_draft + unread_count
- `schedule-followup` — AI follow-up scheduling with SMS escalation rules
- `refresh-owner-basics` — lightweight ATTOM re-fetch for owner/mortgage fields
- `run-followup-agent` — follow-up queue automation

**Updated edge functions:**
- `start-property-search` — creates `search_campaigns` row, returns `campaignId`
- `run-property-fetch` — stamps `campaign_id` on each property
- `generate-outreach` — added `summary` type (2-3 sentence CRM summary from conversation); SMS gets Twilio A2P compliance footer

**New frontend pages:** `Inbox`, `FollowUpQueue`, `Meetings`, `TodayView`, `MonitoredAreas`

**New components:** `SMSConversationSection` (AI draft approval, Summarize), `AISalesCoachingSection` (equity-based tips, 4 tiers)

**DealSearch redesign:** Campaign-first layout — left sidebar lists named past searches, main area shows results grouped by verdict (Analyzing → Strong Deal → Investigate → Pass). Pass collapsed by default. Engagement filter pills, text search, sort controls.

**PropertyDetail improvements:** Quick-action bar (stage selector + scroll-to Log Contact/SMS/AI Draft), overdue follow-up alert banner, meeting prep card with distress-type talking points, AI sales coaching panel after first contact.

**FollowUpQueue:** Summary header chips showing overdue/due today/upcoming counts.

**AppNav:** Inbox nav item with live unread badge (`useInboxCount` realtime hook).

**Design:** Monochrome primary palette — black/white CTAs, calmer distress badges (violet=tax lien, blue=foreclosure).

---

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
