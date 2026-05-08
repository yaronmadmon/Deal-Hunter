# AI Development Rules

# Purpose

This file defines how AI coding agents should behave while working on the platform.

The goal is to maintain:
- consistency
- stability
- simplicity
- operational clarity
- architectural alignment

---

# Related Documents

- README.md defines product vision and workflows
- ARCHITECTURE.md defines technical implementation
- TASKS.md defines implementation status and priorities
- agent.md contains implementation-level context

---

# Product Understanding

This is NOT:
- an AI demo application
- a chatbot product
- a generic CRM
- a social platform

This IS:
- a distressed property acquisition platform
- a lead-generation system
- an outreach automation platform
- a CRM workflow system
- an AI-assisted sales workflow platform

AI supports operational efficiency and lead conversion.

---

# Core Principles

The platform must remain:
- operational
- clean
- organized
- scalable
- easy to navigate
- workflow-focused

Avoid unnecessary complexity.

---

# Development Rules

## Do Not
- remove existing functionality without permission
- rewrite working systems unnecessarily
- introduce architecture that conflicts with Supabase
- clutter the UI
- overengineer workflows
- auto-send communications without approval

---

## Always
- preserve workflow simplicity
- preserve UI consistency
- log communication activity
- maintain lead history integrity
- prioritize readability
- prioritize operational efficiency
- keep systems modular

---

# AI Sales Coaching Rules

The AI should:
- help users communicate effectively
- suggest negotiation strategies
- identify seller motivation
- recommend follow-up timing
- identify hesitation signals
- coach inexperienced users
- help move conversations toward appointments

The AI may:
- draft emails
- draft SMS
- suggest replies
- summarize conversations
- recommend next actions
- suggest empathetic messaging

The AI should behave similarly to an experienced acquisitions manager assisting the user.

---

# AI Restrictions

The AI must NOT:
- guarantee results
- make legal claims
- make financial promises
- pressure sellers aggressively
- impersonate humans deceptively
- operate autonomously
- send communications without approval

---

# UI Rules

The UI should:
- reduce cognitive overload
- support large lead lists
- remain operational and clean
- prioritize workflow speed

Avoid:
- excessive widgets
- unnecessary charts
- flashy interfaces
- information overload

---

# Coding Priorities

Priority order:
1. Stability
2. Simplicity
3. Maintainability
4. Readability
5. Performance
6. Advanced features

---

# Code Standards

- Use clean TypeScript
- Prefer modular systems
- Avoid giant files
- Keep APIs organized
- Write readable code
- Avoid premature optimization