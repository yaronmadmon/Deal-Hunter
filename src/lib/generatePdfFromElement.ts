import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

export async function generatePdfFromElement(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element #${elementId} not found`);
    return;
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: null,
  });

  const imgWidth = 210; // A4 mm
  const pageHeight = 297;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF("p", "mm", "a4");
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position -= pageHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}
