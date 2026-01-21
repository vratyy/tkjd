import jsPDF from "jspdf";

/**
 * PDF Font Manager - Robust Fallback Strategy
 * 
 * Uses Helvetica as primary font with ASCII-safe text conversion for Slovak diacritics.
 * This approach eliminates the Unicode.widths crash entirely.
 */

// Slovak diacritics to ASCII mapping
const DIACRITICS_MAP: Record<string, string> = {
  "á": "a", "ä": "a", "č": "c", "ď": "d", "é": "e", "í": "i", "ĺ": "l", "ľ": "l",
  "ň": "n", "ó": "o", "ô": "o", "ŕ": "r", "š": "s", "ť": "t", "ú": "u", "ý": "y", "ž": "z",
  "Á": "A", "Ä": "A", "Č": "C", "Ď": "D", "É": "E", "Í": "I", "Ĺ": "L", "Ľ": "L",
  "Ň": "N", "Ó": "O", "Ô": "O", "Ŕ": "R", "Š": "S", "Ť": "T", "Ú": "U", "Ý": "Y", "Ž": "Z",
  // German
  "ß": "ss", "ü": "u", "ö": "o", "Ü": "U", "Ö": "O",
  // Common symbols
  "€": "EUR", "–": "-", "—": "-",
};

/**
 * Convert text to ASCII-safe version for Helvetica rendering
 */
export function safeText(text: string | null | undefined): string {
  if (!text) return "";
  
  let result = "";
  for (const char of text) {
    result += DIACRITICS_MAP[char] || char;
  }
  
  // Remove any remaining non-ASCII characters that could crash the PDF
  return result.replace(/[^\x00-\x7F]/g, "");
}

/**
 * Initialize PDF fonts - no-op in this robust implementation
 */
export async function initializePdfFonts(): Promise<boolean> {
  // Using Helvetica - no initialization needed
  return true;
}

/**
 * Register fonts and set up the document
 * Returns true (always uses Helvetica which is built-in)
 */
export function registerPdfFonts(doc: jsPDF): boolean {
  try {
    doc.setFont("helvetica", "normal");
    return true;
  } catch (e) {
    console.warn("[PDF] Font setup failed:", e);
    return false;
  }
}

/**
 * Set font style (bold/normal)
 */
export function setFontStyle(doc: jsPDF, style: "normal" | "bold"): void {
  try {
    doc.setFont("helvetica", style);
  } catch {
    // Ignore font errors
  }
}

/**
 * Get the font family name for autoTable
 */
export function getPdfFontFamily(): string {
  return "helvetica";
}

/**
 * Check if custom Unicode font is available (always false in this implementation)
 */
export function hasCustomFont(): boolean {
  return false;
}
