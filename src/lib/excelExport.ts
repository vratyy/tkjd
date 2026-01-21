import * as XLSX from "xlsx";
import { format, addDays } from "date-fns";
import { sk, de } from "date-fns/locale";

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

export function exportWeeklyRecordsToExcel(params: ExportParams): void {
  const { records, projectName, workerName, calendarWeek, year, projectLocation } = params;
  const { start, end } = getWeekDateRange(calendarWeek, year);

  const wb = XLSX.utils.book_new();

  // ============ HEADER SECTION ============
  const headerData: (string | number)[][] = [
    // Company and title
    ["TKJD s.r.o.", "", "", "", "", "", ""],
    ["LEISTUNGSNACHWEIS / VÝKAZ VÝKONU", "", "", "", "", "", ""],
    [],
    // Meta info
    ["Subdodávateľ / Subunternehmer:", workerName, "", "", "Kalenderwoche (KW):", `KW ${calendarWeek}`, ""],
    ["Projekt / Baustelle:", projectName, "", "", "Zeitraum:", `${format(start, "dd.MM.yyyy")} - ${format(end, "dd.MM.yyyy")}`, ""],
    [],
    // Column headers (bilingual DE/SK)
    [
      "Dátum\n(Tag)",
      "Miesto výkonu\n(Einsatzort)",
      "Začiatok\n(Von)",
      "Koniec\n(Bis)",
      "Prestávka\n(Pause)",
      "Netto hodiny\n(Netto Stunden)",
      "Popis činnosti\n(Tätigkeit)",
    ],
  ];

  // Sort records by date
  const sortedRecords = [...records].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // ============ DATA ROWS ============
  const recordRows = sortedRecords.map((record) => {
    const recordDate = new Date(record.date);
    const dayNameEn = format(recordDate, "EEEE");
    const dayAbbr = germanDays[dayNameEn] || dayNameEn.slice(0, 2);
    const formattedDate = `${dayAbbr}, ${format(recordDate, "dd.MM.yyyy")}`;

    return [
      formattedDate,
      record.location || record.projectName || projectLocation || projectName,
      record.time_from.slice(0, 5),
      record.time_to.slice(0, 5),
      formatBreakDuration(record.break_start, record.break_end),
      Number(record.total_hours).toFixed(2),
      record.note || "",
    ];
  });

  // Calculate totals
  const totalHours = records.reduce((sum, r) => sum + Number(r.total_hours), 0);

  // ============ FOOTER SECTION ============
  const footerData: (string | number)[][] = [
    // Total row
    ["", "", "", "", "SPOLU / GESAMT:", totalHours.toFixed(2) + " h", ""],
    [],
    [],
    // Signature section
    ["Schválil za TKJD s.r.o. (PM)", "", "", "", "Vypracoval Subdodávateľ", "", ""],
    ["Genehmigt durch TKJD (PM)", "", "", "", "Subunternehmer", "", ""],
    [],
    ["Dátum / Datum: _______________", "", "", "", "Dátum / Datum: _______________", "", ""],
    [],
    ["Podpis / Unterschrift:", "", "", "", "Podpis / Unterschrift:", "", ""],
    [],
    ["_____________________________", "", "", "", "_____________________________", "", ""],
  ];

  // Combine all data
  const wsData = [...headerData, ...recordRows, ...footerData];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // ============ COLUMN WIDTHS ============
  ws["!cols"] = [
    { wch: 16 }, // Dátum
    { wch: 22 }, // Miesto výkonu
    { wch: 10 }, // Začiatok
    { wch: 10 }, // Koniec
    { wch: 12 }, // Prestávka
    { wch: 14 }, // Netto hodiny
    { wch: 35 }, // Popis činnosti
  ];

  // ============ ROW HEIGHTS ============
  ws["!rows"] = [];
  ws["!rows"][0] = { hpt: 20 }; // Company name
  ws["!rows"][1] = { hpt: 22 }; // Title
  ws["!rows"][6] = { hpt: 35 }; // Header row (taller for wrapped text)

  // ============ MERGES ============
  ws["!merges"] = [
    // Company name row
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    // Title row
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    // Meta rows
    { s: { r: 3, c: 1 }, e: { r: 3, c: 2 } },
    { s: { r: 4, c: 1 }, e: { r: 4, c: 2 } },
    // Signature sections
    { s: { r: headerData.length + recordRows.length + 3, c: 0 }, e: { r: headerData.length + recordRows.length + 3, c: 2 } },
    { s: { r: headerData.length + recordRows.length + 3, c: 4 }, e: { r: headerData.length + recordRows.length + 3, c: 6 } },
    { s: { r: headerData.length + recordRows.length + 4, c: 0 }, e: { r: headerData.length + recordRows.length + 4, c: 2 } },
    { s: { r: headerData.length + recordRows.length + 4, c: 4 }, e: { r: headerData.length + recordRows.length + 4, c: 6 } },
  ];

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

    const headerData: (string | number)[][] = [
      ["TKJD s.r.o.", "", "", "", "", "", ""],
      ["LEISTUNGSNACHWEIS / VÝKAZ VÝKONU", "", "", "", "", "", ""],
      [],
      ["Subdodávateľ / Subunternehmer:", workerName, "", "", "Kalenderwoche (KW):", `KW ${calendarWeek}`, ""],
      ["Projekt / Baustelle:", projectName, "", "", "Zeitraum:", `${format(start, "dd.MM.yyyy")} - ${format(end, "dd.MM.yyyy")}`, ""],
      [],
      [
        "Dátum\n(Tag)",
        "Miesto výkonu\n(Einsatzort)",
        "Začiatok\n(Von)",
        "Koniec\n(Bis)",
        "Prestávka\n(Pause)",
        "Netto hodiny\n(Netto Stunden)",
        "Popis činnosti\n(Tätigkeit)",
      ],
    ];

    const sortedRecords = [...records].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const recordRows = sortedRecords.map((record) => {
      const recordDate = new Date(record.date);
      const dayNameEn = format(recordDate, "EEEE");
      const dayAbbr = germanDays[dayNameEn] || dayNameEn.slice(0, 2);
      const formattedDate = `${dayAbbr}, ${format(recordDate, "dd.MM.yyyy")}`;

      return [
        formattedDate,
        record.location || record.projectName || projectLocation || projectName,
        record.time_from.slice(0, 5),
        record.time_to.slice(0, 5),
        formatBreakDuration(record.break_start, record.break_end),
        Number(record.total_hours).toFixed(2),
        record.note || "",
      ];
    });

    const totalHours = records.reduce((sum, r) => sum + Number(r.total_hours), 0);

    const footerData: (string | number)[][] = [
      ["", "", "", "", "SPOLU / GESAMT:", totalHours.toFixed(2) + " h", ""],
      [],
      [],
      ["Schválil za TKJD s.r.o. (PM)", "", "", "", "Vypracoval Subdodávateľ", "", ""],
      ["Genehmigt durch TKJD (PM)", "", "", "", "Subunternehmer", "", ""],
      [],
      ["Dátum / Datum: _______________", "", "", "", "Dátum / Datum: _______________", "", ""],
      [],
      ["Podpis / Unterschrift:", "", "", "", "Podpis / Unterschrift:", "", ""],
      [],
      ["_____________________________", "", "", "", "_____________________________", "", ""],
    ];

    const wsData = [...headerData, ...recordRows, ...footerData];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws["!cols"] = [
      { wch: 16 },
      { wch: 22 },
      { wch: 10 },
      { wch: 10 },
      { wch: 12 },
      { wch: 14 },
      { wch: 35 },
    ];

    ws["!rows"] = [];
    ws["!rows"][0] = { hpt: 20 };
    ws["!rows"][1] = { hpt: 22 };
    ws["!rows"][6] = { hpt: 35 };

    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    ];

    const sheetName = `KW${calendarWeek}_${workerName.slice(0, 15)}`.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const filename = `Leistungsnachweise_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  XLSX.writeFile(wb, filename);
}
