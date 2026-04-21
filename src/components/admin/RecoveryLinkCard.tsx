import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Loader2, Copy, Check } from "lucide-react";

export function RecoveryLinkCard() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!email.trim()) {
      toast({
        variant: "destructive",
        title: "Chýba email",
        description: "Zadajte e-mail spolupracovníka.",
      });
      return;
    }
    setLoading(true);
    setLink(null);
    setCopied(false);
    try {
      const { data, error } = await supabase.functions.invoke(
        "admin-generate-recovery",
        {
          body: {
            email: email.trim().toLowerCase(),
            redirectTo: `${window.location.origin}/reset-password`,
          },
        }
      );
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const action = (data as any)?.action_link as string | undefined;
      if (!action) throw new Error("Link sa nevrátil zo servera.");
      setLink(action);
      toast({
        title: "Recovery link vygenerovaný",
        description: "Skopíruj ho a pošli spolupracovníkovi (napr. cez WhatsApp).",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: e instanceof Error ? e.message : "Nepodarilo sa vygenerovať link.",
      });
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Recovery link (obnova hesla)
        </CardTitle>
        <CardDescription>
          Vygeneruj jednorazový odkaz na obnovenie hesla pre spolupracovníka,
          ktorému neprišiel email. Odkaz platí 1 hodinu.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="recovery-email">E-mail spolupracovníka</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="recovery-email"
              type="email"
              placeholder="meno@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="flex-1"
            />
            <Button onClick={generate} disabled={loading} className="shrink-0">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generujem...
                </>
              ) : (
                "Vygenerovať link"
              )}
            </Button>
          </div>
        </div>

        {link && (
          <div className="space-y-2 rounded-lg border bg-muted/50 p-3">
            <Label className="text-xs text-muted-foreground">
              Recovery odkaz (platný 1 hodinu)
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="flex-1 break-all rounded bg-background px-2 py-1.5 text-xs">
                {link}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={copy}
                className="shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Skopírované
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Kopírovať
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Pošli spolupracovníkovi cez WhatsApp/SMS. Po kliknutí si nastaví
              nové heslo na stránke /reset-password.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
