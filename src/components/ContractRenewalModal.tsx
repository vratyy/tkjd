import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * Blocking modal shown from 2026-12-01 onwards if the user's contract_number
 * is missing or still contains "2026" (i.e. not yet updated for 2027).
 * The modal cannot be dismissed without entering a valid new contract number.
 */
export function ContractRenewalModal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contractNumber, setContractNumber] = useState("");

  useEffect(() => {
    if (!user) return;

    const now = new Date();
    // Only activate from December 1, 2026 onwards
    if (now < new Date(2026, 11, 1)) {
      setLoading(false);
      return;
    }

    async function checkContract() {
      const { data } = await supabase
        .from("profiles")
        .select("contract_number")
        .eq("user_id", user!.id)
        .maybeSingle();

      const cn = data?.contract_number?.trim() || "";
      // Needs update if empty or still references 2026
      const needsUpdate = !cn || cn.includes("2026");
      setOpen(needsUpdate);
      setContractNumber(cn);
      setLoading(false);
    }

    checkContract();
  }, [user]);

  const handleSave = async () => {
    const trimmed = contractNumber.trim();
    if (!trimmed) return;

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ contract_number: trimmed })
      .eq("user_id", user!.id);

    if (error) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    } else {
      toast({ title: "Číslo zmluvy uložené", description: "Ďakujeme za aktualizáciu." });
      setOpen(false);
    }
    setSaving(false);
  };

  if (loading || !open) return null;

  return (
    <Dialog open={open} onOpenChange={() => { /* prevent close */ }}>
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Povinná aktualizácia zmluvy
          </DialogTitle>
          <DialogDescription>
            Blíži sa rok 2027. Prosím, zadajte vaše nové Číslo zmluvy pre nadchádzajúce obdobie.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="newContract">Nové číslo zmluvy *</Label>
            <Input
              id="newContract"
              value={contractNumber}
              onChange={(e) => setContractNumber(e.target.value)}
              placeholder="Napr. 102027"
              autoFocus
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={saving || !contractNumber.trim()}
            className="w-full"
          >
            {saving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ukladám...</>
            ) : (
              <><Save className="mr-2 h-4 w-4" /> Uložiť a pokračovať</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
