

## Plan: Sample Report Preview on Landing Page + Public Sample Report

### The Idea

Let visitors see what they'll get before signing up. Two touchpoints:

1. **Landing Page Snapshot** -- A visually compelling "report preview" section on the landing page showing a blurred/teased version of a real report (score ring, key stats, signal cards) with a CTA to view the full sample.

2. **Public Sample Report Page** (`/sample-report`) -- A fully interactive, read-only report page that uses the existing `mockReport` data. No login required. Shows the complete report experience so visitors can explore every section. Includes persistent CTAs ("Get Your Own Report" / "Start Free") throughout.

### Implementation

**1. Create `/sample-report` page (new file: `src/pages/SampleReport.tsx`)**
- Reuse the existing `Report.tsx` rendering logic but strip out auth guards, watchlist tracking, and the `useParams` ID lookup
- Load `mockReport` directly from `src/data/mockReport.ts`
- Add a sticky banner at the top: "You're viewing a sample report. Sign up free to analyze your own idea."
- Add CTA buttons at the bottom and interspersed between sections
- No PDF download (gate that behind auth)
- No blueprint generation button (read-only)

**2. Add Report Preview section to Landing Page (`src/pages/Index.tsx`)**
- Insert a new section between "How It Works" and "Positioning" sections
- Show a mini preview card with:
  - The ScoreRing component (score: 71)
  - The idea title "AI Note Taking App for Students"
  - Signal strength badge ("Moderate")
  - 2-3 key stats from the mock data
  - A subtle glass/blur overlay on the bottom half
- CTA button: "Explore Full Sample Report" linking to `/sample-report`
- Secondary CTA: "Or analyze your own idea" linking to `/auth`

**3. Add route to `App.tsx`**
- Add `/sample-report` as a public route (no auth guard)

### Technical Details

- The `mockReport` object already has rich, realistic data (score 71, 5 signal cards, competitors, sentiment, blueprint, etc.) -- perfect for a sample
- Reuse existing report components (`ScoreRing`, `KeyStatsBar`, `SignalCard`, etc.) on both the landing preview and the sample page
- The sample report page will be a simplified version of `Report.tsx` without the database fetch, auth check, or watchlist logic
- Landing page preview section uses only `ScoreRing` and a few stat badges for a lightweight teaser

### User Flow

```text
Landing Page
  ├── Scroll to "See a Real Report" section
  │     └── Click "Explore Full Sample Report"
  │           └── /sample-report (full interactive report, no login)
  │                 └── CTA: "Get Your Own Report" → /auth (free signup)
  └── Hero CTA → /auth (existing flow)
```

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/pages/SampleReport.tsx` | Create -- public read-only report using mockReport |
| `src/pages/Index.tsx` | Modify -- add report preview section with ScoreRing teaser |
| `src/App.tsx` | Modify -- add `/sample-report` route |

