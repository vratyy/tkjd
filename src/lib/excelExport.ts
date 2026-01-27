import ExcelJS from "exceljs";
import { format, addDays } from "date-fns";

interface ExportRecord {
  date: string;
  time_from: string;
  time_to: string;
  break_start: string | null;
  break_end: string | null;
  total_hours: number;
  note?: string | null;
  location?: string;
  projectName?: string;
}

interface ExportParams {
  records: ExportRecord[];
  projectName: string;
  workerName: string;
  calendarWeek: number;
  year: number;
  projectLocation?: string;
}

function getWeekDateRange(week: number, year: number): { start: Date; end: Date } {
  const firstDayOfYear = new Date(year, 0, 1);
  const dayOfWeek = firstDayOfYear.getDay();
  const daysToMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  const firstMonday = addDays(firstDayOfYear, daysToMonday);
  
  const start = addDays(firstMonday, (week - 1) * 7);
  const end = addDays(start, 6);
  
  return { start, end };
}

function formatBreakDuration(breakStart: string | null, breakEnd: string | null): string {
  if (!breakStart || breakEnd === null) return "—";
  const start = breakStart.split(':').map(Number);
  const end = breakEnd.split(':').map(Number);
  const startMinutes = start[0] * 60 + start[1];
  const endMinutes = end[0] * 60 + end[1];
  const diffMinutes = endMinutes - startMinutes;
  if (diffMinutes <= 0) return "—";
  return `${diffMinutes} min`;
}

// German day abbreviations
const germanDays: Record<string, string> = {
  "Monday": "Mo",
  "Tuesday": "Di",
  "Wednesday": "Mi",
  "Thursday": "Do",
  "Friday": "Fr",
  "Saturday": "Sa",
  "Sunday": "So",
};

export async function exportWeeklyRecordsToExcel(params: ExportParams): Promise<void> {
  const { records, projectName, workerName, calendarWeek, year, projectLocation } = params;
  const { start, end } = getWeekDateRange(calendarWeek, year);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TKJD s.r.o.";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("Leistungsnachweis");

  // ============ COLUMN WIDTHS ============
  ws.columns = [
    { width: 16 }, // Dátum
    { width: 22 }, // Miesto výkonu
    { width: 10 }, // Začiatok
    { width: 10 }, // Koniec
    { width: 12 }, // Prestávka
    { width: 14 }, // Netto hodiny
    { width: 35 }, // Popis činnosti
  ];

  // ============ HEADER SECTION ============
  // Row 1: Company name
  ws.mergeCells("A1:D1");
  const companyCell = ws.getCell("A1");
  companyCell.value = "TKJD s.r.o.";
  companyCell.font = { bold: true, size: 14 };

  // Row 2: Title
  ws.mergeCells("A2:E2");
  const titleCell = ws.getCell("A2");
  titleCell.value = "LEISTUNGSNACHWEIS / VÝKAZ VÝKONU";
  titleCell.font = { bold: true, size: 12 };

  // Row 3: Empty
  // Row 4: Meta info (worker and KW)
  ws.mergeCells("B4:C4");
  ws.getCell("A4").value = "Subdodávateľ / Subunternehmer:";
  ws.getCell("B4").value = workerName;
  ws.getCell("B4").font = { bold: true };
  ws.getCell("E4").value = "Kalenderwoche (KW):";
  ws.getCell("F4").value = `KW ${calendarWeek}`;
  ws.getCell("F4").font = { bold: true };

  // Row 5: Project and date range
  ws.mergeCells("B5:C5");
  ws.getCell("A5").value = "Projekt / Baustelle:";
  ws.getCell("B5").value = projectName;
  ws.getCell("B5").font = { bold: true };
  ws.getCell("E5").value = "Zeitraum:";
  ws.getCell("F5").value = `${format(start, "dd.MM.yyyy")} - ${format(end, "dd.MM.yyyy")}`;
  ws.getCell("F5").font = { bold: true };

  // Row 6: Empty

  // Row 7: Column headers
  const headerRow = ws.getRow(7);
  const headers = [
    "Dátum\n(Tag)",
    "Miesto výkonu\n(Einsatzort)",
    "Začiatok\n(Von)",
    "Koniec\n(Bis)",
    "Prestávka\n(Pause)",
    "Netto hodiny\n(Netto Stunden)",
    "Popis činnosti\n(Tätigkeit)",
  ];
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, size: 9 };
    cell.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
  headerRow.height = 35;

  // ============ DATA ROWS ============
  // Sort records by date
  const sortedRecords = [...records].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let currentRow = 8;
  sortedRecords.forEach((record) => {
    const recordDate = new Date(record.date);
    const dayNameEn = format(recordDate, "EEEE");
    const dayAbbr = germanDays[dayNameEn] || dayNameEn.slice(0, 2);
    const formattedDate = `${dayAbbr}, ${format(recordDate, "dd.MM.yyyy")}`;

    const row = ws.getRow(currentRow);
    row.values = [
      formattedDate,
      record.location || record.projectName || projectLocation || projectName,
      record.time_from?.slice(0, 5) ?? "—",
      record.time_to?.slice(0, 5) ?? "—",
      formatBreakDuration(record.break_start, record.break_end),
      Number(record.total_hours || 0).toFixed(2),
      record.note || "",
    ];

    // Apply borders to all cells in the row
    for (let col = 1; col <= 7; col++) {
      const cell = row.getCell(col);
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      if (col >= 3 && col <= 6) {
        cell.alignment = { horizontal: "center" };
      }
    }

    currentRow++;
  });

  // ============ FOOTER SECTION ============
  // Calculate totals
  const totalHours = records.reduce((sum, r) => sum + (Number(r.total_hours) || 0), 0);

  // Total row
  const totalRow = ws.getRow(currentRow);
  totalRow.getCell(5).value = "SPOLU / GESAMT:";
  totalRow.getCell(5).font = { bold: true };
  totalRow.getCell(6).value = totalHours.toFixed(2) + " h";
  totalRow.getCell(6).font = { bold: true };
  totalRow.getCell(6).alignment = { horizontal: "center" };
  currentRow += 3;

  // Signature section
  ws.mergeCells(`A${currentRow}:C${currentRow}`);
  ws.mergeCells(`E${currentRow}:G${currentRow}`);
  ws.getCell(`A${currentRow}`).value = "Schválil za TKJD s.r.o. (PM)";
  ws.getCell(`E${currentRow}`).value = "Vypracoval Subdodávateľ";
  currentRow++;

  ws.mergeCells(`A${currentRow}:C${currentRow}`);
  ws.mergeCells(`E${currentRow}:G${currentRow}`);
  ws.getCell(`A${currentRow}`).value = "Genehmigt durch TKJD (PM)";
  ws.getCell(`A${currentRow}`).font = { italic: true, size: 9 };
  ws.getCell(`E${currentRow}`).value = "Subunternehmer";
  ws.getCell(`E${currentRow}`).font = { italic: true, size: 9 };
  currentRow += 2;

  ws.mergeCells(`A${currentRow}:C${currentRow}`);
  ws.mergeCells(`E${currentRow}:G${currentRow}`);
  ws.getCell(`A${currentRow}`).value = "Dátum / Datum: _______________";
  ws.getCell(`E${currentRow}`).value = "Dátum / Datum: _______________";
  currentRow += 2;

  ws.mergeCells(`A${currentRow}:C${currentRow}`);
  ws.mergeCells(`E${currentRow}:G${currentRow}`);
  ws.getCell(`A${currentRow}`).value = "Podpis / Unterschrift:";
  ws.getCell(`E${currentRow}`).value = "Podpis / Unterschrift:";
  currentRow += 2;

  ws.mergeCells(`A${currentRow}:C${currentRow}`);
  ws.mergeCells(`E${currentRow}:G${currentRow}`);
  ws.getCell(`A${currentRow}`).value = "_____________________________";
  ws.getCell(`E${currentRow}`).value = "_____________________________";

  // Generate filename
  const filename = `Leistungsnachweis_KW${calendarWeek}_${year}_${workerName.replace(/\s+/g, "_")}.xlsx`;

  // Download file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export for multiple users (Admin view)
export async function exportMultipleWeeksToExcel(
  weeks: Array<{
    records: ExportRecord[];
    projectName: string;
    workerName: string;
    calendarWeek: number;
    year: number;
    projectLocation?: string;
  }>
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TKJD s.r.o.";
  workbook.created = new Date();

  for (const weekData of weeks) {
    const { records, projectName, workerName, calendarWeek, year, projectLocation } = weekData;
    const { start, end } = getWeekDateRange(calendarWeek, year);

    const sheetName = `KW${calendarWeek}_${workerName.slice(0, 15)}`.slice(0, 31);
    const ws = workbook.addWorksheet(sheetName);

    // Column widths
    ws.columns = [
      { width: 16 },
      { width: 22 },
      { width: 10 },
      { width: 10 },
      { width: 12 },
      { width: 14 },
      { width: 35 },
    ];

    // Header
    ws.mergeCells("A1:D1");
    ws.getCell("A1").value = "TKJD s.r.o.";
    ws.getCell("A1").font = { bold: true, size: 14 };

    ws.mergeCells("A2:E2");
    ws.getCell("A2").value = "LEISTUNGSNACHWEIS / VÝKAZ VÝKONU";
    ws.getCell("A2").font = { bold: true, size: 12 };

    ws.mergeCells("B4:C4");
    ws.getCell("A4").value = "Subdodávateľ / Subunternehmer:";
    ws.getCell("B4").value = workerName;
    ws.getCell("B4").font = { bold: true };
    ws.getCell("E4").value = "Kalenderwoche (KW):";
    ws.getCell("F4").value = `KW ${calendarWeek}`;
    ws.getCell("F4").font = { bold: true };

    ws.mergeCells("B5:C5");
    ws.getCell("A5").value = "Projekt / Baustelle:";
    ws.getCell("B5").value = projectName;
    ws.getCell("B5").font = { bold: true };
    ws.getCell("E5").value = "Zeitraum:";
    ws.getCell("F5").value = `${format(start, "dd.MM.yyyy")} - ${format(end, "dd.MM.yyyy")}`;
    ws.getCell("F5").font = { bold: true };

    const headerRow = ws.getRow(7);
    const headers = [
      "Dátum\n(Tag)",
      "Miesto výkonu\n(Einsatzort)",
      "Začiatok\n(Von)",
      "Koniec\n(Bis)",
      "Prestávka\n(Pause)",
      "Netto hodiny\n(Netto Stunden)",
      "Popis činnosti\n(Tätigkeit)",
    ];
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, size: 9 };
      cell.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
    headerRow.height = 35;

    const sortedRecords = [...records].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let currentRow = 8;
    sortedRecords.forEach((record) => {
      const recordDate = new Date(record.date);
      const dayNameEn = format(recordDate, "EEEE");
      const dayAbbr = germanDays[dayNameEn] || dayNameEn.slice(0, 2);
      const formattedDate = `${dayAbbr}, ${format(recordDate, "dd.MM.yyyy")}`;

      const row = ws.getRow(currentRow);
      row.values = [
        formattedDate,
        record.location || record.projectName || projectLocation || projectName,
        record.time_from?.slice(0, 5) ?? "—",
        record.time_to?.slice(0, 5) ?? "—",
        formatBreakDuration(record.break_start, record.break_end),
        Number(record.total_hours || 0).toFixed(2),
        record.note || "",
      ];

      for (let col = 1; col <= 7; col++) {
        const cell = row.getCell(col);
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        if (col >= 3 && col <= 6) {
          cell.alignment = { horizontal: "center" };
        }
      }

      currentRow++;
    });

    const totalHours = records.reduce((sum, r) => sum + (Number(r.total_hours) || 0), 0);

    const totalRow = ws.getRow(currentRow);
    totalRow.getCell(5).value = "SPOLU / GESAMT:";
    totalRow.getCell(5).font = { bold: true };
    totalRow.getCell(6).value = totalHours.toFixed(2) + " h";
    totalRow.getCell(6).font = { bold: true };
    totalRow.getCell(6).alignment = { horizontal: "center" };
    currentRow += 3;

    ws.mergeCells(`A${currentRow}:C${currentRow}`);
    ws.mergeCells(`E${currentRow}:G${currentRow}`);
    ws.getCell(`A${currentRow}`).value = "Schválil za TKJD s.r.o. (PM)";
    ws.getCell(`E${currentRow}`).value = "Vypracoval Subdodávateľ";
    currentRow++;

    ws.mergeCells(`A${currentRow}:C${currentRow}`);
    ws.mergeCells(`E${currentRow}:G${currentRow}`);
    ws.getCell(`A${currentRow}`).value = "Genehmigt durch TKJD (PM)";
    ws.getCell(`A${currentRow}`).font = { italic: true, size: 9 };
    ws.getCell(`E${currentRow}`).value = "Subunternehmer";
    ws.getCell(`E${currentRow}`).font = { italic: true, size: 9 };
    currentRow += 2;

    ws.mergeCells(`A${currentRow}:C${currentRow}`);
    ws.mergeCells(`E${currentRow}:G${currentRow}`);
    ws.getCell(`A${currentRow}`).value = "Dátum / Datum: _______________";
    ws.getCell(`E${currentRow}`).value = "Dátum / Datum: _______________";
    currentRow += 2;

    ws.mergeCells(`A${currentRow}:C${currentRow}`);
    ws.mergeCells(`E${currentRow}:G${currentRow}`);
    ws.getCell(`A${currentRow}`).value = "Podpis / Unterschrift:";
    ws.getCell(`E${currentRow}`).value = "Podpis / Unterschrift:";
    currentRow += 2;

    ws.mergeCells(`A${currentRow}:C${currentRow}`);
    ws.mergeCells(`E${currentRow}:G${currentRow}`);
    ws.getCell(`A${currentRow}`).value = "_____________________________";
    ws.getCell(`E${currentRow}`).value = "_____________________________";
  }

  const filename = `Leistungsnachweise_${format(new Date(), "yyyy-MM-dd")}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
