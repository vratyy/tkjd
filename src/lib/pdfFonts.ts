import jsPDF from "jspdf";

// URL to Google Fonts Roboto with full Latin Extended support
const ROBOTO_REGULAR_URL = "https://fonts.gstatic.com/s/roboto/v47/KFO7CnqEu92Fr1ME7WxP.ttf";
const ROBOTO_BOLD_URL = "https://fonts.gstatic.com/s/roboto/v47/KFO5CnqEu92Fr1Mu53ZEC9_Vu3r1gw.ttf";

let fontsLoaded = false;
let fontsLoadPromise: Promise<void> | null = null;

async function fetchFontAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Extract base64 part from data URL
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function loadRobotoFonts(): Promise<void> {
  if (fontsLoaded) return;
  
  if (fontsLoadPromise) {
    return fontsLoadPromise;
  }

  fontsLoadPromise = (async () => {
    try {
      const [regularBase64, boldBase64] = await Promise.all([
        fetchFontAsBase64(ROBOTO_REGULAR_URL),
        fetchFontAsBase64(ROBOTO_BOLD_URL),
      ]);

      // Store in global for reuse
      (window as any).__robotoRegularBase64 = regularBase64;
      (window as any).__robotoBoldBase64 = boldBase64;
      
      fontsLoaded = true;
    } catch (error) {
      console.error("Failed to load Roboto fonts:", error);
      throw error;
    }
  })();

  return fontsLoadPromise;
}

export function registerRobotoFonts(doc: jsPDF): void {
  const regularBase64 = (window as any).__robotoRegularBase64;
  const boldBase64 = (window as any).__robotoBoldBase64;

  if (!regularBase64 || !boldBase64) {
    console.warn("Roboto fonts not loaded, using default fonts");
    return;
  }

  // Register regular font
  doc.addFileToVFS("Roboto-Regular.ttf", regularBase64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");

  // Register bold font
  doc.addFileToVFS("Roboto-Bold.ttf", boldBase64);
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");

  // Set Roboto as default font
  doc.setFont("Roboto", "normal");
}

export function setFontStyle(doc: jsPDF, style: "normal" | "bold"): void {
  const hasRoboto = (window as any).__robotoRegularBase64;
  
  if (hasRoboto) {
    doc.setFont("Roboto", style);
  } else {
    doc.setFont("helvetica", style === "bold" ? "bold" : "normal");
  }
}
