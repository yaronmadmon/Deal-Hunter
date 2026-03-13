import jsPDF from "jspdf";
import type { BlueprintData, ChartPoint, DonutSegment, ScoreBreakdownItem } from "@/data/mockReport";
import { sanitizeForPdf } from "./pdfSanitize";

// ── Colors ──
const C = {
  indigo: [79, 70, 229] as [number, number, number],
  teal: [20, 184, 166] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  success: [34, 197, 94] as [number, number, number],
  gold: [234, 179, 8] as [number, number, number],
  danger: [239, 68, 68] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

export interface BlueprintPdfContext {
  overallScore?: number;
  signalStrength?: string;
  googleTrendsSparkline?: ChartPoint[];
  sparkline?: ChartPoint[];
  donut?: DonutSegment[];
  scoreBreakdown?: ScoreBreakdownItem[];
}

export function generateBlueprintPdf(blueprint: BlueprintData, idea: string, ctx?: BlueprintPdfContext) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 16;
  const maxY = ph - 22;
  const cw = pw - m * 2;
  let y = 18;

  const setColor = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

  const checkPage = (needed: number) => { if (y + needed > maxY) { doc.addPage(); y = 18; } };
  const writeLines = (lines: string[], x: number, lh: number) => {
    for (const line of lines) { checkPage(lh); doc.text(sanitizeForPdf(line), x, y); y += lh; }
  };
  const drawHRule = () => { checkPage(4); setDraw(C.border); doc.setLineWidth(0.3); doc.line(m, y, pw - m, y); y += 4; };

  // ── Score Ring ──
  const drawScoreRing = (cx: number, cy: number, radius: number, score: number, strength: string) => {
    const startAngle = -90;
    const endAngle = startAngle + (score / 100) * 360;
    setDraw(C.border); doc.setLineWidth(2.5); doc.circle(cx, cy, radius, "S");
    const color = score >= 70 ? C.success : score >= 40 ? C.gold : C.danger;
    setDraw(color); doc.setLineWidth(3);
    const steps = Math.max(2, Math.round((score / 100) * 60));
    for (let i = 0; i < steps; i++) {
      const a1 = (startAngle + (i / steps) * (endAngle - startAngle)) * (Math.PI / 180);
      const a2 = (startAngle + ((i + 1) / steps) * (endAngle - startAngle)) * (Math.PI / 180);
      doc.line(cx + radius * Math.cos(a1), cy + radius * Math.sin(a1), cx + radius * Math.cos(a2), cy + radius * Math.sin(a2));
    }
    doc.setFontSize(18); doc.setFont("helvetica", "bold"); setColor(C.text);
    doc.text(`${score}`, cx, cy + 1, { align: "center" });
    doc.setFontSize(7); setColor(C.muted); doc.text("/100", cx + 7, cy + 1, { align: "center" });
    doc.setFontSize(7); setColor(color); doc.setFont("helvetica", "bold");
    doc.text(strength, cx, cy + 5.5, { align: "center" });
  };

  // ── Sparkline ──
  const drawSparkline = (x: number, yPos: number, w: number, h: number, points: ChartPoint[], color: [number, number, number], label?: string) => {
    if (!points || points.length < 2) return;
    const vals = points.map(p => p.value);
    const minV = Math.min(...vals) * 0.8; const maxV = Math.max(...vals) * 1.1; const range = maxV - minV || 1;
    setFill([248, 250, 252]); doc.roundedRect(x, yPos, w, h, 1.5, 1.5, "F");
    setDraw([235, 238, 245]); doc.setLineWidth(0.15);
    for (let i = 0; i <= 3; i++) doc.line(x + 1, yPos + (h / 3) * i, x + w - 1, yPos + (h / 3) * i);
    setDraw(color); doc.setLineWidth(0.6);
    const coords: [number, number][] = points.map((p, i) => [
      x + 2 + ((w - 4) * i) / (points.length - 1),
      yPos + h - 2 - ((p.value - minV) / range) * (h - 4),
    ]);
    for (let i = 0; i < coords.length - 1; i++) doc.line(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
    setFill(color);
    doc.circle(coords[0][0], coords[0][1], 0.6, "F");
    doc.circle(coords[coords.length - 1][0], coords[coords.length - 1][1], 0.6, "F");
    doc.setFontSize(5); setColor(C.muted); doc.setFont("helvetica", "normal");
    const step = Math.max(1, Math.floor(points.length / 5));
    for (let i = 0; i < points.length; i += step) doc.text(points[i].name, coords[i][0], yPos + h + 3, { align: "center" });
    if (label) { doc.setFontSize(6); setColor(C.muted); doc.text(label, x, yPos - 1.5); }
  };

  // ── Donut ──
  const drawDonut = (cx: number, cy: number, r: number, segments: DonutSegment[]) => {
    if (!segments || segments.length === 0) return;
    const total = segments.reduce((s, seg) => s + seg.value, 0);
    const colors: [number, number, number][] = [C.indigo, [180, 190, 210], C.teal, C.gold];
    let startA = -90;
    segments.forEach((seg, i) => {
      const sweep = (seg.value / total) * 360;
      const endA = startA + sweep;
      const col = colors[i % colors.length];
      setDraw(col); doc.setLineWidth(3);
      const steps = Math.max(2, Math.round(sweep / 4));
      for (let j = 0; j < steps; j++) {
        const a1 = (startA + (j / steps) * sweep) * (Math.PI / 180);
        const a2 = (startA + ((j + 1) / steps) * sweep) * (Math.PI / 180);
        doc.line(cx + r * Math.cos(a1), cy + r * Math.sin(a1), cx + r * Math.cos(a2), cy + r * Math.sin(a2));
      }
      const midA = ((startA + endA) / 2) * (Math.PI / 180);
      doc.setFontSize(6); setColor(col); doc.setFont("helvetica", "bold");
      doc.text(`${seg.name} ${Math.round((seg.value / total) * 100)}%`, cx + (r + 7) * Math.cos(midA), cy + (r + 7) * Math.sin(midA), { align: "center" });
      startA = endA;
    });
    setFill(C.white); doc.circle(cx, cy, r - 3.5, "F");
  };

  // ════════════════════════════════════════
  // BUILD PDF
  // ════════════════════════════════════════

  // Header
  setFill([240, 242, 255]);
  doc.rect(0, 0, pw, 50, "F");

  doc.setFontSize(20); doc.setFont("helvetica", "bold"); setColor(C.indigo);
  doc.text(sanitizeForPdf("Gold Rush"), m, y);
  doc.setFontSize(10); setColor(C.muted);
  doc.text(sanitizeForPdf("Startup Blueprint"), m + 38, y);
  y += 10;

  doc.setFontSize(12); doc.setFont("helvetica", "bold"); setColor(C.text);
  const ideaLines = doc.splitTextToSize(sanitizeForPdf(idea), cw - 45);
  writeLines(ideaLines, m, 6);

  // Score ring in header
  if (ctx?.overallScore) {
    drawScoreRing(pw - m - 18, 28, 12, ctx.overallScore, ctx.signalStrength || "");
  }

  y = 54;

  // ── Market Context Row (charts side by side) ──
  const hasSparkline = (ctx?.googleTrendsSparkline && ctx.googleTrendsSparkline.length > 1) || (ctx?.sparkline && ctx.sparkline.length > 1);
  const hasDonut = ctx?.donut && ctx.donut.length > 0;

  if (hasSparkline || hasDonut) {
    checkPage(35);
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); setColor(C.text);
    doc.text(sanitizeForPdf("Market Context"), m, y);
    y += 8;

    if (hasSparkline && hasDonut) {
      const sparkData = ctx?.googleTrendsSparkline || ctx?.sparkline || [];
      const sparkLabel = ctx?.googleTrendsSparkline ? "Google Trends — Search Interest" : "Simulated Trend (illustrative only)";
      drawSparkline(m, y, cw * 0.55, 18, sparkData, C.indigo, sparkLabel);
      drawDonut(m + cw * 0.55 + 25, y + 9, 8, ctx!.donut!);
      y += 28;
    } else if (hasSparkline) {
      const sparkData = ctx?.googleTrendsSparkline || ctx?.sparkline || [];
      const sparkLabel = ctx?.googleTrendsSparkline ? "Google Trends — Search Interest" : "Simulated Trend (illustrative only)";
      drawSparkline(m, y, cw * 0.65, 18, sparkData, C.indigo, sparkLabel);
      y += 28;
    } else if (hasDonut) {
      drawDonut(m + 25, y + 9, 10, ctx!.donut!);
      y += 28;
    }

    drawHRule();
  }

  // ── Report Summary ──
  if (blueprint.reportSummary) {
    checkPage(16);
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); setColor(C.text);
    doc.text(sanitizeForPdf("Report-Linked Summary"), m, y); y += 6;
    doc.setFontSize(9); doc.setFont("helvetica", "italic"); setColor(C.muted);
    const sumLines = doc.splitTextToSize(sanitizeForPdf(blueprint.reportSummary), cw);
    writeLines(sumLines, m, 4.5); y += 4;
    drawHRule();
  }

  // ── Blueprint sections ──
  const bpSections: { title: string; content: string | string[]; color: [number, number, number] }[] = [
    { title: "Product Concept", content: blueprint.productConcept, color: C.indigo },
    { title: "Strategic Positioning", content: blueprint.strategicPositioning, color: C.teal },
    { title: "Competitive Edge", content: blueprint.competitiveEdge || [], color: C.gold },
    { title: "Core Features", content: blueprint.coreFeatures, color: C.indigo },
    { title: "Target Users", content: blueprint.targetUsers, color: C.teal },
    { title: "Primary Launch Segment", content: blueprint.primaryLaunchSegment || "", color: C.success },
    { title: "Monetization Strategy", content: blueprint.monetization, color: C.success },
    { title: "Monetization Validation", content: blueprint.monetizationValidation || [], color: C.gold },
    { title: "MVP Timeline", content: blueprint.mvpPlan, color: C.indigo },
    { title: "Technical Architecture", content: blueprint.techStack || [], color: C.teal },
    { title: "Technical Tradeoffs", content: blueprint.techTradeoffs || [], color: C.danger },
    { title: "Go-to-Market Plan", content: blueprint.goToMarket || [], color: C.success },
    { title: "Competitive Response", content: blueprint.competitiveResponse || [], color: C.gold },
    { title: "Validation Checkpoints", content: blueprint.validationMilestones || [], color: C.indigo },
  ];

  bpSections.forEach(({ title, content, color }) => {
    if (!content || (Array.isArray(content) && content.length === 0)) return;

    checkPage(14);
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); setColor(C.text);
    doc.text(sanitizeForPdf(title), m, y);
    // Colored underline
    setDraw(color); doc.setLineWidth(0.5);
    doc.line(m, y + 1.5, m + doc.getTextWidth(sanitizeForPdf(title)), y + 1.5);
    y += 7;

    doc.setFontSize(9); doc.setFont("helvetica", "normal"); setColor(C.text);

    if (typeof content === "string") {
      const lines = doc.splitTextToSize(sanitizeForPdf(content), cw);
      writeLines(lines, m, 4.5);
      y += 5;
    } else {
      content.forEach((item, i) => {
        checkPage(8);
        setColor(color);
        doc.setFont("helvetica", "bold");
        doc.text(`${i + 1}.`, m + 2, y);
        doc.setFont("helvetica", "normal");
        setColor(C.text);
        const lines = doc.splitTextToSize(sanitizeForPdf(item), cw - 10);
        writeLines(lines, m + 9, 4.5);
        y += 2;
      });
      y += 3;
    }
  });

  // ── Score Breakdown bars ──
  if (ctx?.scoreBreakdown && ctx.scoreBreakdown.length > 0) {
    drawHRule();
    checkPage(15 + ctx.scoreBreakdown.length * 7);
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); setColor(C.text);
    doc.text(sanitizeForPdf("Score Breakdown"), m, y); y += 7;

    ctx.scoreBreakdown.forEach((item) => {
      checkPage(8);
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); setColor(C.text);
      doc.text(sanitizeForPdf(item.label), m + 2, y);
      const barX = m + 48; const barMaxW = cw - 68; const barH = 3.5;
      setFill(C.border); doc.roundedRect(barX, y - 2.5, barMaxW, barH, 1, 1, "F");
      const fillW = (item.value / 20) * barMaxW;
      const barColor = item.value >= 15 ? C.success : item.value >= 10 ? C.gold : C.danger;
      setFill(barColor); doc.roundedRect(barX, y - 2.5, fillW, barH, 1, 1, "F");
      doc.setFont("helvetica", "bold"); setColor(barColor);
      doc.text(`${item.value}/20`, barX + barMaxW + 3, y);
      y += 7;
    });
    y += 3;
  }

  // ── Footer ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(C.border[0], C.border[1], C.border[2]);
    doc.setLineWidth(0.3); doc.line(m, ph - 14, pw - m, ph - 14);
    doc.setFontSize(7); doc.setFont("helvetica", "normal");
    doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
    doc.text("Generated by Gold Rush | goldrushapp.live", m, ph - 10);
    doc.text(`Page ${i} of ${totalPages}`, pw - m, ph - 10, { align: "right" });
  }

  doc.save(`GoldRush_Blueprint_${idea.replace(/\s+/g, "_").slice(0, 30)}.pdf`);
}
