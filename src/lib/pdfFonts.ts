import jsPDF from "jspdf";

/**
 * PDF Font Manager
 * Handles font loading with graceful fallback to Helvetica
 */

let fontLoaded = false;
let fontBase64: string | null = null;

/**
 * Initialize PDF fonts - attempts to load a Unicode-compatible font
 * Falls back to Helvetica if loading fails
 */
export async function initializePdfFonts(): Promise<boolean> {
  if (fontLoaded && fontBase64) {
    return true;
  }

  try {
    // Use Noto Sans which has excellent Unicode support including Slovak
    const fontUrl = "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@5.0.0/files/noto-sans-latin-ext-400-normal.woff";
    
    const response = await fetch(fontUrl, { 
      cache: 'force-cache',
      mode: 'cors'
    });
    
    if (!response.ok) {
      console.warn("Font fetch failed, using Helvetica fallback");
      return false;
    }

    const arrayBuffer = await response.arrayBuffer();
    
    // Convert to base64
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    fontBase64 = btoa(binary);
    
    if (fontBase64.length < 500) {
      console.warn("Font data too small, using Helvetica fallback");
      fontBase64 = null;
      return false;
    }

    fontLoaded = true;
    return true;
  } catch (error) {
    console.warn("Font loading failed, using Helvetica fallback:", error);
    fontBase64 = null;
    return false;
  }
}

/**
 * Register custom font with jsPDF document
 * Must be called after creating the doc and before writing any text
 */
export function registerPdfFonts(doc: jsPDF): boolean {
  if (!fontBase64) {
    // Use default Helvetica
    doc.setFont("helvetica", "normal");
    return false;
  }

  try {
    doc.addFileToVFS("NotoSans.ttf", fontBase64);
    doc.addFont("NotoSans.ttf", "NotoSans", "normal");
    doc.setFont("NotoSans", "normal");
    return true;
  } catch (error) {
    console.warn("Font registration failed:", error);
    doc.setFont("helvetica", "normal");
    return false;
  }
}

/**
 * Safely set font style - handles both custom font and Helvetica fallback
 */
export function setFontStyle(doc: jsPDF, style: "normal" | "bold"): void {
  try {
    if (fontBase64) {
      // Custom font doesn't have bold variant, simulate with normal
      doc.setFont("NotoSans", "normal");
    } else {
      doc.setFont("helvetica", style === "bold" ? "bold" : "normal");
    }
  } catch {
    doc.setFont("helvetica", "normal");
  }
}

/**
 * Get font family for autoTable configuration
 */
export function getPdfFontFamily(): string {
  return fontBase64 ? "NotoSans" : "helvetica";
}

/**
 * Check if custom font is available
 */
export function hasCustomFont(): boolean {
  return fontLoaded && fontBase64 !== null;
}
