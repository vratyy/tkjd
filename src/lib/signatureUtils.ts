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
