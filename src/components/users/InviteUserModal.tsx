import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Copy, Check, Eye, EyeOff } from "lucide-react";

interface InviteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function generatePassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const specials = "!@#$%&*";
  let pwd = "";
  for (let i = 0; i < 10; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  // Insert a special char at random position
  const pos = Math.floor(Math.random() * pwd.length);
  const special = specials[Math.floor(Math.random() * specials.length)];
  pwd = pwd.slice(0, pos) + special + pwd.slice(pos);
  return pwd;
}

export function InviteUserModal({ open, onOpenChange, onSuccess }: InviteUserModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("monter");
  const [tempPassword, setTempPassword] = useState(generatePassword());
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [createdUser, setCreatedUser] = useState<{ email: string; password: string; name: string } | null>(null);

  const resetForm = () => {
    setEmail("");
    setFullName("");
    setRole("monter");
    setTempPassword(generatePassword());
    setShowPassword(false);
    setCopied(false);
    setCreatedUser(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  const copyCredentials = async () => {
    if (!createdUser) return;
    const text = `Prihlasovacie údaje pre TKJD APP:\nE-mail: ${createdUser.email}\nHeslo: ${createdUser.password}\nPrihlásenie: ${window.location.origin}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Skopírované", description: "Prihlasovacie údaje boli skopírované do schránky." });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !fullName.trim()) {
      toast({ variant: "destructive", title: "Chyba", description: "Vyplňte všetky povinné polia." });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: email.trim().toLowerCase(),
          full_name: fullName.trim(),
          role,
          temporary_password: tempPassword,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setCreatedUser({ email: email.trim().toLowerCase(), password: tempPassword, name: fullName.trim() });
      toast({
        title: "Používateľ vytvorený ✅",
        description: `${fullName.trim()} bol pridaný do systému.`,
      });
      onSuccess();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Chyba pri vytváraní",
        description: err.message || "Nepodarilo sa vytvoriť používateľa.",
      });
    }

    setIsLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pozvať nového montéra</DialogTitle>
          <DialogDescription>
            Vytvorte účet pre nového subdodávateľa. Prihlasovacie údaje mu odovzdajte osobne alebo cez SMS.
          </DialogDescription>
        </DialogHeader>

        {createdUser ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">Prihlasovacie údaje:</p>
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Meno:</span> {createdUser.name}</p>
                <p><span className="text-muted-foreground">E-mail:</span> {createdUser.email}</p>
                <p><span className="text-muted-foreground">Heslo:</span> <code className="bg-background px-1.5 py-0.5 rounded text-xs">{createdUser.password}</code></p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              ⚠️ Heslo sa zobrazuje iba teraz. Odovzdajte ho používateľovi osobne alebo cez SMS.
            </p>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={copyCredentials} className="w-full sm:w-auto">
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? "Skopírované" : "Kopírovať údaje"}
              </Button>
              <Button onClick={() => handleClose(false)} className="w-full sm:w-auto">
                Zavrieť
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-name">Meno a priezvisko <span className="text-destructive">*</span></Label>
              <Input
                id="invite-name"
                placeholder="Ján Novák"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={isLoading}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">E-mail <span className="text-destructive">*</span></Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="jan.novak@email.sk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label>Rola</Label>
              <Select value={role} onValueChange={setRole} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monter">Montér</SelectItem>
                  <SelectItem value="manager">Projektový manažér</SelectItem>
                  <SelectItem value="accountant">Účtovník</SelectItem>
                  <SelectItem value="admin">Administrátor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dočasné heslo</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    disabled={isLoading}
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTempPassword(generatePassword())}
                  disabled={isLoading}
                >
                  Generovať
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Heslo musí mať aspoň 8 znakov. Používateľ si ho zmení po prvom prihlásení.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={isLoading}>
                Zrušiť
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Vytváram...
                  </>
                ) : (
                  "Vytvoriť účet"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
