import XLSX from "xlsx-js-style";
import { format, addDays, startOfWeek, getWeek } from "date-fns";
import { de } from "date-fns/locale";

interface StundenzettelRecord {
  date: string;
  time_from: string;
  time_to: string;
  break_start: string | null;
  break_end: string | null;
  total_hours: number;
  note?: string | null;
}

interface StundenzettelParams {
  records: StundenzettelRecord[];
  projectName: string;
  projectClient: string;
  projectLocation?: string | null;
  workerName: string;
  calendarWeek: number;
  year: number;
}

// German day names for the week (Monday to Saturday)
const germanDays = ["Montag", "Dienstag", "Mitwoch", "Donnerstag", "Freitag", "Samstag"];

// Helper to get week date range
function getWeekDateRange(week: number, year: number): { start: Date; end: Date } {
  const firstDayOfYear = new Date(year, 0, 1);
  const dayOfWeek = firstDayOfYear.getDay();
  const daysToMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  const firstMonday = addDays(firstDayOfYear, daysToMonday);
  
  const start = addDays(firstMonday, (week - 1) * 7);
  const end = addDays(start, 4); // Friday (for display purposes)
  
  return { start, end };
}

// Style definitions
const styles = {
  title: {
    font: { bold: true, sz: 18 },
    alignment: { horizontal: "left", vertical: "center" }
  },
  subtitle: {
    font: { bold: true, sz: 14 },
    alignment: { horizontal: "left", vertical: "center" }
  },
  companyInfo: {
    font: { sz: 10 },
    alignment: { horizontal: "right", vertical: "center" }
  },
  labelBold: {
    font: { bold: true, sz: 10 },
    alignment: { horizontal: "left", vertical: "center" }
  },
  valueBlue: {
    font: { bold: true, sz: 10, color: { rgb: "0000FF" } },
    alignment: { horizontal: "left", vertical: "center" }
  },
  valueRed: {
    font: { sz: 10, color: { rgb: "FF0000" } },
    alignment: { horizontal: "left", vertical: "center" }
  },
  valueBlueLarge: {
    font: { bold: true, sz: 12, color: { rgb: "0000FF" } },
    alignment: { horizontal: "left", vertical: "center" }
  },
  tableHeader: {
    font: { bold: true, sz: 9 },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    },
    fill: { fgColor: { rgb: "E0E0E0" } }
  },
  tableCell: {
    font: { sz: 10, color: { rgb: "0000FF" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  },
  tableCellDay: {
    font: { bold: true, sz: 10 },
    alignment: { horizontal: "left", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  },
  totalRow: {
    font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { fgColor: { rgb: "000000" } },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  },
  totalLabel: {
    font: { bold: true, sz: 10 },
    alignment: { horizontal: "left", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  },
  signatureLabel: {
    font: { sz: 9 },
    alignment: { horizontal: "center", vertical: "center" }
  },
  footerNote: {
    font: { sz: 8, italic: true },
    alignment: { horizontal: "left", vertical: "center" }
  }
};

// Format time for display (handles null/empty)
function formatTime(time: string | null | undefined): string {
  if (!time) return "";
  return time.slice(0, 5); // "HH:MM"
}

// Format break times (can be multiple)
function formatBreak(breakStart: string | null, breakEnd: string | null): string {
  if (!breakStart || !breakEnd) return "";
  return `${formatTime(breakStart)}`;
}

export function exportStundenzettelToExcel(params: StundenzettelParams): void {
  const { records, projectName, projectClient, projectLocation, workerName, calendarWeek, year } = params;
  const { start, end } = getWeekDateRange(calendarWeek, year);

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Initialize worksheet data array
  const wsData: any[][] = [];

  // ============ ROW 1: Title ============
  wsData.push([
    { v: "STUNDENZETTEL", s: styles.title },
    "", "", "", "", 
    { v: "TKJD, s.r.o.", s: styles.companyInfo }
  ]);

  // ============ ROW 2: Subtitle ============
  wsData.push([
    { v: "HODINOVÝ VÝKAZ", s: styles.subtitle },
    "", "", "", "",
    { v: "Žalobín 114", s: styles.companyInfo }
  ]);

  // ============ ROW 3-5: Company contact ============
  wsData.push(["", "", "", "", "", { v: "094 03, Žalobín", s: styles.companyInfo }]);
  wsData.push(["", "", "", "", "", { v: "Slowakei", s: styles.companyInfo }]);
  wsData.push(["", "", "", "", "", { v: "tkjdtorokj@gmail.com", s: styles.companyInfo }]);
  
  // ============ ROW 6: Empty ============
  wsData.push([]);

  // ============ ROW 7: Client ============
  wsData.push([
    { v: "AUFTRAGGEBER / NEMECKÝ ZADÁVATEĽ:", s: styles.labelBold },
    "", "",
    { v: projectClient || projectName, s: styles.labelBold },
    "", ""
  ]);

  // ============ ROW 8: Worker name ============
  wsData.push([
    { v: "NAME DES ARBEITERS / MENO PRACOVNÍKA", s: styles.labelBold },
    "", "",
    { v: workerName, s: styles.valueBlue },
    "", ""
  ]);

  // ============ ROW 9: Location ============
  wsData.push([
    { v: "ORT / MIESTO:", s: styles.labelBold },
    "", "",
    { v: projectLocation || projectName, s: styles.valueRed },
    "", ""
  ]);

  // ============ ROW 10: Period ============
  const dateRangeStr = `${calendarWeek} Woche (${format(start, "dd.MM.yyyy")} - ${format(end, "dd.MM.yyyy")})`;
  wsData.push([
    { v: "ZEITRAUM / OBDOBIE:", s: styles.labelBold },
    "", "",
    { v: dateRangeStr, s: styles.valueBlueLarge },
    "", ""
  ]);

  // ============ ROW 11: Table Headers ============
  wsData.push([
    { v: "TAG / Deň", s: styles.tableHeader },
    { v: "BEGINN\nZAČIATOK", s: styles.tableHeader },
    { v: "PAUSE VON\nPRESTÁVKA OD", s: styles.tableHeader },
    { v: "PAUSE BIS\nPRESTÁVKA DO", s: styles.tableHeader },
    { v: "ENDE\nKONIEC", s: styles.tableHeader },
    { v: "SUMME DER\nABGELEISTETE STUNDEN\nPOČET\nODPRACOVANÝCH HODÍN", s: styles.tableHeader }
  ]);

  // ============ ROW 12: Empty row after header ============
  wsData.push([
    { v: "", s: styles.tableCell },
    { v: "", s: styles.tableCell },
    { v: "", s: styles.tableCell },
    { v: "", s: styles.tableCell },
    { v: "", s: styles.tableCell },
    { v: "", s: styles.tableCell }
  ]);

  // ============ ROWS 13-18: Data rows (Monday to Saturday) ============
  // Create a map of records by day of week
  const recordsByDay = new Map<string, StundenzettelRecord>();
  records.forEach(record => {
    const recordDate = new Date(record.date);
    const dayName = format(recordDate, "EEEE", { locale: de });
    // Normalize German day names
    const normalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    recordsByDay.set(normalizedDay, record);
  });

  let totalHours = 0;

  germanDays.forEach(day => {
    const record = recordsByDay.get(day);
    const hours = record ? (Number(record.total_hours) || 0) : 0;
    totalHours += hours;

    wsData.push([
      { v: day, s: styles.tableCellDay },
      { v: record ? formatTime(record.time_from) : "", s: styles.tableCell },
      { v: record ? formatBreak(record.break_start, null) : "", s: styles.tableCell },
      { v: record ? formatBreak(null, record.break_end) : "", s: styles.tableCell },
      { v: record ? formatTime(record.time_to) : "", s: styles.tableCell },
      { v: hours > 0 ? hours : "", s: styles.tableCell }
    ]);
  });

  // ============ TOTAL ROW ============
  wsData.push([
    { v: "Insgesamt in der Woche / Spolu za týždeň:", s: styles.totalLabel },
    { v: "", s: styles.totalLabel },
    { v: "", s: styles.totalLabel },
    { v: "", s: styles.totalLabel },
    { v: "", s: styles.totalLabel },
    { v: totalHours, s: styles.totalRow }
  ]);

  // ============ EMPTY ROWS FOR SPACING ============
  for (let i = 0; i < 8; i++) {
    wsData.push([]);
  }

  // ============ SIGNATURE SECTION ============
  wsData.push([
    "", "", "", "",
    { v: "UNTERSCHRIFT DES BAULEITERS", s: styles.signatureLabel },
    ""
  ]);
  wsData.push([
    "", "", "", "",
    { v: "PODPIS VEDÚCEHO STAVBY", s: styles.signatureLabel },
    ""
  ]);

  // ============ EMPTY ROWS ============
  for (let i = 0; i < 3; i++) {
    wsData.push([]);
  }

  // ============ FOOTER NOTE ============
  wsData.push([
    { v: "Vyplnený a potvrdený formulár zasielajte každý piatok/sobotu na emailovú adresu: tkjdtorokj@gmail.com", s: styles.footerNote },
    "", "", "", "", ""
  ]);

  // Create worksheet from data
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // ============ COLUMN WIDTHS ============
  ws["!cols"] = [
    { wch: 35 }, // A: Day / Labels
    { wch: 12 }, // B: Beginn
    { wch: 14 }, // C: Pause Von
    { wch: 14 }, // D: Pause Bis
    { wch: 12 }, // E: Ende
    { wch: 20 }  // F: Summe
  ];

  // ============ ROW HEIGHTS ============
  ws["!rows"] = [
    { hpt: 25 },  // Row 1: Title
    { hpt: 20 },  // Row 2: Subtitle
    { hpt: 15 },  // Row 3
    { hpt: 15 },  // Row 4
    { hpt: 15 },  // Row 5
    { hpt: 10 },  // Row 6: Empty
    { hpt: 18 },  // Row 7: Client
    { hpt: 18 },  // Row 8: Worker
    { hpt: 18 },  // Row 9: Location
    { hpt: 20 },  // Row 10: Period
    { hpt: 50 },  // Row 11: Table header (tall for wrapped text)
    { hpt: 15 },  // Row 12: Empty
    { hpt: 20 },  // Row 13: Montag
    { hpt: 20 },  // Row 14: Dienstag
    { hpt: 20 },  // Row 15: Mitwoch
    { hpt: 20 },  // Row 16: Donnerstag
    { hpt: 20 },  // Row 17: Freitag
    { hpt: 20 },  // Row 18: Samstag
    { hpt: 22 },  // Row 19: Total
  ];

  // ============ MERGES ============
  ws["!merges"] = [
    // Title merge (A1:E1)
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    // Subtitle merge (A2:E2)
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    // Client label merge (A7:C7)
    { s: { r: 6, c: 0 }, e: { r: 6, c: 2 } },
    // Client value merge (D7:F7)
    { s: { r: 6, c: 3 }, e: { r: 6, c: 5 } },
    // Worker label merge (A8:C8)
    { s: { r: 7, c: 0 }, e: { r: 7, c: 2 } },
    // Worker value merge (D8:F8)
    { s: { r: 7, c: 3 }, e: { r: 7, c: 5 } },
    // Location label merge (A9:C9)
    { s: { r: 8, c: 0 }, e: { r: 8, c: 2 } },
    // Location value merge (D9:F9)
    { s: { r: 8, c: 3 }, e: { r: 8, c: 5 } },
    // Period label merge (A10:C10)
    { s: { r: 9, c: 0 }, e: { r: 9, c: 2 } },
    // Period value merge (D10:F10)
    { s: { r: 9, c: 3 }, e: { r: 9, c: 5 } },
    // Total label merge (A19:E19) - row index 18
    { s: { r: 18, c: 0 }, e: { r: 18, c: 4 } },
    // Footer note merge
    { s: { r: 30, c: 0 }, e: { r: 30, c: 5 } },
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Stundenzettel");

  // Generate filename: [KW] Woche Stundenzettel [Project Name] - [User Name].xlsx
  const safeProjectName = projectName.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
  const safeWorkerName = workerName.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
  const filename = `${calendarWeek}_Woche_Stundenzettel_${safeProjectName}_${safeWorkerName}.xlsx`;

  // Download file
  XLSX.writeFile(wb, filename);
}

// Export for multiple workers (Admin view)
export function exportMultipleStundenzettelsToExcel(
  sheets: Array<StundenzettelParams>
): void {
  const wb = XLSX.utils.book_new();

  sheets.forEach((params, index) => {
    const { records, projectName, projectClient, projectLocation, workerName, calendarWeek, year } = params;
    const { start, end } = getWeekDateRange(calendarWeek, year);

    const wsData: any[][] = [];

    // Build same structure as single export
    wsData.push([
      { v: "STUNDENZETTEL", s: styles.title },
      "", "", "", "", 
      { v: "TKJD, s.r.o.", s: styles.companyInfo }
    ]);
    wsData.push([
      { v: "HODINOVÝ VÝKAZ", s: styles.subtitle },
      "", "", "", "",
      { v: "Žalobín 114", s: styles.companyInfo }
    ]);
    wsData.push(["", "", "", "", "", { v: "094 03, Žalobín", s: styles.companyInfo }]);
    wsData.push(["", "", "", "", "", { v: "Slowakei", s: styles.companyInfo }]);
    wsData.push(["", "", "", "", "", { v: "tkjdtorokj@gmail.com", s: styles.companyInfo }]);
    wsData.push([]);

    wsData.push([
      { v: "AUFTRAGGEBER / NEMECKÝ ZADÁVATEĽ:", s: styles.labelBold },
      "", "",
      { v: projectClient || projectName, s: styles.labelBold },
      "", ""
    ]);
    wsData.push([
      { v: "NAME DES ARBEITERS / MENO PRACOVNÍKA", s: styles.labelBold },
      "", "",
      { v: workerName, s: styles.valueBlue },
      "", ""
    ]);
    wsData.push([
      { v: "ORT / MIESTO:", s: styles.labelBold },
      "", "",
      { v: projectLocation || projectName, s: styles.valueRed },
      "", ""
    ]);

    const dateRangeStr = `${calendarWeek} Woche (${format(start, "dd.MM.yyyy")} - ${format(end, "dd.MM.yyyy")})`;
    wsData.push([
      { v: "ZEITRAUM / OBDOBIE:", s: styles.labelBold },
      "", "",
      { v: dateRangeStr, s: styles.valueBlueLarge },
      "", ""
    ]);

    wsData.push([
      { v: "TAG / Deň", s: styles.tableHeader },
      { v: "BEGINN\nZAČIATOK", s: styles.tableHeader },
      { v: "PAUSE VON\nPRESTÁVKA OD", s: styles.tableHeader },
      { v: "PAUSE BIS\nPRESTÁVKA DO", s: styles.tableHeader },
      { v: "ENDE\nKONIEC", s: styles.tableHeader },
      { v: "SUMME DER\nABGELEISTETE STUNDEN\nPOČET\nODPRACOVANÝCH HODÍN", s: styles.tableHeader }
    ]);

    wsData.push([
      { v: "", s: styles.tableCell },
      { v: "", s: styles.tableCell },
      { v: "", s: styles.tableCell },
      { v: "", s: styles.tableCell },
      { v: "", s: styles.tableCell },
      { v: "", s: styles.tableCell }
    ]);

    const recordsByDay = new Map<string, StundenzettelRecord>();
    records.forEach(record => {
      const recordDate = new Date(record.date);
      const dayName = format(recordDate, "EEEE", { locale: de });
      const normalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
      recordsByDay.set(normalizedDay, record);
    });

    let totalHours = 0;

    germanDays.forEach(day => {
      const record = recordsByDay.get(day);
      const hours = record ? (Number(record.total_hours) || 0) : 0;
      totalHours += hours;

      wsData.push([
        { v: day, s: styles.tableCellDay },
        { v: record ? formatTime(record.time_from) : "", s: styles.tableCell },
        { v: record ? formatBreak(record.break_start, null) : "", s: styles.tableCell },
        { v: record ? formatBreak(null, record.break_end) : "", s: styles.tableCell },
        { v: record ? formatTime(record.time_to) : "", s: styles.tableCell },
        { v: hours > 0 ? hours : "", s: styles.tableCell }
      ]);
    });

    wsData.push([
      { v: "Insgesamt in der Woche / Spolu za týždeň:", s: styles.totalLabel },
      { v: "", s: styles.totalLabel },
      { v: "", s: styles.totalLabel },
      { v: "", s: styles.totalLabel },
      { v: "", s: styles.totalLabel },
      { v: totalHours, s: styles.totalRow }
    ]);

    for (let i = 0; i < 8; i++) {
      wsData.push([]);
    }

    wsData.push([
      "", "", "", "",
      { v: "UNTERSCHRIFT DES BAULEITERS", s: styles.signatureLabel },
      ""
    ]);
    wsData.push([
      "", "", "", "",
      { v: "PODPIS VEDÚCEHO STAVBY", s: styles.signatureLabel },
      ""
    ]);

    for (let i = 0; i < 3; i++) {
      wsData.push([]);
    }

    wsData.push([
      { v: "Vyplnený a potvrdený formulár zasielajte každý piatok/sobotu na emailovú adresu: tkjdtorokj@gmail.com", s: styles.footerNote },
      "", "", "", "", ""
    ]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws["!cols"] = [
      { wch: 35 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 20 }
    ];

    ws["!rows"] = [
      { hpt: 25 }, { hpt: 20 }, { hpt: 15 }, { hpt: 15 }, { hpt: 15 },
      { hpt: 10 }, { hpt: 18 }, { hpt: 18 }, { hpt: 18 }, { hpt: 20 },
      { hpt: 50 }, { hpt: 15 }, { hpt: 20 }, { hpt: 20 }, { hpt: 20 },
      { hpt: 20 }, { hpt: 20 }, { hpt: 20 }, { hpt: 22 },
    ];

    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
      { s: { r: 6, c: 0 }, e: { r: 6, c: 2 } },
      { s: { r: 6, c: 3 }, e: { r: 6, c: 5 } },
      { s: { r: 7, c: 0 }, e: { r: 7, c: 2 } },
      { s: { r: 7, c: 3 }, e: { r: 7, c: 5 } },
      { s: { r: 8, c: 0 }, e: { r: 8, c: 2 } },
      { s: { r: 8, c: 3 }, e: { r: 8, c: 5 } },
      { s: { r: 9, c: 0 }, e: { r: 9, c: 2 } },
      { s: { r: 9, c: 3 }, e: { r: 9, c: 5 } },
      { s: { r: 18, c: 0 }, e: { r: 18, c: 4 } },
      { s: { r: 30, c: 0 }, e: { r: 30, c: 5 } },
    ];

    // Create sheet name (max 31 chars)
    const sheetName = `${workerName.slice(0, 20)}_KW${calendarWeek}`.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const filename = `Stundenzettels_KW${sheets[0]?.calendarWeek || ""}_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  XLSX.writeFile(wb, filename);
}
