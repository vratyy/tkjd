import * as XLSX from "xlsx";
import { format, addDays } from "date-fns";
import { sk } from "date-fns/locale";

interface ExportRecord {
  date: string;
  time_from: string;
  time_to: string;
  break_start: string | null;
  break_end: string | null;
  total_hours: number;
  note?: string | null;
  location?: string;
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
  if (!breakStart || !breakEnd) return "—";
  const start = breakStart.split(':').map(Number);
  const end = breakEnd.split(':').map(Number);
  const startMinutes = start[0] * 60 + start[1];
  const endMinutes = end[0] * 60 + end[1];
  const diffMinutes = endMinutes - startMinutes;
  if (diffMinutes <= 0) return "—";
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  return hours > 0 ? `${hours}h ${mins}min` : `${mins} min`;
}

function applyHeaderStyle(ws: XLSX.WorkSheet, cellRef: string): void {
  if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
  ws[cellRef].s = {
    font: { bold: true, sz: 11 },
    fill: { fgColor: { rgb: "E0E0E0" } },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
  };
}

function applyCellStyle(ws: XLSX.WorkSheet, cellRef: string): void {
  if (!ws[cellRef]) return;
  ws[cellRef].s = {
    font: { sz: 10 },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    },
    alignment: { horizontal: "center", vertical: "center" },
  };
}

export function exportWeeklyRecordsToExcel(params: ExportParams): void {
  const { records, projectName, workerName, calendarWeek, year, projectLocation } = params;
  const { start, end } = getWeekDateRange(calendarWeek, year);

  const wb = XLSX.utils.book_new();

  // Header section - company info on left, project info on right
  const headerData = [
    ["TKJD s.r.o.", "", "", "", "", "Subdodávateľ:", workerName],
    ["LEISTUNGSNACHWEIS / VÝKAZ PRÁCE", "", "", "", "", "Projekt:", projectName],
    ["", "", "", "", "", "Kalendárny týždeň:", `KW ${calendarWeek} / ${year}`],
    ["", "", "", "", "", "Obdobie:", `${format(start, "dd.MM.yyyy")} - ${format(end, "dd.MM.yyyy")}`],
    [],
    // Column headers (bilingual SK/DE)
    [
      "Dátum\n(Tag)",
      "Miesto plnenia\n(Einsatzort)",
      "Začiatok výkonu\n(Von)",
      "Koniec výkonu\n(Bis)",
      "Prestávka\n(Pause)",
      "Rozsah výkonu celkom\n(Summe Stunden)",
      "Popis činnosti\n(Tätigkeitsbeschreibung)",
    ],
  ];

  // Sort records by date
  const sortedRecords = [...records].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Prepare record rows
  const recordRows = sortedRecords.map((record) => {
    const recordDate = new Date(record.date);
    const dayName = format(recordDate, "EEEE", { locale: sk });
    const formattedDate = `${dayName}\n${format(recordDate, "dd.MM.yyyy")}`;

    return [
      formattedDate,
      record.location || projectLocation || projectName,
      record.time_from.slice(0, 5),
      record.time_to.slice(0, 5),
      formatBreakDuration(record.break_start, record.break_end),
      Number(record.total_hours).toFixed(2) + " h",
      record.note || "",
    ];
  });

  // Calculate totals
  const totalHours = records.reduce((sum, r) => sum + Number(r.total_hours), 0);

  // Footer data
  const footerData = [
    [],
    ["", "", "", "", "CELKOM / GESAMT:", totalHours.toFixed(2) + " h", ""],
    [],
    [],
    ["Potvrdil za TKJD s.r.o. (PM):", "", "", "", "Vypracoval Subdodávateľ:", "", ""],
    [],
    ["_______________________", "", "", "", "_______________________", "", ""],
    ["Dátum:", format(new Date(), "dd.MM.yyyy"), "", "", "Dátum:", format(new Date(), "dd.MM.yyyy"), ""],
  ];

  // Combine all data
  const wsData = [...headerData, ...recordRows, ...footerData];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws["!cols"] = [
    { wch: 16 }, // Dátum
    { wch: 18 }, // Miesto plnenia
    { wch: 12 }, // Začiatok
    { wch: 12 }, // Koniec
    { wch: 12 }, // Prestávka
    { wch: 16 }, // Rozsah celkom
    { wch: 35 }, // Popis činnosti
  ];

  // Set row heights for header row
  ws["!rows"] = [];
  ws["!rows"][5] = { hpt: 40 }; // Header row height

  // Merge cells for company name and title
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, // Company name
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }, // Title
  ];

  // Apply styles to header row (row 6, index 5)
  const headerRowIndex = 5;
  const cols = ["A", "B", "C", "D", "E", "F", "G"];
  cols.forEach((col) => {
    applyHeaderStyle(ws, `${col}${headerRowIndex + 1}`);
  });

  // Apply styles to data cells
  const dataStartRow = 7;
  const dataEndRow = dataStartRow + recordRows.length - 1;
  for (let row = dataStartRow; row <= dataEndRow; row++) {
    cols.forEach((col) => {
      applyCellStyle(ws, `${col}${row}`);
    });
  }

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Leistungsnachweis");

  // Generate filename
  const filename = `Leistungsnachweis_KW${calendarWeek}_${year}_${workerName.replace(/\s+/g, "_")}.xlsx`;

  // Download file
  XLSX.writeFile(wb, filename);
}

// Export for multiple users (Admin view)
export function exportMultipleWeeksToExcel(
  weeks: Array<{
    records: ExportRecord[];
    projectName: string;
    workerName: string;
    calendarWeek: number;
    year: number;
    projectLocation?: string;
  }>
): void {
  const wb = XLSX.utils.book_new();

  weeks.forEach((weekData) => {
    const { records, projectName, workerName, calendarWeek, year, projectLocation } = weekData;
    const { start, end } = getWeekDateRange(calendarWeek, year);

    const headerData = [
      ["TKJD s.r.o.", "", "", "", "", "Subdodávateľ:", workerName],
      ["LEISTUNGSNACHWEIS / VÝKAZ PRÁCE", "", "", "", "", "Projekt:", projectName],
      ["", "", "", "", "", "Kalendárny týždeň:", `KW ${calendarWeek} / ${year}`],
      ["", "", "", "", "", "Obdobie:", `${format(start, "dd.MM.yyyy")} - ${format(end, "dd.MM.yyyy")}`],
      [],
      [
        "Dátum\n(Tag)",
        "Miesto plnenia\n(Einsatzort)",
        "Začiatok výkonu\n(Von)",
        "Koniec výkonu\n(Bis)",
        "Prestávka\n(Pause)",
        "Rozsah výkonu celkom\n(Summe Stunden)",
        "Popis činnosti\n(Tätigkeitsbeschreibung)",
      ],
    ];

    const sortedRecords = [...records].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const recordRows = sortedRecords.map((record) => {
      const recordDate = new Date(record.date);
      const dayName = format(recordDate, "EEEE", { locale: sk });
      const formattedDate = `${dayName}\n${format(recordDate, "dd.MM.yyyy")}`;

      return [
        formattedDate,
        record.location || projectLocation || projectName,
        record.time_from.slice(0, 5),
        record.time_to.slice(0, 5),
        formatBreakDuration(record.break_start, record.break_end),
        Number(record.total_hours).toFixed(2) + " h",
        record.note || "",
      ];
    });

    const totalHours = records.reduce((sum, r) => sum + Number(r.total_hours), 0);

    const footerData = [
      [],
      ["", "", "", "", "CELKOM / GESAMT:", totalHours.toFixed(2) + " h", ""],
      [],
      ["Potvrdil za TKJD s.r.o. (PM):", "", "", "", "Vypracoval Subdodávateľ:", "", ""],
      [],
      ["_______________________", "", "", "", "_______________________", "", ""],
    ];

    const wsData = [...headerData, ...recordRows, ...footerData];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws["!cols"] = [
      { wch: 16 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 16 },
      { wch: 35 },
    ];

    ws["!rows"] = [];
    ws["!rows"][5] = { hpt: 40 };

    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    ];

    const sheetName = `KW${calendarWeek}_${workerName.slice(0, 15)}`.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const filename = `Leistungsnachweise_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  XLSX.writeFile(wb, filename);
}
