import html2pdf from "html2pdf.js";

export async function generatePdfFromElement(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element #${elementId} not found`);
    return;
  }

  const opt = {
    margin: 0.5,
    filename,
    image: { type: "jpeg", quality: 0.8 },
    html2canvas: { scale: 1.5, useCORS: true, logging: false },
    jsPDF: { unit: "in", format: "letter", orientation: "portrait" as const },
  };

  await html2pdf().from(element).set(opt).save();
}
