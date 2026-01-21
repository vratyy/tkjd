import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { format, addDays } from "date-fns";
import { initializePdfFonts, registerPdfFonts, setFontStyle, getPdfFontFamily } from "./pdfFonts";

interface InvoiceData {
  // Supplier (Subcontractor - User)
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

// TKJD s.r.o. company details (Odberateľ)
const CUSTOMER = {
  name: "TKJD s.r.o.",
  address: "Hlavná 123\n811 01 Bratislava\nSlovenská republika",
  ico: "12345678",
  dic: "2012345678",
  icDph: "SK2012345678",
};

const VAT_RATE = 0.20; // 20% VAT

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

function generatePaymentQRData(
  iban: string,
  amount: number,
  invoiceNumber: string,
  beneficiaryName: string
): string {
  const cleanIban = iban.replace(/\s/g, "");
  const amountStr = amount.toFixed(2);
  const message = `Faktura ${invoiceNumber}`;
  
  return `SPD*1.0*ACC:${cleanIban}*AM:${amountStr}*CC:EUR*MSG:${message}*RN:${beneficiaryName}`;
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
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

export async function generateInvoicePDF(data: InvoiceData): Promise<void> {
  // Try to load custom fonts (will use Helvetica fallback if it fails)
  try {
    await initializePdfFonts();
  } catch (error) {
    console.warn("Font initialization failed, using fallback:", error);
  }
  
  const doc = new jsPDF();
  
  // Register fonts with fallback handling
  registerPdfFonts(doc);
  
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
  
  const issueDate = new Date();
  const deliveryDate = issueDate; // Same as issue date for services
  const dueDate = addDays(issueDate, 14);

  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 15;
  const rightColStart = pageWidth / 2 + 5;
  const rightMargin = pageWidth - 15;

  // ============ INVOICE TITLE ============
  doc.setFontSize(24);
  setFontStyle(doc, "bold");
  doc.text("FAKTÚRA", leftMargin, 22);

  // Invoice number - prominent
  doc.setFontSize(11);
  setFontStyle(doc, "normal");
  doc.text("č.:", leftMargin + 52, 22);
  setFontStyle(doc, "bold");
  doc.setFontSize(14);
  doc.text(invoiceNumber, leftMargin + 60, 22);

  // Separator
  doc.setDrawColor(50, 50, 50);
  doc.setLineWidth(0.5);
  doc.line(leftMargin, 28, rightMargin, 28);

  // ============ INVOICE META (dates) - Right aligned ============
  const metaY = 38;
  doc.setFontSize(9);
  setFontStyle(doc, "normal");
  
  const labelX = rightColStart + 20;
  const valueX = rightMargin;

  doc.text("Dátum vystavenia:", labelX, metaY);
  setFontStyle(doc, "bold");
  doc.text(format(issueDate, "dd.MM.yyyy"), valueX, metaY, { align: "right" });

  setFontStyle(doc, "normal");
  doc.text("Dátum dodania:", labelX, metaY + 6);
  setFontStyle(doc, "bold");
  doc.text(format(deliveryDate, "dd.MM.yyyy"), valueX, metaY + 6, { align: "right" });

  setFontStyle(doc, "normal");
  doc.text("Dátum splatnosti:", labelX, metaY + 12);
  setFontStyle(doc, "bold");
  doc.setTextColor(180, 0, 0);
  doc.text(format(dueDate, "dd.MM.yyyy"), valueX, metaY + 12, { align: "right" });
  doc.setTextColor(0);

  // ============ COMPANY INFO SECTION ============
  const companyY = 60;

  // Left column: DODÁVATEĽ
  doc.setFillColor(248, 248, 248);
  doc.rect(leftMargin, companyY - 5, 85, 55, "F");
  
  doc.setFontSize(8);
  setFontStyle(doc, "bold");
  doc.setTextColor(100);
  doc.text("DODÁVATEĽ", leftMargin + 3, companyY);
  doc.setTextColor(0);

  doc.setFontSize(11);
  setFontStyle(doc, "bold");
  doc.text(data.supplierName, leftMargin + 3, companyY + 8);

  doc.setFontSize(8);
  setFontStyle(doc, "normal");
  let supplierY = companyY + 14;

  if (data.supplierCompany) {
    doc.text(data.supplierCompany, leftMargin + 3, supplierY);
    supplierY += 4;
  }

  if (data.supplierAddress) {
    const addressLines = data.supplierAddress.split("\n");
    addressLines.forEach((line) => {
      doc.text(line.trim(), leftMargin + 3, supplierY);
      supplierY += 4;
    });
  }

  supplierY += 2;
  if (data.supplierIco) {
    doc.text(`IČO: ${data.supplierIco}`, leftMargin + 3, supplierY);
    supplierY += 4;
  }
  if (data.supplierDic) {
    doc.text(`DIČ: ${data.supplierDic}`, leftMargin + 3, supplierY);
    supplierY += 4;
  }
  if (data.isVatPayer && data.vatNumber) {
    doc.text(`IČ DPH: ${data.vatNumber}`, leftMargin + 3, supplierY);
    supplierY += 4;
  }

  // Bank details in supplier box
  supplierY += 2;
  if (data.supplierIban) {
    setFontStyle(doc, "bold");
    doc.text(`IBAN: ${data.supplierIban}`, leftMargin + 3, supplierY);
    supplierY += 4;
  }
  if (data.supplierSwiftBic) {
    setFontStyle(doc, "normal");
    doc.text(`SWIFT: ${data.supplierSwiftBic}`, leftMargin + 3, supplierY);
  }

  // Right column: ODBERATEĽ
  doc.setFillColor(248, 248, 248);
  doc.rect(rightColStart, companyY - 5, 85, 55, "F");

  doc.setFontSize(8);
  setFontStyle(doc, "bold");
  doc.setTextColor(100);
  doc.text("ODBERATEĽ", rightColStart + 3, companyY);
  doc.setTextColor(0);

  doc.setFontSize(11);
  setFontStyle(doc, "bold");
  doc.text(CUSTOMER.name, rightColStart + 3, companyY + 8);

  doc.setFontSize(8);
  setFontStyle(doc, "normal");
  let customerY = companyY + 14;

  const customerAddressLines = CUSTOMER.address.split("\n");
  customerAddressLines.forEach((line) => {
    doc.text(line.trim(), rightColStart + 3, customerY);
    customerY += 4;
  });

  customerY += 2;
  doc.text(`IČO: ${CUSTOMER.ico}`, rightColStart + 3, customerY);
  customerY += 4;
  doc.text(`DIČ: ${CUSTOMER.dic}`, rightColStart + 3, customerY);
  customerY += 4;
  doc.text(`IČ DPH: ${CUSTOMER.icDph}`, rightColStart + 3, customerY);

  // ============ INVOICE TABLE ============
  const tableStartY = 120;

  const tableBody: (string | number)[][] = [
    [
      `${data.projectName} – KW ${data.calendarWeek}/${data.year}`,
      data.totalHours.toFixed(2),
      data.hourlyRate.toFixed(2),
      data.isReverseCharge ? "0% (RC)" : (data.isVatPayer ? "20%" : "—"),
      baseAmount.toFixed(2),
    ],
  ];

  // Get font family for table (with fallback)
  const fontFamily = getPdfFontFamily();

  autoTable(doc, {
    startY: tableStartY,
    head: [[
      { content: "Popis", styles: { halign: "left" } },
      { content: "Rozsah (hod)", styles: { halign: "center" } },
      { content: "Sadzba (€/h)", styles: { halign: "right" } },
      { content: "DPH (%)", styles: { halign: "center" } },
      { content: "Celkom (€)", styles: { halign: "right" } },
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
      fillColor: [60, 60, 60],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      font: fontFamily,
    },
    bodyStyles: {
      textColor: [30, 30, 30],
      font: fontFamily,
    },
    columnStyles: {
      0: { cellWidth: 75, halign: "left" },
      1: { cellWidth: 28, halign: "center" },
      2: { cellWidth: 28, halign: "right" },
      3: { cellWidth: 25, halign: "center" },
      4: { cellWidth: 28, halign: "right" },
    },
    margin: { left: leftMargin, right: 15 },
    tableWidth: "auto",
  });

  const afterTableY = (doc as any).lastAutoTable.finalY || 150;

  // ============ SUMMARY BLOCK (bottom right) ============
  const summaryX = rightColStart + 15;
  const summaryWidth = 70;
  let summaryY = afterTableY + 10;

  // Summary box
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.rect(summaryX, summaryY - 3, summaryWidth, data.isVatPayer && !data.isReverseCharge ? 35 : 25, "FD");

  doc.setFontSize(9);
  setFontStyle(doc, "normal");

  // Základ dane
  doc.text("Základ dane:", summaryX + 3, summaryY + 4);
  doc.text(`${baseAmount.toFixed(2)} €`, summaryX + summaryWidth - 3, summaryY + 4, { align: "right" });

  // DPH line
  if (data.isVatPayer && !data.isReverseCharge) {
    summaryY += 8;
    doc.text(`DPH ${vatPercent}%:`, summaryX + 3, summaryY + 4);
    doc.text(`${vatAmount.toFixed(2)} €`, summaryX + summaryWidth - 3, summaryY + 4, { align: "right" });
  }

  // Total
  summaryY += 10;
  doc.setFillColor(50, 50, 50);
  doc.rect(summaryX, summaryY, summaryWidth, 12, "F");
  doc.setTextColor(255);
  doc.setFontSize(10);
  setFontStyle(doc, "bold");
  doc.text("Suma na úhradu:", summaryX + 3, summaryY + 8);
  doc.setFontSize(12);
  doc.text(`${totalAmount.toFixed(2)} €`, summaryX + summaryWidth - 3, summaryY + 8, { align: "right" });
  doc.setTextColor(0);

  // VAT status notice (left side, below table)
  let noticeY = afterTableY + 12;
  doc.setFontSize(8);
  setFontStyle(doc, "normal");
  doc.setTextColor(80);

  if (data.isReverseCharge) {
    doc.text(
      "Prenesená daňová povinnosť podľa § 69 ods. 12 zákona č. 222/2004 Z.z. o DPH.",
      leftMargin,
      noticeY
    );
  } else if (!data.isVatPayer) {
    doc.text("Dodávateľ nie je platcom DPH.", leftMargin, noticeY);
  }
  doc.setTextColor(0);

  // ============ FOOTER SECTION ============
  const footerY = summaryY + 30;

  // QR Code (bottom left)
  if (data.supplierIban) {
    try {
      const qrData = generatePaymentQRData(
        data.supplierIban,
        totalAmount,
        invoiceNumber,
        data.supplierName
      );
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        width: 150,
        margin: 1,
        color: { dark: "#000000", light: "#FFFFFF" },
      });
      doc.addImage(qrCodeDataUrl, "PNG", leftMargin, footerY, 38, 38);
      
      doc.setFontSize(8);
      setFontStyle(doc, "bold");
      doc.text("PAY by square", leftMargin, footerY + 43);
      setFontStyle(doc, "normal");
      doc.setTextColor(100);
      doc.setFontSize(7);
      doc.text("Naskenujte pre platbu", leftMargin, footerY + 47);
      doc.setTextColor(0);
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  }

  // Signature section (bottom right)
  const signatureX = rightColStart + 10;
  
  doc.setFontSize(8);
  setFontStyle(doc, "normal");
  doc.setTextColor(100);
  doc.text("Pečiatka a podpis dodávateľa", signatureX, footerY);
  doc.setTextColor(0);

  // Signature box
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.rect(signatureX, footerY + 3, 55, 32);

  if (data.signatureUrl) {
    try {
      const signatureBase64 = await loadImageAsBase64(data.signatureUrl);
      if (signatureBase64) {
        doc.addImage(signatureBase64, "PNG", signatureX + 3, footerY + 5, 49, 26);
      }
    } catch (error) {
      console.error("Error loading signature:", error);
    }
  }

  // Line under signature
  doc.setDrawColor(120);
  doc.line(signatureX, footerY + 38, signatureX + 55, footerY + 38);
  doc.setFontSize(7);
  doc.setTextColor(80);
  doc.text(data.supplierName, signatureX, footerY + 43);
  doc.setTextColor(0);

  // ============ LEGAL FOOTER ============
  doc.setFontSize(6);
  doc.setTextColor(120);
  doc.text(
    "Táto faktúra slúži ako podklad k fakturácii za vykonané dielo v zmysle zmluvy o dielo.",
    pageWidth / 2,
    285,
    { align: "center" }
  );
  doc.setTextColor(0);

  // Download
  const filename = `Faktura_${invoiceNumber}.pdf`;
  doc.save(filename);
}
