import jsPDF from "jspdf";
import type { MockReportData } from "@/data/mockReport";

export function generateReportPdf(report: MockReportData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const bottomMargin = 20;
  const maxY = pageHeight - bottomMargin;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  const addPage = () => {
    doc.addPage();
    y = 20;
  };

  const checkPage = (needed: number) => {
    if (y + needed > maxY) addPage();
  };

  /** Write wrapped text line-by-line with page breaks */
  const writeLines = (lines: string[], x: number, lineHeight: number) => {
    for (const line of lines) {
      checkPage(lineHeight);
      doc.text(line, x, y);
      y += lineHeight;
    }
  };

  // Title
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Gold Rush — Market Report", margin, y);
  y += 10;

  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  const ideaLines = doc.splitTextToSize(report.idea, contentWidth);
  writeLines(ideaLines, margin, 6);
  y += 4;

  // Score
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  checkPage(8);
  doc.text(`Overall Score: ${report.overallScore}/100  •  Signal: ${report.signalStrength}`, margin, y);
  y += 10;

  // Score breakdown
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  checkPage(8);
  doc.text("Score Breakdown", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  report.scoreBreakdown.forEach((item) => {
    checkPage(6);
    doc.text(`• ${item.label}: ${item.value}/20`, margin + 2, y);
    y += 5;
  });
  y += 4;

  doc.setFontSize(9);
  const explanationLines = doc.splitTextToSize(report.scoreExplanation, contentWidth);
  writeLines(explanationLines, margin, 4);
  y += 6;

  // Signal Cards
  report.signalCards.forEach((card) => {
    checkPage(14);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`${card.title}  (${card.source})`, margin, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    checkPage(6);
    doc.text(`Confidence: ${card.confidence}  •  Evidence: ${card.evidenceCount} data points`, margin, y);
    y += 5;

    if (card.metrics) {
      card.metrics.forEach((m) => {
        checkPage(5);
        doc.text(`${m.label}: ${m.value}`, margin + 2, y);
        y += 4.5;
      });
    }

    if (card.competitors) {
      card.competitors.forEach((c) => {
        checkPage(12);
        doc.text(`${c.name} — ${c.rating}, ${c.reviews} reviews, ${c.downloads} downloads`, margin + 2, y);
        y += 4;
        const weakLines = doc.splitTextToSize(`  Weakness: ${c.weakness}`, contentWidth - 6);
        writeLines(weakLines, margin + 4, 4);
        y += 1;
      });
    }

    if (card.sentiment) {
      const s = card.sentiment;
      checkPage(8);
      doc.text(`Emotion: ${s.emotion}  (${s.complaintCount} complaints, ${s.positiveCount} positive)`, margin + 2, y);
      y += 5;
      checkPage(5);
      doc.text("Top complaints:", margin + 2, y);
      y += 4;
      s.complaints.forEach((c) => {
        checkPage(5);
        const cLines = doc.splitTextToSize(`  – ${c}`, contentWidth - 6);
        writeLines(cLines, margin + 4, 4);
      });
      checkPage(5);
      doc.text("Users love:", margin + 2, y);
      y += 4;
      s.loves.forEach((l) => {
        checkPage(5);
        const lLines = doc.splitTextToSize(`  + ${l}`, contentWidth - 6);
        writeLines(lLines, margin + 4, 4);
      });
    }

    // Insight
    checkPage(8);
    doc.setFont("helvetica", "italic");
    const insightLines = doc.splitTextToSize(`Insight: ${card.insight}`, contentWidth - 4);
    writeLines(insightLines, margin + 2, 4);
    y += 2;
    doc.setFont("helvetica", "normal");

    // Evidence quotes
    card.evidence.forEach((e) => {
      doc.setFontSize(8);
      const elines = doc.splitTextToSize(`"${e}"`, contentWidth - 6);
      writeLines(elines, margin + 4, 3.5);
      y += 1;
      doc.setFontSize(9);
    });

    y += 4;
  });

  // Opportunity
  checkPage(14);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Opportunity", margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  checkPage(6);
  doc.text("Feature Gaps:", margin, y);
  y += 5;
  report.opportunity.featureGaps.forEach((g) => {
    checkPage(5);
    const gLines = doc.splitTextToSize(`• ${g}`, contentWidth - 4);
    writeLines(gLines, margin + 2, 4.5);
  });
  y += 2;
  checkPage(6);
  doc.text("Underserved Users:", margin, y);
  y += 5;
  report.opportunity.underservedUsers.forEach((u) => {
    checkPage(5);
    const uLines = doc.splitTextToSize(`• ${u}`, contentWidth - 4);
    writeLines(uLines, margin + 2, 4.5);
  });
  y += 2;
  checkPage(10);
  const posLines = doc.splitTextToSize(`Positioning: ${report.opportunity.positioning}`, contentWidth);
  writeLines(posLines, margin, 4);
  y += 6;

  // Revenue
  checkPage(14);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Revenue Benchmark", margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  checkPage(6);
  doc.text(`Range: ${report.revenueBenchmark.range}`, margin, y);
  y += 5;
  const sumLines = doc.splitTextToSize(report.revenueBenchmark.summary, contentWidth);
  writeLines(sumLines, margin, 4);
  y += 4;
  const basisLines = doc.splitTextToSize(report.revenueBenchmark.basis, contentWidth);
  doc.setFontSize(8);
  writeLines(basisLines, margin, 3.5);
  y += 6;

  // Footer on every page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text("Generated by Gold Rush • goldrush.ai", margin, pageHeight - 10);
  }

  doc.save(`GoldRush_Report_${report.idea.replace(/\s+/g, "_").slice(0, 30)}.pdf`);
}
