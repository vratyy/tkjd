import jsPDF from "jspdf";
import interRegularUrl from "@/assets/fonts/Inter-Regular.ttf?url";
import interBoldUrl from "@/assets/fonts/Inter-Bold.ttf?url";

/**
 * PDF Font Manager (robust)
 * - Uses local TTF assets (latin-ext) to avoid CDN/WOFF parsing issues.
 * - Registers fonts with Identity-H to ensure Unicode widths are initialized.
 * - Provides safe fallback to Helvetica.
 */

let loaded = false;
let base64Regular: string | null = null;
let base64Bold: string | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function fetchTtfBase64(url: string): Promise<string> {
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  return arrayBufferToBase64(buf);
}

export async function initializePdfFonts(): Promise<boolean> {
  if (loaded) return Boolean(base64Regular && base64Bold);
  loaded = true;

  try {
    const [reg, bold] = await Promise.all([
      fetchTtfBase64(interRegularUrl),
      fetchTtfBase64(interBoldUrl),
    ]);
    base64Regular = reg;
    base64Bold = bold;
    return true;
  } catch (e) {
    console.warn("[PDF] Unicode font load failed, using Helvetica.", e);
    base64Regular = null;
    base64Bold = null;
    return false;
  }
}

/**
 * Register fonts BEFORE any doc.text() / autoTable() calls.
 * Returns true if Unicode font is active.
 */
export function registerPdfFonts(doc: jsPDF): boolean {
  try {
    if (!base64Regular || !base64Bold) {
      doc.setFont("helvetica", "normal");
      return false;
    }

    doc.addFileToVFS("Inter-Regular.ttf", base64Regular);
    doc.addFileToVFS("Inter-Bold.ttf", base64Bold);
    // IMPORTANT: Identity-H ensures Unicode metadata is initialized
    doc.addFont("Inter-Regular.ttf", "Inter", "normal", "Identity-H");
    doc.addFont("Inter-Bold.ttf", "Inter", "bold", "Identity-H");
    doc.setFont("Inter", "normal");

    // Validate immediately (this is where the Unicode.widths crash used to happen)
    doc.getTextWidth("ľščťžáéíú Žalobín");

    return true;
  } catch (e) {
    console.warn("[PDF] Unicode font registration/validation failed, using Helvetica.", e);
    try {
      doc.setFont("helvetica", "normal");
    } catch {
      // ignore
    }
    return false;
  }
}

export function setFontStyle(doc: jsPDF, style: "normal" | "bold"): void {
  try {
    if (base64Regular && base64Bold) {
      doc.setFont("Inter", style);
    } else {
      doc.setFont("helvetica", style === "bold" ? "bold" : "normal");
    }
  } catch {
    try {
      doc.setFont("helvetica", "normal");
    } catch {
      // ignore
    }
  }
}

export function getPdfFontFamily(): string {
  return base64Regular && base64Bold ? "Inter" : "helvetica";
}

export function hasCustomFont(): boolean {
  return Boolean(base64Regular && base64Bold);
}
