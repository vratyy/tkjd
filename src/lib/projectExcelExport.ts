import ExcelJS from "exceljs";
import { format, addDays } from "date-fns";
import { de } from "date-fns/locale";
import tkjdLogoUrl from "@/assets/tkjd-logo.png";

interface ProjectExportRecord {
  date: string;
  time_from: string;
  time_to: string;
  break_start: string | null;
  break_end: string | null;
  break2_start: string | null;
  break2_end: string | null;
  total_hours: number;
  note?: string | null;
}

export interface ProjectWorkerSheet {
  workerName: string;
  records: ProjectExportRecord[];
}

export interface ProjectExportParams {
  projectName: string;
  projectClient: string;
  projectLocation?: string | null;
  projectAddress?: string | null;
  calendarWeek: number;
  year: number;
  workers: ProjectWorkerSheet[];
}

// German day names (Monday to Saturday)
const germanDays = ["Montag", "Dienstag", "Mitwoch", "Donnerstag", "Freitag", "Samstag"];

function getWeekDateRange(week: number, year: number): { start: Date; end: Date } {
  const firstDayOfYear = new Date(year, 0, 1);
  const dayOfWeek = firstDayOfYear.getDay();
  const daysToMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  const firstMonday = addDays(firstDayOfYear, daysToMonday);
  const start = addDays(firstMonday, (week - 1) * 7);
  const end = addDays(start, 4); // Friday
  return { start, end };
}

function formatTime(time: string | null | undefined): string {
  if (!time) return "";
  return time.slice(0, 5);
}

// Colors
const BLUE_COLOR = { argb: "FF1A56DB" };
const RED_COLOR = { argb: "FFFF0000" };
const BLACK_COLOR = { argb: "FF000000" };
const WHITE_COLOR = { argb: "FFFFFFFF" };
const HEADER_BG = { argb: "FFE0E0E0" };

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: BLACK_COLOR },
  bottom: { style: "thin", color: BLACK_COLOR },
  left: { style: "thin", color: BLACK_COLOR },
  right: { style: "thin", color: BLACK_COLOR },
};

async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      resolve(base64.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function applyStundenzettelSheet(
  ws: ExcelJS.Worksheet,
  workerName: string,
  records: ProjectExportRecord[],
  projectName: string,
  projectClient: string,
  projectLocation: string | null | undefined,
  calendarWeek: number,
  year: number,
  logoImageId: number | null,
) {
  const { start, end } = getWeekDateRange(calendarWeek, year);

  // Column widths
  ws.columns = [
    { key: "A", width: 40 },
    { key: "B", width: 14 },
    { key: "C", width: 18 },
    { key: "D", width: 18 },
    { key: "E", width: 14 },
    { key: "F", width: 22 },
  ];

  // Row 1: Title
  ws.getCell("A1").value = "STUNDENZETTEL";
  ws.getCell("A1").font = { bold: true, size: 18 };
  ws.getCell("A1").alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(1).height = 28;

  // Row 2: Subtitle
  ws.getCell("A2").value = "HODINOVÝ VÝKAZ";
  ws.getCell("A2").font = { bold: true, size: 14 };
  ws.getCell("A2").alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(2).height = 22;

  // Spacer rows 3-5
  for (let i = 3; i <= 5; i++) ws.getRow(i).height = 15;

  // Company info (right aligned)
  const companyInfo = ["TKJD, s.r.o.", "Žalobín 114", "094 03, Žalobín", "Slowakei", "tkjdtorokj@gmail.com"];
  companyInfo.forEach((text, idx) => {
    const cell = ws.getCell(`F${6 + idx}`);
    cell.value = text;
    cell.font = { size: 10 };
    cell.alignment = { horizontal: "right", vertical: "middle" };
    ws.getRow(6 + idx).height = 15;
  });

  ws.getRow(11).height = 10;

  // Row 12: Client
  ws.mergeCells("A12:C12");
  ws.getCell("A12").value = "AUFTRAGGEBER / NEMECKÝ ZADÁVATEĽ:";
  ws.getCell("A12").font = { bold: true, size: 10 };
  ws.getCell("A12").alignment = { horizontal: "left", vertical: "middle" };
  ws.mergeCells("D12:F12");
  ws.getCell("D12").value = projectClient || projectName;
  ws.getCell("D12").font = { bold: true, size: 10 };
  ws.getCell("D12").alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(12).height = 20;

  // Row 13: Worker
  ws.mergeCells("A13:C13");
  ws.getCell("A13").value = "NAME DES ARBEITERS / MENO PRACOVNÍKA";
  ws.getCell("A13").font = { bold: true, size: 10 };
  ws.getCell("A13").alignment = { horizontal: "left", vertical: "middle" };
  ws.mergeCells("D13:F13");
  ws.getCell("D13").value = workerName;
  ws.getCell("D13").font = { bold: true, size: 10, color: BLUE_COLOR };
  ws.getCell("D13").alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(13).height = 20;

  // Row 14: Location
  ws.mergeCells("A14:C14");
  ws.getCell("A14").value = "ORT / MIESTO:";
  ws.getCell("A14").font = { bold: true, size: 10 };
  ws.getCell("A14").alignment = { horizontal: "left", vertical: "middle" };
  ws.mergeCells("D14:F14");
  ws.getCell("D14").value = projectLocation || projectName;
  ws.getCell("D14").font = { size: 10, color: RED_COLOR };
  ws.getCell("D14").alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(14).height = 20;

  // Row 15: Period
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

  // Row 16: Table Headers
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
    cell.fill = { type: "pattern", pattern: "solid", fgColor: HEADER_BG };
  });

  // Row 17: Empty data row
  ws.getRow(17).height = 15;
  ["A", "B", "C", "D", "E", "F"].forEach((col) => {
    const cell = ws.getCell(`${col}17`);
    cell.value = "";
    cell.border = thinBorder;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  // Data rows 18-23: Monday to Saturday
  const recordsByDay = new Map<string, ProjectExportRecord>();
  records.forEach((record) => {
    const recordDate = new Date(record.date + "T12:00:00");
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

  // Total row
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

  // Spacer rows
  for (let i = 25; i <= 32; i++) ws.getRow(i).height = 15;

  // Signature rows
  ws.getCell("A33").value = "Podpis montéra / Unterschrift Monteur:";
  ws.getCell("A33").font = { size: 9 };
  ws.getCell("A33").alignment = { horizontal: "left", vertical: "bottom" };
  ws.getRow(33).height = 15;

  ws.getCell("E33").value = "UNTERSCHRIFT DES BAULEITERS";
  ws.getCell("E33").font = { size: 9 };
  ws.getCell("E33").alignment = { horizontal: "center", vertical: "middle" };

  ws.getCell("E34").value = "PODPIS VEDÚCEHO STAVBY";
  ws.getCell("E34").font = { size: 9 };
  ws.getCell("E34").alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(34).height = 15;

  // Signature lines
  ws.mergeCells("A35:B35");
  ws.getCell("A35").value = "_________________________________";
  ws.getCell("A35").alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells("E35:F35");
  ws.getCell("E35").value = "_________________________________";
  ws.getCell("E35").alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(35).height = 15;

  // Date labels
  ws.mergeCells("A36:B36");
  ws.getCell("A36").value = "Dátum / Datum: ___________";
  ws.getCell("A36").font = { italic: true, size: 9 };
  ws.getCell("A36").alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells("E36:F36");
  ws.getCell("E36").value = "Dátum / Datum: ___________";
  ws.getCell("E36").font = { italic: true, size: 9 };
  ws.getCell("E36").alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(36).height = 15;

  ws.getRow(37).height = 15;

  // Footer
  ws.mergeCells("A38:F38");
  ws.getCell("A38").value = "Vyplnený a potvrdený formulár zasielajte každý piatok/sobotu na emailovú adresu: tkjdtorokj@gmail.com";
  ws.getCell("A38").font = { size: 8, italic: true };
  ws.getCell("A38").alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(38).height = 18;

  // Embed logo in top-left (A1:B3 area)
  if (logoImageId !== null) {
    ws.addImage(logoImageId, {
      tl: { col: 0, row: 0 },
      ext: { width: 90, height: 90 },
    });
  }
}

/**
 * Export a consolidated Excel file with one Stundenzettel tab per worker
 * for a specific project and calendar week.
 */
export async function exportProjectConsolidatedExcel(params: ProjectExportParams): Promise<void> {
  const { projectName, projectClient, projectLocation, calendarWeek, year, workers } = params;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TKJD s.r.o.";
  workbook.created = new Date();

  // Fetch and embed logo once
  let logoImageId: number | null = null;
  try {
    const logoBase64 = await fetchImageAsBase64(tkjdLogoUrl);
    logoImageId = workbook.addImage({ base64: logoBase64, extension: "png" });
  } catch (error) {
    console.warn("Could not embed logo image:", error);
  }

  for (const worker of workers) {
    // Sheet name: worker name (max 31 chars for Excel)
    const sheetName = worker.workerName.slice(0, 31).replace(/[\\/*?[\]:]/g, "_");
    const ws = workbook.addWorksheet(sheetName, {
      pageSetup: {
        paperSize: 9,
        orientation: "portrait",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        margins: {
          left: 0.4, right: 0.4,
          top: 0.4, bottom: 0.4,
          header: 0.2, footer: 0.2,
        },
      },
    });

    applyStundenzettelSheet(
      ws,
      worker.workerName,
      worker.records,
      projectName,
      projectClient,
      projectLocation,
      calendarWeek,
      year,
      logoImageId,
    );
  }

  // Generate and download
  const safeProjectName = projectName.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
  const filename = `${safeProjectName}_KW${calendarWeek}_${year}.xlsx`;

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
