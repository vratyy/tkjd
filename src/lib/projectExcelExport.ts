import ExcelJS from "exceljs";
import { format, addDays } from "date-fns";
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

// Slovak day abbreviations
const dayAbbreviations: Record<number, string> = {
  1: "Po", 2: "Ut", 3: "St", 4: "Št", 5: "Pi", 6: "So", 0: "Ne",
};

function getWeekDateRange(week: number, year: number): { start: Date; end: Date } {
  const firstDayOfYear = new Date(year, 0, 1);
  const dayOfWeek = firstDayOfYear.getDay();
  const daysToMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  const firstMonday = addDays(firstDayOfYear, daysToMonday);
  const start = addDays(firstMonday, (week - 1) * 7);
  const end = addDays(start, 6);
  return { start, end };
}

function formatBreakRange(start: string | null, end: string | null): string {
  if (!start || !end) return "";
  return `${start.slice(0, 5)}-${end.slice(0, 5)}`;
}

// Colors
const BLACK_COLOR = { argb: "FF000000" };
const WHITE_COLOR = { argb: "FFFFFFFF" };
const HEADER_BG = { argb: "FFE8E8E8" };
const ACCENT_COLOR = { argb: "FF1A56DB" };

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

function applyLeistungsnachweisSheet(
  ws: ExcelJS.Worksheet,
  workerName: string,
  records: ProjectExportRecord[],
  projectName: string,
  projectClient: string,
  projectLocation: string | null | undefined,
  projectAddress: string | null | undefined,
  calendarWeek: number,
  year: number,
  logoImageId: number | null,
) {
  const { start, end } = getWeekDateRange(calendarWeek, year);

  // ============ COLUMN WIDTHS (8 columns) ============
  ws.columns = [
    { key: "A", width: 14 },  // Dátum
    { key: "B", width: 6 },   // Deň
    { key: "C", width: 10 },  // Začiatok
    { key: "D", width: 10 },  // Koniec
    { key: "E", width: 14 },  // 1. Prestávka
    { key: "F", width: 14 },  // 2. Prestávka
    { key: "G", width: 10 },  // Spolu Hod.
    { key: "H", width: 42 },  // Popis práce
  ];

  // ============ ROW 1: Company + KW ============
  ws.mergeCells("A1:D1");
  const companyCell = ws.getCell("A1");
  companyCell.value = "TKJD s.r.o.";
  companyCell.font = { bold: true, size: 16 };
  companyCell.alignment = { horizontal: "left", vertical: "middle" };

  ws.mergeCells("F1:H1");
  const kwCell = ws.getCell("F1");
  kwCell.value = `KW ${calendarWeek} / ${year}`;
  kwCell.font = { bold: true, size: 14, color: ACCENT_COLOR };
  kwCell.alignment = { horizontal: "right", vertical: "middle" };
  ws.getRow(1).height = 26;

  // ============ ROW 2: Title + Date Range ============
  ws.mergeCells("A2:D2");
  const titleCell = ws.getCell("A2");
  titleCell.value = "LEISTUNGSNACHWEIS / VÝKAZ VÝKONU";
  titleCell.font = { bold: true, size: 11 };
  titleCell.alignment = { horizontal: "left", vertical: "middle" };

  ws.mergeCells("F2:H2");
  const dateRangeCell = ws.getCell("F2");
  dateRangeCell.value = `${format(start, "dd.MM.yyyy")} – ${format(end, "dd.MM.yyyy")}`;
  dateRangeCell.font = { size: 10 };
  dateRangeCell.alignment = { horizontal: "right", vertical: "middle" };
  ws.getRow(2).height = 20;

  // ============ ROW 3: Spacer ============
  ws.getRow(3).height = 8;

  // ============ ROW 4: Project Name ============
  ws.getCell("A4").value = "Projekt:";
  ws.getCell("A4").font = { size: 10 };
  ws.getCell("A4").alignment = { horizontal: "left", vertical: "middle" };
  ws.mergeCells("B4:E4");
  ws.getCell("B4").value = projectName;
  ws.getCell("B4").font = { bold: true, size: 10 };
  ws.getCell("B4").alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(4).height = 18;

  // ============ ROW 5: Address ============
  ws.getCell("A5").value = "Adresa:";
  ws.getCell("A5").font = { size: 10 };
  ws.getCell("A5").alignment = { horizontal: "left", vertical: "middle" };
  ws.mergeCells("B5:E5");
  ws.getCell("B5").value = projectAddress || projectLocation || "";
  ws.getCell("B5").font = { size: 10 };
  ws.getCell("B5").alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(5).height = 18;

  // ============ ROW 6: Worker Name ============
  ws.getCell("A6").value = "Pracovník:";
  ws.getCell("A6").font = { size: 10 };
  ws.getCell("A6").alignment = { horizontal: "left", vertical: "middle" };
  ws.mergeCells("B6:E6");
  ws.getCell("B6").value = workerName;
  ws.getCell("B6").font = { bold: true, size: 11 };
  ws.getCell("B6").alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(6).height = 20;

  // ============ ROW 7: Spacer ============
  ws.getRow(7).height = 6;

  // ============ ROW 8: Table Headers ============
  const headerRow = ws.getRow(8);
  headerRow.height = 30;

  const headers = [
    "Dátum",
    "Deň",
    "Začiatok",
    "Koniec",
    "1. Prestávka",
    "2. Prestávka",
    "Spolu Hod.",
    "Popis práce",
  ];

  headers.forEach((text, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = text;
    cell.font = { bold: true, size: 9 };
    cell.alignment = {
      horizontal: index === 7 ? "left" : "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: HEADER_BG };
    cell.border = thinBorder;
  });

  // ============ DATA ROWS ============
  const sortedRecords = [...records].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let currentRow = 9;
  let totalHours = 0;

  sortedRecords.forEach((record) => {
    const recordDate = new Date(record.date + "T12:00:00");
    const dayIdx = recordDate.getDay();
    const dayAbbr = dayAbbreviations[dayIdx] || "?";
    const formattedDate = format(recordDate, "dd.MM.yyyy");
    const hours = Number(record.total_hours) || 0;
    totalHours += hours;

    const row = ws.getRow(currentRow);
    row.height = 20;

    // Col A: Dátum
    const dateCell = row.getCell(1);
    dateCell.value = formattedDate;
    dateCell.font = { size: 10 };
    dateCell.alignment = { horizontal: "center", vertical: "middle" };
    dateCell.border = thinBorder;

    // Col B: Deň
    const dayCell = row.getCell(2);
    dayCell.value = dayAbbr;
    dayCell.font = { size: 10 };
    dayCell.alignment = { horizontal: "center", vertical: "middle" };
    dayCell.border = thinBorder;

    // Col C: Začiatok
    const startCell = row.getCell(3);
    startCell.value = record.time_from?.slice(0, 5) ?? "";
    startCell.font = { size: 10 };
    startCell.alignment = { horizontal: "center", vertical: "middle" };
    startCell.border = thinBorder;

    // Col D: Koniec
    const endCell = row.getCell(4);
    endCell.value = record.time_to?.slice(0, 5) ?? "";
    endCell.font = { size: 10 };
    endCell.alignment = { horizontal: "center", vertical: "middle" };
    endCell.border = thinBorder;

    // Col E: 1. Prestávka
    const break1Cell = row.getCell(5);
    break1Cell.value = formatBreakRange(record.break_start, record.break_end);
    break1Cell.font = { size: 10 };
    break1Cell.alignment = { horizontal: "center", vertical: "middle" };
    break1Cell.border = thinBorder;

    // Col F: 2. Prestávka
    const break2Cell = row.getCell(6);
    break2Cell.value = formatBreakRange(record.break2_start, record.break2_end);
    break2Cell.font = { size: 10 };
    break2Cell.alignment = { horizontal: "center", vertical: "middle" };
    break2Cell.border = thinBorder;

    // Col G: Spolu Hod.
    const hoursCell = row.getCell(7);
    hoursCell.value = hours > 0 ? hours.toFixed(2) : "";
    hoursCell.font = { bold: true, size: 10 };
    hoursCell.alignment = { horizontal: "center", vertical: "middle" };
    hoursCell.border = thinBorder;

    // Col H: Popis práce
    const noteCell = row.getCell(8);
    noteCell.value = record.note || "";
    noteCell.font = { size: 9 };
    noteCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    noteCell.border = thinBorder;

    currentRow++;
  });

  // ============ TOTAL ROW ============
  const totalRowNum = currentRow;
  const totalRow = ws.getRow(totalRowNum);
  totalRow.height = 24;

  ws.mergeCells(`A${totalRowNum}:F${totalRowNum}`);
  const totalLabelCell = ws.getCell(`A${totalRowNum}`);
  totalLabelCell.value = "SPOLU / GESAMT:";
  totalLabelCell.font = { bold: true, size: 11 };
  totalLabelCell.alignment = { horizontal: "right", vertical: "middle" };
  totalLabelCell.border = thinBorder;

  const totalSumCell = ws.getCell(`G${totalRowNum}`);
  totalSumCell.value = totalHours.toFixed(2) + " h";
  totalSumCell.font = { bold: true, size: 11, color: WHITE_COLOR };
  totalSumCell.alignment = { horizontal: "center", vertical: "middle" };
  totalSumCell.fill = { type: "pattern", pattern: "solid", fgColor: BLACK_COLOR };
  totalSumCell.border = thinBorder;

  const totalNoteCell = ws.getCell(`H${totalRowNum}`);
  totalNoteCell.value = "";
  totalNoteCell.border = thinBorder;

  currentRow += 3;

  // ============ SIGNATURE SECTION ============
  ws.mergeCells(`A${currentRow}:D${currentRow}`);
  ws.getCell(`A${currentRow}`).value = "Podpis montéra / Unterschrift Monteur:";
  ws.getCell(`A${currentRow}`).font = { size: 10 };
  ws.getCell(`A${currentRow}`).alignment = { horizontal: "left", vertical: "bottom" };

  ws.mergeCells(`F${currentRow}:H${currentRow}`);
  ws.getCell(`F${currentRow}`).value = "Podpis stavbyvedúceho / Bauleiter:";
  ws.getCell(`F${currentRow}`).font = { size: 10 };
  ws.getCell(`F${currentRow}`).alignment = { horizontal: "left", vertical: "bottom" };

  currentRow += 3;

  ws.mergeCells(`A${currentRow}:D${currentRow}`);
  ws.getCell(`A${currentRow}`).value = "_________________________________";
  ws.getCell(`A${currentRow}`).alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells(`F${currentRow}:H${currentRow}`);
  ws.getCell(`F${currentRow}`).value = "_________________________________";
  ws.getCell(`F${currentRow}`).alignment = { horizontal: "center", vertical: "middle" };

  currentRow++;

  ws.mergeCells(`A${currentRow}:D${currentRow}`);
  ws.getCell(`A${currentRow}`).value = "Dátum / Datum: _______________";
  ws.getCell(`A${currentRow}`).font = { italic: true, size: 9 };
  ws.getCell(`A${currentRow}`).alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells(`F${currentRow}:H${currentRow}`);
  ws.getCell(`F${currentRow}`).value = "Dátum / Datum: _______________";
  ws.getCell(`F${currentRow}`).font = { italic: true, size: 9 };
  ws.getCell(`F${currentRow}`).alignment = { horizontal: "center", vertical: "middle" };

  // ============ LOGO ============
  if (logoImageId !== null) {
    ws.addImage(logoImageId, {
      tl: { col: 6.5, row: 0 },
      ext: { width: 80, height: 80 },
    });
  }
}

/**
 * Export a consolidated Excel file with one Leistungsnachweis tab per worker
 * for a specific project and calendar week.
 */
export async function exportProjectConsolidatedExcel(params: ProjectExportParams): Promise<void> {
  const { projectName, projectClient, projectLocation, projectAddress, calendarWeek, year, workers } = params;

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
    const sheetName = worker.workerName.slice(0, 31).replace(/[\\/*?[\]:]/g, "_");
    const ws = workbook.addWorksheet(sheetName, {
      pageSetup: {
        paperSize: 9,
        orientation: "portrait",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.25, right: 0.25,
          top: 0.4, bottom: 0.4,
          header: 0.2, footer: 0.2,
        },
      },
    });

    applyLeistungsnachweisSheet(
      ws,
      worker.workerName,
      worker.records,
      projectName,
      projectClient,
      projectLocation,
      projectAddress,
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
