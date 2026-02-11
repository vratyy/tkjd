import ExcelJS from "exceljs";
import { format, addDays } from "date-fns";
import { de } from "date-fns/locale";

// Import logo as base64 for embedding
import tkjdLogoUrl from "@/assets/tkjd-logo.png";

interface StundenzettelRecord {
  date: string;
  time_from: string;
  time_to: string;
  break_start: string | null;
  break_end: string | null;
  break2_start?: string | null;
  break2_end?: string | null;
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
  companySignatureBase64?: string | null;
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

// Format time for display (handles null/empty)
function formatTime(time: string | null | undefined): string {
  if (!time) return "";
  return time.slice(0, 5); // "HH:MM"
}

// Colors
const BLUE_COLOR = { argb: "FF0000FF" };
const RED_COLOR = { argb: "FFFF0000" };
const BLACK_COLOR = { argb: "FF000000" };
const WHITE_COLOR = { argb: "FFFFFFFF" };

// Border style
const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: BLACK_COLOR },
  bottom: { style: "thin", color: BLACK_COLOR },
  left: { style: "thin", color: BLACK_COLOR },
  right: { style: "thin", color: BLACK_COLOR },
};

// Fetch image as base64
async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove the data URL prefix to get just the base64 data
      const base64Data = base64.split(",")[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function exportStundenzettelToExcel(params: StundenzettelParams): Promise<void> {
  const { records, projectName, projectClient, projectLocation, workerName, calendarWeek, year } = params;
  const { start, end } = getWeekDateRange(calendarWeek, year);

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TKJD s.r.o.";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("Stundenzettel", {
    pageSetup: { paperSize: 9, orientation: "portrait" },
  });

  // ============ COLUMN WIDTHS ============
  ws.columns = [
    { key: "A", width: 40 },  // Day / Labels
    { key: "B", width: 14 },  // Beginn
    { key: "C", width: 18 },  // Pause Von
    { key: "D", width: 18 },  // Pause Bis
    { key: "E", width: 14 },  // Ende
    { key: "F", width: 22 },  // Summe
  ];

  // ============ ROW 1: Title "STUNDENZETTEL" ============
  ws.getCell("A1").value = "STUNDENZETTEL";
  ws.getCell("A1").font = { bold: true, size: 18 };
  ws.getCell("A1").alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(1).height = 28;

  // ============ ROW 2: Subtitle "HODINOVÝ VÝKAZ" ============
  ws.getCell("A2").value = "HODINOVÝ VÝKAZ";
  ws.getCell("A2").font = { bold: true, size: 14 };
  ws.getCell("A2").alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(2).height = 22;

  // ============ ROWS 3-5: Empty spacer rows ============
  ws.getRow(3).height = 15;
  ws.getRow(4).height = 15;
  ws.getRow(5).height = 15;

  // ============ ROW 6: Company info (right aligned) ============
  ws.getCell("F6").value = "TKJD, s.r.o.";
  ws.getCell("F6").font = { size: 10 };
  ws.getCell("F6").alignment = { horizontal: "right", vertical: "middle" };
  ws.getRow(6).height = 15;

  // ============ ROW 7: Address line 1 ============
  ws.getCell("F7").value = "Žalobín 114";
  ws.getCell("F7").font = { size: 10 };
  ws.getCell("F7").alignment = { horizontal: "right", vertical: "middle" };
  ws.getRow(7).height = 15;

  // ============ ROW 8: Address line 2 ============
  ws.getCell("F8").value = "094 03, Žalobín";
  ws.getCell("F8").font = { size: 10 };
  ws.getCell("F8").alignment = { horizontal: "right", vertical: "middle" };
  ws.getRow(8).height = 15;

  // ============ ROW 9: Country ============
  ws.getCell("F9").value = "Slowakei";
  ws.getCell("F9").font = { size: 10 };
  ws.getCell("F9").alignment = { horizontal: "right", vertical: "middle" };
  ws.getRow(9).height = 15;

  // ============ ROW 10: Email ============
  ws.getCell("F10").value = "tkjdtorokj@gmail.com";
  ws.getCell("F10").font = { size: 10 };
  ws.getCell("F10").alignment = { horizontal: "right", vertical: "middle" };
  ws.getRow(10).height = 15;

  // ============ ROW 11: Empty ============
  ws.getRow(11).height = 10;

  // ============ ROW 12: Client ============
  ws.getCell("A12").value = "AUFTRAGGEBER / NEMECKÝ ZADÁVATEĽ:";
  ws.getCell("A12").font = { bold: true, size: 10 };
  ws.getCell("A12").alignment = { horizontal: "left", vertical: "middle" };
  ws.mergeCells("A12:C12");
  
  ws.getCell("D12").value = projectClient || projectName;
  ws.getCell("D12").font = { bold: true, size: 10 };
  ws.getCell("D12").alignment = { horizontal: "left", vertical: "middle" };
  ws.mergeCells("D12:F12");
  ws.getRow(12).height = 20;

  // ============ ROW 13: Worker name ============
  ws.getCell("A13").value = "NAME DES ARBEITERS / MENO PRACOVNÍKA";
  ws.getCell("A13").font = { bold: true, size: 10 };
  ws.getCell("A13").alignment = { horizontal: "left", vertical: "middle" };
  ws.mergeCells("A13:C13");
  
  ws.getCell("D13").value = workerName;
  ws.getCell("D13").font = { bold: true, size: 10, color: BLUE_COLOR };
  ws.getCell("D13").alignment = { horizontal: "left", vertical: "middle" };
  ws.mergeCells("D13:F13");
  ws.getRow(13).height = 20;

  // ============ ROW 14: Location ============
  ws.getCell("A14").value = "ORT / MIESTO:";
  ws.getCell("A14").font = { bold: true, size: 10 };
  ws.getCell("A14").alignment = { horizontal: "left", vertical: "middle" };
  ws.mergeCells("A14:C14");
  
  ws.getCell("D14").value = projectLocation || projectName;
  ws.getCell("D14").font = { size: 10, color: RED_COLOR };
  ws.getCell("D14").alignment = { horizontal: "left", vertical: "middle" };
  ws.mergeCells("D14:F14");
  ws.getRow(14).height = 20;

  // ============ ROW 15: Period ============
  const dateRangeStr = `${calendarWeek} Woche (${format(start, "dd.MM.yyyy")} - ${format(end, "dd.MM.yyyy")})`;
  ws.getCell("A15").value = "ZEITRAUM / OBDOBIE:";
  ws.getCell("A15").font = { bold: true, size: 10 };
  ws.getCell("A15").alignment = { horizontal: "left", vertical: "middle" };
  ws.mergeCells("A15:C15");
  
  ws.getCell("D15").value = dateRangeStr;
  ws.getCell("D15").font = { bold: true, size: 12, color: BLUE_COLOR };
  ws.getCell("D15").alignment = { horizontal: "left", vertical: "middle" };
  ws.mergeCells("D15:F15");
  ws.getRow(15).height = 22;

  // ============ ROW 16: Table Headers ============
  const headerRow = ws.getRow(16);
  headerRow.height = 55;

  const headers = [
    { col: "A", text: "TAG / Deň" },
    { col: "B", text: "BEGINN\nZAČIATOK" },
    { col: "C", text: "PAUSE VON\nPRESTÁVKA OD" },
    { col: "D", text: "PAUSE BIS\nPRESTÁVKA DO" },
    { col: "E", text: "ENDE\nKONIEC" },
    { col: "F", text: "SUMME DER\nABGELEISTETE STUNDEN\nPOČET\nODPRACOVANÝCH HODÍN" },
  ];

  headers.forEach(({ col, text }) => {
    const cell = ws.getCell(`${col}16`);
    cell.value = text;
    cell.font = { bold: true, size: 9 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = thinBorder;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
  });

  // ============ ROW 17: Empty data row ============
  const emptyRow = ws.getRow(17);
  emptyRow.height = 15;
  ["A", "B", "C", "D", "E", "F"].forEach((col) => {
    const cell = ws.getCell(`${col}17`);
    cell.value = "";
    cell.border = thinBorder;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  // ============ ROWS 18-23: Data rows (Monday to Saturday) ============
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
  const dataStartRow = 18;

  germanDays.forEach((day, index) => {
    const rowNum = dataStartRow + index;
    const record = recordsByDay.get(day);
    const hours = record ? (Number(record.total_hours) || 0) : 0;
    totalHours += hours;

    const row = ws.getRow(rowNum);
    row.height = 22;

    // Day name
    const dayCell = ws.getCell(`A${rowNum}`);
    dayCell.value = day;
    dayCell.font = { bold: true, size: 10 };
    dayCell.alignment = { horizontal: "left", vertical: "middle" };
    dayCell.border = thinBorder;

    // Beginn (start time)
    const beginCell = ws.getCell(`B${rowNum}`);
    beginCell.value = record ? formatTime(record.time_from) : "";
    beginCell.font = { size: 10, color: BLUE_COLOR };
    beginCell.alignment = { horizontal: "center", vertical: "middle" };
    beginCell.border = thinBorder;

    // Pause Von (break start) - combined format: "10:00 / 13:00"
    const pauseVonCell = ws.getCell(`C${rowNum}`);
    const pauseVonParts = [
      record?.break_start ? formatTime(record.break_start) : "",
      record?.break2_start ? formatTime(record.break2_start) : "",
    ].filter(Boolean);
    pauseVonCell.value = pauseVonParts.join(" / ");
    pauseVonCell.font = { size: 10, color: BLUE_COLOR };
    pauseVonCell.alignment = { horizontal: "center", vertical: "middle" };
    pauseVonCell.border = thinBorder;

    // Pause Bis (break end) - combined format: "10:30 / 13:30"
    const pauseBisCell = ws.getCell(`D${rowNum}`);
    const pauseBisParts = [
      record?.break_end ? formatTime(record.break_end) : "",
      record?.break2_end ? formatTime(record.break2_end) : "",
    ].filter(Boolean);
    pauseBisCell.value = pauseBisParts.join(" / ");
    pauseBisCell.font = { size: 10, color: BLUE_COLOR };
    pauseBisCell.alignment = { horizontal: "center", vertical: "middle" };
    pauseBisCell.border = thinBorder;

    // Ende (end time)
    const endCell = ws.getCell(`E${rowNum}`);
    endCell.value = record ? formatTime(record.time_to) : "";
    endCell.font = { size: 10, color: BLUE_COLOR };
    endCell.alignment = { horizontal: "center", vertical: "middle" };
    endCell.border = thinBorder;

    // Summe (hours)
    const sumCell = ws.getCell(`F${rowNum}`);
    sumCell.value = hours > 0 ? hours : "";
    sumCell.font = { size: 10, color: BLUE_COLOR };
    sumCell.alignment = { horizontal: "center", vertical: "middle" };
    sumCell.border = thinBorder;
  });

  // ============ ROW 24: Total row ============
  const totalRowNum = dataStartRow + germanDays.length; // Row 24
  const totalRow = ws.getRow(totalRowNum);
  totalRow.height = 24;

  // Merge A-E for label
  ws.mergeCells(`A${totalRowNum}:E${totalRowNum}`);
  const totalLabelCell = ws.getCell(`A${totalRowNum}`);
  totalLabelCell.value = "Insgesamt in der Woche / Spolu za týždeň:";
  totalLabelCell.font = { bold: true, size: 10 };
  totalLabelCell.alignment = { horizontal: "left", vertical: "middle" };
  totalLabelCell.border = thinBorder;

  // Total hours with black background
  const totalSumCell = ws.getCell(`F${totalRowNum}`);
  totalSumCell.value = totalHours;
  totalSumCell.font = { bold: true, size: 11, color: WHITE_COLOR };
  totalSumCell.alignment = { horizontal: "center", vertical: "middle" };
  totalSumCell.fill = { type: "pattern", pattern: "solid", fgColor: BLACK_COLOR };
  totalSumCell.border = thinBorder;

  // ============ ROWS 25-26: Auftraggeber signature section ============
  ws.getRow(25).height = 15;
  ws.getRow(26).height = 15;

  // ============ ROW 27: Auftraggeber label ============
  ws.mergeCells("A27:C27");
  ws.getCell("A27").value = "AUFTRAGGEBER / ZADÁVATEĽ:";
  ws.getCell("A27").font = { bold: true, size: 9 };
  ws.getCell("A27").alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(27).height = 16;

  // ============ ROWS 28-31: Company signature image area ============
  for (let i = 28; i <= 31; i++) ws.getRow(i).height = 20;

  // Add company signature/stamp if available
  if (params.companySignatureBase64) {
    try {
      const sigImageId = workbook.addImage({
        base64: params.companySignatureBase64,
        extension: "png",
      });
      ws.addImage(sigImageId, {
        tl: { col: 0, row: 27 },
        ext: { width: 150, height: 80 },
      });
    } catch (error) {
      console.warn("Could not embed company signature:", error);
    }
  }

  ws.getRow(32).height = 15;

  // ============ ROW 33: Signature label (German) ============
  ws.getCell("E33").value = "UNTERSCHRIFT DES BAULEITERS";
  ws.getCell("E33").font = { size: 9 };
  ws.getCell("E33").alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(33).height = 15;

  // ============ ROW 34: Signature label (Slovak) ============
  ws.getCell("E34").value = "PODPIS VEDÚCEHO STAVBY";
  ws.getCell("E34").font = { size: 9 };
  ws.getCell("E34").alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(34).height = 15;

  // ============ ROWS 35-37: Empty spacer ============
  for (let i = 35; i <= 37; i++) {
    ws.getRow(i).height = 15;
  }

  // ============ ROW 38: Footer note ============
  ws.mergeCells("A38:F38");
  ws.getCell("A38").value = "Vyplnený a potvrdený formulár zasielajte každý piatok/sobotu na emailovú adresu: tkjdtorokj@gmail.com";
  ws.getCell("A38").font = { size: 8, italic: true };
  ws.getCell("A38").alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(38).height = 18;

  // ============ ADD LOGO IMAGE ============
  try {
    const logoBase64 = await fetchImageAsBase64(tkjdLogoUrl);
    const imageId = workbook.addImage({
      base64: logoBase64,
      extension: "png",
    });

    // Position logo in top-right area (rows 1-5, column F)
    ws.addImage(imageId, {
      tl: { col: 4.5, row: 0 },
      ext: { width: 100, height: 100 },
    });
  } catch (error) {
    console.warn("Could not embed logo image:", error);
  }

  // ============ GENERATE & DOWNLOAD ============
  const safeProjectName = projectName.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
  const safeWorkerName = workerName.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
  const filename = `${calendarWeek}_Woche_Stundenzettel_${safeProjectName}_${safeWorkerName}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  
  URL.revokeObjectURL(url);
}

// Export for multiple workers (Admin view)
export async function exportMultipleStundenzettelsToExcel(
  sheets: Array<StundenzettelParams>
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TKJD s.r.o.";
  workbook.created = new Date();

  // Fetch logo once
  let logoImageId: number | null = null;
  try {
    const logoBase64 = await fetchImageAsBase64(tkjdLogoUrl);
    logoImageId = workbook.addImage({
      base64: logoBase64,
      extension: "png",
    });
  } catch (error) {
    console.warn("Could not load logo image:", error);
  }

  for (const params of sheets) {
    const { records, projectName, projectClient, projectLocation, workerName, calendarWeek, year } = params;
    const { start, end } = getWeekDateRange(calendarWeek, year);

    // Create sheet name (max 31 chars)
    const sheetName = `${workerName.slice(0, 20)}_KW${calendarWeek}`.slice(0, 31);
    const ws = workbook.addWorksheet(sheetName, {
      pageSetup: { paperSize: 9, orientation: "portrait" },
    });

    // ============ COLUMN WIDTHS ============
    ws.columns = [
      { key: "A", width: 40 },
      { key: "B", width: 14 },
      { key: "C", width: 18 },
      { key: "D", width: 18 },
      { key: "E", width: 14 },
      { key: "F", width: 22 },
    ];

    // ============ ROW 1: Title ============
    ws.getCell("A1").value = "STUNDENZETTEL";
    ws.getCell("A1").font = { bold: true, size: 18 };
    ws.getCell("A1").alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(1).height = 28;

    // ============ ROW 2: Subtitle ============
    ws.getCell("A2").value = "HODINOVÝ VÝKAZ";
    ws.getCell("A2").font = { bold: true, size: 14 };
    ws.getCell("A2").alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(2).height = 22;

    // Spacer rows 3-5
    for (let i = 3; i <= 5; i++) ws.getRow(i).height = 15;

    // ============ ROWS 6-10: Company info ============
    const companyInfo = ["TKJD, s.r.o.", "Žalobín 114", "094 03, Žalobín", "Slowakei", "tkjdtorokj@gmail.com"];
    companyInfo.forEach((text, idx) => {
      const cell = ws.getCell(`F${6 + idx}`);
      cell.value = text;
      cell.font = { size: 10 };
      cell.alignment = { horizontal: "right", vertical: "middle" };
      ws.getRow(6 + idx).height = 15;
    });

    ws.getRow(11).height = 10;

    // ============ ROW 12: Client ============
    ws.mergeCells("A12:C12");
    ws.getCell("A12").value = "AUFTRAGGEBER / NEMECKÝ ZADÁVATEĽ:";
    ws.getCell("A12").font = { bold: true, size: 10 };
    ws.getCell("A12").alignment = { horizontal: "left", vertical: "middle" };
    ws.mergeCells("D12:F12");
    ws.getCell("D12").value = projectClient || projectName;
    ws.getCell("D12").font = { bold: true, size: 10 };
    ws.getCell("D12").alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(12).height = 20;

    // ============ ROW 13: Worker ============
    ws.mergeCells("A13:C13");
    ws.getCell("A13").value = "NAME DES ARBEITERS / MENO PRACOVNÍKA";
    ws.getCell("A13").font = { bold: true, size: 10 };
    ws.getCell("A13").alignment = { horizontal: "left", vertical: "middle" };
    ws.mergeCells("D13:F13");
    ws.getCell("D13").value = workerName;
    ws.getCell("D13").font = { bold: true, size: 10, color: BLUE_COLOR };
    ws.getCell("D13").alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(13).height = 20;

    // ============ ROW 14: Location ============
    ws.mergeCells("A14:C14");
    ws.getCell("A14").value = "ORT / MIESTO:";
    ws.getCell("A14").font = { bold: true, size: 10 };
    ws.getCell("A14").alignment = { horizontal: "left", vertical: "middle" };
    ws.mergeCells("D14:F14");
    ws.getCell("D14").value = projectLocation || projectName;
    ws.getCell("D14").font = { size: 10, color: RED_COLOR };
    ws.getCell("D14").alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(14).height = 20;

    // ============ ROW 15: Period ============
    const dateRangeStr = `${calendarWeek} Woche (${format(start, "dd.MM.yyyy")} - ${format(end, "dd.MM.yyyy")})`;
    ws.mergeCells("A15:C15");
    ws.getCell("A15").value = "ZEITRAUM / OBDOBIE:";
    ws.getCell("A15").font = { bold: true, size: 10 };
    ws.getCell("A15").alignment = { horizontal: "left", vertical: "middle" };
    ws.mergeCells("D15:F15");
    ws.getCell("D15").value = dateRangeStr;
    ws.getCell("D15").font = { bold: true, size: 12, color: BLUE_COLOR };
    ws.getCell("D15").alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(15).height = 22;

    // ============ ROW 16: Headers ============
    const headerRow = ws.getRow(16);
    headerRow.height = 55;
    const headers = [
      { col: "A", text: "TAG / Deň" },
      { col: "B", text: "BEGINN\nZAČIATOK" },
      { col: "C", text: "PAUSE VON\nPRESTÁVKA OD" },
      { col: "D", text: "PAUSE BIS\nPRESTÁVKA DO" },
      { col: "E", text: "ENDE\nKONIEC" },
      { col: "F", text: "SUMME DER\nABGELEISTETE STUNDEN\nPOČET\nODPRACOVANÝCH HODÍN" },
    ];
    headers.forEach(({ col, text }) => {
      const cell = ws.getCell(`${col}16`);
      cell.value = text;
      cell.font = { bold: true, size: 9 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = thinBorder;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
    });

    // ============ ROW 17: Empty row ============
    const emptyRow = ws.getRow(17);
    emptyRow.height = 15;
    ["A", "B", "C", "D", "E", "F"].forEach((col) => {
      const cell = ws.getCell(`${col}17`);
      cell.value = "";
      cell.border = thinBorder;
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    // ============ ROWS 18-23: Data ============
    const recordsByDay = new Map<string, StundenzettelRecord>();
    records.forEach(record => {
      const recordDate = new Date(record.date);
      const dayName = format(recordDate, "EEEE", { locale: de });
      const normalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
      recordsByDay.set(normalizedDay, record);
    });

    let totalHours = 0;
    const dataStartRow = 18;

    germanDays.forEach((day, index) => {
      const rowNum = dataStartRow + index;
      const record = recordsByDay.get(day);
      const hours = record ? (Number(record.total_hours) || 0) : 0;
      totalHours += hours;

      ws.getRow(rowNum).height = 22;

      ws.getCell(`A${rowNum}`).value = day;
      ws.getCell(`A${rowNum}`).font = { bold: true, size: 10 };
      ws.getCell(`A${rowNum}`).alignment = { horizontal: "left", vertical: "middle" };
      ws.getCell(`A${rowNum}`).border = thinBorder;

      ws.getCell(`B${rowNum}`).value = record ? formatTime(record.time_from) : "";
      ws.getCell(`B${rowNum}`).font = { size: 10, color: BLUE_COLOR };
      ws.getCell(`B${rowNum}`).alignment = { horizontal: "center", vertical: "middle" };
      ws.getCell(`B${rowNum}`).border = thinBorder;

      const pauseVonParts = [
        record?.break_start ? formatTime(record.break_start) : "",
        record?.break2_start ? formatTime(record.break2_start) : "",
      ].filter(Boolean);
      ws.getCell(`C${rowNum}`).value = pauseVonParts.join(" / ");
      ws.getCell(`C${rowNum}`).font = { size: 10, color: BLUE_COLOR };
      ws.getCell(`C${rowNum}`).alignment = { horizontal: "center", vertical: "middle" };
      ws.getCell(`C${rowNum}`).border = thinBorder;

      const pauseBisParts = [
        record?.break_end ? formatTime(record.break_end) : "",
        record?.break2_end ? formatTime(record.break2_end) : "",
      ].filter(Boolean);
      ws.getCell(`D${rowNum}`).value = pauseBisParts.join(" / ");
      ws.getCell(`D${rowNum}`).font = { size: 10, color: BLUE_COLOR };
      ws.getCell(`D${rowNum}`).alignment = { horizontal: "center", vertical: "middle" };
      ws.getCell(`D${rowNum}`).border = thinBorder;

      ws.getCell(`E${rowNum}`).value = record ? formatTime(record.time_to) : "";
      ws.getCell(`E${rowNum}`).font = { size: 10, color: BLUE_COLOR };
      ws.getCell(`E${rowNum}`).alignment = { horizontal: "center", vertical: "middle" };
      ws.getCell(`E${rowNum}`).border = thinBorder;

      ws.getCell(`F${rowNum}`).value = hours > 0 ? hours : "";
      ws.getCell(`F${rowNum}`).font = { size: 10, color: BLUE_COLOR };
      ws.getCell(`F${rowNum}`).alignment = { horizontal: "center", vertical: "middle" };
      ws.getCell(`F${rowNum}`).border = thinBorder;
    });

    // ============ ROW 24: Total ============
    const totalRowNum = dataStartRow + germanDays.length;
    ws.getRow(totalRowNum).height = 24;
    ws.mergeCells(`A${totalRowNum}:E${totalRowNum}`);
    ws.getCell(`A${totalRowNum}`).value = "Insgesamt in der Woche / Spolu za týždeň:";
    ws.getCell(`A${totalRowNum}`).font = { bold: true, size: 10 };
    ws.getCell(`A${totalRowNum}`).alignment = { horizontal: "left", vertical: "middle" };
    ws.getCell(`A${totalRowNum}`).border = thinBorder;

    ws.getCell(`F${totalRowNum}`).value = totalHours;
    ws.getCell(`F${totalRowNum}`).font = { bold: true, size: 11, color: WHITE_COLOR };
    ws.getCell(`F${totalRowNum}`).alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell(`F${totalRowNum}`).fill = { type: "pattern", pattern: "solid", fgColor: BLACK_COLOR };
    ws.getCell(`F${totalRowNum}`).border = thinBorder;

    // ============ Auftraggeber signature section ============
    ws.getRow(25).height = 15;
    ws.getRow(26).height = 15;
    ws.mergeCells("A27:C27");
    ws.getCell("A27").value = "AUFTRAGGEBER / ZADÁVATEĽ:";
    ws.getCell("A27").font = { bold: true, size: 9 };
    ws.getCell("A27").alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(27).height = 16;
    for (let i = 28; i <= 31; i++) ws.getRow(i).height = 20;

    // Add company signature/stamp if available
    if (params.companySignatureBase64) {
      try {
        const sigImgId = workbook.addImage({
          base64: params.companySignatureBase64,
          extension: "png",
        });
        ws.addImage(sigImgId, {
          tl: { col: 0, row: 27 },
          ext: { width: 150, height: 80 },
        });
      } catch (error) {
        console.warn("Could not embed company signature:", error);
      }
    }

    ws.getRow(32).height = 15;

    // Signature rows
    ws.getCell("E33").value = "UNTERSCHRIFT DES BAULEITERS";
    ws.getCell("E33").font = { size: 9 };
    ws.getCell("E33").alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(33).height = 15;

    ws.getCell("E34").value = "PODPIS VEDÚCEHO STAVBY";
    ws.getCell("E34").font = { size: 9 };
    ws.getCell("E34").alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(34).height = 15;

    for (let i = 35; i <= 37; i++) ws.getRow(i).height = 15;

    // Footer
    ws.mergeCells("A38:F38");
    ws.getCell("A38").value = "Vyplnený a potvrdený formulár zasielajte každý piatok/sobotu na emailovú adresu: tkjdtorokj@gmail.com";
    ws.getCell("A38").font = { size: 8, italic: true };
    ws.getCell("A38").alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(38).height = 18;

    // Add logo
    if (logoImageId !== null) {
      ws.addImage(logoImageId, {
        tl: { col: 4.5, row: 0 },
        ext: { width: 100, height: 100 },
      });
    }
  }

  // Download
  const filename = `Stundenzettels_KW${sheets[0]?.calendarWeek || ""}_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  
  URL.revokeObjectURL(url);
}
