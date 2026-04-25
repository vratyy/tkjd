import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaxPaymentStatusBadge } from "./TaxPaymentStatusBadge";
import { InvoiceDetailDialog } from "./InvoiceDetailDialog";
import { InvoicePreviewModal } from "./InvoicePreviewModal";
import { InvoiceStatusDropdown } from "./InvoiceStatusDropdown";
import { MobileInvoiceCard } from "@/components/mobile/MobileInvoiceCard";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
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
import { AlertTriangle, Eye, FileSearch, Lock, Unlock, BookCheck, BookX, RefreshCw, XCircle, Trash2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { generateInvoicePDF } from "@/lib/invoiceGenerator";
import { getISOWeekLocal } from "@/lib/dateUtils";
import type { Invoice, ProjectOption } from "@/hooks/useFinancialData";

const UNASSIGNED_VALUE = "__unassigned__";

interface InvoicesTrafficTableProps {
  invoices: Invoice[];
  allProjects?: ProjectOption[];
  loading: boolean;
  onMarkAsPaid: (invoiceId: string) => void;
  onRefresh: () => void;
  urgentFilterActive?: boolean;
  onClearUrgentFilter?: () => void;
}

interface WeekGroup {
  key: string;
  calendarWeek: number;
  year: number;
  invoices: Invoice[];
  totalAmount: number;
  dateRange: string;
}

function getWeekDateRange(week: number, year: number): string {
  // Build a date from week/year, then get start/end of ISO week
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - dayOfWeek + 1);
  const weekStart = new Date(firstMonday);
  weekStart.setDate(firstMonday.getDate() + (week - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return `${format(weekStart, "d. MMM", { locale: sk })} - ${format(weekEnd, "d. MMM yyyy", { locale: sk })}`;
}

export function InvoicesTrafficTable({ invoices, allProjects = [], loading, onMarkAsPaid, onRefresh, urgentFilterActive, onClearUrgentFilter }: InvoicesTrafficTableProps) {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [lockingId, setLockingId] = useState<string | null>(null);
  const [accountingId, setAccountingId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterWeek, setFilterWeek] = useState<string>("all");
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { isAdmin } = useUserRole();
  const [trashView, setTrashView] = useState(false);
  const [trashConfirm, setTrashConfirm] = useState<Invoice | null>(null);
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState<Invoice | null>(null);
  const [trashingId, setTrashingId] = useState<string | null>(null);

  const formatAmount = (amount: number) => {
    const safeAmount = Number(amount) || 0;
    return new Intl.NumberFormat("sk-SK", {
      style: "currency",
      currency: "EUR",
    }).format(safeAmount);
  };

  const formatDate = (date: string) => {
    try {
      return format(new Date(date), "d. MMM yyyy", { locale: sk });
    } catch {
      return "—";
    }
  };

  // Project filter: union of all active projects + "Bez projektu" if any unassigned invoices exist
  const projectOptions = useMemo(() => {
    const names = new Set<string>();
    allProjects.forEach((p) => names.add(p.name));
    // Also include any project names found on invoices (in case project is inactive/deleted but invoices exist)
    invoices.forEach((inv) => {
      if (inv.project?.name) names.add(inv.project.name);
    });
    const sorted = Array.from(names).sort((a, b) => a.localeCompare(b, "sk"));
    const hasUnassigned = invoices.some((inv) => !inv.project?.name);
    return { names: sorted, hasUnassigned };
  }, [allProjects, invoices]);

  const weekOptions = useMemo(() => {
    const weeks = new Set<string>();
    invoices.forEach((inv) => {
      let cw = inv.calendar_week;
      let yr = inv.year;
      if (!cw || !yr) {
        const d = new Date(inv.delivery_date || inv.issue_date);
        cw = getISOWeekLocal(d);
        yr = d.getFullYear();
      }
      weeks.add(`${yr}-${String(cw).padStart(2, "0")}`);
    });
    return Array.from(weeks).sort().reverse();
  }, [invoices]);

  // Urgent invoices for filter mode
  const urgentAndApproachingInvoices = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);

    return invoices.filter((inv) => {
      if (inv.status === "paid" || inv.status === "void") return false;
      const due = new Date(inv.due_date);
      due.setHours(0, 0, 0, 0);
      return due <= in7Days;
    });
  }, [invoices]);

  // Split invoices into active and trashed
  const activeInvoices = useMemo(() => invoices.filter(inv => inv.status !== "void"), [invoices]);
  const trashedInvoices = useMemo(() => invoices.filter(inv => inv.status === "void"), [invoices]);

  // Apply filters (only on active invoices)
  const filteredInvoices = useMemo(() => {
    if (urgentFilterActive) return urgentAndApproachingInvoices;
    if (trashView) return trashedInvoices;

    return activeInvoices.filter((inv) => {
      if (filterProject !== "all" && inv.project?.name !== filterProject) return false;
      if (filterWeek !== "all") {
        let cw = inv.calendar_week;
        let yr = inv.year;
        if (!cw || !yr) {
          const d = new Date(inv.delivery_date || inv.issue_date);
          cw = getISOWeekLocal(d);
          yr = d.getFullYear();
        }
        const key = `${yr}-${String(cw).padStart(2, "0")}`;
        if (key !== filterWeek) return false;
      }
      return true;
    });
  }, [activeInvoices, trashedInvoices, filterProject, filterWeek, urgentFilterActive, urgentAndApproachingInvoices, trashView]);

  // Group invoices by calendar week, sorted descending (latest first)
  const weekGroups = useMemo<WeekGroup[]>(() => {
    const groups = new Map<string, WeekGroup>();

    filteredInvoices.forEach((inv) => {
      // Use week_closing data if available, otherwise derive from delivery_date
      let cw = inv.calendar_week;
      let yr = inv.year;
      if (!cw || !yr) {
        const d = new Date(inv.delivery_date || inv.issue_date);
        cw = getISOWeekLocal(d);
        yr = d.getFullYear();
      }

      const key = `${yr}-${String(cw).padStart(2, "0")}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          calendarWeek: cw,
          year: yr,
          invoices: [],
          totalAmount: 0,
          dateRange: getWeekDateRange(cw, yr),
        });
      }
      const group = groups.get(key)!;
      group.invoices.push(inv);
      group.totalAmount += Number(inv.subtotal || inv.total_amount) || 0;
    });

    // Sort groups descending by key (year-week)
    return Array.from(groups.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [filteredInvoices]);

  // The latest week key for default expansion
  const latestWeekKey = weekGroups.length > 0 ? weekGroups[0].key : undefined;

  const overdueCount = invoices.filter(inv => {
    if (inv.status === "paid") return false;
    const daysUntilDue = Math.ceil((new Date(inv.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilDue < 0;
  }).length;

  const dueSoonCount = invoices.filter(inv => {
    if (inv.status === "paid") return false;
    const daysUntilDue = Math.ceil((new Date(inv.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilDue >= 0 && daysUntilDue <= 3;
  }).length;

  // --- Action handlers (unchanged) ---
  const handleToggleLock = async (invoiceId: string, currentlyLocked: boolean) => {
    setLockingId(invoiceId);
    try {
      const { error } = await supabase
        .from("invoices")
        .update({
          is_locked: !currentlyLocked,
          locked_at: !currentlyLocked ? new Date().toISOString() : null,
        })
        .eq("id", invoiceId);
      if (error) throw error;
      toast({
        title: currentlyLocked ? "Faktúra odomknutá" : "Faktúra zamknutá",
        description: currentlyLocked
          ? "Faktúru je možné znova upravovať."
          : "Faktúra je teraz chránená proti úpravám.",
      });
      onRefresh();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    } finally {
      setLockingId(null);
    }
  };

  const handleToggleAccounted = async (invoiceId: string, currentlyAccounted: boolean) => {
    setAccountingId(invoiceId);
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ is_accounted: !currentlyAccounted })
        .eq("id", invoiceId);
      if (error) throw error;
      toast({
        title: currentlyAccounted ? "Faktúra vyradená zo štatistík" : "Faktúra zaevidovaná",
        description: currentlyAccounted
          ? "Faktúra už nebude započítaná do finančného prehľadu."
          : "Faktúra bola zaevidovaná do finančného prehľadu.",
      });
      onRefresh();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    } finally {
      setAccountingId(null);
    }
  };

  const handleRegeneratePDF = async (invoice: Invoice) => {
    setRegeneratingId(invoice.id);
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", invoice.user_id)
        .maybeSingle();
      if (profileError || !profile) throw new Error("Nepodarilo sa načítať profil dodávateľa");

      const { data: fullInvoice, error: invError } = await supabase
        .from("invoices")
        .select("*, weekly_closings(calendar_week, year)")
        .eq("id", invoice.id)
        .single();
      if (invError || !fullInvoice) throw new Error("Nepodarilo sa načítať faktúru");

      const calendarWeek = (fullInvoice as any).weekly_closings?.calendar_week || 0;
      const year = (fullInvoice as any).weekly_closings?.year || new Date().getFullYear();

      await generateInvoicePDF({
        invoiceNumber: fullInvoice.invoice_number,
        supplierName: profile.full_name,
        supplierCompany: profile.company_name,
        supplierAddress: profile.billing_address,
        supplierCountry: (profile as any).country,
        supplierIco: profile.ico,
        supplierDic: profile.dic,
        supplierIban: profile.iban,
        supplierSwiftBic: profile.swift_bic,
        signatureUrl: profile.signature_url,
        hourlyRate: fullInvoice.hourly_rate,
        contractNumber: profile.contract_number,
        workerId: profile.contract_number,
        isVatPayer: profile.is_vat_payer ?? false,
        vatNumber: profile.vat_number,
        isReverseCharge: fullInvoice.is_reverse_charge ?? false,
        projectName: invoice.project?.name || "Projekt",
        calendarWeek,
        year,
        totalHours: fullInvoice.total_hours,
        advanceDeduction: fullInvoice.advance_deduction ?? 0,
        historicalIssueDate: fullInvoice.issue_date,
        historicalDeliveryDate: fullInvoice.delivery_date,
        historicalDueDate: fullInvoice.due_date,
      });

      toast({
        title: "PDF regenerované",
        description: `Faktúra ${invoice.invoice_number} bola znovu vygenerovaná s aktuálnymi údajmi.`,
      });
    } catch (error: any) {
      console.error("Error regenerating PDF:", error);
      toast({ variant: "destructive", title: "Chyba pri regenerovaní PDF", description: error.message });
    } finally {
      setRegeneratingId(null);
    }
  };

  // --- Trash / Restore / Hard Delete handlers ---
  const handleTrashInvoice = async (invoice: Invoice) => {
    setTrashingId(invoice.id);
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ status: "void" as const })
        .eq("id", invoice.id);
      if (error) throw error;
      toast({ title: "Faktúra presunutá do koša", description: `Faktúra ${invoice.invoice_number} bola zrušená.` });
      onRefresh();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    } finally {
      setTrashingId(null);
      setTrashConfirm(null);
    }
  };

  const handleRestoreInvoice = async (invoice: Invoice) => {
    setTrashingId(invoice.id);
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ status: "pending" as const })
        .eq("id", invoice.id);
      if (error) throw error;
      toast({ title: "Faktúra obnovená", description: `Faktúra ${invoice.invoice_number} bola obnovená.` });
      onRefresh();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    } finally {
      setTrashingId(null);
    }
  };

  const handleHardDelete = async (invoice: Invoice) => {
    setTrashingId(invoice.id);
    try {
      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", invoice.id);
      if (error) throw error;
      toast({ title: "Faktúra trvalo vymazaná", description: `Faktúra ${invoice.invoice_number} bola permanentne odstránená.` });
      onRefresh();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    } finally {
      setTrashingId(null);
      setHardDeleteConfirm(null);
    }
  };

  // --- Render ---

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderInvoiceRow = (invoice: Invoice, index: number) => {
    let cw = invoice.calendar_week;
    if (!cw) {
      const d = new Date(invoice.delivery_date || invoice.issue_date);
      cw = getISOWeekLocal(d);
    }
    return (
    <TableRow key={invoice.id} className={invoice.status === "paid" ? "bg-green-50 dark:bg-green-900/10" : ""}>
      <TableCell className="w-10 text-muted-foreground">{index + 1}</TableCell>
      <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
      <TableCell className="hidden lg:table-cell text-muted-foreground">KW {cw}</TableCell>
      <TableCell>
        <div>
          <div className="font-medium">{invoice.profile?.full_name ?? "—"}</div>
          {invoice.profile?.company_name && (
            <div className="text-xs text-muted-foreground">{invoice.profile.company_name}</div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div>
          <div>{invoice.project?.name ?? "—"}</div>
          {invoice.project?.client && (
            <div className="text-xs text-muted-foreground">{invoice.project.client}</div>
          )}
        </div>
      </TableCell>
      <TableCell>{formatDate(invoice.issue_date)}</TableCell>
      <TableCell>{formatDate(invoice.due_date)}</TableCell>
      <TableCell className="text-right font-medium">{formatAmount(invoice.subtotal || invoice.total_amount)}</TableCell>
      <TableCell>
        <InvoiceStatusDropdown
          invoiceId={invoice.id}
          currentStatus={invoice.status}
          dueDate={invoice.due_date}
          onStatusChange={onRefresh}
        />
      </TableCell>
      <TableCell>
        <TaxPaymentStatusBadge status={invoice.tax_payment_status || "pending"} />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          {isAdmin && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleToggleAccounted(invoice.id, invoice.is_accounted || false)}
              disabled={accountingId === invoice.id}
              title={invoice.is_accounted ? "Vyradiť zo štatistík" : "Zaevidovať do prehľadu"}
            >
              {invoice.is_accounted ? (
                <BookCheck className="h-4 w-4 text-primary" />
              ) : (
                <BookX className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          )}
          {isAdmin && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleRegeneratePDF(invoice)}
              disabled={regeneratingId === invoice.id}
              title="Regenerovať PDF"
            >
              <RefreshCw className={`h-4 w-4 ${regeneratingId === invoice.id ? "animate-spin" : ""}`} />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleToggleLock(invoice.id, invoice.is_locked || false)}
            disabled={lockingId === invoice.id}
            title={invoice.is_locked ? "Odomknúť faktúru" : "Zamknúť faktúru"}
          >
            {invoice.is_locked ? (
              <Lock className="h-4 w-4 text-destructive" />
            ) : (
              <Unlock className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setPreviewInvoice(invoice);
              setPreviewOpen(true);
            }}
            title="Náhľad faktúry"
          >
            <FileSearch className="h-4 w-4" />
          </Button>
           <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelectedInvoice(invoice);
              setDetailOpen(true);
            }}
            title="Detail faktúry"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {isAdmin && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setTrashConfirm(invoice)}
              disabled={trashingId === invoice.id}
              title="Presunúť do koša"
            >
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
    );
  };

  const renderTrashRow = (invoice: Invoice, index: number) => {
    let cw = invoice.calendar_week;
    if (!cw) {
      const d = new Date(invoice.delivery_date || invoice.issue_date);
      cw = getISOWeekLocal(d);
    }
    return (
      <TableRow key={invoice.id} className="opacity-70">
        <TableCell className="w-10 text-muted-foreground">{index + 1}</TableCell>
        <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
        <TableCell className="hidden lg:table-cell text-muted-foreground">KW {cw}</TableCell>
        <TableCell>
          <div className="font-medium">{invoice.profile?.full_name ?? "—"}</div>
        </TableCell>
        <TableCell>{invoice.project?.name ?? "—"}</TableCell>
        <TableCell>{formatDate(invoice.issue_date)}</TableCell>
        <TableCell className="text-right font-medium">{formatAmount(invoice.subtotal || invoice.total_amount)}</TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRestoreInvoice(invoice)}
              disabled={trashingId === invoice.id}
              title="Obnoviť faktúru"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Obnoviť
            </Button>
            {isAdmin && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setHardDeleteConfirm(invoice)}
                disabled={trashingId === invoice.id}
                title="Trvalo vymazať"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Vymazať
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {urgentFilterActive ? "Urgentné faktúry" : trashView ? "Kôš – zrušené faktúry" : "Prehľad faktúr"}
                {!urgentFilterActive && !trashView && overdueCount > 0 && (
                  <span className="flex items-center gap-1 text-sm font-normal text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    {overdueCount} po splatnosti
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                {urgentFilterActive
                  ? "Zobrazené sú iba faktúry splatné dnes, po splatnosti alebo do 7 dní"
                  : trashView
                  ? "Zrušené faktúry – môžete ich obnoviť alebo trvalo vymazať"
                  : "Faktúry zoskupené podľa kalendárneho týždňa"}
                {!urgentFilterActive && !trashView && dueSoonCount > 0 && (
                  <span className="ml-2 text-orange-600 dark:text-orange-400">
                    • {dueSoonCount} blíži sa splatnosť
                  </span>
                )}
              </CardDescription>
            </div>
            {urgentFilterActive && onClearUrgentFilter && (
              <Button variant="outline" size="sm" onClick={onClearUrgentFilter}>
                <XCircle className="mr-2 h-4 w-4" />
                Zrušiť urgentný filter
              </Button>
            )}
          </div>
          {/* Active / Trash view toggle */}
          {!urgentFilterActive && (
            <div className="flex items-center gap-2">
              <Button
                variant={trashView ? "outline" : "default"}
                size="sm"
                onClick={() => setTrashView(false)}
              >
                Aktívne faktúry ({activeInvoices.length})
              </Button>
              <Button
                variant={trashView ? "default" : "outline"}
                size="sm"
                onClick={() => setTrashView(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Kôš ({trashedInvoices.length})
              </Button>
            </div>
          )}
          {!urgentFilterActive && !trashView && (
            <div className="flex flex-wrap gap-2">
              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Projekt" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všetky projekty</SelectItem>
                  {projectOptions.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterWeek} onValueChange={setFilterWeek}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Týždeň" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všetky týždne</SelectItem>
                  {weekOptions.map((w) => {
                    const [yr, wk] = w.split("-");
                    return (
                      <SelectItem key={w} value={w}>KW {parseInt(wk)} / {yr}</SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Trash view */}
        {trashView && !urgentFilterActive ? (
          filteredInvoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Kôš je prázdny
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[65vh] pr-2">
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Číslo faktúry</TableHead>
                      <TableHead className="hidden lg:table-cell">KW</TableHead>
                      <TableHead>Dodávateľ</TableHead>
                      <TableHead>Projekt</TableHead>
                      <TableHead>Dátum vystavenia</TableHead>
                      <TableHead className="text-right">Suma</TableHead>
                      <TableHead className="text-right">Akcie</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((inv, idx) => renderTrashRow(inv, idx))}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile trash cards */}
              <div className="md:hidden space-y-2">
                {filteredInvoices.map((inv) => (
                  <div key={inv.id} className="border rounded-lg p-3 opacity-70 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{inv.invoice_number}</div>
                        <div className="text-sm text-muted-foreground">{inv.profile?.full_name}</div>
                      </div>
                      <div className="font-medium">{formatAmount(inv.total_amount)}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleRestoreInvoice(inv)} disabled={trashingId === inv.id}>
                        <RotateCcw className="h-4 w-4 mr-1" /> Obnoviť
                      </Button>
                      {isAdmin && (
                        <Button size="sm" variant="destructive" onClick={() => setHardDeleteConfirm(inv)} disabled={trashingId === inv.id}>
                          <Trash2 className="h-4 w-4 mr-1" /> Vymazať
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : urgentFilterActive ? (
          /* Flat urgent list — no KW grouping */
          filteredInvoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Žiadne urgentné faktúry 🎉
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[65vh] pr-2">
              {/* Mobile */}
              <div className="md:hidden space-y-0">
                {filteredInvoices.map((invoice) => (
                  <MobileInvoiceCard
                    key={invoice.id}
                    id={invoice.id}
                    invoiceNumber={invoice.invoice_number}
                    supplierName={invoice.profile?.full_name}
                    companyName={invoice.profile?.company_name}
                    projectName={invoice.project?.name}
                    issueDate={invoice.issue_date}
                    dueDate={invoice.due_date}
                    totalAmount={invoice.subtotal || invoice.total_amount}
                    status={invoice.status}
                    taxPaymentStatus={invoice.tax_payment_status || "pending"}
                    onView={(id) => {
                      const inv = filteredInvoices.find((i) => i.id === id);
                      if (inv) {
                        setSelectedInvoice(inv);
                        setDetailOpen(true);
                      }
                    }}
                    onStatusChange={onRefresh}
                  />
                ))}
              </div>
              {/* Desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Číslo faktúry</TableHead>
                      <TableHead>KW</TableHead>
                      <TableHead>Dodávateľ</TableHead>
                      <TableHead>Projekt</TableHead>
                      <TableHead>Dátum vystavenia</TableHead>
                      <TableHead>Splatnosť</TableHead>
                      <TableHead className="text-right">Suma</TableHead>
                      <TableHead>Stav platby</TableHead>
                      <TableHead>Stav dane</TableHead>
                      <TableHead className="text-right">Akcie</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((inv, idx) => renderInvoiceRow(inv, idx))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )
        ) : weekGroups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Žiadne faktúry na zobrazenie
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[65vh] pr-2">
            <Accordion
              type="multiple"
              defaultValue={latestWeekKey ? [latestWeekKey] : []}
              className="space-y-2"
            >
              {weekGroups.map((group) => (
                <AccordionItem key={group.key} value={group.key} className="border rounded-lg px-2">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-left w-full pr-4">
                      <span className="font-bold text-base">
                        KW {group.calendarWeek}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        ({group.dateRange})
                      </span>
                      <span className="text-sm text-muted-foreground ml-auto hidden sm:inline">
                        {group.invoices.length} {group.invoices.length === 1 ? "faktúra" : group.invoices.length < 5 ? "faktúry" : "faktúr"}
                      </span>
                      <span className="font-semibold text-primary text-sm sm:text-base">
                        {formatAmount(group.totalAmount)}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    {/* Mobile: Card view */}
                    <div className="md:hidden space-y-0">
                      {group.invoices.map((invoice) => (
                        <MobileInvoiceCard
                          key={invoice.id}
                          id={invoice.id}
                          invoiceNumber={invoice.invoice_number}
                          supplierName={invoice.profile?.full_name}
                          companyName={invoice.profile?.company_name}
                          projectName={invoice.project?.name}
                          issueDate={invoice.issue_date}
                          dueDate={invoice.due_date}
                          totalAmount={invoice.subtotal || invoice.total_amount}
                          status={invoice.status}
                          taxPaymentStatus={invoice.tax_payment_status || "pending"}
                          onView={(id) => {
                            const inv = group.invoices.find((i) => i.id === id);
                            if (inv) {
                              setSelectedInvoice(inv);
                              setDetailOpen(true);
                            }
                          }}
                          onStatusChange={onRefresh}
                        />
                      ))}
                    </div>

                    {/* Desktop: Table view */}
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">#</TableHead>
                            <TableHead>Číslo faktúry</TableHead>
                            <TableHead className="hidden lg:table-cell">KW</TableHead>
                            <TableHead>Dodávateľ</TableHead>
                            <TableHead>Projekt</TableHead>
                            <TableHead>Dátum vystavenia</TableHead>
                            <TableHead>Splatnosť</TableHead>
                            <TableHead className="text-right">Suma</TableHead>
                            <TableHead>Stav platby</TableHead>
                            <TableHead>Stav dane</TableHead>
                            <TableHead className="text-right">Akcie</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.invoices.map((inv, idx) => renderInvoiceRow(inv, idx))}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}

        <InvoiceDetailDialog
          invoice={selectedInvoice}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          onUpdate={() => {
            onRefresh();
            setDetailOpen(false);
          }}
        />

        <InvoicePreviewModal
          invoice={previewInvoice}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          onUpdate={() => {
            onRefresh();
            setPreviewOpen(false);
          }}
        />

        {/* Trash confirmation dialog */}
        <AlertDialog open={!!trashConfirm} onOpenChange={(open) => !open && setTrashConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Presunúť do koša?</AlertDialogTitle>
              <AlertDialogDescription>
                Faktúra {trashConfirm?.invoice_number} bude presunutá do koša. Môžete ju neskôr obnoviť.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušiť</AlertDialogCancel>
              <AlertDialogAction onClick={() => trashConfirm && handleTrashInvoice(trashConfirm)}>
                Presunúť do koša
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Hard delete confirmation dialog */}
        <AlertDialog open={!!hardDeleteConfirm} onOpenChange={(open) => !open && setHardDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Trvalo vymazať faktúru?</AlertDialogTitle>
              <AlertDialogDescription>
                Naozaj chcete túto faktúru trvalo vymazať? Tento krok sa nedá vrátiť. Faktúra {hardDeleteConfirm?.invoice_number} bude permanentne odstránená.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušiť</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => hardDeleteConfirm && handleHardDelete(hardDeleteConfirm)}
              >
                Trvalo vymazať
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
