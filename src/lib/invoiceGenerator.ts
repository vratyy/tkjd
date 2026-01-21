import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { format } from "date-fns";

interface InvoiceData {
  // Supplier (User)
  supplierName: string;
  supplierCompany: string | null;
  supplierAddress: string | null;
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

// TKJD s.r.o. company details (hardcoded)
const CUSTOMER = {
  name: "TKJD s.r.o.",
  address: "Hlavná 123, 811 01 Bratislava",
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

// Generate SEPA QR code data (simplified Slovak format)
function generatePaymentQRData(
  iban: string,
  amount: number,
  invoiceNumber: string,
  beneficiaryName: string
): string {
  // Simple SEPA payment string format
  // Format: SPD*1.0*ACC:IBAN*AM:AMOUNT*CC:EUR*X-VS:VARIABLE*MSG:MESSAGE
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
  const issueDate = format(new Date(), "dd.MM.yyyy");
  const dueDate = format(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    "dd.MM.yyyy"
  );

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("FAKTÚRA / INVOICE", 105, 20, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Číslo faktúry: ${invoiceNumber}`, 105, 28, { align: "center" });

  // Supplier section (left)
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DODÁVATEĽ / SUPPLIER:", 14, 45);
  doc.setFont("helvetica", "normal");
  doc.text(data.supplierName, 14, 52);
  if (data.supplierCompany) {
    doc.text(data.supplierCompany, 14, 58);
  }
  if (data.supplierAddress) {
    const addressLines = data.supplierAddress.split("\n");
    let y = data.supplierCompany ? 64 : 58;
    addressLines.forEach((line) => {
      doc.text(line, 14, y);
      y += 5;
    });
  }

  // Bank details
  let bankY = 80;
  if (data.supplierIban) {
    doc.setFont("helvetica", "bold");
    doc.text("IBAN:", 14, bankY);
    doc.setFont("helvetica", "normal");
    doc.text(data.supplierIban, 35, bankY);
    bankY += 5;
  }
  if (data.supplierSwiftBic) {
    doc.setFont("helvetica", "bold");
    doc.text("SWIFT/BIC:", 14, bankY);
    doc.setFont("helvetica", "normal");
    doc.text(data.supplierSwiftBic, 35, bankY);
  }

  // Customer section (right)
  doc.setFont("helvetica", "bold");
  doc.text("ODBERATEĽ / CUSTOMER:", 110, 45);
  doc.setFont("helvetica", "normal");
  doc.text(CUSTOMER.name, 110, 52);
  doc.text(CUSTOMER.address, 110, 58);
  doc.text(`IČO: ${CUSTOMER.ico}`, 110, 64);
  doc.text(`DIČ: ${CUSTOMER.dic}`, 110, 70);

  // Dates
  doc.setFont("helvetica", "bold");
  doc.text("Dátum vystavenia:", 110, 80);
  doc.setFont("helvetica", "normal");
  doc.text(issueDate, 155, 80);
  doc.setFont("helvetica", "bold");
  doc.text("Dátum splatnosti:", 110, 86);
  doc.setFont("helvetica", "normal");
  doc.text(dueDate, 155, 86);

  // Separator line
  doc.setLineWidth(0.5);
  doc.line(14, 95, 196, 95);

  // Invoice items table
  autoTable(doc, {
    startY: 100,
    head: [["Popis / Description", "Množstvo / Qty", "Jedn. cena / Unit", "Suma / Total"]],
    body: [
      [
        `${data.projectName}\nKW ${data.calendarWeek}/${data.year}`,
        `${data.totalHours.toFixed(2)} h`,
        `${data.hourlyRate.toFixed(2)} €`,
        `${totalPrice.toFixed(2)} €`,
      ],
    ],
    foot: [["", "", "SPOLU / TOTAL:", `${totalPrice.toFixed(2)} €`]],
    styles: {
      fontSize: 10,
      cellPadding: 5,
    },
    headStyles: {
      fillColor: [51, 51, 51],
      textColor: 255,
      fontStyle: "bold",
    },
    footStyles: {
      fillColor: [240, 240, 240],
      textColor: 0,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 35, halign: "center" },
      2: { cellWidth: 35, halign: "right" },
      3: { cellWidth: 35, halign: "right" },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 150;

  // QR Code for payment
  if (data.supplierIban) {
    try {
      const qrData = generatePaymentQRData(
        data.supplierIban,
        totalPrice,
        invoiceNumber,
        data.supplierName
      );
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        width: 100,
        margin: 1,
      });
      doc.addImage(qrCodeDataUrl, "PNG", 14, finalY + 10, 35, 35);
      doc.setFontSize(8);
      doc.text("PAY by square", 14, finalY + 48);
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  }

  // Signature section
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Podpis dodávateľa / Supplier signature:", 110, finalY + 15);

  if (data.signatureUrl) {
    try {
      const signatureBase64 = await loadImageAsBase64(data.signatureUrl);
      if (signatureBase64) {
        doc.addImage(signatureBase64, "PNG", 110, finalY + 20, 50, 25);
      }
    } catch (error) {
      console.error("Error loading signature:", error);
    }
  }

  doc.setFont("helvetica", "normal");
  doc.text("_______________________", 110, finalY + 50);
  doc.setFontSize(8);
  doc.text(data.supplierName, 110, finalY + 56);

  // Footer disclaimer
  doc.setFontSize(7);
  doc.setTextColor(100);
  doc.text(
    "Táto faktúra slúži ako podklad pre B2B fakturáciu medzi subdodávateľom a objednávateľom.",
    105,
    280,
    { align: "center" }
  );

  // Download
  const filename = `Faktura_${invoiceNumber}.pdf`;
  doc.save(filename);
}
