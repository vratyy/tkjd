import jsPDF from "jspdf";

// Font loading state
let fontLoadAttempted = false;
let fontLoadSuccess = false;

/**
 * Attempts to load custom fonts for PDF generation.
 * Falls back to Helvetica if fonts fail to load.
 */
export async function initializePdfFonts(): Promise<boolean> {
  if (fontLoadAttempted) {
    return fontLoadSuccess;
  }

  fontLoadAttempted = true;

  try {
    // Try to fetch Roboto from a CDN that serves actual TTF files
    const ttfUrl = "https://cdn.jsdelivr.net/fontsource/fonts/roboto@latest/latin-ext-400-normal.ttf";
    
    const response = await fetch(ttfUrl, { 
      mode: 'cors',
      cache: 'force-cache' 
    });
    
    if (!response.ok) {
      throw new Error(`Font fetch failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);
    
    // Validate base64 string
    if (!base64 || base64.length < 1000) {
      throw new Error("Font data appears invalid");
    }

    // Store for later use
    (window as any).__pdfFontBase64 = base64;
    fontLoadSuccess = true;
    
    console.log("PDF fonts loaded successfully");
    return true;
  } catch (error) {
    console.warn("Custom PDF fonts unavailable, using Helvetica fallback:", error);
    fontLoadSuccess = false;
    return false;
  }
}

/**
 * Convert ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Register fonts with a jsPDF document instance.
 * Must be called before any text is written.
 */
export function registerPdfFonts(doc: jsPDF): boolean {
  const fontBase64 = (window as any).__pdfFontBase64;

  if (!fontBase64) {
    // No custom font available, use default Helvetica
    return false;
  }

  try {
    // Add font to virtual file system
    doc.addFileToVFS("CustomFont.ttf", fontBase64);
    
    // Register the font with jsPDF
    doc.addFont("CustomFont.ttf", "CustomFont", "normal");
    
    // Set as the active font
    doc.setFont("CustomFont", "normal");
    
    return true;
  } catch (error) {
    console.warn("Failed to register custom font, using Helvetica:", error);
    // Ensure we fall back to a working font
    doc.setFont("helvetica", "normal");
    return false;
  }
}

/**
 * Safely set font style with fallback to Helvetica.
 * Use this throughout the PDF generation instead of doc.setFont directly.
 */
export function setFontStyle(doc: jsPDF, style: "normal" | "bold"): void {
  try {
    const hasCustomFont = (window as any).__pdfFontBase64;
    
    if (hasCustomFont) {
      // For custom font, we only have normal weight (bold simulation not available)
      doc.setFont("CustomFont", "normal");
    } else {
      // Use Helvetica with proper weight
      doc.setFont("helvetica", style === "bold" ? "bold" : "normal");
    }
  } catch (error) {
    // Ultimate fallback
    try {
      doc.setFont("helvetica", "normal");
    } catch {
      // Font system completely broken, nothing we can do
    }
  }
}

/**
 * Get the font family name to use in autoTable config
 */
export function getPdfFontFamily(): string {
  const hasCustomFont = (window as any).__pdfFontBase64;
  return hasCustomFont ? "CustomFont" : "helvetica";
}
