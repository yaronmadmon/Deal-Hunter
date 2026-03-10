/**
 * Signal Processing Utilities
 * Unified signal structure, normalization, scoring, dedup, and filtering
 */

export interface NormalizedSignal {
  source: string;
  category: string;
  title: string;
  description: string;
  keyword: string;
  growthRate: number;
  confidenceScore: number;
  signalScore: number;
  timestamp: string;
  rawData: Record<string, unknown>;
}

/* ── Category normalization map ── */
const CATEGORY_MAP: Record<string, string> = {
  trending_searches: "Search Trends",
  product_hunt: "Product Launches",
  reddit_pain_points: "User Pain Points",
  growing_niches: "Growing Niches",
  hacker_news: "Developer Buzz",
  github_trending: "Open Source",
  google_trends: "Google Trends",
  breakout_idea: "Breakout Opportunity",
};

export function normalizeCategory(raw: string): string {
  return CATEGORY_MAP[raw] || raw;
}

/* ── Score a single signal (0-100) ── */
export function scoreSignal(signal: {
  growthRate?: number;
  discussionVelocity?: number;
  competitionGap?: number;
  trendRecency?: number;
}): number {
  const g = Math.min(100, signal.growthRate ?? 50);
  const d = Math.min(100, signal.discussionVelocity ?? 40);
  const c = Math.min(100, signal.competitionGap ?? 50);
  const r = Math.min(100, signal.trendRecency ?? 60);

  return Math.round(g * 0.35 + d * 0.25 + c * 0.20 + r * 0.20);
}

/* ── Confidence from source count + growth strength ── */
export function computeConfidence(
  sourceCount: number,
  growthStrength: number
): "High" | "Medium" | "Low" {
  const score = sourceCount * 30 + Math.min(growthStrength, 100) * 0.7;
  if (score >= 80) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

/* ── Deduplicate signals within a 12h window ── */
export function deduplicateSignals<T extends { keyword?: string; title?: string; description?: string; signalScore?: number; timestamp?: string }>(
  signals: T[]
): T[] {
  const WINDOW_MS = 12 * 60 * 60 * 1000;
  const seen = new Map<string, T>();

  for (const s of signals) {
    const key = (s.keyword || s.title || "").toLowerCase().trim();
    if (!key) {
      seen.set(crypto.randomUUID?.() || String(Math.random()), s);
      continue;
    }

    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, s);
      continue;
    }

    // Check time window
    const tNew = s.timestamp ? new Date(s.timestamp).getTime() : Date.now();
    const tOld = existing.timestamp ? new Date(existing.timestamp).getTime() : Date.now();
    if (Math.abs(tNew - tOld) < WINDOW_MS) {
      // Keep the one with higher score
      if ((s.signalScore ?? 0) > (existing.signalScore ?? 0)) {
        seen.set(key, s);
      }
    } else {
      // Different window, keep both
      seen.set(key + "_" + tNew, s);
    }
  }

  return Array.from(seen.values());
}

/* ── Filter out weak/noisy signals ── */
export function filterWeakSignals<T extends { signalScore?: number; confidenceScore?: number; growthRate?: number }>(
  signals: T[],
  opts?: { minScore?: number; minConfidence?: number; minGrowth?: number }
): T[] {
  const minScore = opts?.minScore ?? 15;
  const minConfidence = opts?.minConfidence ?? 10;
  const minGrowth = opts?.minGrowth ?? 0;

  return signals.filter((s) => {
    if ((s.signalScore ?? 100) < minScore) return false;
    if ((s.confidenceScore ?? 100) < minConfidence) return false;
    if ((s.growthRate ?? 100) < minGrowth) return false;
    return true;
  });
}

/* ── Sort signals by score descending ── */
export function rankSignals<T extends { signalScore?: number }>(signals: T[]): T[] {
  return [...signals].sort((a, b) => (b.signalScore ?? 0) - (a.signalScore ?? 0));
}

/* ── Parse growth string like "+200%" to number ── */
export function parseGrowthRate(spike: string | number | undefined): number {
  if (typeof spike === "number") return spike;
  if (!spike) return 0;
  const num = parseInt(String(spike).replace(/[^0-9-]/g, ""), 10);
  return isNaN(num) ? 0 : num;
}
