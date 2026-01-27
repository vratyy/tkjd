import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { format, addDays, getISOWeek } from "date-fns";
import { safeText, registerPdfFonts, setFontStyle, getPdfFontFamily } from "./pdfFonts";

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
}

// TKJD s.r.o. company details (Odberatel / Customer)
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

/**
 * Calculate the correct ISO Calendar Week from a date
 */
function getCalendarWeek(date: Date): number {
  return getISOWeek(date);
}

/**
 * Format KW number with leading zero (e.g., 05, 12, 52)
 */
function formatKW(kw: number): string {
  return String(kw).padStart(2, "0");
}

/**
 * Generate invoice number in format: YYYYMMXXX
 */
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
  // Example: "49 woche Patrik Cmar" - uses plain KW number without leading zero
  const message = `${calendarWeek} woche ${safeText(supplierName)}`;
  
  // PAY by square format (SEPA with VS and proper message)
  // SPD format: SPD*1.0*ACC:IBAN*AM:amount*CC:EUR*X-VS:variableSymbol*MSG:message*RN:beneficiary
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

// ============================================================================
// MAIN PDF GENERATOR
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
  const kwFormatted = formatKW(calendarWeek);
  
  // Safe number conversion helper
  const safeNumber = (val: unknown): number => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  };
  
  // Calculate amounts with safe number handling
  const totalHours = safeNumber(data.totalHours);
  const hourlyRate = safeNumber(data.hourlyRate);
  const baseAmount = totalHours * hourlyRate;
  let vatAmount = 0;
  let vatPercent = 0;
  let totalAmount = baseAmount;
  
  if (data.isVatPayer && !data.isReverseCharge) {
    vatPercent = 20;
    vatAmount = baseAmount * VAT_RATE;
    totalAmount = baseAmount + vatAmount;
  }
  
  // Dates - CEO requirement: due date = issue date + 21 days
  const issueDate = new Date();
  const deliveryDate = issueDate;
  const dueDate = addDays(issueDate, 21);

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
  setFontStyle(doc, "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("TKJD s.r.o.", margin, 20);
  
  // Invoice title and number (top right)
  doc.setFontSize(22);
  doc.text("FAKTURA", pageWidth - margin, 20, { align: "right" });
  
  doc.setFontSize(12);
  setFontStyle(doc, "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`c.: ${invoiceNumber} | KW ${kwFormatted}`, pageWidth - margin, 28, { align: "right" });

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
    setFontStyle(doc, "bold");
    doc.text(value, pageWidth - margin, dateY, { align: "right" });
    setFontStyle(doc, "normal");
    
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
  setFontStyle(doc, "bold");
  doc.text("DODAVATEL", margin + 5, addressY + 8);
  
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(safeText(data.supplierName), margin + 5, addressY + 16);
  
  doc.setFontSize(8);
  setFontStyle(doc, "normal");
  doc.setTextColor(60, 60, 60);
  
  let supY = addressY + 22;
  
  if (data.supplierCompany) {
    doc.text(safeText(data.supplierCompany), margin + 5, supY);
    supY += 4;
  }
  
  if (data.supplierAddress) {
    const addressLines = data.supplierAddress.split("\n");
    addressLines.forEach((line) => {
      doc.text(safeText(line.trim()), margin + 5, supY);
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
    setFontStyle(doc, "bold");
    doc.text(`IBAN: ${data.supplierIban}`, margin + 5, supY);
    supY += 4;
    setFontStyle(doc, "normal");
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
  setFontStyle(doc, "bold");
  doc.text("ODBERATEL", rightBoxX + 5, addressY + 8);
  
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(CUSTOMER.name, rightBoxX + 5, addressY + 16);
  
  doc.setFontSize(8);
  setFontStyle(doc, "normal");
  doc.setTextColor(60, 60, 60);
  
  let custY = addressY + 22;
  doc.text(safeText(CUSTOMER.street), rightBoxX + 5, custY);
  custY += 4;
  doc.text(safeText(CUSTOMER.city), rightBoxX + 5, custY);
  custY += 4;
  doc.text(safeText(CUSTOMER.country), rightBoxX + 5, custY);
  custY += 6;
  doc.text(`ICO: ${CUSTOMER.ico}`, rightBoxX + 5, custY);
  custY += 4;
  doc.text(`DIC: ${CUSTOMER.dic}`, rightBoxX + 5, custY);
  custY += 4;
  doc.text(`IC DPH: ${CUSTOMER.icDph}`, rightBoxX + 5, custY);

  // ============================================================================
  // PERFORMANCE TABLE (Leistungsnachweis)
  // ============================================================================
  
  const tableStartY = addressY + boxHeight + 15;
  const fontFamily = getPdfFontFamily();

  const tableBody: (string | number)[][] = [
    [
      safeText(`${data.projectName} - KW ${kwFormatted}/${data.year}`),
      totalHours.toFixed(2),
      hourlyRate.toFixed(2),
      data.isReverseCharge ? "0% (RC)" : (data.isVatPayer ? "20%" : "-"),
      `${baseAmount.toFixed(2)} EUR`,
    ],
  ];

  autoTable(doc, {
    startY: tableStartY,
    head: [[
      { content: "Popis vykonu (Leistungsnachweis)", styles: { halign: "left" } },
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

  // Zaklad dane
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
  setFontStyle(doc, "bold");
  doc.text("Suma na uhradu:", summaryX + 5, summaryY + 4);
  doc.setFontSize(11);
  doc.text(`${totalAmount.toFixed(2)} EUR`, summaryX + summaryWidth - 5, summaryY + 4, { align: "right" });
  setFontStyle(doc, "normal");

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
        calendarWeek,
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
      setFontStyle(doc, "bold");
      doc.setTextColor(40, 40, 40);
      doc.text("PAY by square", margin, footerY + 40);
      
      doc.setFontSize(7);
      setFontStyle(doc, "normal");
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
  doc.text(safeText(data.supplierName), signatureX, footerY + 43);

  // ============================================================================
  // LEGAL DISCLAIMERS (Bottom of page) - BILINGUAL + TRANSACTION TAX INFO
  // ============================================================================
  
  const disclaimerY = pageHeight - 24;
  
  doc.setFontSize(6);
  doc.setTextColor(140, 140, 140);
  
  // Transaction Tax Info (internal usage note)
  const transactionTaxRate = 0.4; // Default rate
  const transactionTaxAmount = Math.ceil((totalAmount * transactionTaxRate / 100) * 100) / 100;
  const taxInfoText = `Informativna vyska transakcnej dane (${transactionTaxRate}%): ${transactionTaxAmount.toFixed(2)} EUR`;
  doc.setTextColor(100, 100, 100);
  doc.text(taxInfoText, pageWidth / 2, disclaimerY - 8, { align: "center" });
  
  doc.setTextColor(140, 140, 140);
  
  // Slovak disclaimer
  const disclaimerSK = "Tato aplikacia sluzi vylucne na evidenciu rozsahu vykonaneho diela ako podklad k fakturacii medzi B2B partnermi. Nejde o dochadzkovy ani zamestnanecky system.";
  doc.text(disclaimerSK, pageWidth / 2, disclaimerY, { align: "center", maxWidth: pageWidth - 30 });
  
  // German disclaimer
  const disclaimerDE = "Diese App dient ausschliesslich als Abrechnungsgrundlage/Leistungsnachweis im B2B-Verhaltnis. Es handelt sich nicht um eine Arbeitszeiterfassung im arbeitsrechtlichen Sinne.";
  doc.text(disclaimerDE, pageWidth / 2, disclaimerY + 6, { align: "center", maxWidth: pageWidth - 30 });

  // ============================================================================
  // SAVE PDF WITH EXACT NAMING FORMAT
  // Format: [KW Number] KW [Invoice Number] [User Name] [Project Name].pdf
  // Example: 05 KW 202601 Patrik Cmar Berlin.pdf
  // ============================================================================
  
  // Sanitize names for filename (remove special characters)
  const sanitize = (str: string): string => {
    return str
      .replace(/[/\\?%*:|"<>]/g, "") // Remove invalid filename chars
      .replace(/\s+/g, " ")          // Normalize spaces
      .trim();
  };
  
  const userName = sanitize(safeText(data.supplierName));
  const projectName = sanitize(safeText(data.projectName));
  
  const filename = `${kwFormatted} KW ${invoiceNumber} ${userName} ${projectName}.pdf`;
  doc.save(filename);
}
