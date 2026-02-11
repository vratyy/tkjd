import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch the company signature as base64 for PDF embedding.
 * Returns null if no signature is configured.
 */
export async function getCompanySignatureBase64(): Promise<string | null> {
  try {
    // Get the stored path
    const { data: setting } = await supabase
      .from("company_settings")
      .select("value")
      .eq("key", "company_signature_path")
      .maybeSingle();

    if (!setting?.value) return null;

    // Download the file
    const { data: fileData, error } = await supabase.storage
      .from("company-assets")
      .download(setting.value);

    if (error || !fileData) {
      console.warn("Could not download company signature:", error);
      return null;
    }

    // Convert to base64
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64.split(",")[1]);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(fileData);
    });
  } catch (err) {
    console.warn("Error fetching company signature:", err);
    return null;
  }
}
