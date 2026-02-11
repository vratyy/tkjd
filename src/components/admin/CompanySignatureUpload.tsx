import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Trash2, Stamp, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CompanySignatureUpload() {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [signaturePath, setSignaturePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCurrentSignature();
  }, []);

  const loadCurrentSignature = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("company_settings")
        .select("value")
        .eq("key", "company_signature_path")
        .maybeSingle();

      if (error) throw error;

      if (data?.value) {
        setSignaturePath(data.value);
        // Generate signed URL for preview
        const { data: urlData } = await supabase.storage
          .from("company-assets")
          .createSignedUrl(data.value, 3600);
        setSignatureUrl(urlData?.signedUrl || null);
      }
    } catch (error: any) {
      console.error("Error loading company signature:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "Chyba", description: "Nahrajte obrázok (PNG, JPG)." });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Chyba", description: "Maximálna veľkosť súboru je 2 MB." });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const filePath = `company-signature.${ext}`;

      // Delete old file if exists
      if (signaturePath) {
        await supabase.storage.from("company-assets").remove([signaturePath]);
      }

      // Upload new file
      const { error: uploadError } = await supabase.storage
        .from("company-assets")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Save path to settings
      const { error: settingsError } = await supabase
        .from("company_settings")
        .upsert(
          { key: "company_signature_path", value: filePath },
          { onConflict: "key" }
        );

      if (settingsError) throw settingsError;

      await loadCurrentSignature();
      toast({ title: "Podpis nahraný", description: "Firemný podpis/pečiatka bola úspešne uložená." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Chyba pri nahrávaní", description: error.message });
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = "";
    }
  };

  const handleDelete = async () => {
    if (!signaturePath) return;
    const confirmed = window.confirm("Naozaj chcete odstrániť firemný podpis/pečiatku?");
    if (!confirmed) return;

    setDeleting(true);
    try {
      await supabase.storage.from("company-assets").remove([signaturePath]);
      await supabase.from("company_settings").delete().eq("key", "company_signature_path");

      setSignatureUrl(null);
      setSignaturePath(null);
      toast({ title: "Podpis odstránený", description: "Firemný podpis/pečiatka bola odstránená." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Stamp className="h-5 w-5 text-primary" />
          Nastavenia spoločnosti
        </CardTitle>
        <CardDescription>
          Nahrajte firemný podpis/pečiatku, ktorá sa automaticky zobrazí na Stundenzettel a Leistungsnachweis PDF dokumentoch v sekcii "Auftraggeber".
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {signatureUrl ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-primary">
                  <CheckCircle className="h-4 w-4" />
                  <span>Firemný podpis/pečiatka je nahraná</span>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4 flex items-center justify-center">
                  <img
                    src={signatureUrl}
                    alt="Firemný podpis"
                    className="max-h-[80px] max-w-[150px] object-contain"
                  />
                </div>
                <div className="flex gap-2">
                  <Label htmlFor="signature-replace" className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild disabled={uploading}>
                      <span>
                        {uploading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Nahradiť
                      </span>
                    </Button>
                  </Label>
                  <Input
                    id="signature-replace"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUpload}
                    disabled={uploading}
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Odstrániť
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Žiadny podpis nie je nahraný. Nahrajte obrázok pečiatky/podpisu (PNG, JPG, max 2 MB).
                </p>
                <Label htmlFor="signature-upload" className="cursor-pointer">
                  <Button variant="outline" className="w-full" asChild disabled={uploading}>
                    <span>
                      {uploading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Nahrať firemný podpis/pečiatku
                    </span>
                  </Button>
                </Label>
                <Input
                  id="signature-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUpload}
                  disabled={uploading}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
