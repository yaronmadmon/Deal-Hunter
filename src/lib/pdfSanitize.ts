/**
 * Sanitizes text for safe rendering in jsPDF.
 * Replaces problematic UTF-8 characters that cause corrupted output (Ø=Ü¡ etc).
 * Only used in the PDF layer — does NOT modify AI output or report data.
 */
export function sanitizeForPdf(text: string): string {
  if (!text) return text;

  return text
    // Smart quotes → straight quotes
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    // Dashes
    .replace(/[\u2013\u2014]/g, "-")
    // Bullets and list markers
    .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, "-")
    // Ellipsis
    .replace(/\u2026/g, "...")
    // Non-breaking space
    .replace(/\u00A0/g, " ")
    // Trademark, copyright, registered
    .replace(/\u2122/g, "(TM)")
    .replace(/\u00A9/g, "(c)")
    .replace(/\u00AE/g, "(R)")
    // Arrows
    .replace(/[\u2190-\u21FF]/g, "->")
    // Mathematical operators that break rendering
    .replace(/\u2260/g, "!=")
    .replace(/\u2264/g, "<=")
    .replace(/\u2265/g, ">=")
    .replace(/\u00D7/g, "x")
    .replace(/\u00F7/g, "/")
    // Degree symbol
    .replace(/\u00B0/g, " deg")
    // Misc symbols that commonly break jsPDF
    .replace(/[\u2200-\u22FF]/g, "") // mathematical operators
    .replace(/[\u2600-\u26FF]/g, "") // misc symbols
    .replace(/[\u2700-\u27BF]/g, "") // dingbats
    // Emoji ranges (surrogate pairs and common emoji blocks)
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, "")
    // Keep basic printable ASCII + common accented Latin chars (00C0-00FF)
    // Remove remaining control/obscure chars that break rendering
    .replace(/[^\x20-\x7E\u00C0-\u00FF\u0100-\u017F\n\r\t]/g, "");
}
