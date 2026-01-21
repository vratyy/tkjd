import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { format } from "date-fns";

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

  // Invoice details
  projectName: string;
  calendarWeek: number;
  year: number;
  totalHours: number;
}

// TKJD s.r.o. company details (hardcoded - Odberateľ)
const CUSTOMER = {
  name: "TKJD s.r.o.",
  address: "Hlavná 123\n811 01 Bratislava\nSlovenská republika",
  ico: "12345678",
  dic: "SK1234567890",
};

function generateInvoiceNumber(supplierName: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const initials = supplierName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `${year}${month}-${initials}-${random}`;
}

// Generate SEPA QR code data (PAY by square format)
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
  const doc = new jsPDF();
  const invoiceNumber = generateInvoiceNumber(data.supplierName);
  const totalPrice = data.totalHours * data.hourlyRate;
  const issueDate = new Date();
  const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 20;
  const rightColStart = pageWidth / 2 + 10;

  // ============ HEADER ============
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("FAKTÚRA", leftMargin, 25);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("INVOICE", leftMargin, 31);
  doc.setTextColor(0);

  // Invoice number box (top right)
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Číslo faktúry:`, rightColStart, 20);
  doc.setFontSize(14);
  doc.text(invoiceNumber, rightColStart, 27);

  // Dates (top right, below invoice number)
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Dátum vystavenia:`, rightColStart, 38);
  doc.setFont("helvetica", "bold");
  doc.text(format(issueDate, "dd.MM.yyyy"), rightColStart + 38, 38);

  doc.setFont("helvetica", "normal");
  doc.text(`Dátum splatnosti:`, rightColStart, 44);
  doc.setFont("helvetica", "bold");
  doc.text(format(dueDate, "dd.MM.yyyy"), rightColStart + 38, 44);

  // Separator line under header
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(leftMargin, 52, pageWidth - leftMargin, 52);

  // ============ COMPANY INFO SECTION ============
  const companyY = 62;

  // Left column: DODÁVATEĽ (Supplier - the user/subcontractor)
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100);
  doc.text("DODÁVATEĽ", leftMargin, companyY);
  doc.setTextColor(0);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(data.supplierName, leftMargin, companyY + 8);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  let supplierY = companyY + 15;

  if (data.supplierCompany) {
    doc.text(data.supplierCompany, leftMargin, supplierY);
    supplierY += 5;
  }

  if (data.supplierAddress) {
    const addressLines = data.supplierAddress.split("\n");
    addressLines.forEach((line) => {
      doc.text(line.trim(), leftMargin, supplierY);
      supplierY += 5;
    });
  }

  supplierY += 3;
  if (data.supplierIco) {
    doc.text(`IČO: ${data.supplierIco}`, leftMargin, supplierY);
    supplierY += 5;
  }
  if (data.supplierDic) {
    doc.text(`DIČ: ${data.supplierDic}`, leftMargin, supplierY);
    supplierY += 5;
  }

  // Right column: ODBERATEĽ (Customer - TKJD s.r.o.)
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100);
  doc.text("ODBERATEĽ", rightColStart, companyY);
  doc.setTextColor(0);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(CUSTOMER.name, rightColStart, companyY + 8);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  let customerY = companyY + 15;

  const customerAddressLines = CUSTOMER.address.split("\n");
  customerAddressLines.forEach((line) => {
    doc.text(line.trim(), rightColStart, customerY);
    customerY += 5;
  });

  customerY += 3;
  doc.text(`IČO: ${CUSTOMER.ico}`, rightColStart, customerY);
  customerY += 5;
  doc.text(`DIČ: ${CUSTOMER.dic}`, rightColStart, customerY);

  // ============ INVOICE TABLE ============
  const tableStartY = 115;

  autoTable(doc, {
    startY: tableStartY,
    head: [[
      "Popis služby",
      "Počet hodín",
      "Hodinová sadzba",
      "Celkom bez DPH"
    ]],
    body: [
      [
        `${data.projectName}\nKW ${data.calendarWeek}/${data.year}`,
        `${data.totalHours.toFixed(2)} h`,
        `${data.hourlyRate.toFixed(2)} €`,
        `${totalPrice.toFixed(2)} €`,
      ],
    ],
    styles: {
      fontSize: 10,
      cellPadding: 6,
      lineColor: [180, 180, 180],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [50, 50, 50],
      fontStyle: "bold",
      halign: "left",
    },
    bodyStyles: {
      textColor: [30, 30, 30],
    },
    columnStyles: {
      0: { cellWidth: 75, halign: "left" },
      1: { cellWidth: 30, halign: "center" },
      2: { cellWidth: 35, halign: "right" },
      3: { cellWidth: 40, halign: "right" },
    },
    margin: { left: leftMargin, right: leftMargin },
  });

  const afterTableY = (doc as any).lastAutoTable.finalY || 145;

  // Total row (separate for emphasis)
  doc.setFillColor(50, 50, 50);
  doc.rect(leftMargin, afterTableY, pageWidth - leftMargin * 2, 12, "F");
  doc.setTextColor(255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("CELKOM K ÚHRADE:", leftMargin + 5, afterTableY + 8);
  doc.setFontSize(14);
  doc.text(`${totalPrice.toFixed(2)} €`, pageWidth - leftMargin - 5, afterTableY + 8, { align: "right" });
  doc.setTextColor(0);

  // ============ PAYMENT INFO SECTION ============
  const paymentY = afterTableY + 25;

  doc.setFillColor(248, 248, 248);
  doc.rect(leftMargin, paymentY, pageWidth - leftMargin * 2, 28, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100);
  doc.text("PLATOBNÉ ÚDAJE", leftMargin + 5, paymentY + 7);
  doc.setTextColor(0);

  if (data.supplierIban) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("IBAN:", leftMargin + 5, paymentY + 16);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(data.supplierIban, leftMargin + 25, paymentY + 16);
  }

  if (data.supplierSwiftBic) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("SWIFT/BIC:", leftMargin + 5, paymentY + 23);
    doc.setFont("helvetica", "bold");
    doc.text(data.supplierSwiftBic, leftMargin + 35, paymentY + 23);
  }

  // ============ FOOTER SECTION ============
  const footerY = paymentY + 40;

  // QR Code (bottom left)
  if (data.supplierIban) {
    try {
      const qrData = generatePaymentQRData(
        data.supplierIban,
        totalPrice,
        invoiceNumber,
        data.supplierName
      );
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        width: 120,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });
      doc.addImage(qrCodeDataUrl, "PNG", leftMargin, footerY, 40, 40);
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("PAY by square", leftMargin, footerY + 45);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text("Naskenujte pre platbu", leftMargin, footerY + 50);
      doc.setTextColor(0);
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  }

  // Signature section (bottom right)
  const signatureX = rightColStart;
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("Pečiatka a podpis dodávateľa", signatureX, footerY);
  doc.setTextColor(0);

  // Draw signature box
  doc.setDrawColor(200);
  doc.setLineWidth(0.2);
  doc.rect(signatureX, footerY + 3, 60, 35);

  if (data.signatureUrl) {
    try {
      const signatureBase64 = await loadImageAsBase64(data.signatureUrl);
      if (signatureBase64) {
        doc.addImage(signatureBase64, "PNG", signatureX + 5, footerY + 5, 50, 28);
      }
    } catch (error) {
      console.error("Error loading signature:", error);
    }
  }

  // Signature line and name below box
  doc.setDrawColor(150);
  doc.line(signatureX, footerY + 42, signatureX + 60, footerY + 42);
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text(data.supplierName, signatureX, footerY + 48);
  doc.setTextColor(0);

  // ============ DISCLAIMER FOOTER ============
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(
    "Faktúra slúži ako podklad pre B2B fakturáciu medzi subdodávateľom a objednávateľom. Nie sme platcami DPH.",
    pageWidth / 2,
    282,
    { align: "center" }
  );
  doc.setTextColor(0);

  // Download
  const filename = `Faktura_${invoiceNumber}.pdf`;
  doc.save(filename);
}
