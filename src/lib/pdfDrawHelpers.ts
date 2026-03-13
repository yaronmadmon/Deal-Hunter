import type jsPDF from "jspdf";
import type { ChartPoint } from "@/data/mockReport";

/** RGB color tuple used throughout PDF generation */
export type RGBColor = [number, number, number];

/** Shared color palette (HSL → RGB approximations for jsPDF) */
export const PDF_COLORS = {
  indigo: [79, 70, 229] as RGBColor,
  teal: [20, 184, 166] as RGBColor,
  bg: [245, 245, 250] as RGBColor,
  cardBg: [255, 255, 255] as RGBColor,
  text: [30, 41, 59] as RGBColor,
  muted: [100, 116, 139] as RGBColor,
  success: [34, 197, 94] as RGBColor,
  warning: [245, 158, 11] as RGBColor,
  danger: [239, 68, 68] as RGBColor,
  gold: [234, 179, 8] as RGBColor,
  border: [226, 232, 240] as RGBColor,
  white: [255, 255, 255] as RGBColor,
};

/** Draw a score ring arc onto a jsPDF document */
export function drawScoreRing(
  doc: jsPDF,
  cx: number,
  cy: number,
  radius: number,
  score: number,
  strength: string,
  colors: typeof PDF_COLORS = PDF_COLORS
) {
  const startAngle = -90;
  const endAngle = startAngle + (score / 100) * 360;

  // Background circle
  doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
  doc.setLineWidth(2.5);
  doc.circle(cx, cy, radius, "S");

  // Score arc
  const color = score >= 70 ? colors.success : score >= 40 ? colors.gold : colors.danger;
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(3);
  const steps = Math.max(2, Math.round((score / 100) * 60));
  for (let i = 0; i < steps; i++) {
    const a1 = (startAngle + (i / steps) * (endAngle - startAngle)) * (Math.PI / 180);
    const a2 = (startAngle + ((i + 1) / steps) * (endAngle - startAngle)) * (Math.PI / 180);
    doc.line(
      cx + radius * Math.cos(a1),
      cy + radius * Math.sin(a1),
      cx + radius * Math.cos(a2),
      cy + radius * Math.sin(a2)
    );
  }

  // Score text
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  doc.text(`${score}`, cx, cy + 1, { align: "center" });

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
  doc.text("/100", cx + 8, cy + 1, { align: "center" });

  doc.setFontSize(8);
  doc.setTextColor(color[0], color[1], color[2]);
  doc.setFont("helvetica", "bold");
  doc.text(strength, cx, cy + 6, { align: "center" });
}

/** Draw a sparkline chart onto a jsPDF document */
export function drawSparkline(
  doc: jsPDF,
  x: number,
  yPos: number,
  w: number,
  h: number,
  points: ChartPoint[],
  color: RGBColor,
  label?: string,
  colors: typeof PDF_COLORS = PDF_COLORS
) {
  if (!points || points.length < 2) return;

  const vals = points.map(p => p.value);
  const minV = Math.min(...vals) * 0.8;
  const maxV = Math.max(...vals) * 1.1;
  const range = maxV - minV || 1;

  // Subtle background
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(x, yPos, w, h, 1.5, 1.5, "F");

  // Grid lines
  doc.setDrawColor(235, 238, 245);
  doc.setLineWidth(0.15);
  for (let i = 0; i <= 3; i++) {
    const gy = yPos + (h / 3) * i;
    doc.line(x + 1, gy, x + w - 1, gy);
  }

  // Line
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.6);
  const coords: [number, number][] = points.map((p, i) => [
    x + 2 + ((w - 4) * i) / (points.length - 1),
    yPos + h - 2 - ((p.value - minV) / range) * (h - 4),
  ]);
  for (let i = 0; i < coords.length - 1; i++) {
    doc.line(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
  }

  // Dots at start and end
  doc.setFillColor(color[0], color[1], color[2]);
  doc.circle(coords[0][0], coords[0][1], 0.6, "F");
  doc.circle(coords[coords.length - 1][0], coords[coords.length - 1][1], 0.6, "F");

  // X-axis labels
  doc.setFontSize(5);
  doc.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
  doc.setFont("helvetica", "normal");
  const step = Math.max(1, Math.floor(points.length / 5));
  for (let i = 0; i < points.length; i += step) {
    doc.text(points[i].name, coords[i][0], yPos + h + 3, { align: "center" });
  }

  // Label
  if (label) {
    doc.setFontSize(6);
    doc.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
    doc.text(label, x, yPos - 1.5);
  }
}
