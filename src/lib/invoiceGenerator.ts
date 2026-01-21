import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { format, addDays } from "date-fns";
import { initializePdfFonts, registerPdfFonts, setFontStyle, getPdfFontFamily, hasCustomFont } from "./pdfFonts";

export interface InvoiceData {
  // Supplier (Dodávateľ - Subcontractor)
  supplierName: string;
  supplierCompany: string | null;
  supplierAddress: string | null;
  supplierIco?: string | null;
  supplierDic?: string | null;
  supplierIban: string | null;
  supplierSwiftBic: string | null;
  signatureUrl: string | null;
  hourlyRate: number;
  
  // VAT settings
  isVatPayer: boolean;
  vatNumber: string | null;
  isReverseCharge: boolean;

  // Invoice details
  projectName: string;
  calendarWeek: number;
  year: number;
  totalHours: number;
  
  // For unique invoice number
  odberatelId?: string;
}

// TKJD s.r.o. company details (Odberateľ / Customer)
const CUSTOMER = {
  name: "TKJD s.r.o.",
  street: "Zalobin 114",
  city: "094 03 Zalobin",
  country: "Slovenska republika",
  ico: "56004133",
  dic: "2122094097",
  icDph: "SK2122094097",
};

const VAT_RATE = 0.20;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateInvoiceNumber(odberatelId?: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  
  let suffix: string;
  if (odberatelId && odberatelId.length >= 3) {
    suffix = odberatelId.replace(/-/g, "").slice(-3).toUpperCase();
  } else {
    suffix = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  }
  
  return `${year}${month}${suffix}`;
}

function generatePayBySquareData(
  iban: string,
  amount: number,
  invoiceNumber: string,
  beneficiaryName: string
): string {
  const cleanIban = iban.replace(/\s/g, "");
  const amountStr = amount.toFixed(2);
  const message = `Faktura ${invoiceNumber}`;
  
  // PAY by square format
  return `SPD*1.0*ACC:${cleanIban}*AM:${amountStr}*CC:EUR*MSG:${message}*RN:${beneficiaryName}`;
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ============================================================================
// MAIN PDF GENERATOR
// ============================================================================

export async function generateInvoicePDF(data: InvoiceData): Promise<void> {
  // Initialize fonts with fallback
  try {
    await initializePdfFonts();
  } catch (error) {
    console.warn("Font init failed, continuing with Helvetica:", error);
  }

  const doc = new jsPDF();
  
  // Register fonts (will fallback to Helvetica if needed)
  const usingCustomFont = registerPdfFonts(doc);
  
  const invoiceNumber = generateInvoiceNumber(data.odberatelId);
  
  // Calculate amounts
  const baseAmount = data.totalHours * data.hourlyRate;
  let vatAmount = 0;
  let vatPercent = 0;
  let totalAmount = baseAmount;
  
  if (data.isVatPayer && !data.isReverseCharge) {
    vatPercent = 20;
    vatAmount = baseAmount * VAT_RATE;
    totalAmount = baseAmount + vatAmount;
  }
  
  // Dates
  const issueDate = new Date();
  const deliveryDate = issueDate;
  const dueDate = addDays(issueDate, 14);

  // Layout constants
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const colWidth = (pageWidth - margin * 2 - 10) / 2;

  // ============================================================================
  // HEADER SECTION
  // ============================================================================
  
  // Company name (top left)
  doc.setFontSize(18);
  if (!usingCustomFont) doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("TKJD s.r.o.", margin, 20);
  
  // Invoice title and number (top right)
  doc.setFontSize(22);
  doc.text("FAKTURA", pageWidth - margin, 20, { align: "right" });
  
  doc.setFontSize(12);
  if (!usingCustomFont) doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`c.: ${invoiceNumber}`, pageWidth - margin, 28, { align: "right" });

  // Separator line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, 35, pageWidth - margin, 35);

  // ============================================================================
  // DATE SECTION (Right aligned, below header)
  // ============================================================================
  
  const dateBlockX = pageWidth - margin - 80;
  let dateY = 45;
  
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  
  // Date labels and values
  const dateLabels = [
    { label: "Datum vystavenia:", value: format(issueDate, "dd.MM.yyyy") },
    { label: "Datum dodania:", value: format(deliveryDate, "dd.MM.yyyy") },
    { label: "Datum splatnosti:", value: format(dueDate, "dd.MM.yyyy"), highlight: true },
  ];
  
  dateLabels.forEach(({ label, value, highlight }) => {
    doc.setTextColor(100, 100, 100);
    doc.text(label, dateBlockX, dateY);
    
    if (highlight) {
      doc.setTextColor(180, 0, 0);
    } else {
      doc.setTextColor(40, 40, 40);
    }
    if (!usingCustomFont) doc.setFont("helvetica", "bold");
    doc.text(value, pageWidth - margin, dateY, { align: "right" });
    if (!usingCustomFont) doc.setFont("helvetica", "normal");
    
    dateY += 6;
  });

  // ============================================================================
  // ADDRESS BLOCKS (Two Columns)
  // ============================================================================
  
  const addressY = 70;
  const boxHeight = 55;
  
  // Left box: DODAVATEL (Supplier)
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(margin, addressY, colWidth, boxHeight, 2, 2, "F");
  
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  if (!usingCustomFont) doc.setFont("helvetica", "bold");
  doc.text("DODAVATEL", margin + 5, addressY + 8);
  
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(data.supplierName, margin + 5, addressY + 16);
  
  doc.setFontSize(8);
  if (!usingCustomFont) doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  
  let supY = addressY + 22;
  
  if (data.supplierCompany) {
    doc.text(data.supplierCompany, margin + 5, supY);
    supY += 4;
  }
  
  if (data.supplierAddress) {
    const addressLines = data.supplierAddress.split("\n");
    addressLines.forEach((line) => {
      doc.text(line.trim(), margin + 5, supY);
      supY += 4;
    });
  }
  
  supY += 2;
  
  if (data.supplierIco) {
    doc.text(`ICO: ${data.supplierIco}`, margin + 5, supY);
    supY += 4;
  }
  if (data.supplierDic) {
    doc.text(`DIC: ${data.supplierDic}`, margin + 5, supY);
    supY += 4;
  }
  if (data.isVatPayer && data.vatNumber) {
    doc.text(`IC DPH: ${data.vatNumber}`, margin + 5, supY);
    supY += 4;
  }
  
  // IBAN in supplier box
  if (data.supplierIban) {
    supY += 1;
    if (!usingCustomFont) doc.setFont("helvetica", "bold");
    doc.text(`IBAN: ${data.supplierIban}`, margin + 5, supY);
    supY += 4;
    if (!usingCustomFont) doc.setFont("helvetica", "normal");
    if (data.supplierSwiftBic) {
      doc.text(`SWIFT: ${data.supplierSwiftBic}`, margin + 5, supY);
    }
  }

  // Right box: ODBERATEL (Customer)
  const rightBoxX = margin + colWidth + 10;
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(rightBoxX, addressY, colWidth, boxHeight, 2, 2, "F");
  
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  if (!usingCustomFont) doc.setFont("helvetica", "bold");
  doc.text("ODBERATEL", rightBoxX + 5, addressY + 8);
  
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(CUSTOMER.name, rightBoxX + 5, addressY + 16);
  
  doc.setFontSize(8);
  if (!usingCustomFont) doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  
  let custY = addressY + 22;
  doc.text(CUSTOMER.street, rightBoxX + 5, custY);
  custY += 4;
  doc.text(CUSTOMER.city, rightBoxX + 5, custY);
  custY += 4;
  doc.text(CUSTOMER.country, rightBoxX + 5, custY);
  custY += 6;
  doc.text(`ICO: ${CUSTOMER.ico}`, rightBoxX + 5, custY);
  custY += 4;
  doc.text(`DIC: ${CUSTOMER.dic}`, rightBoxX + 5, custY);
  custY += 4;
  doc.text(`IC DPH: ${CUSTOMER.icDph}`, rightBoxX + 5, custY);

  // ============================================================================
  // PERFORMANCE TABLE
  // ============================================================================
  
  const tableStartY = addressY + boxHeight + 15;
  const fontFamily = getPdfFontFamily();

  const tableBody: (string | number)[][] = [
    [
      `${data.projectName} - KW ${data.calendarWeek}/${data.year}`,
      data.totalHours.toFixed(2),
      data.hourlyRate.toFixed(2),
      data.isReverseCharge ? "0% (RC)" : (data.isVatPayer ? "20%" : "-"),
      `${baseAmount.toFixed(2)} EUR`,
    ],
  ];

  autoTable(doc, {
    startY: tableStartY,
    head: [[
      { content: "Popis vykonu", styles: { halign: "left" } },
      { content: "Rozsah (hod)", styles: { halign: "center" } },
      { content: "Sadzba (EUR/h)", styles: { halign: "right" } },
      { content: "DPH (%)", styles: { halign: "center" } },
      { content: "Celkom", styles: { halign: "right" } },
    ]],
    body: tableBody,
    styles: {
      fontSize: 9,
      cellPadding: 6,
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
      font: fontFamily,
    },
    headStyles: {
      fillColor: [50, 50, 50],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      textColor: [40, 40, 40],
    },
    columnStyles: {
      0: { cellWidth: 70, halign: "left" },
      1: { cellWidth: 28, halign: "center" },
      2: { cellWidth: 30, halign: "right" },
      3: { cellWidth: 22, halign: "center" },
      4: { cellWidth: 32, halign: "right" },
    },
    margin: { left: margin, right: margin },
    tableWidth: "auto",
  });

  const afterTableY = (doc as any).lastAutoTable.finalY + 10;

  // ============================================================================
  // SUMMARY BLOCK (Bottom Right)
  // ============================================================================
  
  const summaryWidth = 85;
  const summaryX = pageWidth - margin - summaryWidth;
  let summaryY = afterTableY;

  // Summary box background
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  const summaryHeight = data.isVatPayer && !data.isReverseCharge ? 42 : 32;
  doc.roundedRect(summaryX, summaryY, summaryWidth, summaryHeight, 2, 2, "FD");

  doc.setFontSize(9);
  summaryY += 8;

  // Základ dane
  doc.setTextColor(80, 80, 80);
  doc.text("Zaklad dane:", summaryX + 5, summaryY);
  doc.setTextColor(40, 40, 40);
  doc.text(`${baseAmount.toFixed(2)} EUR`, summaryX + summaryWidth - 5, summaryY, { align: "right" });

  // DPH (if applicable)
  if (data.isVatPayer && !data.isReverseCharge) {
    summaryY += 8;
    doc.setTextColor(80, 80, 80);
    doc.text(`DPH ${vatPercent}%:`, summaryX + 5, summaryY);
    doc.setTextColor(40, 40, 40);
    doc.text(`${vatAmount.toFixed(2)} EUR`, summaryX + summaryWidth - 5, summaryY, { align: "right" });
  }

  // Total amount (highlighted)
  summaryY += 10;
  doc.setFillColor(50, 50, 50);
  doc.roundedRect(summaryX, summaryY - 4, summaryWidth, 14, 2, 2, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  if (!usingCustomFont) doc.setFont("helvetica", "bold");
  doc.text("Suma na uhradu:", summaryX + 5, summaryY + 4);
  doc.setFontSize(11);
  doc.text(`${totalAmount.toFixed(2)} EUR`, summaryX + summaryWidth - 5, summaryY + 4, { align: "right" });
  if (!usingCustomFont) doc.setFont("helvetica", "normal");

  // VAT notice (left side)
  let noticeY = afterTableY + 5;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  
  if (data.isReverseCharge) {
    doc.text(
      "Prenesena danova povinnost podla § 69 ods. 12 zakona c. 222/2004 Z.z. o DPH.",
      margin,
      noticeY
    );
  } else if (!data.isVatPayer) {
    doc.text("Dodavatel nie je platcom DPH.", margin, noticeY);
  }

  // ============================================================================
  // FOOTER SECTION (QR Code + Signature)
  // ============================================================================
  
  const footerY = Math.max(summaryY + 25, afterTableY + 50);

  // QR Code (bottom left)
  if (data.supplierIban) {
    try {
      const qrData = generatePayBySquareData(
        data.supplierIban,
        totalAmount,
        invoiceNumber,
        data.supplierName
      );
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        width: 120,
        margin: 1,
        color: { dark: "#000000", light: "#FFFFFF" },
      });
      
      // QR Code image
      doc.addImage(qrCodeDataUrl, "PNG", margin, footerY, 35, 35);
      
      // QR Label
      doc.setFontSize(8);
      if (!usingCustomFont) doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 40, 40);
      doc.text("PAY by square", margin, footerY + 40);
      
      doc.setFontSize(7);
      if (!usingCustomFont) doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.text("Naskenujte pre platbu", margin, footerY + 44);
    } catch (error) {
      console.error("QR code generation failed:", error);
    }
  }

  // Signature (bottom right)
  const signatureX = pageWidth - margin - 60;
  
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("Peciatka a podpis dodavatela", signatureX, footerY);

  // Signature box
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.roundedRect(signatureX, footerY + 3, 60, 32, 2, 2, "S");

  // Add signature image if available
  if (data.signatureUrl) {
    try {
      const signatureBase64 = await loadImageAsBase64(data.signatureUrl);
      if (signatureBase64) {
        doc.addImage(signatureBase64, "PNG", signatureX + 3, footerY + 5, 54, 26);
      }
    } catch (error) {
      console.error("Signature loading failed:", error);
    }
  }

  // Signature line
  doc.setDrawColor(150, 150, 150);
  doc.line(signatureX, footerY + 38, signatureX + 60, footerY + 38);
  
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text(data.supplierName, signatureX, footerY + 43);

  // ============================================================================
  // LEGAL DISCLAIMER (Bottom of page)
  // ============================================================================
  
  const disclaimerY = pageHeight - 15;
  
  doc.setFontSize(6);
  doc.setTextColor(140, 140, 140);
  const disclaimer = "Tato aplikacia sluzi vylucne na evidenciu rozsahu vykonaneho diela ako podklad k fakturacii medzi B2B partnermi. Nejde o dochadzkovy ani zamestnanecky system.";
  doc.text(disclaimer, pageWidth / 2, disclaimerY, { align: "center", maxWidth: pageWidth - 30 });

  // ============================================================================
  // SAVE PDF
  // ============================================================================
  
  const filename = `Faktura_${invoiceNumber}.pdf`;
  doc.save(filename);
}
