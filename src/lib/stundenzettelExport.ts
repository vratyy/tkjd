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

interface StundenzettelParams {
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
  const { records, projectName, projectClient, projectLocation, workerName, calendarWeek, year } = params;

  const { start, end } = getWeekDateRange(calendarWeek, year);

  // -----------------------------
  // HEADER FIELDS
  // -----------------------------

  ws.getCell("D12").value = projectClient || projectName;
  ws.getCell("D13").value = workerName;
  ws.getCell("D14").value = projectLocation || projectName;

  ws.getCell("D15").value =
    `KW ${calendarWeek} / ${year} (${format(start, "dd.MM.yyyy")} - ${format(end, "dd.MM.yyyy")})`;

  // -----------------------------
  // MAP RECORDS BY GERMAN DAY
  // -----------------------------

  const recordsByDay = new Map<string, StundenzettelRecord>();

  records.forEach((record) => {
    const recordDate = new Date(record.date);
    const germanDay = format(recordDate, "EEEE", { locale: de });
    const normalized = germanDay.charAt(0).toUpperCase() + germanDay.slice(1);

    recordsByDay.set(normalized, record);
  });

  // -----------------------------
  // TABLE (ROWS 18–23)
  // -----------------------------

  const germanDays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

  const dataStartRow = 18;
  let totalHours = 0;

  germanDays.forEach((day, index) => {
    const rowNum = dataStartRow + index;
    const record = recordsByDay.get(day);

    const hours = record ? Number(record.total_hours) || 0 : 0;
    totalHours += hours;

    // Column A – Tag (only write if template doesn't already contain it)
    const dayCell = ws.getCell(`A${rowNum}`);
    if (!dayCell.value) {
      dayCell.value = day;
    }

    // Column B – Beginn
    ws.getCell(`B${rowNum}`).value = record ? formatTime(record.time_from) : "";

    // Column C – Pause von
    ws.getCell(`C${rowNum}`).value = record?.break_start ? formatTime(record.break_start) : "";

    // Column D – Pause bis
    ws.getCell(`D${rowNum}`).value = record?.break_end ? formatTime(record.break_end) : "";

    // Column E – Ende
    ws.getCell(`E${rowNum}`).value = record ? formatTime(record.time_to) : "";

    // Column F – Summe Stunden
    ws.getCell(`F${rowNum}`).value = hours > 0 ? hours : "";
  });

  // -----------------------------
  // TOTAL ROW (ROW 24)
  // -----------------------------

  ws.getCell("F24").value = totalHours;
}

/** Single sheet export — loads template, injects data, downloads */
export async function exportStundenzettelToExcel(params: StundenzettelParams): Promise<void> {
  const templateBuffer = await loadTemplate();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);

  const ws = workbook.getWorksheet(1);
  if (!ws) throw new Error("Template worksheet not found");

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
