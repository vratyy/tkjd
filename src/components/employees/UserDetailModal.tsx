import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { AdminAddEntryModal, type EditEntryData } from "./AdminAddEntryModal";
import { UserRecordsTab } from "./UserRecordsTab";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Save,
  User,
  Euro,
  FileText,
  Plus,
  CreditCard,
  Building2,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { InvoiceStatusBadge } from "@/components/financial/InvoiceStatusBadge";

interface UserProfile {
  full_name: string;
  company_name: string | null;
  billing_address: string | null;
  iban: string | null;
  swift_bic: string | null;
  hourly_rate: number | null;
  fixed_wage: number | null;
  ico: string | null;
  dic: string | null;
  vat_number: string | null;
  is_vat_payer: boolean;
  contract_number: string | null;
}

interface UserInvoice {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  total_hours: number;
  total_amount: number;
  status: string;
  hourly_rate: number;
  projects: { name: string } | null;
}

interface UserRecord {
  id: string;
  date: string;
  time_from: string;
  time_to: string;
  total_hours: number | null;
  status: string;
  note: string | null;
  break_start: string | null;
  break_end: string | null;
  projects: { id: string; name: string } | null;
}

interface UserDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userName: string;
  userRole?: string;
  onProfileUpdated?: () => void;
}

export function UserDetailModal({
  open,
  onOpenChange,
  userId,
  userName,
  userRole,
  onProfileUpdated,
}: UserDetailModalProps) {
  const { toast } = useToast();
  const { role } = useUserRole();
  const isPrivileged = role === "admin" || role === "director";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [invoices, setInvoices] = useState<UserInvoice[]>([]);
  const [records, setRecords] = useState<UserRecord[]>([]);
  const [editHourlyRate, setEditHourlyRate] = useState<string>("");
  const [editFixedWage, setEditFixedWage] = useState<string>("");
  const [wageConfirmOpen, setWageConfirmOpen] = useState(false);
  const [originalHourlyRate, setOriginalHourlyRate] = useState<string>("");
  const [addEntryOpen, setAddEntryOpen] = useState(false);
  const [editEntryData, setEditEntryData] = useState<EditEntryData | null>(null);

  useEffect(() => {
    if (!open || !userId) return;
    fetchUserData();
  }, [open, userId]);

  const fetchUserData = async () => {
    if (!userId) return;
    setLoading(true);

    try {
      const [profileRes, invoicesRes, recordsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "full_name, company_name, billing_address, iban, swift_bic, hourly_rate, fixed_wage, ico, dic, vat_number, is_vat_payer, contract_number"
          )
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("invoices")
          .select(
            "id, invoice_number, issue_date, due_date, total_hours, total_amount, status, hourly_rate, projects(name)"
          )
          .eq("user_id", userId)
          .is("deleted_at", null)
          .order("issue_date", { ascending: false }),
        supabase
          .from("performance_records")
          .select(
            "id, date, time_from, time_to, total_hours, status, note, break_start, break_end, projects(id, name)"
          )
          .eq("user_id", userId)
          .is("deleted_at", null)
          .order("date", { ascending: false }),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (profileRes.data) {
        setProfile(profileRes.data);
        const rateStr = profileRes.data.hourly_rate != null
          ? String(profileRes.data.hourly_rate)
          : "";
        setEditHourlyRate(rateStr);
        setOriginalHourlyRate(rateStr);
        setEditFixedWage(
          profileRes.data.fixed_wage != null
            ? String(profileRes.data.fixed_wage)
            : ""
        );
      }

      setInvoices((invoicesRes.data as UserInvoice[]) || []);
      setRecords((recordsRes.data as UserRecord[]) || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWageClick = () => {
    if (editHourlyRate !== originalHourlyRate) {
      setWageConfirmOpen(true);
    } else {
      executeSaveWage();
    }
  };

  const handleCancelWageChange = () => {
    setWageConfirmOpen(false);
    setEditHourlyRate(originalHourlyRate);
  };

  const handleConfirmWageChange = () => {
    setWageConfirmOpen(false);
    executeSaveWage();
  };

  const executeSaveWage = async () => {
    if (!userId) return;
    setSaving(true);

    try {
      const newRate = editHourlyRate ? parseFloat(editHourlyRate) : null;
      const newWage = editFixedWage ? parseFloat(editFixedWage) : null;

      const { error } = await supabase
        .from("profiles")
        .update({ hourly_rate: newRate, fixed_wage: newWage })
        .eq("user_id", userId);

      if (error) throw error;

      const rateStr = newRate != null ? String(newRate) : "";
      setOriginalHourlyRate(rateStr);
      setProfile((prev) =>
        prev ? { ...prev, hourly_rate: newRate, fixed_wage: newWage } : prev
      );

      toast({ title: "Uložené", description: "Mzdové údaje boli aktualizované." });
      onProfileUpdated?.();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleEditRecord = (data: EditEntryData) => {
    setEditEntryData(data);
    setAddEntryOpen(true);
  };

  const handleAddNew = () => {
    setEditEntryData(null);
    setAddEntryOpen(true);
  };

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const getRoleBadgeColor = (r: string) => {
    switch (r) {
      case "admin": return "bg-destructive text-destructive-foreground";
      case "manager": return "bg-primary text-primary-foreground";
      case "accountant": return "bg-secondary text-secondary-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <span>{userName}</span>
                  {userRole && (
                    <Badge className={`ml-2 ${getRoleBadgeColor(userRole)}`} variant="secondary">
                      {userRole}
                    </Badge>
                  )}
                </div>
              </DialogTitle>
              {isPrivileged && userId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddNew}
                  className="gap-1.5 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Pridať deň</span>
                </Button>
              )}
            </div>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Tabs defaultValue="records" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="records" className="gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span className="hidden sm:inline">Záznamy</span>
                  <span className="sm:hidden">Dni</span>
                </TabsTrigger>
                <TabsTrigger value="info" className="gap-1.5">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Osobné</span>
                  <span className="sm:hidden">Info</span>
                </TabsTrigger>
                <TabsTrigger value="wage" className="gap-1.5">
                  <Euro className="h-4 w-4" />
                  <span className="hidden sm:inline">Mzda</span>
                  <span className="sm:hidden">Mzda</span>
                </TabsTrigger>
                <TabsTrigger value="docs" className="gap-1.5">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Faktúry</span>
                  <span className="sm:hidden">Docs</span>
                </TabsTrigger>
              </TabsList>

              {/* Records Tab */}
              <TabsContent value="records" className="flex-1 overflow-hidden mt-4 flex flex-col">
                <UserRecordsTab
                  records={records}
                  isPrivileged={isPrivileged}
                  onEdit={handleEditRecord}
                  onRecordDeleted={fetchUserData}
                />
              </TabsContent>

              {/* Personal Info Tab */}
              <TabsContent value="info" className="flex-1 overflow-auto mt-4">
                <div className="space-y-4">
                  <InfoRow icon={<User className="h-4 w-4" />} label="Meno" value={profile?.full_name} />
                  <InfoRow icon={<Building2 className="h-4 w-4" />} label="Firma" value={profile?.company_name} />
                  <InfoRow label="Číslo zmluvy" value={profile?.contract_number} />
                  <Separator />
                  <InfoRow label="IČO" value={profile?.ico} />
                  <InfoRow label="DIČ" value={profile?.dic} />
                  {profile?.is_vat_payer && <InfoRow label="IČ DPH" value={profile?.vat_number} />}
                  <Separator />
                  <InfoRow label="Fakturačná adresa" value={profile?.billing_address} />
                  <InfoRow icon={<CreditCard className="h-4 w-4" />} label="IBAN" value={profile?.iban} />
                  <InfoRow label="SWIFT/BIC" value={profile?.swift_bic} />
                </div>
              </TabsContent>

              {/* Wage Settings Tab */}
              <TabsContent value="wage" className="flex-1 overflow-auto mt-4">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="modal-hourly-rate" className="flex items-center gap-1.5">
                      <Euro className="h-4 w-4" />
                      Hodinová sadzba (€)
                    </Label>
                    <Input
                      id="modal-hourly-rate"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editHourlyRate}
                      onChange={(e) => setEditHourlyRate(e.target.value)}
                      placeholder="Napr. 25.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="modal-fixed-wage" className="flex items-center gap-1.5">
                      <Euro className="h-4 w-4" />
                      Fixná mzda (€/mesiac)
                    </Label>
                    <Input
                      id="modal-fixed-wage"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editFixedWage}
                      onChange={(e) => setEditFixedWage(e.target.value)}
                      placeholder="Napr. 2500.00"
                    />
                  </div>
                  <div className="rounded-lg border p-4 bg-muted/30 space-y-1">
                    <p className="text-sm font-medium">Aktuálne hodnoty</p>
                    <p className="text-sm text-muted-foreground">
                      Hodinová sadzba:{" "}
                      <span className="font-medium text-foreground">
                        {profile?.hourly_rate != null ? `${profile.hourly_rate} €` : "nenastavená"}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Fixná mzda:{" "}
                      <span className="font-medium text-foreground">
                        {profile?.fixed_wage != null ? `${profile.fixed_wage} €/mes.` : "nenastavená"}
                      </span>
                    </p>
                  </div>
                  <Button onClick={handleSaveWageClick} disabled={saving} className="w-full">
                    {saving ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Ukladám...</>
                    ) : (
                      <><Save className="mr-2 h-4 w-4" />Uložiť mzdové údaje</>
                    )}
                  </Button>
                </div>
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="docs" className="flex-1 overflow-hidden mt-4 flex flex-col">
                <ScrollArea className="flex-1">
                  {invoices.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Žiadne faktúry</p>
                    </div>
                  ) : (
                    <div className="space-y-2 pr-4">
                      {invoices.map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{inv.invoice_number}</span>
                              <InvoiceStatusBadge status={inv.status as any} dueDate={inv.due_date} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {format(new Date(inv.issue_date), "d. MMM yyyy", { locale: sk })} •{" "}
                              {inv.total_hours}h • {inv.projects?.name || "—"}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-semibold text-sm">{Number(inv.total_amount).toFixed(2)} €</p>
                            <p className="text-xs text-muted-foreground">{inv.hourly_rate} €/h</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                {invoices.length > 0 && (
                  <div className="pt-4 border-t mt-4">
                    <p className="text-sm text-muted-foreground mb-1">
                      Celkom faktúr: <strong>{invoices.length}</strong> •
                      Celková suma:{" "}
                      <strong>
                        {invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0).toFixed(2)} €
                      </strong>
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Wage Change Confirmation Dialog */}
      <AlertDialog open={wageConfirmOpen} onOpenChange={setWageConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zmena hodinovej sadzby</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Naozaj chcete zmeniť sadzbu pre používateľa <strong>{userName}</strong>?</p>
                <div className="rounded-lg border p-3 bg-muted/30 space-y-1 text-sm">
                  <p>Pôvodná sadzba: <strong>{originalHourlyRate ? `${originalHourlyRate} €` : "nenastavená"}</strong></p>
                  <p>Nová sadzba: <strong>{editHourlyRate ? `${editHourlyRate} €` : "nenastavená"}</strong></p>
                </div>
                <p className="text-xs text-muted-foreground">⚠ Táto zmena ovplyvní všetky budúce výpočty.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelWageChange}>Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmWageChange}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Potvrdiť
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {userId && (
        <AdminAddEntryModal
          open={addEntryOpen}
          onOpenChange={setAddEntryOpen}
          targetUserId={userId}
          targetUserName={userName}
          onEntryAdded={() => {
            fetchUserData();
            onProfileUpdated?.();
          }}
          editData={editEntryData}
        />
      )}
    </>
  );
}

function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3">
      {icon && <div className="mt-0.5 text-muted-foreground">{icon}</div>}
      {!icon && <div className="w-4" />}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">
          {value || <span className="text-muted-foreground italic">—</span>}
        </p>
      </div>
    </div>
  );
}
