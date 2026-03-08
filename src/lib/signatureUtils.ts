import { supabase } from "@/integrations/supabase/client";

/**
 * Check if a signature URL is a file path (not a full URL)
 * File paths are stored as "{user_id}/signature.png"
 */
export function isSignaturePath(signatureUrl: string | null): boolean {
  if (!signatureUrl) return false;
  // If it's a full URL (http/https), it's the old format
  return !signatureUrl.startsWith("http");
}

/**
 * Generate a signed URL for a signature file path
 * Returns the signed URL or null if generation fails
 */
export async function getSignedSignatureUrl(
  signaturePath: string | null,
  expiresIn: number = 3600 // 1 hour default
): Promise<string | null> {
  if (!signaturePath) return null;

  // If it's already a full URL (legacy data), return as-is
  // Note: This will fail for old public URLs once bucket is private
  if (signaturePath.startsWith("http")) {
    // Try to extract the path from the old public URL
    const match = signaturePath.match(/\/signatures\/(.+)$/);
    if (match) {
      const extractedPath = match[1];
      const { data } = await supabase.storage
        .from("signatures")
        .createSignedUrl(extractedPath, expiresIn);
      return data?.signedUrl || null;
    }
    return null;
  }

  // Generate signed URL for the path
  const { data, error } = await supabase.storage
    .from("signatures")
    .createSignedUrl(signaturePath, expiresIn);

  if (error) {
    console.error("Error generating signed signature URL:", error);
    return null;
  }

  return data?.signedUrl || null;
}

/**
 * Fetch a signature image and return it as a base64 string (without data URI prefix).
 * Returns null if the signature doesn't exist or can't be fetched.
 */
export async function getSignatureBase64(signaturePath: string | null): Promise<string | null> {
  if (!signaturePath) return null;

  try {
    const signedUrl = await getSignedSignatureUrl(signaturePath);
    if (!signedUrl) return null;

    const response = await fetch(signedUrl);
    if (!response.ok) return null;

    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Strip data URI prefix to get raw base64
        const base64 = result.split(",")[1] || null;
        resolve(base64);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("Could not fetch signature as base64:", e);
    return null;
  }
}

/**
 * Generate signed URLs for multiple signature paths
 */
export async function getSignedSignatureUrls(
  signaturePaths: (string | null)[],
  expiresIn: number = 3600
): Promise<(string | null)[]> {
  return Promise.all(
    signaturePaths.map((path) => getSignedSignatureUrl(path, expiresIn))
  );
}
