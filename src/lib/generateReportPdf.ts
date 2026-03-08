import jsPDF from "jspdf";
import type { MockReportData } from "@/data/mockReport";

export function generateReportPdf(report: MockReportData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  const addPage = () => {
    doc.addPage();
    y = 20;
  };

  const checkPage = (needed: number) => {
    if (y + needed > 270) addPage();
  };

  // Title
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Gold Rush — Market Report", margin, y);
  y += 10;

  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(report.idea, margin, y);
  y += 10;

  // Score
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Overall Score: ${report.overallScore}/100  •  Signal: ${report.signalStrength}`, margin, y);
  y += 10;

  // Score breakdown
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
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
  checkPage(explanationLines.length * 4 + 4);
  doc.text(explanationLines, margin, y);
  y += explanationLines.length * 4 + 6;

  // Signal Cards
  report.signalCards.forEach((card) => {
    checkPage(40);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`${card.title}  (${card.source})`, margin, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
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
        checkPage(6);
        doc.text(`${c.name} — ${c.rating}, ${c.reviews} reviews, ${c.downloads} downloads`, margin + 2, y);
        y += 4;
        doc.text(`  Weakness: ${c.weakness}`, margin + 4, y);
        y += 5;
      });
    }

    if (card.sentiment) {
      const s = card.sentiment;
      checkPage(20);
      doc.text(`Emotion: ${s.emotion}  (${s.complaintCount} complaints, ${s.positiveCount} positive)`, margin + 2, y);
      y += 5;
      doc.text("Top complaints:", margin + 2, y);
      y += 4;
      s.complaints.forEach((c) => {
        checkPage(5);
        doc.text(`  – ${c}`, margin + 4, y);
        y += 4;
      });
      doc.text("Users love:", margin + 2, y);
      y += 4;
      s.loves.forEach((l) => {
        checkPage(5);
        doc.text(`  + ${l}`, margin + 4, y);
        y += 4;
      });
    }

    // Insight
    checkPage(8);
    doc.setFont("helvetica", "italic");
    const insightLines = doc.splitTextToSize(`Insight: ${card.insight}`, contentWidth - 4);
    doc.text(insightLines, margin + 2, y);
    y += insightLines.length * 4 + 4;
    doc.setFont("helvetica", "normal");

    // Evidence quotes
    card.evidence.forEach((e) => {
      checkPage(8);
      const elines = doc.splitTextToSize(`"${e}"`, contentWidth - 6);
      doc.setFontSize(8);
      doc.text(elines, margin + 4, y);
      y += elines.length * 3.5 + 2;
      doc.setFontSize(9);
    });

    y += 4;
  });

  // Opportunity
  checkPage(30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Opportunity", margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Feature Gaps:", margin, y);
  y += 5;
  report.opportunity.featureGaps.forEach((g) => {
    checkPage(5);
    doc.text(`• ${g}`, margin + 2, y);
    y += 4.5;
  });
  y += 2;
  doc.text("Underserved Users:", margin, y);
  y += 5;
  report.opportunity.underservedUsers.forEach((u) => {
    checkPage(5);
    doc.text(`• ${u}`, margin + 2, y);
    y += 4.5;
  });
  y += 2;
  checkPage(10);
  const posLines = doc.splitTextToSize(`Positioning: ${report.opportunity.positioning}`, contentWidth);
  doc.text(posLines, margin, y);
  y += posLines.length * 4 + 6;

  // Revenue
  checkPage(20);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Revenue Benchmark", margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Range: ${report.revenueBenchmark.range}`, margin, y);
  y += 5;
  const sumLines = doc.splitTextToSize(report.revenueBenchmark.summary, contentWidth);
  doc.text(sumLines, margin, y);
  y += sumLines.length * 4 + 4;
  const basisLines = doc.splitTextToSize(report.revenueBenchmark.basis, contentWidth);
  doc.setFontSize(8);
  doc.text(basisLines, margin, y);
  y += basisLines.length * 3.5 + 6;

  // Footer
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text("Generated by Gold Rush • goldrush.ai", margin, 285);

  doc.save(`GoldRush_Report_${report.idea.replace(/\s+/g, "_").slice(0, 30)}.pdf`);
}
