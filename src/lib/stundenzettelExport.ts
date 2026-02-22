import ExcelJS from "exceljs";
import { format, addDays } from "date-fns";
import { de } from "date-fns/locale";

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
  activity_description?: string | null;
}

export interface StundenzettelParams {
  records: StundenzettelRecord[];
  projectName: string;
  projectClient: string;
  projectLocation?: string | null;
  workerName: string;
  calendarWeek: number;
  year: number;
  companySignatureBase64?: string | null;
  employeeAddress?: string | null;
  employeeBirthdate?: string | null;
  companyName?: string | null;
  companyAddress?: string | null;
  projectAddress?: string | null;
}

const TEMPLATE_URL = "/template_stundenzettel_v2.xlsx";

/** Template has 6 physical day rows (Mon–Sat). Sunday data is accepted but not rendered. */
const germanDays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

function getWeekDateRange(week: number, year: number): { start: Date; end: Date } {
  const firstDayOfYear = new Date(year, 0, 1);
  const dayOfWeek = firstDayOfYear.getDay();
  const daysToMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  const firstMonday = addDays(firstDayOfYear, daysToMonday);
  const start = addDays(firstMonday, (week - 1) * 7);
  const end = addDays(start, 4);
  return { start, end };
}

function formatTime(time: string | null | undefined): string {
  if (!time) return "";
  return time.slice(0, 5);
}

/** Load the template workbook from public folder */
async function loadTemplate(): Promise<ArrayBuffer> {
  console.log("INITIATING TEMPLATE DOWNLOAD: Fetching /template_stundenzettel_v2.xlsx");
  const response = await fetch(TEMPLATE_URL + "?v=" + Date.now());
  if (!response.ok) throw new Error("Šablóna template_stundenzettel_v2.xlsx sa nenašla v priečinku public.");
  return response.arrayBuffer();
}

/** Inject data into a template worksheet */
function fillTemplateSheet(ws: ExcelJS.Worksheet, params: StundenzettelParams) {
  const { records, projectClient, projectLocation, workerName, calendarWeek, year } = params;

  const { start, end } = getWeekDateRange(calendarWeek, year);

  // =========================
  // HEADER (NEW TEMPLATE)
  // =========================

  // Client
  ws.getCell("E12").value = projectClient || "";

  // Worker
  ws.getCell("E13").value = workerName || "";

  // Location
  ws.getCell("E14").value = projectLocation || "";

  // Period
  ws.getCell("E15").value = `${format(start, "dd.MM.yyyy")} - ${format(end, "dd.MM.yyyy")}`;

  // =========================
  // MAP RECORDS BY DAY
  // =========================

  const recordsByDay = new Map<string, StundenzettelRecord>();

  records.forEach((record) => {
    const dateObj = new Date(record.date);
    const germanDay = format(dateObj, "EEEE", { locale: de });
    const normalized = germanDay.charAt(0).toUpperCase() + germanDay.slice(1);

    recordsByDay.set(normalized, record);
  });

  // =========================
  // TABLE STRUCTURE (B–G)
  // =========================
  // B = Day (already in template — DO NOT TOUCH)
  // C = Beginn
  // D = Pause von
  // E = Pause bis
  // F = Ende
  // G = Summe

  const germanDays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

  const startRow = 18;
  let totalHours = 0;

  germanDays.forEach((day, index) => {
    const row = startRow + index;
    const record = recordsByDay.get(day);

    const hours = record ? Number(record.total_hours) || 0 : 0;
    totalHours += hours;

    // NEVER WRITE COLUMN A OR B (template already has days)

    // Column C – Beginn
    ws.getCell(`C${row}`).value = record ? formatTime(record.time_from) : "";

    // Column D – Pause von
    ws.getCell(`D${row}`).value = record?.break_start ? formatTime(record.break_start) : "";

    // Column E – Pause bis
    ws.getCell(`E${row}`).value = record?.break_end ? formatTime(record.break_end) : "";

    // Column F – Ende
    ws.getCell(`F${row}`).value = record ? formatTime(record.time_to) : "";

    // Column G – Summe
    ws.getCell(`G${row}`).value = hours > 0 ? hours : "";
  });

  // =========================
  // TOTAL (ROW 24)
  // =========================

  ws.getCell("G24").value = totalHours;
}

function applyPageSetupFromTemplate(target: ExcelJS.Worksheet, source: ExcelJS.Worksheet) {
  target.pageSetup = {
    ...source.pageSetup,

    // enforce safe printing behavior
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0, // CRITICAL: prevent vertical compression
    orientation: "portrait",
    paperSize: 9, // A4
  };
}

/** Single sheet export — loads template, injects data, downloads */
export async function exportStundenzettelToExcel(params: StundenzettelParams): Promise<void> {
  const templateBuffer = await loadTemplate();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);

  const ws = workbook.worksheets[0];
  if (!ws) throw new Error("Template worksheet not found");

  applyPageSetupFromTemplate(ws, ws);

  fillTemplateSheet(ws, params);

  // Add company signature if available
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

  // Generate & download
  const safeProjectName = params.projectName.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
  const safeWorkerName = params.workerName.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
  const filename = `${params.calendarWeek}_Woche_Stundenzettel_${safeProjectName}_${safeWorkerName}.xlsx`;

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

/** Multi-sheet export for admin — one sheet per worker, all from template */
export async function exportMultipleStundenzettelsToExcel(sheets: Array<StundenzettelParams>): Promise<void> {
  const templateBuffer = await loadTemplate();

  // For multi-sheet: create a fresh workbook for output
  const outWorkbook = new ExcelJS.Workbook();
  outWorkbook.creator = "TKJD s.r.o.";
  outWorkbook.created = new Date();

  for (const params of sheets) {
    // Load a fresh template workbook for each sheet to clone from
    const tmpWorkbook = new ExcelJS.Workbook();
    await tmpWorkbook.xlsx.load(templateBuffer);
    const templateWs = tmpWorkbook.getWorksheet(1);
    if (!templateWs) continue;

    // Create sheet in output workbook
    const sheetName = `${params.workerName.slice(0, 20)}_KW${params.calendarWeek}`.slice(0, 31);
    const ws = outWorkbook.addWorksheet(sheetName);

    // Copy template structure: column widths
    templateWs.columns.forEach((col, i) => {
      if (ws.columns[i]) {
        ws.getColumn(i + 1).width = col.width;
      }
    });

    // Copy all rows with values, styles, merges
    templateWs.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const newRow = ws.getRow(rowNumber);
      newRow.height = row.height;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const newCell = newRow.getCell(colNumber);
        newCell.value = cell.value;
        newCell.style = { ...cell.style };
      });
    });

    // Copy merged cells
    // @ts-ignore - accessing internal merges
    const merges = templateWs.model?.merges;
    if (merges && Array.isArray(merges)) {
      merges.forEach((merge: string) => {
        try {
          ws.mergeCells(merge);
        } catch {
          /* already merged */
        }
      });
    }

    // Now inject data
    fillTemplateSheet(ws, params);
    applyPageSetupFromTemplate(ws, templateWs);

    // Add company signature if available
    if (params.companySignatureBase64) {
      try {
        const sigImgId = outWorkbook.addImage({
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
  }

  // Download
  const filename = `Stundenzettels_KW${sheets[0]?.calendarWeek || ""}_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  const buffer = await outWorkbook.xlsx.writeBuffer();
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
