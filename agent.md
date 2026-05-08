# Deal Hunter Agent Guide

## Purpose
This repository is `Deal Hunter`, a real-estate investor SaaS. Users search distressed properties, review property history and opportunity signals, reveal owner contact info, and move leads through a pipeline.

This file is a short operating guide for coding agents working in this repo.

## Stack
- Frontend: React 18, TypeScript, Vite, React Router, Tailwind, shadcn-ui
- Backend: Supabase Postgres, Auth, Realtime, Edge Functions
- Payments: Stripe
- Email: Resend via queue
- Deployment: Vercel for frontend, Supabase for edge functions

## Important Project IDs
- Supabase project: `vnileremxagzmlieykgm`
- Frontend production alias: `https://deal-hunter-beta.vercel.app`

## Core Frontend Entry Points
- `src/pages/DealSearch.tsx`: campaign-first search hub — sidebar of past searches, properties grouped by verdict
- `src/pages/PropertyDetail.tsx`: property report, owner info, outreach, ROI, contact log, SMS conversation, AI coaching
- `src/pages/DealPipeline.tsx`: kanban pipeline (7 stages)
- `src/pages/Processing.tsx`: batch progress (realtime + 8s poll)
- `src/pages/Index.tsx`: landing page
- `src/pages/Inbox.tsx`: SMS inbox — all threads with unread counts and AI draft approval
- `src/pages/FollowUpQueue.tsx`: AI-scheduled follow-up queue — overdue / due today / upcoming sections
- `src/pages/Meetings.tsx`: booked meetings from SMS conversations — Google Calendar + .ics export
- `src/pages/TodayView.tsx`: daily operational summary — replies waiting, follow-ups due, meetings today
- `src/pages/MonitoredAreas.tsx`: monitored-search schedule management
- `src/pages/AuctionCalendar.tsx`: upcoming foreclosure/sheriff/tax deed auctions
- `src/pages/BuyCredits.tsx`: skip trace credit packs
- `src/pages/Pricing.tsx`: subscription plans

## Core Edge Functions
- `supabase/functions/start-property-search/index.ts` — creates search_campaigns row, returns campaignId
- `supabase/functions/run-property-fetch/index.ts` — stamps campaign_id on each property, updates property_count
- `supabase/functions/run-deal-analyze/index.ts`
- `supabase/functions/skip-trace/index.ts`
- `supabase/functions/run-monitored-searches/index.ts`
- `supabase/functions/generate-outreach/index.ts` — email / sms / summary types; SMS gets Twilio compliance footer
- `supabase/functions/receive-sms/index.ts` — Twilio inbound; stores AI draft, does NOT auto-send
- `supabase/functions/send-sms/index.ts` — sends via Twilio, clears ai_draft + unread_count
- `supabase/functions/schedule-followup/index.ts` — AI follow-up scheduling; reads contact history + SMS stats
- `supabase/functions/refresh-owner-basics/index.ts` — lightweight ATTOM re-fetch for missing owner/mortgage fields
- `supabase/functions/run-followup-agent/index.ts` — processes follow-up queue automation
- `supabase/functions/refresh-auction-feed/index.ts` — Serper auction queries → parses with GPT-4o-mini → live_feed_snapshots
- `supabase/functions/timeout-watchdog/index.ts` — marks stuck properties (searching/scoring >5min) as failed

## Current Search Behavior
- DealSearch uses a **campaign-first layout**: left sidebar lists past searches by name (e.g. "Ocean County NJ — May 8"), main area shows results for the selected campaign.
- Each search automatically creates a `search_campaigns` row (named by location + date).
- Auto-selects the most recent campaign on page load.
- "New Search" button toggles the filter panel (zip/city, distress types, price/equity); submitting navigates to /processing then returns to the dashboard with the new campaign selected.
- Within an active campaign, results are **grouped by verdict**: Analyzing → Strong Deal → Investigate → Pass. Pass is collapsed by default.
- Controls: text search (address/owner name), sort (Best Score / Most Equity / Newest), engagement filter pills (All / Phone / Email / In pipeline / Not contacted).
- Search mode (ZIP market scan vs. exact-address single property) is inferred from input — no visible toggle.

## Current Design Direction
- Primary UI direction is monochrome.
- Default buttons and main CTAs should be black/white, not purple.
- Keep distress emphasis color where it matters:
  - `Tax Lien`
  - `Foreclosure`
- Typography now uses:
  - headings: `Bricolage Grotesque`
  - body: `Manrope`
  - mono/data: `IBM Plex Mono`
- Distress badges are intentionally calmer:
  - `Tax Lien`: violet
  - `Foreclosure`: blue
  - avoid alarm-heavy red/orange styling on normal deal cards

## SMS Inbox & AI Conversation Notes
- The AI does **not** auto-send SMS replies. `receive-sms` generates a GPT draft and stores it in `sms_threads.ai_draft` — the user approves or dismisses from the Inbox page or the SMSConversationSection inside PropertyDetail.
- `send-sms` clears `ai_draft` and resets `unread_count` to 0 on send.
- All outbound SMS drafts (generate-outreach type "sms") get a Twilio A2P compliance footer appended: `Reply STOP to opt out. Msg & data rates may apply.`
- `generate-outreach` now also supports `outreachType: "summary"` — pass `messages: [{direction, body}]` to get a 2-3 sentence CRM summary of the conversation.
- Meeting booking is automatic in `receive-sms` when the homeowner confirms a time — inserts into `meetings` table.
- `useInboxCount` hook provides live unread thread count for the AppNav badge (realtime subscription on `sms_threads`).

## CRM Workflow Notes
- `schedule-followup` is called after every contact log entry. It reads the contact history **and** SMS thread stats (message count, inbound response count) to determine: `next_action`, `follow_up_at`, `next_step_brief`, `urgency_flag`.
- SMS escalation rule: if the owner has replied to SMS, urgency is elevated and the AI recommends a call within 1 day.
- PropertyDetail shows:
  - A prominent **quick-action bar** below the header card (stage selector, Log Contact, SMS, AI Draft scroll buttons).
  - An **overdue follow-up alert banner** when `follow_up_at < now && follow_up_status ≠ "completed"`.
  - A **meeting prep card** (distress-type talking points) when a pending/confirmed meeting exists.
  - An **AI Sales Coaching panel** (collapsible) after first contact is logged — next step, seller motivation, recommended tone, equity-based negotiation tip, objection handling.

## Skip Trace Notes
- Owner info comes from the `skip-trace` function.
- The active Tracerfy endpoint is:
  - `https://tracerfy.com/v1/api/trace/lookup/`
- Do not switch back to the old `api.tracerfy.com` hostname. It fails DNS resolution and causes `503`.
- `run-deal-analyze` also uses the same Tracerfy lookup flow for auto-tracing strong deals.
- `skip-trace` supports `forceRefresh` for shallow contact hits and should merge enriched phones/emails instead of blindly reusing stale cache.

## Analysis / History Notes
- The score UI is intentionally hidden in the main product. Keep backend score fields intact unless explicitly asked.
- `run-deal-analyze` now generates a more useful operator brief:
  - `history_summary`
  - `urgency_summary`
  - `next_step`
- Property detail should lead with:
  - history
  - urgency
  - next operator move
  - opportunity/watchout bullets
- Sale history, listing timeline, pending type, price cuts, and urgency/default signals should be surfaced before abstract scoring language.
- Existing properties can be refreshed from the UI through `run-deal-analyze`.

## Data Mapping Notes
- ATTOM AVM must use `avm.amount.value`, not confidence score fields like `scr`.
- Lot size is now captured from ATTOM size fields and stored in `distress_details.lotSizeSqft`.
- Owner/mortgage enrichment should populate:
  - `ownerName`
  - `ownerMailingAddress`
  - `mortgage.loanAmount`
  - `mortgage.lenderName`
  - `mortgage.loanType`
- Property photos are best-effort via Firecrawl/public listing pages and will be sparse for many off-market properties.

## Monitoring Notes
- Monitoring is active through `run-monitored-searches`.
- Production cron runs every 15 minutes.
- Daily monitored searches can run at an exact time using saved-search schedule fields.
- The monitoring UI lives in `src/pages/MonitoredAreas.tsx`.

## Build
```bash
npm install
npm run dev
npm run build
npm test
```

## Deploy
Frontend:
```bash
npx vercel deploy --prod --yes --scope yaron-madmons-projects
```

Edge functions:
```bash
npx supabase functions deploy <name> --project-ref vnileremxagzmlieykgm
```

Common function deploys:
```bash
npx supabase functions deploy start-property-search --project-ref vnileremxagzmlieykgm
npx supabase functions deploy run-property-fetch --project-ref vnileremxagzmlieykgm
npx supabase functions deploy run-deal-analyze --project-ref vnileremxagzmlieykgm
npx supabase functions deploy skip-trace --project-ref vnileremxagzmlieykgm
npx supabase functions deploy run-monitored-searches --project-ref vnileremxagzmlieykgm
npx supabase functions deploy generate-outreach --project-ref vnileremxagzmlieykgm
npx supabase functions deploy receive-sms --project-ref vnileremxagzmlieykgm
npx supabase functions deploy send-sms --project-ref vnileremxagzmlieykgm
npx supabase functions deploy schedule-followup --project-ref vnileremxagzmlieykgm
npx supabase functions deploy refresh-owner-basics --project-ref vnileremxagzmlieykgm
npx supabase functions deploy run-followup-agent --project-ref vnileremxagzmlieykgm
```

## Working Rules
- Make additive changes. The repo still contains legacy Gold Rush code and infrastructure.
- Do not remove legacy tables or functions unless explicitly asked.
- Prefer targeted fixes over broad refactors.
- Build before deploy.
- If a change touches owner info or deal analysis, verify the relevant Supabase function behavior, not just the frontend.

## Useful Verification Checks
- `npm run build`
- `npx supabase functions list --project-ref vnileremxagzmlieykgm`
- `npx supabase secrets list --project-ref vnileremxagzmlieykgm`
- Run a ZIP search → campaign appears in sidebar, properties grouped by verdict
- Run a second search → both campaigns in sidebar, switching between them filters results
- Text search and sort within a campaign
- Skip trace a property → "Phone" filter pill works
- Send an initial AI SMS → homeowner reply → verify draft appears in Inbox, NOT auto-sent
- Approve draft from Inbox → message sends, unread count clears
- Log a contact on a property → AI coaching panel appears in PropertyDetail
- Add a property to pipeline → quick-action bar and stage selector appear at top
- Check FollowUpQueue for overdue/today/upcoming sections with correct stat chips
- Check Meetings page for calendar export links
