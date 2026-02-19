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

const TEMPLATE_URL = "/template_stundenzettel.xlsx";

const germanDays = ["Montag", "Dienstag", "Mitwoch", "Donnerstag", "Freitag", "Samstag"];

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
  const response = await fetch(TEMPLATE_URL);
  if (!response.ok) throw new Error("Failed to load Stundenzettel template");
  return response.arrayBuffer();
}

/** Inject data into a template worksheet */
function fillTemplateSheet(
  ws: ExcelJS.Worksheet,
  params: StundenzettelParams,
) {
  const { records, projectName, projectClient, projectLocation, workerName, calendarWeek, year } = params;
  const { start, end } = getWeekDateRange(calendarWeek, year);

  // Row 12 col D: Client / Auftraggeber
  ws.getCell("D12").value = projectClient || projectName;

  // Row 13 col D: Worker name
  ws.getCell("D13").value = workerName;

  // Row 14 col D: Location
  ws.getCell("D14").value = projectLocation || projectName;

  // Row 15 col D: Period
  ws.getCell("D15").value = `${calendarWeek} Woche (${format(start, "dd.MM.yyyy")} - ${format(end, "dd.MM.yyyy")})`;

  // Map records by German day name
  const recordsByDay = new Map<string, StundenzettelRecord>();
  records.forEach(record => {
    const recordDate = new Date(record.date);
    const dayName = format(recordDate, "EEEE", { locale: de });
    const normalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    recordsByDay.set(normalizedDay, record);
  });

  // Rows 18-23: Monday to Saturday data
  let totalHours = 0;
  const dataStartRow = 18;

  germanDays.forEach((day, index) => {
    const rowNum = dataStartRow + index;
    const record = recordsByDay.get(day);
    const hours = record ? (Number(record.total_hours) || 0) : 0;
    totalHours += hours;

    // B: Beginn
    ws.getCell(`B${rowNum}`).value = record ? formatTime(record.time_from) : "";

    // C: Pause Von (combined if two breaks)
    const pauseVonParts = [
      record?.break_start ? formatTime(record.break_start) : "",
      record?.break2_start ? formatTime(record.break2_start) : "",
    ].filter(Boolean);
    ws.getCell(`C${rowNum}`).value = pauseVonParts.join(" / ");

    // D: Pause Bis
    const pauseBisParts = [
      record?.break_end ? formatTime(record.break_end) : "",
      record?.break2_end ? formatTime(record.break2_end) : "",
    ].filter(Boolean);
    ws.getCell(`D${rowNum}`).value = pauseBisParts.join(" / ");

    // E: Ende
    ws.getCell(`E${rowNum}`).value = record ? formatTime(record.time_to) : "";

    // F: Summe
    ws.getCell(`F${rowNum}`).value = hours > 0 ? hours : "";
  });

  // Row 24: Total hours
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
export async function exportMultipleStundenzettelsToExcel(
  sheets: Array<StundenzettelParams>
): Promise<void> {
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
        try { ws.mergeCells(merge); } catch { /* already merged */ }
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
