import jsPDF from "jspdf";
import type { MockReportData, SignalCardData, CompetitorEntry, ChartPoint, MarketExploitMapData, CompetitorMatrixData, FounderDecisionData, ProofDashboardData, KeywordDemandData, AppStoreIntelligenceData, RecommendedStrategyData, KillShotAnalysisData, ScoreExplanationData } from "@/data/mockReport";
import { sanitizeForPdf } from "./pdfSanitize";

/** Sanitize + replace unknown/unavailable labels for PDF output */
const safePdfText = (val: any): string => {
  if (val === null || val === undefined || val === "N/A" || val === "n/a" || val === "NaN" || Number.isNaN(val)) {
    return "Insufficient data";
  }
  let s = String(val);
  const lower = s.toLowerCase();
  if (lower === "unknown" || lower === "data unavailable") {
    return "Insufficient data";
  }
  return sanitizeForPdf(s);
};

// ── Color palette (HSL → RGB approximations for jsPDF) ──
const C = {
  indigo: [79, 70, 229] as [number, number, number],     // primary
  teal: [20, 184, 166] as [number, number, number],
  bg: [245, 245, 250] as [number, number, number],
  cardBg: [255, 255, 255] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  success: [34, 197, 94] as [number, number, number],
  warning: [245, 158, 11] as [number, number, number],
  danger: [239, 68, 68] as [number, number, number],
  gold: [234, 179, 8] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

export function generateReportPdf(report: MockReportData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 16; // margin
  const bm = 18; // bottom margin
  const maxY = ph - bm;
  const cw = pw - m * 2; // content width
  let y = 18;

  // ── Helpers ──
  const setColor = (c: [number, number, number]) => {
    doc.setTextColor(c[0], c[1], c[2]);
  };
  const setDraw = (c: [number, number, number]) => {
    doc.setDrawColor(c[0], c[1], c[2]);
  };
  const setFill = (c: [number, number, number]) => {
    doc.setFillColor(c[0], c[1], c[2]);
  };

  const checkPage = (needed: number) => {
    if (y + needed > maxY) { doc.addPage(); y = 18; }
  };

  const writeLines = (lines: string[], x: number, lh: number) => {
    for (const line of lines) {
      checkPage(lh);
      doc.text(sanitizeForPdf(line), x, y);
      y += lh;
    }
  };

  const drawHRule = () => {
    checkPage(4);
    setDraw(C.border);
    doc.setLineWidth(0.3);
    doc.line(m, y, pw - m, y);
    y += 4;
  };

  // ── Score Ring ──
  const drawScoreRing = (cx: number, cy: number, radius: number, score: number, strength: string) => {
    const startAngle = -90;
    const endAngle = startAngle + (score / 100) * 360;

    // Background circle
    setDraw(C.border);
    doc.setLineWidth(2.5);
    doc.circle(cx, cy, radius, "S");

    // Score arc
    const color = score >= 70 ? C.success : score >= 40 ? C.gold : C.danger;
    setDraw(color);
    doc.setLineWidth(3);
    const steps = Math.max(2, Math.round((score / 100) * 60));
    for (let i = 0; i < steps; i++) {
      const a1 = (startAngle + (i / steps) * (endAngle - startAngle)) * (Math.PI / 180);
      const a2 = (startAngle + ((i + 1) / steps) * (endAngle - startAngle)) * (Math.PI / 180);
      const x1 = cx + radius * Math.cos(a1);
      const y1 = cy + radius * Math.sin(a1);
      const x2 = cx + radius * Math.cos(a2);
      const y2 = cy + radius * Math.sin(a2);
      doc.line(x1, y1, x2, y2);
    }

    // Score text
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    setColor(C.text);
    doc.text(`${score}`, cx, cy + 1, { align: "center" });

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    setColor(C.muted);
    doc.text("/100", cx + 8, cy + 1, { align: "center" });

    doc.setFontSize(8);
    setColor(color);
    doc.setFont("helvetica", "bold");
    doc.text(strength, cx, cy + 6, { align: "center" });
  };

  // ── Sparkline Chart ──
  const drawSparkline = (x: number, yPos: number, w: number, h: number, points: ChartPoint[], color: [number, number, number], label?: string) => {
    if (!points || points.length < 2) return;

    const vals = points.map(p => p.value);
    const minV = Math.min(...vals) * 0.8;
    const maxV = Math.max(...vals) * 1.1;
    const range = maxV - minV || 1;

    // Subtle background
    setFill([248, 250, 252]);
    doc.roundedRect(x, yPos, w, h, 1.5, 1.5, "F");

    // Grid lines
    setDraw([235, 238, 245]);
    doc.setLineWidth(0.15);
    for (let i = 0; i <= 3; i++) {
      const gy = yPos + (h / 3) * i;
      doc.line(x + 1, gy, x + w - 1, gy);
    }

    // Line
    setDraw(color);
    doc.setLineWidth(0.6);
    const coords: [number, number][] = points.map((p, i) => [
      x + 2 + ((w - 4) * i) / (points.length - 1),
      yPos + h - 2 - ((p.value - minV) / range) * (h - 4),
    ]);
    for (let i = 0; i < coords.length - 1; i++) {
      doc.line(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
    }

    // Dots at start and end
    setFill(color);
    doc.circle(coords[0][0], coords[0][1], 0.6, "F");
    doc.circle(coords[coords.length - 1][0], coords[coords.length - 1][1], 0.6, "F");

    // X-axis labels
    doc.setFontSize(5);
    setColor(C.muted);
    doc.setFont("helvetica", "normal");
    const step = Math.max(1, Math.floor(points.length / 5));
    for (let i = 0; i < points.length; i += step) {
      doc.text(points[i].name, coords[i][0], yPos + h + 3, { align: "center" });
    }

    // Label
    if (label) {
      doc.setFontSize(6);
      setColor(C.muted);
      doc.text(label, x, yPos - 1.5);
    }
  };

  // ── Donut Chart ──
  const drawDonut = (cx: number, cy: number, r: number, segments: { name: string; value: number }[]) => {
    if (!segments || segments.length === 0) return;
    const total = segments.reduce((s, seg) => s + seg.value, 0);
    const colors: [number, number, number][] = [C.indigo, [180, 190, 210], C.teal, C.gold];
    let startA = -90;

    segments.forEach((seg, i) => {
      const sweep = (seg.value / total) * 360;
      const endA = startA + sweep;
      const col = colors[i % colors.length];

      // Draw arc segments
      setFill(col);
      setDraw(col);
      doc.setLineWidth(3);
      const steps = Math.max(2, Math.round(sweep / 4));
      for (let j = 0; j < steps; j++) {
        const a1 = (startA + (j / steps) * sweep) * (Math.PI / 180);
        const a2 = (startA + ((j + 1) / steps) * sweep) * (Math.PI / 180);
        doc.line(cx + r * Math.cos(a1), cy + r * Math.sin(a1), cx + r * Math.cos(a2), cy + r * Math.sin(a2));
      }

      // Label
      const midA = ((startA + endA) / 2) * (Math.PI / 180);
      const lx = cx + (r + 7) * Math.cos(midA);
      const ly = cy + (r + 7) * Math.sin(midA);
      doc.setFontSize(6);
      setColor(col);
      doc.setFont("helvetica", "bold");
      doc.text(`${seg.name} ${Math.round((seg.value / total) * 100)}%`, lx, ly, { align: "center" });

      startA = endA;
    });

    // Center white circle
    setFill(C.white);
    doc.circle(cx, cy, r - 3.5, "F");
  };

  // ── Competitor Table ──
  const drawCompetitorTable = (competitors: CompetitorEntry[]) => {
    if (!competitors || competitors.length === 0) return;
    const cols = [m, m + 35, m + 55, m + 72, m + 92];
    const headers = ["Competitor", "Rating", "Reviews", "Downloads", "Weakness"];

    checkPage(8 + competitors.length * 8);

    // Header row
    setFill([241, 245, 249]);
    doc.roundedRect(m, y - 1, cw, 7, 1, 1, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    setColor(C.muted);
    headers.forEach((h, i) => doc.text(h, cols[i], y + 3));
    y += 8;

    // Rows
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    competitors.forEach((c, i) => {
      if (i % 2 === 0) {
        setFill([248, 250, 252]);
        doc.rect(m, y - 2.5, cw, 7, "F");
      }
      setColor(C.text);
      doc.setFont("helvetica", "bold");
      doc.text(sanitizeForPdf(c.name), cols[0], y + 1);
      doc.setFont("helvetica", "normal");
      setColor(C.muted);
      doc.text(sanitizeForPdf(c.rating), cols[1], y + 1);
      doc.text(sanitizeForPdf(c.reviews), cols[2], y + 1);
      doc.text(sanitizeForPdf(c.downloads), cols[3], y + 1);

      // Weakness (truncated)
      doc.setFontSize(7);
      const wLines = doc.splitTextToSize(sanitizeForPdf(c.weakness), cw - (cols[4] - m));
      doc.text(wLines[0] || "", cols[4], y + 1);
      doc.setFontSize(8);
      y += 7;
    });
    y += 3;
  };

  // ── Card wrapper ──
  const drawCardStart = (title: string, source: string, confidence: string) => {
    checkPage(40);
    setFill(C.cardBg);
    setDraw(C.border);
    doc.setLineWidth(0.3);
    // We'll just draw a header area
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    setColor(C.text);
    doc.text(title, m, y);

    // Source + confidence badge
    const titleW = doc.getTextWidth(title);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    setColor(C.muted);
    doc.text(`${source}  |  ${confidence} confidence`, m + titleW + 3, y);

    y += 3;
    setDraw(C.indigo);
    doc.setLineWidth(0.5);
    doc.line(m, y, m + 30, y);
    y += 5;
  };

  // ════════════════════════════════════════
  // START BUILDING THE PDF
  // ════════════════════════════════════════

  // Background tint for first page header area
  setFill([240, 242, 255]);
  doc.rect(0, 0, pw, 55, "F");

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  setColor(C.indigo);
  doc.text("Gold Rush", m, y);
  doc.setFontSize(10);
  setColor(C.muted);
  doc.text("Market Validation Report", m + 38, y);
  y += 10;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  setColor(C.text);
  const ideaLines = doc.splitTextToSize(report.idea, cw - 45);
  writeLines(ideaLines, m, 6);
  y += 2;

  // Score Ring — positioned to the right of title area
  drawScoreRing(pw - m - 18, 30, 13, report.overallScore, report.signalStrength);

  y = 58;
  drawHRule();

  // ── Key Stats Bar ──
  const defaultStats = [
    { value: `${report.overallScore}/100`, label: "Signal Score" },
    { value: `${report.signalCards.reduce((s, c) => s + (c.evidenceCount || 0), 0)}+`, label: "Data Points" },
    { value: report.revenueBenchmark?.range || "N/A", label: "Revenue Est." },
    { value: `${report.signalCards.length}`, label: "Sources Analyzed" },
  ];
  const rawStats = report.keyStats && report.keyStats.length > 0 ? report.keyStats : defaultStats;
  // Ensure exactly 4 stats — pad with defaults if pipeline returned fewer
  const statsRow = rawStats.length >= 4
    ? rawStats.slice(0, 4)
    : [...rawStats, ...defaultStats.slice(rawStats.length)].slice(0, 4);
  const statW = cw / statsRow.length;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  statsRow.forEach((stat, i) => {
    const sx = m + statW * i + statW / 2;
    setColor(C.indigo);
    doc.text(safePdfText(stat.value), sx, y, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    setColor(C.muted);
    doc.text(safePdfText(stat.label), sx, y + 4, { align: "center" });
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
  });
  y += 12;
  drawHRule();

  // ── Signal Cards ──
  report.signalCards.forEach((card) => {
    drawCardStart(card.title, card.source, card.confidence);

    // Metrics
    if (card.metrics) {
      doc.setFontSize(9);
      card.metrics.forEach((met) => {
        checkPage(5);
        doc.setFont("helvetica", "normal");
        setColor(C.muted);
        doc.text(safePdfText(met.label) + ":", m + 2, y);
        doc.setFont("helvetica", "bold");
        setColor(C.text);
        doc.text(safePdfText(met.value), m + 45, y);
        y += 5;
      });
      y += 2;
    }

    // Google Trends Sparkline
    if (card.googleTrendsSparkline && card.googleTrendsSparkline.length > 1) {
      checkPage(28);
      drawSparkline(m + 2, y, cw * 0.6, 18, card.googleTrendsSparkline, C.indigo, "Google Trends — Search Interest (12 months)");
      y += 26;
    }
    // Trend sparkline (simulated)
    else if (card.sparkline && card.sparkline.length > 1) {
      checkPage(28);
      drawSparkline(m + 2, y, cw * 0.6, 18, card.sparkline, C.teal, "Simulated Trend (illustrative only)");
      y += 26;
    }

    // Donut chart
    if (card.donut && card.donut.length > 0) {
      checkPage(30);
      drawDonut(m + 25, y + 12, 10, card.donut);
      y += 30;
    }

    // Competitor table
    if (card.competitors) {
      drawCompetitorTable(card.competitors);
    }

    // Sentiment
    if (card.sentiment) {
      const s = card.sentiment;
      checkPage(20);

      // Sentiment bar
      const barW = cw * 0.5;
      const negW = barW * (s.complaintCount / (s.complaintCount + s.positiveCount));
      const posW = barW - negW;
      setFill(C.danger);
      doc.roundedRect(m + 2, y, negW, 3.5, 1, 1, "F");
      setFill(C.success);
      doc.roundedRect(m + 2 + negW, y, posW, 3.5, 1, 1, "F");
      y += 6;

      doc.setFontSize(6);
      setColor(C.danger);
      doc.text(`${s.complaintCount} complaints`, m + 2, y);
      setColor(C.success);
      doc.text(`${s.positiveCount} positive`, m + 2 + negW, y);
      y += 5;

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      setColor(C.text);
      doc.text("Top Complaints:", m + 2, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      s.complaints.forEach((c) => {
        checkPage(5);
        setColor(C.danger);
        doc.text("-", m + 4, y);
        setColor(C.text);
        const cl = doc.splitTextToSize(c, cw - 10);
        writeLines(cl, m + 8, 4);
        y += 1;
      });
      y += 2;

      doc.setFont("helvetica", "bold");
      setColor(C.text);
      doc.text("What Users Love:", m + 2, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      s.loves.forEach((l) => {
        checkPage(5);
        setColor(C.success);
        doc.text("-", m + 4, y);
        setColor(C.text);
        const ll = doc.splitTextToSize(l, cw - 10);
        writeLines(ll, m + 8, 4);
        y += 1;
      });
      y += 2;

      doc.setFontSize(8);
      setColor(C.muted);
      doc.text(`Dominant Emotion: ${s.emotion}`, m + 2, y);
      y += 5;
    }

    // Growth line chart (simulated)
    if (card.lineChart && card.lineChart.length > 1) {
      checkPage(28);
      drawSparkline(m + 2, y, cw * 0.6, 18, card.lineChart, C.success, "Simulated Growth Trend (illustrative only)");
      y += 26;
    }

    // Insight
    checkPage(10);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    setColor(C.indigo);
    const insightLines = doc.splitTextToSize(`> ${card.insight}`, cw - 4);
    writeLines(insightLines, m + 2, 4);
    y += 2;

    // Evidence quotes
    if (card.evidence.length > 0) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      setColor(C.muted);
      card.evidence.slice(0, 2).forEach((e) => {
        checkPage(6);
        const el = doc.splitTextToSize(`"${e}"`, cw - 8);
        writeLines(el, m + 4, 3.5);
        y += 1;
      });
    }

    y += 5;
    drawHRule();
  });

  // ── Opportunity Section ──
  checkPage(30);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  setColor(C.text);
  doc.text("Opportunity Gap", m, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  setColor(C.text);
  doc.text("Feature Gaps", m, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  report.opportunity.featureGaps.forEach((g) => {
    checkPage(5);
    setColor(C.indigo);
    doc.text(">", m + 2, y);
    setColor(C.text);
    const gl = doc.splitTextToSize(g, cw - 8);
    writeLines(gl, m + 7, 4.5);
    y += 1;
  });
  y += 3;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Underserved Users", m, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  report.opportunity.underservedUsers.forEach((u) => {
    checkPage(5);
    setColor(C.teal);
    doc.text(">", m + 2, y);
    setColor(C.text);
    const ul = doc.splitTextToSize(u, cw - 8);
    writeLines(ul, m + 7, 4.5);
    y += 1;
  });
  y += 3;

  checkPage(10);
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  setColor(C.muted);
  const posLines = doc.splitTextToSize(`Positioning: ${report.opportunity.positioning}`, cw);
  writeLines(posLines, m, 4);
  y += 5;
  drawHRule();

  // ── Revenue Benchmark ──
  checkPage(20);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  setColor(C.text);
  doc.text("Revenue Benchmark", m, y);
  y += 7;

  // Revenue range highlight box
  setFill([240, 253, 244]);
  doc.roundedRect(m, y - 2, cw, 10, 2, 2, "F");
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  setColor(C.success);
  doc.text(safePdfText(report.revenueBenchmark.range), m + 4, y + 4);
  y += 13;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  setColor(C.text);
  const sumLines = doc.splitTextToSize(report.revenueBenchmark.summary, cw);
  writeLines(sumLines, m, 4);
  y += 2;
  doc.setFontSize(7);
  setColor(C.muted);
  const basisLines = doc.splitTextToSize(report.revenueBenchmark.basis, cw);
  writeLines(basisLines, m, 3.5);
  y += 5;
  drawHRule();

  // ── Score Breakdown ──
  checkPage(40);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  setColor(C.text);
  doc.text("Score Breakdown", m, y);
  y += 8;

  report.scoreBreakdown.forEach((item) => {
    checkPage(8);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    setColor(C.text);
    doc.text(item.label, m + 2, y);

    // Progress bar
    const barX = m + 50;
    const barMaxW = cw - 70;
    const barH = 3.5;
    setFill(C.border);
    doc.roundedRect(barX, y - 2.5, barMaxW, barH, 1, 1, "F");
    const fillW = (item.value / 20) * barMaxW;
    const barColor = item.value >= 15 ? C.success : item.value >= 10 ? C.gold : C.danger;
    setFill(barColor);
    doc.roundedRect(barX, y - 2.5, fillW, barH, 1, 1, "F");

    // Value
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setColor(barColor);
    doc.text(`${item.value}/20`, barX + barMaxW + 3, y);

    y += 7;
  });

  y += 3;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  setColor(C.muted);
  const expLines = doc.splitTextToSize(report.scoreExplanation, cw);
  writeLines(expLines, m, 4);
  y += 5;

  // ── Helper: Section title ──
  const drawSectionTitle = (title: string, subtitle?: string) => {
    checkPage(15);
    drawHRule();
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    setColor(C.text);
    doc.text(title, m, y);
    if (subtitle) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      setColor(C.muted);
      doc.text(subtitle, m + doc.getTextWidth(title) + 3, y);
    }
    y += 7;
  };

  // ── Helper: bullet list ──
  const drawBulletList = (items: string[], bulletColor: [number, number, number], bullet = ">") => {
    // Sanitize bullet for jsPDF (no Unicode symbols)
    const safeBullet = bullet.replace(/[^\x20-\x7E]/g, "-");
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    items.forEach((item) => {
      checkPage(6);
      setColor(bulletColor);
      doc.text(safeBullet, m + 2, y);
      setColor(C.text);
      const lines = doc.splitTextToSize(item, cw - 10);
      writeLines(lines, m + 7, 4);
      y += 1;
    });
    y += 2;
  };

  // ── Proof Dashboard ──
  if (report.proofDashboard) {
    const pd = report.proofDashboard;
    drawSectionTitle("Proof Dashboard", "Evidence-based market signals");

    const blocks = [
      { title: "Search Demand", items: pd.searchDemand ? [`Keyword: ${pd.searchDemand.keyword}`, `Monthly Searches: ${pd.searchDemand.monthlySearches}`, `Trend: ${pd.searchDemand.trend}`] : [] },
      { title: "Developer Activity", items: pd.developerActivity ? [`Repos: ${pd.developerActivity.repoCount}`, `Stars: ${pd.developerActivity.totalStars}`, `Trend: ${pd.developerActivity.trend}`] : [] },
      { title: "Social Activity", items: pd.socialActivity ? [`X Mentions (7d): ${pd.socialActivity.twitterMentions}`, `Reddit Threads: ${pd.socialActivity.redditThreads}`, `Sentiment: ${pd.socialActivity.sentimentScore}`] : [] },
      { title: "App Store Signals", items: pd.appStoreSignals ? [`Related Apps: ${pd.appStoreSignals.relatedApps}`, `Avg Rating: ${pd.appStoreSignals.avgRating}`, `Downloads: ${pd.appStoreSignals.downloadEstimate}`] : [] },
    ];

    blocks.forEach(block => {
      if (block.items.length === 0) return;
      checkPage(15);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      setColor(C.indigo);
      doc.text(block.title, m + 2, y);
      y += 5;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      block.items.forEach(item => {
        checkPage(5);
        setColor(C.text);
        doc.text(safePdfText(item), m + 4, y);
        y += 4;
      });
      y += 2;
    });
  }

  // ── Keyword Demand ──
  if (report.keywordDemand?.keywords?.length) {
    drawSectionTitle("Keyword Demand", "Search volume data");
    const kws = report.keywordDemand.keywords;
    const cols = [m, m + 60, m + 95, m + 125];
    const headers = ["Keyword", "Volume", "Difficulty", "Trend"];

    checkPage(8 + kws.length * 6);
    setFill([241, 245, 249]);
    doc.roundedRect(m, y - 1, cw, 7, 1, 1, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    setColor(C.muted);
    headers.forEach((h, i) => doc.text(h, cols[i], y + 3));
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    kws.forEach((kw, i) => {
      checkPage(6);
      if (i % 2 === 0) { setFill([248, 250, 252]); doc.rect(m, y - 2.5, cw, 6, "F"); }
      setColor(C.text);
      doc.text(doc.splitTextToSize(safePdfText(kw.keyword), 55)[0], cols[0], y + 1);
      setColor(C.muted);
      doc.text(safePdfText(kw.volume), cols[1], y + 1);
      doc.text(safePdfText(kw.difficulty), cols[2], y + 1);
      doc.text(safePdfText(kw.trend), cols[3], y + 1);
      y += 6;
    });
    y += 3;
  }

  // ── App Store Intelligence ──
  if (report.appStoreIntelligence?.apps?.length) {
    drawSectionTitle("App Market Signals");
    const apps = report.appStoreIntelligence.apps;
    const cols = [m, m + 45, m + 75, m + 95, m + 120];
    const headers = ["App", "Platform", "Rating", "Reviews", "Downloads"];

    checkPage(8 + apps.length * 6);
    setFill([241, 245, 249]);
    doc.roundedRect(m, y - 1, cw, 7, 1, 1, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    setColor(C.muted);
    headers.forEach((h, i) => doc.text(h, cols[i], y + 3));
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    apps.forEach((app, i) => {
      checkPage(6);
      if (i % 2 === 0) { setFill([248, 250, 252]); doc.rect(m, y - 2.5, cw, 6, "F"); }
      setColor(C.text);
      doc.setFont("helvetica", "bold");
      doc.text(doc.splitTextToSize(safePdfText(app.name), 42)[0], cols[0], y + 1);
      doc.setFont("helvetica", "normal");
      setColor(C.muted);
      doc.text(safePdfText(app.platform), cols[1], y + 1);
      doc.text(safePdfText(app.rating), cols[2], y + 1);
      doc.text(safePdfText(app.reviews), cols[3], y + 1);
      doc.text(safePdfText(app.downloads), cols[4], y + 1);
      y += 6;
    });
    if (report.appStoreIntelligence.insight) {
      y += 2;
      doc.setFontSize(7);
      setColor(C.muted);
      const insLines = doc.splitTextToSize(report.appStoreIntelligence.insight, cw);
      writeLines(insLines, m, 3.5);
    }
    y += 3;
  }

  // ── Market Exploit Map ──
  if (report.marketExploitMap) {
    const mem = report.marketExploitMap;
    drawSectionTitle("Market Exploit Map", "Where competitors are weak");

    if (mem.competitorWeaknesses?.length) {
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); setColor(C.text);
      doc.text("Competitor Weaknesses", m, y); y += 5;
      drawBulletList(mem.competitorWeaknesses, C.danger, "!");
    }
    if (mem.competitorStrengths?.length) {
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); setColor(C.text);
      doc.text("What Competitors Do Well", m, y); y += 5;
      drawBulletList(mem.competitorStrengths, C.success, "+");
    }
    if (mem.topComplaints?.length) {
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); setColor(C.text);
      doc.text("Top User Complaints", m, y); y += 5;
      drawBulletList(mem.topComplaints.map(c => `${c.complaint} (${c.frequency})`), C.warning, "-");
    }
    if (mem.topPraise?.length) {
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); setColor(C.text);
      doc.text("What Users Value", m, y); y += 5;
      drawBulletList(mem.topPraise.map(p => `${p.praise} (${p.frequency})`), C.indigo, "-");
    }
    if (mem.whereToWin?.length) {
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); setColor(C.text);
      doc.text("Where You Can Win", m, y); y += 5;
      drawBulletList(mem.whereToWin, C.success, "→");
    }
    if (mem.attackAngle) {
      checkPage(12);
      setFill([240, 242, 255]);
      const aaLines = doc.splitTextToSize(mem.attackAngle, cw - 8);
      doc.roundedRect(m, y - 2, cw, aaLines.length * 4 + 8, 2, 2, "F");
      doc.setFontSize(7); doc.setFont("helvetica", "bold"); setColor(C.indigo);
      doc.text("RECOMMENDED ATTACK ANGLE", m + 4, y + 2);
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); setColor(C.text);
      y += 6;
      writeLines(aaLines, m + 4, 4);
      y += 4;
    }
  }

  // ── Competitor Matrix ──
  if (report.competitorMatrix?.features?.length && report.competitorMatrix?.competitors?.length) {
    const cm = report.competitorMatrix;
    drawSectionTitle("Competitor Comparison Matrix");

    const colW = Math.min(30, (cw - 45) / cm.competitors.length);
    const fColW = 45;

    checkPage(8 + cm.features.length * 6);
    setFill([241, 245, 249]);
    doc.roundedRect(m, y - 1, cw, 7, 1, 1, "F");
    doc.setFontSize(6); doc.setFont("helvetica", "bold"); setColor(C.muted);
    doc.text("Feature", m + 2, y + 3);
      cm.competitors.forEach((comp, i) => {
      const cx = m + fColW + colW * i + colW / 2;
      setColor(comp.isYou ? C.indigo : C.muted);
      doc.text(safePdfText(comp.name), cx, y + 3, { align: "center" });
    });
    y += 8;

    doc.setFontSize(7); doc.setFont("helvetica", "normal");
    cm.features.forEach((feature, fi) => {
      checkPage(6);
      if (fi % 2 === 0) { setFill([248, 250, 252]); doc.rect(m, y - 2.5, cw, 6, "F"); }
      setColor(C.text);
      doc.text(doc.splitTextToSize(safePdfText(feature), fColW - 4)[0], m + 2, y + 1);
      cm.competitors.forEach((comp, ci) => {
        const val = comp.scores[feature] || "—";
        const cx = m + fColW + colW * ci + colW / 2;
        const lower = val.toLowerCase();
        if (lower === "yes" || lower === "strong") setColor(C.success);
        else if (lower === "no" || lower === "weak" || lower === "none") setColor(C.danger);
        else if (lower === "medium" || lower === "partial") setColor(C.warning);
        else setColor(C.muted);
        doc.text(safePdfText(val), cx, y + 1, { align: "center" });
      });
      y += 6;
    });
    y += 3;
  }

  // ── Recommended Strategy ──
  if (report.recommendedStrategy) {
    const rs = report.recommendedStrategy;
    drawSectionTitle("Recommended Strategy");

    if (rs.positioning) {
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); setColor(C.text);
      doc.text("Positioning", m, y); y += 5;
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); setColor(C.text);
      const pLines = doc.splitTextToSize(rs.positioning, cw);
      writeLines(pLines, m + 2, 4); y += 2;
    }
    if (rs.suggestedPricing) {
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); setColor(C.text);
      doc.text("Suggested Pricing", m, y); y += 5;
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); setColor(C.text);
      const prLines = doc.splitTextToSize(rs.suggestedPricing, cw);
      writeLines(prLines, m + 2, 4); y += 2;
    }
    if (rs.differentiators?.length) {
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); setColor(C.text);
      doc.text("Differentiation Opportunities", m, y); y += 5;
      drawBulletList(rs.differentiators, C.indigo, "→");
    }
    if (rs.channels?.length) {
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); setColor(C.text);
      doc.text("Go-to-Market Channels", m, y); y += 5;
      drawBulletList(rs.channels, C.teal, "▸");
    }
  }

  // ── Score Explanation ──
  if (report.scoreExplanationData) {
    const se = report.scoreExplanationData;
    drawSectionTitle("Why This Score: " + report.overallScore + "/100");
    if (se.summary) {
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); setColor(C.muted);
      const sumLines = doc.splitTextToSize(se.summary, cw);
      writeLines(sumLines, m, 4); y += 2;
    }
    for (const factor of se.factors) {
      checkPage(12);
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); setColor(C.indigo);
      doc.text(factor.category, m, y); y += 4;
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); setColor(C.text);
      const fLines = doc.splitTextToSize(factor.explanation, cw - 4);
      writeLines(fLines, m + 2, 3.5); y += 2;
    }
  }

  // ── Kill Shot Analysis ──
  if (report.killShotAnalysis) {
    const ks = report.killShotAnalysis;
    drawSectionTitle("Kill Shot Analysis");

    for (const risk of ks.risks) {
      checkPage(8);
      const sevColor = risk.severity === "High" ? C.danger : risk.severity === "Medium" ? C.gold : C.success;
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); setColor(C.text);
      const riskText = safePdfText(risk.risk);
      doc.text("- " + riskText, m + 2, y);
      if (risk.severity) {
        doc.setFontSize(6); setColor(sevColor);
        doc.text(`[${risk.severity}]`, m + 2 + doc.getTextWidth("- " + riskText) + 2, y);
      }
      y += 5;
    }

    checkPage(14);
    const rlColor = ks.riskLevel === "High" ? C.danger : ks.riskLevel === "Medium" ? C.gold : C.success;
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); setColor(rlColor);
    doc.text("Overall Risk: " + ks.riskLevel, m, y); y += 5;
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); setColor(C.text);
    const intLines = doc.splitTextToSize(ks.interpretation, cw);
    writeLines(intLines, m, 3.5); y += 3;
  }

  // ── Founder Decision Matrix ──
  if (report.founderDecision) {
    const fd = report.founderDecision;
    drawSectionTitle("Founder Decision Matrix");

    // Decision box
    checkPage(20);
    const decColor = fd.decision.includes("Build Now") ? C.success : fd.decision.includes("Not Build") ? C.danger : C.gold;
    // Light tinted background for the decision box
    const lightDecColor: [number, number, number] = [
      Math.min(255, 230 + Math.round(decColor[0] * 0.1)),
      Math.min(255, 240 + Math.round(decColor[1] * 0.05)),
      Math.min(255, 230 + Math.round(decColor[2] * 0.1)),
    ];
    setFill(lightDecColor);
    doc.roundedRect(m, y - 2, cw, 14, 2, 2, "F");
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); setColor(decColor);
    doc.text(safePdfText(fd.decision), m + 4, y + 4);
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); setColor(C.text);
    const rLines = doc.splitTextToSize(safePdfText(fd.reasoning), cw - 8);
    doc.text(rLines[0] || "", m + 4, y + 9);
    y += 17;

    if (fd.whyFactors?.length) {
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); setColor(C.text);
      doc.text("Why:", m, y); y += 5;
      drawBulletList(fd.whyFactors, C.indigo, "→");
    }
    if (fd.nextStep) {
      checkPage(10);
      doc.setFontSize(8); doc.setFont("helvetica", "bold"); setColor(C.muted);
      doc.text("SUGGESTED NEXT STEP", m, y); y += 4;
      doc.setFont("helvetica", "normal"); setColor(C.text);
      const nsLines = doc.splitTextToSize(fd.nextStep, cw);
      writeLines(nsLines, m + 2, 4); y += 3;
    }

    // Risk / Speed / Clarity
    checkPage(10);
    const indicators = [
      { label: "Risk Level", value: fd.riskLevel || "Medium" },
      { label: "Speed to MVP", value: fd.speedToMvp || "Medium" },
      { label: "Commercial Clarity", value: fd.commercialClarity || "Moderate" },
    ];
    const indW = cw / 3;
    indicators.forEach((ind, i) => {
      const ix = m + indW * i + indW / 2;
      doc.setFontSize(6); doc.setFont("helvetica", "normal"); setColor(C.muted);
      doc.text(ind.label, ix, y, { align: "center" });
      doc.setFontSize(9); doc.setFont("helvetica", "bold");
      const vc = ind.value.toLowerCase();
      setColor(vc === "low" || vc === "fast" || vc === "clear" ? C.success : vc === "high" || vc === "slow" || vc === "weak" ? C.danger : C.gold);
      doc.text(ind.value, ix, y + 5, { align: "center" });
    });
    y += 10;
  }


  // ── Evidence Strength ──
  if (report.proofDashboard) {
    const pd = report.proofDashboard;
    drawSectionTitle("Evidence Strength", "Signals ranked by reliability tier");

    const tiers = [
      {
        tier: 1, title: "Hard Market Evidence", description: "Verified search volume, downloads, revenue data",
        items: [
          ...(pd.searchDemand ? [
            { label: "Search volume", value: pd.searchDemand.monthlySearches || "Insufficient data" },
            { label: "Trend direction", value: pd.searchDemand.trend || "Insufficient data" },
          ] : []),
          ...(pd.appStoreSignals ? [
            { label: "App downloads", value: pd.appStoreSignals.downloadEstimate || "Insufficient data" },
            { label: "App store rating", value: pd.appStoreSignals.avgRating || "Insufficient data" },
          ] : []),
        ],
      },
      {
        tier: 2, title: "Market Activity", description: "Developer adoption, product launches, startup activity",
        items: pd.developerActivity ? [
          { label: "GitHub repos", value: pd.developerActivity.repoCount || "Insufficient data" },
          { label: "Total stars", value: pd.developerActivity.totalStars || "Insufficient data" },
          { label: "Recent commits (30d)", value: pd.developerActivity.recentCommits || "Insufficient data" },
        ] : [],
      },
      {
        tier: 3, title: "Social Signals", description: "Community chatter, social mentions, forum discussions",
        items: pd.socialActivity ? [
          { label: "X/Twitter mentions (7d)", value: pd.socialActivity.twitterMentions || "Insufficient data" },
          { label: "Reddit threads", value: pd.socialActivity.redditThreads || "Insufficient data" },
          { label: "HN / PH launches", value: pd.socialActivity.hnPhLaunches || "Insufficient data" },
        ] : [],
      },
    ];

    const tierColors: [number, number, number][] = [C.success, C.indigo, C.gold];

    tiers.forEach((tier, ti) => {
      if (tier.items.length === 0) return;
      checkPage(12 + tier.items.length * 5);
      const tc = tierColors[ti];

      // Tier header
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); setColor(tc);
      doc.text(`Tier ${tier.tier}: ${tier.title}`, m + 2, y);
      doc.setFontSize(6); doc.setFont("helvetica", "normal"); setColor(C.muted);
      doc.text(tier.description, m + 2 + doc.getTextWidth(`Tier ${tier.tier}: ${tier.title}`) + 3, y);
      y += 5;

      // Items
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      tier.items.forEach((item) => {
        checkPage(5);
        const val = safePdfText(item.value);
        const isAvailable = val !== "Insufficient data";
        setColor(isAvailable ? tc : C.muted);
        doc.text(isAvailable ? "+" : "o", m + 4, y);
        setColor(C.muted);
        doc.text(`${item.label}: `, m + 8, y);
        setColor(isAvailable ? C.text : C.muted);
        doc.setFont("helvetica", isAvailable ? "bold" : "italic");
        doc.text(val, m + 8 + doc.getTextWidth(`${item.label}: `), y);
        doc.setFont("helvetica", "normal");
        y += 4.5;
      });
      y += 3;
    });
    y += 2;
  }

  // ── Niche Analysis ──
  if (report.nicheAnalysis) {
    const na = report.nicheAnalysis;
    drawSectionTitle("Niche Analysis", "Addressable market deep-dive");

    const naFields = [
      { label: "SAM Estimate", value: na.samEstimate },
      { label: "SAM %", value: na.samPercentage },
      { label: "Competitor Clarity", value: na.competitorClarity },
      { label: "Direct Competitors", value: String(na.directCompetitors) },
    ];
    naFields.forEach(f => {
      checkPage(5);
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); setColor(C.muted);
      doc.text(f.label + ":", m + 2, y);
      doc.setFont("helvetica", "bold"); setColor(C.text);
      doc.text(safePdfText(f.value), m + 45, y);
      y += 5;
    });
    y += 2;
    if (na.samReasoning) {
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); setColor(C.text);
      const rl = doc.splitTextToSize(na.samReasoning, cw);
      writeLines(rl, m + 2, 4); y += 2;
    }
    if (na.competitorDetail) {
      doc.setFontSize(8); doc.setFont("helvetica", "italic"); setColor(C.muted);
      const cl = doc.splitTextToSize(na.competitorDetail, cw);
      writeLines(cl, m + 2, 4); y += 2;
    }
    if (na.xSignalInterpretation) {
      doc.setFontSize(7); setColor(C.muted); doc.setFont("helvetica", "normal");
      const xl = doc.splitTextToSize("X/Twitter: " + na.xSignalInterpretation, cw);
      writeLines(xl, m + 2, 3.5); y += 2;
    }
  }

  // ── Unit Economics ──
  if (report.unitEconomics) {
    const ue = report.unitEconomics;
    drawSectionTitle("Unit Economics");

    const ueFields = [
      { label: "Realistic ARPU", value: ue.realisticArpu },
      { label: "LTV Estimate", value: ue.ltvEstimate },
      { label: "Privacy Premium", value: ue.privacyPremium },
    ];
    ueFields.forEach(f => {
      checkPage(5);
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); setColor(C.muted);
      doc.text(f.label + ":", m + 2, y);
      doc.setFont("helvetica", "bold"); setColor(C.text);
      doc.text(safePdfText(f.value), m + 45, y);
      y += 5;
    });
    y += 2;
    if (ue.arpuReasoning) {
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); setColor(C.text);
      const al = doc.splitTextToSize(ue.arpuReasoning, cw);
      writeLines(al, m + 2, 4); y += 2;
    }
    if (ue.churnBenchmarks?.length) {
      checkPage(8 + ue.churnBenchmarks.length * 6);
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); setColor(C.text);
      doc.text("Churn Benchmarks", m, y); y += 5;
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      ue.churnBenchmarks.forEach(cb => {
        checkPage(5);
        setColor(C.text);
        doc.text(`${safePdfText(cb.name)}: ${safePdfText(cb.churnRate)}`, m + 4, y);
        doc.setFontSize(6); setColor(C.muted);
        doc.text(`(${safePdfText(cb.source)})`, m + 4 + doc.getTextWidth(`${safePdfText(cb.name)}: ${safePdfText(cb.churnRate)}`) + 2, y);
        doc.setFontSize(8);
        y += 5;
      });
    }
    if (ue.churnImplication) {
      doc.setFontSize(7); doc.setFont("helvetica", "italic"); setColor(C.muted);
      const ci = doc.splitTextToSize(ue.churnImplication, cw);
      writeLines(ci, m + 2, 3.5); y += 2;
    }
  }

  // ── Build Complexity ──
  if (report.buildComplexity) {
    const bc = report.buildComplexity;
    drawSectionTitle("Build Complexity");

    const bcFields = [
      { label: "MVP Timeline", value: bc.mvpTimeline },
      { label: "Estimated Cost", value: bc.estimatedCost },
      { label: "Voice API Costs", value: bc.voiceApiCosts },
    ];
    bcFields.forEach(f => {
      if (!f.value) return;
      checkPage(5);
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); setColor(C.muted);
      doc.text(f.label + ":", m + 2, y);
      doc.setFont("helvetica", "bold"); setColor(C.text);
      doc.text(safePdfText(f.value), m + 45, y);
      y += 5;
    });
    y += 2;
    if (bc.mvpScope?.length) {
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); setColor(C.text);
      doc.text("MVP Scope", m, y); y += 5;
      drawBulletList(bc.mvpScope, C.indigo, "-");
    }
    if (bc.techChallenges?.length) {
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); setColor(C.text);
      doc.text("Technical Challenges", m, y); y += 5;
      drawBulletList(bc.techChallenges, C.danger, "-");
    }
    if (bc.onDeviceNote) {
      doc.setFontSize(7); doc.setFont("helvetica", "italic"); setColor(C.muted);
      const on = doc.splitTextToSize(bc.onDeviceNote, cw);
      writeLines(on, m + 2, 3.5); y += 2;
    }
  }

  // ── Open Source Landscape ──
  if (report.githubRepos?.length) {
    drawSectionTitle("Open Source Landscape", "Related GitHub repositories");

    const repos = report.githubRepos.slice(0, 8);
    repos.forEach(repo => {
      checkPage(12);
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); setColor(C.indigo);
      doc.text(safePdfText(repo.name), m + 2, y);
      doc.setFontSize(6); doc.setFont("helvetica", "normal"); setColor(C.muted);
      doc.text(`Stars: ${repo.stars}  Forks: ${repo.forks}  Issues: ${repo.openIssues}`, m + 2 + doc.getTextWidth(safePdfText(repo.name)) + 3, y);
      y += 4;
      if (repo.description) {
        doc.setFontSize(7); setColor(C.text);
        const dl = doc.splitTextToSize(safePdfText(repo.description), cw - 4);
        writeLines(dl.slice(0, 2), m + 4, 3.5);
      }
      y += 3;
    });
  }

  // ── Founder Insight ──
  if (report.founderInsight) {
    const fi = report.founderInsight;
    drawSectionTitle("Founder Insight", "Plain-English interpretation");

    if (fi.summary) {
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); setColor(C.text);
      const sl = doc.splitTextToSize(fi.summary, cw);
      writeLines(sl, m + 2, 4.5); y += 3;
    }
    const fiSections = [
      { label: "Market Reality", value: fi.marketReality },
      { label: "Competitive Pressure", value: fi.competitivePressure },
      { label: "Possible Gaps", value: fi.possibleGaps },
      { label: "Signal Interpretation", value: fi.signalInterpretation },
    ];
    fiSections.forEach(s => {
      if (!s.value) return;
      checkPage(10);
      doc.setFontSize(8); doc.setFont("helvetica", "bold"); setColor(C.indigo);
      doc.text(s.label, m + 2, y); y += 4;
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); setColor(C.text);
      const vl = doc.splitTextToSize(s.value, cw - 4);
      writeLines(vl, m + 4, 4); y += 2;
    });
  }

  // ── Data Quality Summary ──
  if (report.dataQualitySummary?.length) {
    drawSectionTitle("Data Quality Summary", "Source reliability overview");

    const dqs = report.dataQualitySummary;
    // Table header
    const dqCols = [m, m + 40, m + 65, m + 90];
    checkPage(8 + dqs.length * 6);
    setFill([241, 245, 249]);
    doc.roundedRect(m, y - 1, cw, 7, 1, 1, "F");
    doc.setFontSize(7); doc.setFont("helvetica", "bold"); setColor(C.muted);
    ["Source", "Data Tier", "Signals", "Reliability"].forEach((h, i) => doc.text(h, dqCols[i], y + 3));
    y += 8;

    doc.setFont("helvetica", "normal"); doc.setFontSize(7);
    dqs.forEach((row, i) => {
      checkPage(6);
      if (i % 2 === 0) { setFill([248, 250, 252]); doc.rect(m, y - 2.5, cw, 6, "F"); }
      setColor(C.text);
      doc.text(safePdfText(row.sourceName), dqCols[0], y + 1);
      setColor(C.muted);
      doc.text(safePdfText(row.dataTier), dqCols[1], y + 1);
      doc.text(safePdfText(row.signalCount), dqCols[2], y + 1);
      doc.text(doc.splitTextToSize(safePdfText(row.reliabilityNote), cw - (dqCols[3] - m))[0] || "", dqCols[3], y + 1);
      y += 6;
    });
    y += 3;
  }

  // ── Conflicting Signals ──
  if (report.conflictingSignals?.length) {
    drawSectionTitle("Conflicting Evidence", "Where data sources disagree");

    report.conflictingSignals.forEach(cs => {
      checkPage(14);
      doc.setFontSize(8); doc.setFont("helvetica", "bold"); setColor(C.gold);
      doc.text(safePdfText(cs.category), m + 2, y); y += 4;
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); setColor(C.text);
      doc.text(`Signal A (${safePdfText(cs.sourceA)}): ${safePdfText(cs.signalA)}`, m + 4, y); y += 4;
      doc.text(`Signal B (${safePdfText(cs.sourceB)}): ${safePdfText(cs.signalB)}`, m + 4, y); y += 5;
    });
  }

  // ── Cross-Validated Signals ──
  if (report.pipelineMetrics?.crossValidatedSignals?.length) {
    drawSectionTitle("Cross-Validated Signals", "Claims confirmed by multiple sources");

    report.pipelineMetrics.crossValidatedSignals.forEach(cv => {
      checkPage(8);
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); setColor(C.text);
      doc.text("+ " + safePdfText(cv.claim), m + 2, y);
      doc.setFontSize(6); setColor(C.muted);
      doc.text(`[${cv.sources.join(", ")}]`, m + 6 + doc.getTextWidth(safePdfText(cv.claim)), y);
      y += 5;
    });
    y += 2;
  }

  // ── Perplexity Warning ──
  if (report.pipelineMetrics?.perplexityDominanceBanner && report.pipelineMetrics.perplexityDominanceBanner.percentage > 60) {
    checkPage(14);
    setFill([255, 251, 235]);
    doc.roundedRect(m, y - 2, cw, 12, 2, 2, "F");
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); setColor(C.warning);
    doc.text(`Data Quality Warning - ${report.pipelineMetrics.perplexityDominanceBanner.percentage}% AI-Synthesized`, m + 4, y + 2);
    doc.setFontSize(7); doc.setFont("helvetica", "normal"); setColor(C.muted);
    const wl = doc.splitTextToSize(report.pipelineMetrics.perplexityDominanceBanner.message, cw - 8);
    doc.text(wl[0] || "", m + 4, y + 7);
    y += 15;
  }

  // ── Source Contamination ──
  if (report.pipelineMetrics?.sourceContamination?.length) {
    drawSectionTitle("Source Contamination", "Filtered low-quality data");

    report.pipelineMetrics.sourceContamination.forEach(sc => {
      checkPage(5);
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); setColor(C.text);
      doc.text(`${safePdfText(sc.source)}: ${sc.filtered}/${sc.total} filtered (${sc.contaminationPct}% contamination)`, m + 4, y);
      y += 4;
    });
    y += 2;
  }

  // ── Glossary ──
  {
    drawSectionTitle("Glossary");
    const terms = [
      { term: "Signal Score", def: "Composite 0-100 rating based on trend momentum, market saturation, sentiment, and growth signals." },
      { term: "SAM", def: "Serviceable Addressable Market - the portion of the total market you can realistically capture." },
      { term: "ARPU", def: "Average Revenue Per User - monthly revenue divided by active users." },
      { term: "LTV", def: "Lifetime Value - total revenue expected from one customer over their lifetime." },
      { term: "Kill Shot", def: "A critical risk that could prevent the product from succeeding regardless of execution quality." },
      { term: "MVP", def: "Minimum Viable Product - the simplest version that tests the core value proposition." },
    ];
    terms.forEach(t => {
      checkPage(8);
      doc.setFontSize(8); doc.setFont("helvetica", "bold"); setColor(C.indigo);
      doc.text(t.term, m + 2, y);
      doc.setFont("helvetica", "normal"); setColor(C.text);
      const dl = doc.splitTextToSize(t.def, cw - doc.getTextWidth(t.term) - 8);
      doc.text(dl[0] || "", m + 4 + doc.getTextWidth(t.term), y);
      if (dl.length > 1) { y += 3.5; writeLines(dl.slice(1), m + 4, 3.5); }
      y += 4.5;
    });
  }

  // ── Methodology ──
  if (report.methodology) {
    const mt = report.methodology;
    drawSectionTitle("Methodology", "How this report was generated");

    const mtFields = [
      { label: "Total Sources", value: String(mt.totalSources) },
      { label: "Data Points", value: String(mt.dataPoints) },
      { label: "Analysis Date", value: mt.analysisDate },
      { label: "Perplexity Queries", value: String(mt.perplexityQueries) },
      { label: "Firecrawl Scrapes", value: String(mt.firecrawlScrapes) },
    ];
    if (mt.serperSearches) mtFields.push({ label: "Serper Searches", value: String(mt.serperSearches) });
    if (mt.githubSearches) mtFields.push({ label: "GitHub Searches", value: String(mt.githubSearches) });
    if (mt.twitterSearches) mtFields.push({ label: "X/Twitter Searches", value: String(mt.twitterSearches) });

    mtFields.forEach(f => {
      checkPage(5);
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); setColor(C.muted);
      doc.text(f.label + ":", m + 2, y);
      doc.setFont("helvetica", "bold"); setColor(C.text);
      doc.text(safePdfText(f.value), m + 45, y);
      y += 5;
    });
    y += 2;
    if (mt.confidenceNote) {
      doc.setFontSize(7); doc.setFont("helvetica", "italic"); setColor(C.muted);
      const cn = doc.splitTextToSize(mt.confidenceNote, cw);
      writeLines(cn, m + 2, 3.5); y += 2;
    }
  }

  // ── Source URLs ──
  if (report.dataSources?.length) {
    drawSectionTitle("Sources");
    doc.setFontSize(6); doc.setFont("helvetica", "normal"); setColor(C.muted);
    report.dataSources.slice(0, 20).forEach((url, i) => {
      checkPage(4);
      doc.text(`[${i + 1}] ${safePdfText(url)}`, m + 2, y);
      y += 3.5;
    });
    y += 2;
  }

  // ── Footer on every page ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Footer line
    doc.setDrawColor(C.border[0], C.border[1], C.border[2]);
    doc.setLineWidth(0.3);
    doc.line(m, ph - 14, pw - m, ph - 14);

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
    const siteUrl = typeof window !== "undefined" ? window.location.origin : "Gold Rush";
    doc.text(`Generated by Gold Rush | ${siteUrl.replace(/^https?:\/\//, "")}`, m, ph - 10);
    doc.text(`Page ${i} of ${totalPages}`, pw - m, ph - 10, { align: "right" });
  }

  doc.save(`GoldRush_Report_${report.idea.replace(/\s+/g, "_").slice(0, 30)}.pdf`);
}
