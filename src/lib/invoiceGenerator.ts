import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { format, addDays, getISOWeek } from "date-fns";
import { safeText, registerPdfFonts, setFontStyle, getPdfFontFamily } from "./pdfFonts";
import { getSignedSignatureUrl } from "./signatureUtils";

export interface InvoiceData {
  // Supplier (Dodavatel - Subcontractor)
  supplierName: string;
  supplierCompany: string | null;
  supplierAddress: string | null;
  supplierIco?: string | null;
  supplierDic?: string | null;
  supplierIban: string | null;
  supplierSwiftBic: string | null;
  signatureUrl: string | null;
  hourlyRate: number;
  contractNumber?: string | null;
  
  // VAT settings
  isVatPayer: boolean;
  vatNumber: string | null;
  isReverseCharge: boolean;

  // Invoice details
  projectName: string;
  calendarWeek: number;
  year: number;
  totalHours: number;
  
  // Service period dates (for accurate KW calculation)
  serviceDateFrom?: Date;
  serviceDateTo?: Date;
  
  // For unique invoice number
  odberatelId?: string;
  
  // Advance deduction (optional)
  advanceDeduction?: number;
}

// TKJD s.r.o. company details (Odberatel / Customer)
const CUSTOMER = {
  name: "TKJD, s. r. o.",
  street: "114 094 03 Zalobin",
  country: "Slovenska republika",
  ico: "47417528",
  dic: "2023943845",
  icDph: "SK2023943845",
};

const VAT_RATE = 0.20;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate the correct ISO Calendar Week from a date
 */
function getCalendarWeek(date: Date): number {
  return getISOWeek(date);
}

/**
 * Generate invoice number in format: YYYYXXX
 */
function generateInvoiceNumber(odberatelId?: string): string {
  const now = new Date();
  const year = now.getFullYear();
  
  let suffix: string;
  if (odberatelId && odberatelId.length >= 3) {
    // Use last 3 digits of ID for uniqueness
    const numericPart = odberatelId.replace(/\D/g, "");
    suffix = numericPart.slice(-3).padStart(3, "0");
  } else {
    suffix = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  }
  
  return `${year}0${suffix}`;
}

/**
 * Extract numeric part from invoice number for Variable Symbol
 */
function extractNumericVS(invoiceNumber: string): string {
  return invoiceNumber.replace(/\D/g, "");
}

/**
 * Generate proper PAY by square QR data with Variable Symbol and correct message
 */
function generatePayBySquareData(
  iban: string,
  amount: number,
  invoiceNumber: string,
  calendarWeek: number,
  supplierName: string
): string {
  const cleanIban = iban.replace(/\s/g, "");
  const amountStr = amount.toFixed(2);
  
  // Variable Symbol = strictly numeric part of invoice number
  const variableSymbol = extractNumericVS(invoiceNumber);
  
  // Message for recipient: [KW] woche [First Name] [Last Name]
  const message = `${calendarWeek} woche ${safeText(supplierName)}`;
  
  // PAY by square format (SEPA with VS and proper message)
  return `SPD*1.0*ACC:${cleanIban}*AM:${amountStr}*CC:EUR*X-VS:${variableSymbol}*MSG:${message}*RN:TKJD s.r.o.`;
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

/**
 * Format currency with Slovak formatting (space as thousand separator)
 */
function formatCurrency(amount: number): string {
  return amount.toLocaleString("sk-SK", { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
}

// ============================================================================
// MAIN PDF GENERATOR - B2B STANDARD FORMAT
// ============================================================================

export async function generateInvoicePDF(data: InvoiceData): Promise<void> {
  const doc = new jsPDF();
  
  // Register fonts (uses Helvetica - crash-proof)
  registerPdfFonts(doc);
  
  const invoiceNumber = generateInvoiceNumber(data.odberatelId);
  
  // Determine the correct Calendar Week from service dates or use provided value
  let calendarWeek = data.calendarWeek;
  if (data.serviceDateFrom) {
    calendarWeek = getCalendarWeek(data.serviceDateFrom);
  }
  
  // Safe number conversion helper
  const safeNumber = (val: unknown): number => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  };
  
  // Calculate amounts with safe number handling
  const totalHours = safeNumber(data.totalHours);
  const hourlyRate = safeNumber(data.hourlyRate);
  const baseAmount = totalHours * hourlyRate;
  const advanceDeduction = safeNumber(data.advanceDeduction);
  
  let vatAmount = 0;
  let totalAmount = baseAmount - advanceDeduction;
  
  if (data.isVatPayer && !data.isReverseCharge) {
    vatAmount = baseAmount * VAT_RATE;
    totalAmount = baseAmount + vatAmount - advanceDeduction;
  }
  
  // Dates - CEO requirement: due date = issue date + 21 days
  const issueDate = new Date();
  const deliveryDate = issueDate;
  const dueDate = addDays(issueDate, 21);

  // Layout constants
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const fontFamily = getPdfFontFamily();

  // ============================================================================
  // HEADER: INVOICE TITLE (Top Right, Large)
  // ============================================================================
  
  doc.setFontSize(24);
  setFontStyle(doc, "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(`FAKTURA ${invoiceNumber}`, pageWidth - margin, 22, { align: "right" });

  // ============================================================================
  // ADDRESS BLOCKS (Two Columns with Grey Labels)
  // ============================================================================
  
  const addressY = 35;
  const colWidth = 85;
  
  // Left block: DODAVATEL (Supplier)
  doc.setFontSize(9);
  doc.setTextColor(130, 130, 130);
  setFontStyle(doc, "bold");
  doc.text("DODAVATEL", margin, addressY);
  
  setFontStyle(doc, "normal");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  
  let supY = addressY + 8;
  
  // Supplier name (bold)
  setFontStyle(doc, "bold");
  doc.text(safeText(data.supplierName), margin, supY);
  setFontStyle(doc, "normal");
  supY += 6;
  
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  
  // Address
  if (data.supplierAddress) {
    const addressLines = data.supplierAddress.split("\n");
    addressLines.forEach((line) => {
      doc.text(safeText(line.trim()), margin, supY);
      supY += 5;
    });
  }
  
  supY += 2;
  
  // ICO, DIC
  if (data.supplierIco) {
    doc.text(`ICO: ${data.supplierIco}`, margin, supY);
    supY += 5;
  }
  if (data.supplierDic) {
    doc.text(`DIC: ${data.supplierDic}`, margin, supY);
    supY += 5;
  }
  
  // VAT payer status
  if (!data.isVatPayer) {
    doc.setTextColor(100, 100, 100);
    doc.text("Nie je platitel DPH.", margin, supY);
    supY += 5;
  } else if (data.vatNumber) {
    doc.text(`IC DPH: ${data.vatNumber}`, margin, supY);
    supY += 5;
  }

  // Right block: ODBERATEL (Customer)
  const rightBlockX = pageWidth / 2 + 5;
  
  doc.setFontSize(9);
  doc.setTextColor(130, 130, 130);
  setFontStyle(doc, "bold");
  doc.text("ODBERATEL", rightBlockX, addressY);
  
  setFontStyle(doc, "normal");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  
  let custY = addressY + 8;
  
  // Customer name (bold)
  setFontStyle(doc, "bold");
  doc.text(CUSTOMER.name, rightBlockX, custY);
  setFontStyle(doc, "normal");
  custY += 6;
  
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  
  doc.text(safeText(CUSTOMER.street), rightBlockX, custY);
  custY += 5;
  doc.text(safeText(CUSTOMER.country), rightBlockX, custY);
  custY += 7;
  doc.text(`ICO: ${CUSTOMER.ico}`, rightBlockX, custY);
  custY += 5;
  doc.text(`DIC: ${CUSTOMER.dic}`, rightBlockX, custY);
  custY += 5;
  doc.text(`IC DPH: ${CUSTOMER.icDph}`, rightBlockX, custY);

  // ============================================================================
  // DATES STRIP (Grey Background)
  // ============================================================================
  
  const datesY = 95;
  const datesHeight = 18;
  
  // Grey background strip
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, datesY, pageWidth - margin * 2, datesHeight, "F");
  
  // Date labels and values
  doc.setFontSize(8);
  const dateColWidth = (pageWidth - margin * 2) / 3;
  
  // Column 1: Datum vystavenia
  let dateX = margin + 5;
  doc.setTextColor(100, 100, 100);
  setFontStyle(doc, "normal");
  doc.text("Datum vystavenia:", dateX, datesY + 6);
  doc.setTextColor(30, 30, 30);
  setFontStyle(doc, "bold");
  doc.text(format(issueDate, "dd.MM.yyyy"), dateX, datesY + 12);
  
  // Column 2: Datum dodania
  dateX = margin + dateColWidth + 5;
  doc.setTextColor(100, 100, 100);
  setFontStyle(doc, "normal");
  doc.text("Datum dodania:", dateX, datesY + 6);
  doc.setTextColor(30, 30, 30);
  setFontStyle(doc, "bold");
  doc.text(format(deliveryDate, "dd.MM.yyyy"), dateX, datesY + 12);
  
  // Column 3: Splatnost
  dateX = margin + dateColWidth * 2 + 5;
  doc.setTextColor(100, 100, 100);
  setFontStyle(doc, "normal");
  doc.text("Splatnost:", dateX, datesY + 6);
  doc.setTextColor(180, 0, 0);
  setFontStyle(doc, "bold");
  doc.text(format(dueDate, "dd.MM.yyyy"), dateX, datesY + 12);

  // ============================================================================
  // PAYMENT INFO STRIP
  // ============================================================================
  
  const paymentY = datesY + datesHeight + 5;
  const paymentHeight = 16;
  
  doc.setFillColor(250, 250, 250);
  doc.rect(margin, paymentY, pageWidth - margin * 2, paymentHeight, "F");
  
  doc.setFontSize(8);
  setFontStyle(doc, "normal");
  
  // Payment method
  dateX = margin + 5;
  doc.setTextColor(100, 100, 100);
  doc.text("Sposob uhrady:", dateX, paymentY + 5);
  doc.setTextColor(30, 30, 30);
  
  // Amount, Variable Symbol, IBAN
  let payInfoX = margin + 5;
  doc.setTextColor(30, 30, 30);
  setFontStyle(doc, "bold");
  doc.text(`Suma: ${formatCurrency(totalAmount)} EUR`, payInfoX, paymentY + 11);
  
  payInfoX = margin + 60;
  doc.setTextColor(100, 100, 100);
  setFontStyle(doc, "normal");
  doc.text("Variabilny symbol:", payInfoX, paymentY + 11);
  doc.setTextColor(30, 30, 30);
  setFontStyle(doc, "bold");
  doc.text(extractNumericVS(invoiceNumber), payInfoX + 32, paymentY + 11);
  
  payInfoX = margin + 115;
  doc.setTextColor(100, 100, 100);
  setFontStyle(doc, "normal");
  doc.text("IBAN:", payInfoX, paymentY + 11);
  doc.setTextColor(30, 30, 30);
  setFontStyle(doc, "bold");
  doc.text(data.supplierIban || "-", payInfoX + 12, paymentY + 11);

  // ============================================================================
  // SERVICE TABLE
  // ============================================================================
  
  const tableStartY = paymentY + paymentHeight + 10;

  const tableBody: (string | number)[][] = [
    [
      "1.",
      safeText(`Fakturujem Vam na zaklade zmluvy za vykonanu pracu za ${calendarWeek}. kalendarny tyzden.`),
      `${totalHours.toFixed(2)} hod`,
      `${formatCurrency(hourlyRate)}`,
      `${formatCurrency(baseAmount)}`,
    ],
  ];

  autoTable(doc, {
    startY: tableStartY,
    head: [[
      { content: "C.", styles: { halign: "center", cellWidth: 12 } },
      { content: "NAZOV", styles: { halign: "left" } },
      { content: "MNOZSTVO", styles: { halign: "center", cellWidth: 28 } },
      { content: "JEDN. CENA", styles: { halign: "right", cellWidth: 28 } },
      { content: "SPOLU", styles: { halign: "right", cellWidth: 30 } },
    ]],
    body: tableBody,
    styles: {
      fontSize: 9,
      cellPadding: 5,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
      font: fontFamily,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [80, 80, 80],
      fontStyle: "bold",
      fontSize: 8,
    },
    bodyStyles: {
      textColor: [30, 30, 30],
    },
    columnStyles: {
      0: { halign: "center" },
      1: { halign: "left" },
      2: { halign: "center" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
    margin: { left: margin, right: margin },
    tableWidth: "auto",
    theme: "plain",
    didDrawCell: (data) => {
      // Draw bottom border for header and body rows
      if (data.row.index >= 0) {
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.line(
          data.cell.x,
          data.cell.y + data.cell.height,
          data.cell.x + data.cell.width,
          data.cell.y + data.cell.height
        );
      }
    },
  });

  const afterTableY = (doc as any).lastAutoTable.finalY + 5;

  // ============================================================================
  // TOTALS SECTION (Right Aligned)
  // ============================================================================
  
  const totalsWidth = 70;
  const totalsX = pageWidth - margin - totalsWidth;
  let totalsY = afterTableY + 5;
  
  doc.setFontSize(10);
  
  // Spolu label and total
  doc.setTextColor(30, 30, 30);
  setFontStyle(doc, "bold");
  doc.text("Spolu", totalsX, totalsY);
  doc.text(`${formatCurrency(totalAmount)} EUR`, pageWidth - margin, totalsY, { align: "right" });
  
  // Draw separator line
  totalsY += 4;
  doc.setDrawColor(50, 50, 50);
  doc.setLineWidth(0.8);
  doc.line(totalsX, totalsY, pageWidth - margin, totalsY);

  // ============================================================================
  // QR CODE (Bottom Left)
  // ============================================================================
  
  const footerY = totalsY + 20;
  
  if (data.supplierIban) {
    try {
      const qrData = generatePayBySquareData(
        data.supplierIban,
        totalAmount,
        invoiceNumber,
        calendarWeek,
        data.supplierName
      );
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        width: 150,
        margin: 1,
        color: { dark: "#000000", light: "#FFFFFF" },
      });
      
      // QR Code image
      doc.addImage(qrCodeDataUrl, "PNG", margin, footerY, 40, 40);
      
      // QR Label
      doc.setFontSize(8);
      setFontStyle(doc, "bold");
      doc.setTextColor(40, 40, 40);
      doc.text("PAY by square", margin, footerY + 45);
    } catch (error) {
      console.error("QR code generation failed:", error);
    }
  }

  // ============================================================================
  // SIGNATURE (Bottom Right)
  // ============================================================================
  
  const signatureX = pageWidth - margin - 55;
  
  // Signature box
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.roundedRect(signatureX, footerY, 55, 35, 2, 2, "S");

  // Add signature image if available
  if (data.signatureUrl) {
    try {
      // Get signed URL for the signature (handles both old URLs and new paths)
      const signedUrl = await getSignedSignatureUrl(data.signatureUrl, 300); // 5 min expiry for immediate use
      if (signedUrl) {
        const signatureBase64 = await loadImageAsBase64(signedUrl);
        if (signatureBase64) {
          doc.addImage(signatureBase64, "PNG", signatureX + 3, footerY + 2, 49, 28);
        }
      }
    } catch (error) {
      console.error("Signature loading failed:", error);
    }
  }

  // Label below signature
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  setFontStyle(doc, "normal");
  doc.text(`Fakturu vystavil: ${safeText(data.supplierName)}`, signatureX, footerY + 42);

  // ============================================================================
  // LEGAL DISCLAIMERS (Bottom of page)
  // ============================================================================
  
  const disclaimerY = pageHeight - 20;
  
  doc.setFontSize(6);
  doc.setTextColor(130, 130, 130);
  
  // Transaction Tax Info (internal usage note)
  const transactionTaxRate = 0.4;
  const transactionTaxAmount = Math.ceil((totalAmount * transactionTaxRate / 100) * 100) / 100;
  const taxInfoText = `Informativna vyska transakcnej dane (${transactionTaxRate}%): ${transactionTaxAmount.toFixed(2)} EUR`;
  doc.text(taxInfoText, pageWidth / 2, disclaimerY - 6, { align: "center" });
  
  // Slovak disclaimer
  const disclaimerSK = "Tato aplikacia sluzi vylucne na evidenciu rozsahu vykonaneho diela ako podklad k fakturacii medzi B2B partnermi.";
  doc.text(disclaimerSK, pageWidth / 2, disclaimerY, { align: "center", maxWidth: pageWidth - 30 });
  
  // German disclaimer
  const disclaimerDE = "Diese App dient ausschliesslich als Leistungsnachweis im B2B-Verhaltnis.";
  doc.text(disclaimerDE, pageWidth / 2, disclaimerY + 5, { align: "center", maxWidth: pageWidth - 30 });

  // ============================================================================
  // SAVE PDF WITH EXACT NAMING FORMAT
  // Format: [KW Number] KW [Invoice Number] [User Name] [Project Name].pdf
  // ============================================================================
  
  const kwFormatted = String(calendarWeek).padStart(2, "0");
  
  const sanitize = (str: string): string => {
    return str
      .replace(/[/\\?%*:|"<>]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };
  
  const userName = sanitize(safeText(data.supplierName));
  const projectName = sanitize(safeText(data.projectName));
  
  const filename = `${kwFormatted} KW ${invoiceNumber} ${userName} ${projectName}.pdf`;
  doc.save(filename);
}
