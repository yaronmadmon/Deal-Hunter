# Architecture

# Purpose

This document describes the REAL technical architecture of the platform.

This file should reflect the ACTUAL implementation and should not describe theoretical or future architecture that does not exist yet.

Always keep this file aligned with the real codebase.

---

# Related Documents

- README.md explains product vision and workflows
- AI_RULES.md defines development rules and AI behavior
- TASKS.md defines implementation status and priorities
- agent.md contains the most accurate implementation details

---

# Actual Stack

Current stack includes:

- React frontend
- TypeScript
- Supabase Postgres
- Supabase Auth
- Supabase Edge Functions
- Twilio integration
- AI integrations
- Property data APIs
- Skip tracing APIs

This project does NOT currently use:
- Express backend
- Prisma ORM
- Redis
- custom Node server architecture

Do not introduce alternative architecture unless specifically requested.

---

# Frontend

Frontend responsibilities include:
- search interface
- property results
- lead management
- outreach UI
- CRM workflows
- messaging timelines
- reminders
- dashboards
- campaign management

The frontend should remain:
- clean
- operational
- scalable
- easy to navigate

---

# Backend

The backend logic primarily runs through Supabase Edge Functions.

Edge Functions are responsible for:
- property search
- lead enrichment
- owner/contact lookup
- skip tracing calls
- Twilio messaging
- Twilio webhook handling
- AI message generation
- AI reply suggestions
- CRM activity logging
- follow-up logic

---

# Database

The platform uses Supabase Postgres.

Core tables may include:
- properties
- owner_contacts
- pipeline_deals
- sms_threads
- sms_messages
- outreach_campaigns
- search_campaigns
- follow_up_tasks
- appointments
- activity_logs
- lead_notes
- user_profiles

The database should reflect the acquisition workflow:

Property → Contact → Lead → Outreach → Follow-Up → Appointment → Deal

---

# Messaging Architecture

Twilio handles:
- outbound SMS
- inbound SMS
- delivery events
- webhook events

All communication must be:
- logged
- timestamped
- tied to a lead
- tied to a thread
- searchable
- visible inside CRM history

The system should never treat messaging as temporary state only.

---

# AI Layer

The AI assists with:
- SMS drafting
- email drafting
- reply suggestions
- sales coaching
- objection handling
- seller motivation analysis
- follow-up recommendations
- conversation summaries
- negotiation guidance

The AI behaves similarly to an experienced acquisitions manager assisting the user.

The AI is not autonomous.

The human operator remains in control.

---

# Logging Requirements

Everything must be logged:
- outbound communication
- inbound communication
- AI suggestions
- lead stage changes
- reminders
- appointments
- assignments
- activity history

---

# Important Implementation Rules

- Preserve Supabase architecture
- Do not rewrite working systems unnecessarily
- Match existing database structure before creating new tables
- Match existing Edge Functions before creating replacements
- Keep workflows operational and simple
- Keep the UI clean and organized
- Avoid unnecessary abstractions
- Use agent.md as implementation-level reference