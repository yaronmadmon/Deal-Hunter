/**
 * Signal Processing Utilities
 * Unified signal structure, normalization, scoring, dedup, filtering, and merging
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
  momentum?: "Exploding" | "Rising" | "Emerging";
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

/* ── Clamp helper ── */
function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

/* ── Source weight adjustments ── */
const SOURCE_WEIGHTS: Record<string, number> = {
  product_hunt: 10,
  google_trends: 12,
  reddit_pain_points: 6,
  hacker_news: 8,
  github_trending: 7,
  trending_searches: 9,
  growing_niches: 5,
};

/* ── Score a single signal (always 0-100) ── */
export function scoreSignal(signal: {
  growthRate?: number;
  discussionVelocity?: number;
  competitionGap?: number;
  trendRecency?: number;
  source?: string;
  timestamp?: string;
}): number {
  const g = clamp(signal.growthRate ?? 50);
  const d = clamp(signal.discussionVelocity ?? 40);
  const c = clamp(signal.competitionGap ?? 50);
  const r = clamp(signal.trendRecency ?? 60);

  let base = Math.round(g * 0.35 + d * 0.25 + c * 0.20 + r * 0.20);

  // Source weight
  if (signal.source) {
    base += SOURCE_WEIGHTS[signal.source] ?? 0;
  }

  // Recency boost: +10 if within 24h
  if (signal.timestamp) {
    const age = Date.now() - new Date(signal.timestamp).getTime();
    if (age < 24 * 60 * 60 * 1000) base += 10;
  }

  return clamp(base);
}

/* ── Momentum label ── */
export function computeMomentum(
  growthRate: number,
  velocity: number,
  recency: number
): "Exploding" | "Rising" | "Emerging" {
  const composite = growthRate * 0.5 + velocity * 0.3 + recency * 0.2;
  if (composite >= 70) return "Exploding";
  if (composite >= 40) return "Rising";
  return "Emerging";
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

/* ── Simple similarity (Jaccard on words) ── */
function wordSet(s: string): Set<string> {
  return new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean));
}

function similarity(a: string, b: string): number {
  const sa = wordSet(a);
  const sb = wordSet(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  return inter / Math.max(sa.size, sb.size);
}

/* ── Cross-feed signal merging ── */
export function crossFeedMerge<T extends Record<string, any>>(
  signals: T[],
  keyField = "keyword",
  titleField = "title"
): T[] {
  const merged: T[] = [];

  for (const sig of signals) {
    const key = String(sig[keyField] || sig[titleField] || "");
    if (!key) { merged.push(sig); continue; }

    let found = false;
    for (let i = 0; i < merged.length; i++) {
      const existing = merged[i];
      const eKey = String(existing[keyField] || existing[titleField] || "");
      const sim = similarity(key, eKey);
      if (sim >= 0.75) {
        // Merge: keep higher score, boost confidence
        if ((sig._signalScore ?? 0) > (existing._signalScore ?? 0)) {
          merged[i] = {
            ...sig,
            _confidence: "High",
            _mergedSources: [
              ...(existing._mergedSources || [existing._source]),
              sig._source,
            ],
          };
        } else {
          merged[i] = {
            ...existing,
            _confidence: "High",
            _mergedSources: [
              ...(existing._mergedSources || [existing._source]),
              sig._source,
            ],
          };
        }
        found = true;
        break;
      }
    }
    if (!found) merged.push(sig);
  }

  return merged;
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

    const tNew = s.timestamp ? new Date(s.timestamp).getTime() : Date.now();
    const tOld = existing.timestamp ? new Date(existing.timestamp).getTime() : Date.now();
    if (Math.abs(tNew - tOld) < WINDOW_MS) {
      if ((s.signalScore ?? 0) > (existing.signalScore ?? 0)) {
        seen.set(key, s);
      }
    } else {
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
