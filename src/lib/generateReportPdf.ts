import jsPDF from "jspdf";
import type { MockReportData, SignalCardData, CompetitorEntry, ChartPoint } from "@/data/mockReport";

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
      doc.text(line, x, y);
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
      doc.text(c.name, cols[0], y + 1);
      doc.setFont("helvetica", "normal");
      setColor(C.muted);
      doc.text(c.rating, cols[1], y + 1);
      doc.text(c.reviews, cols[2], y + 1);
      doc.text(c.downloads, cols[3], y + 1);

      // Weakness (truncated)
      doc.setFontSize(7);
      const wLines = doc.splitTextToSize(c.weakness, cw - (cols[4] - m));
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
    doc.text(`${source}  •  ${confidence} confidence`, m + titleW + 3, y);

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
  const statsRow = report.keyStats || [
    { value: `${report.overallScore}/100`, label: "Signal Score" },
    { value: `${report.signalCards.reduce((s, c) => s + (c.evidenceCount || 0), 0)}+`, label: "Data Points" },
    { value: report.revenueBenchmark.range, label: "Revenue Est." },
  ];
  const statW = cw / statsRow.length;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  statsRow.forEach((stat, i) => {
    const sx = m + statW * i + statW / 2;
    setColor(C.indigo);
    doc.text(stat.value, sx, y, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    setColor(C.muted);
    doc.text(stat.label, sx, y + 4, { align: "center" });
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
        doc.text(`${met.label}:`, m + 2, y);
        doc.setFont("helvetica", "bold");
        setColor(C.text);
        doc.text(met.value, m + 45, y);
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
    // Trend sparkline
    else if (card.sparkline && card.sparkline.length > 1) {
      checkPage(28);
      drawSparkline(m + 2, y, cw * 0.6, 18, card.sparkline, C.teal, "Trend — Interest Over Time");
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
        doc.text("•", m + 4, y);
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
        doc.text("•", m + 4, y);
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

    // Growth line chart
    if (card.lineChart && card.lineChart.length > 1) {
      checkPage(28);
      drawSparkline(m + 2, y, cw * 0.6, 18, card.lineChart, C.success, "Growth — Search & Activity Trend");
      y += 26;
    }

    // Insight
    checkPage(10);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    setColor(C.indigo);
    const insightLines = doc.splitTextToSize(`💡 ${card.insight}`, cw - 4);
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
    doc.text("▸", m + 2, y);
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
    doc.text("▸", m + 2, y);
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
  doc.text(report.revenueBenchmark.range, m + 4, y + 4);
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
    doc.text(`Generated by Gold Rush • ${siteUrl.replace(/^https?:\/\//, "")}`, m, ph - 10);
    doc.text(`Page ${i} of ${totalPages}`, pw - m, ph - 10, { align: "right" });
  }

  doc.save(`GoldRush_Report_${report.idea.replace(/\s+/g, "_").slice(0, 30)}.pdf`);
}
