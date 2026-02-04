import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, User, CreditCard, Euro, Building2, Lock } from "lucide-react";
import { SignaturePad } from "@/components/SignaturePad";
import { Switch } from "@/components/ui/switch";
import { getSignedSignatureUrl } from "@/lib/signatureUtils";

interface ProfileData {
  full_name: string;
  company_name: string | null;
  contract_number: string | null;
  hourly_rate: number | null;
  fixed_wage: number | null;
  iban: string | null;
  swift_bic: string | null;
  billing_address: string | null;
  signature_url: string | null;
  is_vat_payer: boolean;
  vat_number: string | null;
  ico: string | null;
  dic: string | null;
}

export default function Profile() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signedSignatureUrl, setSignedSignatureUrl] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData>({
    full_name: "",
    company_name: null,
    contract_number: null,
    hourly_rate: null,
    fixed_wage: null,
    iban: null,
    swift_bic: null,
    billing_address: null,
    signature_url: null,
    is_vat_payer: false,
    vat_number: null,
    ico: null,
    dic: null,
  });

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, company_name, contract_number, hourly_rate, fixed_wage, iban, swift_bic, billing_address, signature_url, is_vat_payer, vat_number, ico, dic")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
      } else if (data) {
        setProfile(data);
        
        // Generate signed URL for signature display
        if (data.signature_url) {
          const signedUrl = await getSignedSignatureUrl(data.signature_url, 3600);
          setSignedSignatureUrl(signedUrl);
        }
      }
      setLoading(false);
    }

    fetchProfile();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        company_name: profile.company_name,
        contract_number: profile.contract_number,
        hourly_rate: profile.hourly_rate,
        iban: profile.iban,
        swift_bic: profile.swift_bic,
        billing_address: profile.billing_address,
        is_vat_payer: profile.is_vat_payer,
        vat_number: profile.vat_number,
        ico: profile.ico,
        dic: profile.dic,
      })
      .eq("user_id", user.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Chyba pri ukladaní",
        description: error.message,
      });
    } else {
      toast({
        title: "Profil uložený",
        description: "Vaše údaje boli úspešne aktualizované.",
      });
    }

    setSaving(false);
  };

  const handleSignatureSaved = (url: string) => {
    setProfile((prev) => ({ ...prev, signature_url: prev.signature_url }));
    setSignedSignatureUrl(url); // url is already a signed URL from SignaturePad
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Profil</h2>
        <p className="text-muted-foreground">Spravujte svoje osobné a fakturačné údaje</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Osobné údaje
            </CardTitle>
            <CardDescription>Základné informácie o vás</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Meno a priezvisko</Label>
                <Input
                  id="fullName"
                  value={profile.full_name}
                  onChange={(e) =>
                    setProfile((prev) => ({ ...prev, full_name: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyName">Názov firmy</Label>
                <Input
                  id="companyName"
                  value={profile.company_name || ""}
                  onChange={(e) =>
                    setProfile((prev) => ({ ...prev, company_name: e.target.value }))
                  }
                  placeholder="Napr. Ján Novák s.r.o."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contractNumber">Číslo zmluvy</Label>
                <Input
                  id="contractNumber"
                  value={profile.contract_number || ""}
                  onChange={(e) =>
                    setProfile((prev) => ({ ...prev, contract_number: e.target.value }))
                  }
                  placeholder="Napr. ZML-2024-001"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ico">IČO</Label>
                  <Input
                    id="ico"
                    value={profile.ico || ""}
                    onChange={(e) =>
                      setProfile((prev) => ({ ...prev, ico: e.target.value }))
                    }
                    placeholder="12345678"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dic">DIČ</Label>
                  <Input
                    id="dic"
                    value={profile.dic || ""}
                    onChange={(e) =>
                      setProfile((prev) => ({ ...prev, dic: e.target.value }))
                    }
                    placeholder="2012345678"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="billingAddress">Fakturačná adresa</Label>
                <Textarea
                  id="billingAddress"
                  value={profile.billing_address || ""}
                  onChange={(e) =>
                    setProfile((prev) => ({ ...prev, billing_address: e.target.value }))
                  }
                  placeholder="Ulica, Mesto, PSČ"
                  rows={3}
                />
              </div>

              <Button type="submit" disabled={saving} className="w-full">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ukladám...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Uložiť osobné údaje
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* VAT Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Daňové údaje
            </CardTitle>
            <CardDescription>Nastavenia DPH pre fakturáciu</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="isVatPayer" className="text-base">Platca DPH</Label>
                  <p className="text-sm text-muted-foreground">
                    Aktivujte, ak ste registrovaný platca DPH
                  </p>
                </div>
                <Switch
                  id="isVatPayer"
                  checked={profile.is_vat_payer}
                  onCheckedChange={(checked) =>
                    setProfile((prev) => ({ ...prev, is_vat_payer: checked }))
                  }
                />
              </div>

              {profile.is_vat_payer && (
                <div className="space-y-2">
                  <Label htmlFor="vatNumber">IČ DPH</Label>
                  <Input
                    id="vatNumber"
                    value={profile.vat_number || ""}
                    onChange={(e) =>
                      setProfile((prev) => ({ ...prev, vat_number: e.target.value }))
                    }
                    placeholder="SK1234567890"
                  />
                </div>
              )}

              <Button type="submit" disabled={saving} className="w-full">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ukladám...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Uložiť daňové údaje
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Banking Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Bankové údaje
            </CardTitle>
            <CardDescription>Údaje pre príjem platieb</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Fixed Wage - Admin only edit, readonly for users */}
              <div className="space-y-2">
                <Label htmlFor="fixedWage" className="flex items-center gap-1">
                  <Lock className="h-4 w-4" />
                  Fixná mzda (€/mesiac)
                </Label>
                <Input
                  id="fixedWage"
                  type="number"
                  step="0.01"
                  min="0"
                  value={profile.fixed_wage || ""}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      fixed_wage: e.target.value ? parseFloat(e.target.value) : null,
                    }))
                  }
                  placeholder="Napr. 2500.00"
                  disabled={!isAdmin}
                  className={!isAdmin ? "bg-muted cursor-not-allowed" : ""}
                />
                {!isAdmin && (
                  <p className="text-xs text-muted-foreground">
                    Iba admin môže upraviť fixnú mzdu
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="hourlyRate" className="flex items-center gap-1">
                  <Euro className="h-4 w-4" />
                  Zmluvná hodinová sadzba (€)
                </Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={profile.hourly_rate || ""}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      hourly_rate: e.target.value ? parseFloat(e.target.value) : null,
                    }))
                  }
                  placeholder="Napr. 25.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="iban">IBAN</Label>
                <Input
                  id="iban"
                  value={profile.iban || ""}
                  onChange={(e) =>
                    setProfile((prev) => ({ ...prev, iban: e.target.value }))
                  }
                  placeholder="SK00 0000 0000 0000 0000 0000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="swiftBic">SWIFT/BIC</Label>
                <Input
                  id="swiftBic"
                  value={profile.swift_bic || ""}
                  onChange={(e) =>
                    setProfile((prev) => ({ ...prev, swift_bic: e.target.value }))
                  }
                  placeholder="Napr. TATRSKBX"
                />
              </div>

              <Button type="submit" disabled={saving} className="w-full">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ukladám...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Uložiť bankové údaje
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Digital Signature */}
        {user && (
          <div className="lg:col-span-2">
            <SignaturePad
              userId={user.id}
              currentSignatureUrl={signedSignatureUrl}
              onSignatureSaved={handleSignatureSaved}
            />
          </div>
        )}
      </div>
    </div>
  );
}
