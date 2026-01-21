import * as XLSX from "xlsx";
import { format, startOfWeek, endOfWeek, addDays } from "date-fns";
import { de } from "date-fns/locale";

interface ExportRecord {
  date: string;
  time_from: string;
  time_to: string;
  break_minutes: number;
  total_hours: number;
  note?: string | null;
}

interface ExportParams {
  records: ExportRecord[];
  projectName: string;
  workerName: string;
  calendarWeek: number;
  year: number;
}

// German day names for the Stundenzettel
const germanDays: Record<string, string> = {
  Monday: "Montag",
  Tuesday: "Dienstag",
  Wednesday: "Mittwoch",
  Thursday: "Donnerstag",
  Friday: "Freitag",
  Saturday: "Samstag",
  Sunday: "Sonntag",
};

function getWeekDateRange(week: number, year: number): { start: Date; end: Date } {
  // Get the first day of the year
  const firstDayOfYear = new Date(year, 0, 1);
  // Find the first Monday of the year
  const dayOfWeek = firstDayOfYear.getDay();
  const daysToMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  const firstMonday = addDays(firstDayOfYear, daysToMonday);
  
  // Calculate the start of the requested week
  const start = addDays(firstMonday, (week - 1) * 7);
  const end = addDays(start, 6);
  
  return { start, end };
}

function formatBreakTime(minutes: number): string {
  if (minutes === 0) return "—";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}min`;
  if (hours > 0) return `${hours}h`;
  return `${mins}min`;
}

export function exportWeeklyRecordsToExcel(params: ExportParams): void {
  const { records, projectName, workerName, calendarWeek, year } = params;
  const { start, end } = getWeekDateRange(calendarWeek, year);

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();

  // Prepare header data
  const headerData = [
    ["LEISTUNGSNACHWEIS / STUNDENZETTEL"],
    [],
    ["Projekt:", projectName],
    ["Subdodávateľ / Montér:", workerName],
    ["Kalenderwoche (KW):", `KW ${calendarWeek} / ${year}`],
    ["Zeitraum:", `${format(start, "dd.MM.yyyy")} - ${format(end, "dd.MM.yyyy")}`],
    [],
    // Column headers in German
    ["Tag", "Datum", "Beginn", "Pause", "Ende", "Summe (h)", "Bemerkung"],
  ];

  // Sort records by date
  const sortedRecords = [...records].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Prepare record rows
  const recordRows = sortedRecords.map((record) => {
    const recordDate = new Date(record.date);
    const dayName = format(recordDate, "EEEE", { locale: de });
    const germanDay = germanDays[format(recordDate, "EEEE")] || dayName;

    return [
      germanDay,
      format(recordDate, "dd.MM.yyyy"),
      record.time_from.slice(0, 5), // Remove seconds if present
      formatBreakTime(record.break_minutes),
      record.time_to.slice(0, 5),
      Number(record.total_hours).toFixed(2),
      record.note || "",
    ];
  });

  // Calculate totals
  const totalHours = records.reduce((sum, r) => sum + Number(r.total_hours), 0);
  const totalBreakMinutes = records.reduce((sum, r) => sum + r.break_minutes, 0);

  // Footer data
  const footerData = [
    [],
    ["", "", "", "", "GESAMT:", totalHours.toFixed(2) + " h", ""],
    [],
    [],
    ["Unterschrift Subdodávateľ:", "", "", "", "Unterschrift Auftraggeber:", "", ""],
    [],
    ["_______________________", "", "", "", "_______________________", "", ""],
    ["Datum:", format(new Date(), "dd.MM.yyyy")],
    [],
    [],
    [
      "Táto aplikácia slúži výlučne na evidenciu rozsahu vykonaného diela ako podklad k fakturácii medzi B2B partnermi.",
    ],
  ];

  // Combine all data
  const wsData = [...headerData, ...recordRows, ...footerData];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws["!cols"] = [
    { wch: 12 }, // Tag
    { wch: 12 }, // Datum
    { wch: 8 },  // Beginn
    { wch: 10 }, // Pause
    { wch: 8 },  // Ende
    { wch: 10 }, // Summe
    { wch: 30 }, // Bemerkung
  ];

  // Merge cells for header title
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // Title row
    { s: { r: wsData.length - 1, c: 0 }, e: { r: wsData.length - 1, c: 6 } }, // Disclaimer
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
  }>
): void {
  const wb = XLSX.utils.book_new();

  weeks.forEach((weekData, index) => {
    const { records, projectName, workerName, calendarWeek, year } = weekData;
    const { start, end } = getWeekDateRange(calendarWeek, year);

    const headerData = [
      ["LEISTUNGSNACHWEIS / STUNDENZETTEL"],
      [],
      ["Projekt:", projectName],
      ["Subdodávateľ / Montér:", workerName],
      ["Kalenderwoche (KW):", `KW ${calendarWeek} / ${year}`],
      ["Zeitraum:", `${format(start, "dd.MM.yyyy")} - ${format(end, "dd.MM.yyyy")}`],
      [],
      ["Tag", "Datum", "Beginn", "Pause", "Ende", "Summe (h)", "Bemerkung"],
    ];

    const sortedRecords = [...records].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const recordRows = sortedRecords.map((record) => {
      const recordDate = new Date(record.date);
      const germanDay = germanDays[format(recordDate, "EEEE")] || format(recordDate, "EEEE", { locale: de });

      return [
        germanDay,
        format(recordDate, "dd.MM.yyyy"),
        record.time_from.slice(0, 5),
        formatBreakTime(record.break_minutes),
        record.time_to.slice(0, 5),
        Number(record.total_hours).toFixed(2),
        record.note || "",
      ];
    });

    const totalHours = records.reduce((sum, r) => sum + Number(r.total_hours), 0);

    const footerData = [
      [],
      ["", "", "", "", "GESAMT:", totalHours.toFixed(2) + " h", ""],
      [],
      ["Unterschrift Subdodávateľ:", "", "", "", "Unterschrift Auftraggeber:", "", ""],
      [],
      ["_______________________", "", "", "", "_______________________", "", ""],
    ];

    const wsData = [...headerData, ...recordRows, ...footerData];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws["!cols"] = [
      { wch: 12 },
      { wch: 12 },
      { wch: 8 },
      { wch: 10 },
      { wch: 8 },
      { wch: 10 },
      { wch: 30 },
    ];

    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];

    // Sheet name (max 31 chars)
    const sheetName = `KW${calendarWeek}_${workerName.slice(0, 15)}`.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const filename = `Leistungsnachweise_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  XLSX.writeFile(wb, filename);
}
