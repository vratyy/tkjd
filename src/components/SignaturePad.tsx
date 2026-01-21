import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trash2, Save, PenTool } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SignaturePadProps {
  userId: string;
  currentSignatureUrl: string | null;
  onSignatureSaved: (url: string) => void;
}

export function SignaturePad({ userId, currentSignatureUrl, onSignatureSaved }: SignaturePadProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [saving, setSaving] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const { toast } = useToast();

  const clearSignature = () => {
    sigCanvas.current?.clear();
    setIsDrawing(false);
  };

  const saveSignature = async () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Najprv nakreslite podpis.",
      });
      return;
    }

    setSaving(true);

    try {
      // Get signature as PNG data URL
      const dataUrl = sigCanvas.current.toDataURL("image/png");
      
      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      // Create file path
      const fileName = `${userId}/signature.png`;
      
      // Delete existing signature if present
      await supabase.storage.from("signatures").remove([fileName]);
      
      // Upload new signature
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("signatures")
        .upload(fileName, blob, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("signatures")
        .getPublicUrl(fileName);

      const signatureUrl = urlData.publicUrl;

      // Update profile with signature URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ signature_url: signatureUrl })
        .eq("user_id", userId);

      if (updateError) throw updateError;

      onSignatureSaved(signatureUrl);
      
      toast({
        title: "Podpis uložený",
        description: "Váš digitálny podpis bol úspešne uložený.",
      });
    } catch (error: any) {
      console.error("Error saving signature:", error);
      toast({
        variant: "destructive",
        title: "Chyba pri ukladaní",
        description: error.message,
      });
    }

    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PenTool className="h-5 w-5" />
          Digitálny podpis
        </CardTitle>
        <CardDescription>
          Nakreslite svoj podpis pre faktúry
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentSignatureUrl && !isDrawing ? (
          <div className="space-y-4">
            <div className="border rounded-lg p-4 bg-white">
              <img 
                src={currentSignatureUrl} 
                alt="Aktuálny podpis" 
                className="max-h-24 mx-auto"
              />
            </div>
            <Button 
              variant="outline" 
              onClick={() => setIsDrawing(true)}
              className="w-full"
            >
              <PenTool className="mr-2 h-4 w-4" />
              Nakresliť nový podpis
            </Button>
          </div>
        ) : (
          <>
            <div className="border-2 border-dashed border-border rounded-lg bg-white">
              <SignatureCanvas
                ref={sigCanvas}
                canvasProps={{
                  className: "w-full h-40 cursor-crosshair",
                  style: { width: "100%", height: "160px" },
                }}
                backgroundColor="white"
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Nakreslite podpis myšou alebo dotykom
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={clearSignature}
                className="flex-1"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Vymazať
              </Button>
              <Button 
                onClick={saveSignature} 
                disabled={saving}
                className="flex-1"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ukladám...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Uložiť podpis
                  </>
                )}
              </Button>
            </div>
            {currentSignatureUrl && (
              <Button 
                variant="ghost" 
                onClick={() => setIsDrawing(false)}
                className="w-full"
              >
                Zrušiť
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
