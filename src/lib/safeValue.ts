/**
 * Safely display a value — never show null, undefined, NaN, or N/A.
 * Shared across UI components and PDF generators.
 */
export const safeValue = (val: any): string => {
  if (val === null || val === undefined || val === "N/A" || val === "n/a" || val === "NaN" || Number.isNaN(val)) {
    return "Insufficient data";
  }
  const s = String(val);
  const lower = s.toLowerCase();
  if (lower === "unknown" || lower === "data unavailable") {
    return "Insufficient data";
  }
  return s;
};
