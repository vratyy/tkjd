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
import { TaxPaymentStatusBadge } from "./TaxPaymentStatusBadge";
import { InvoiceDetailDialog } from "./InvoiceDetailDialog";
import { InvoiceStatusDropdown } from "./InvoiceStatusDropdown";
import { MobileInvoiceCard } from "@/components/mobile/MobileInvoiceCard";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Eye, Lock, Unlock, BookCheck, BookX, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { format, startOfISOWeek, endOfISOWeek } from "date-fns";
import { sk } from "date-fns/locale";
import { generateInvoicePDF } from "@/lib/invoiceGenerator";
import { getISOWeekLocal } from "@/lib/dateUtils";
import type { Invoice } from "@/hooks/useFinancialData";

interface InvoicesTrafficTableProps {
  invoices: Invoice[];
  loading: boolean;
  onMarkAsPaid: (invoiceId: string) => void;
  onRefresh: () => void;
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

export function InvoicesTrafficTable({ invoices, loading, onMarkAsPaid, onRefresh }: InvoicesTrafficTableProps) {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [lockingId, setLockingId] = useState<string | null>(null);
  const [accountingId, setAccountingId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { isAdmin } = useUserRole();

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

  // Group invoices by calendar week, sorted descending (latest first)
  const weekGroups = useMemo<WeekGroup[]>(() => {
    const groups = new Map<string, WeekGroup>();

    invoices.forEach((inv) => {
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
      group.totalAmount += Number(inv.total_amount) || 0;
    });

    // Sort groups descending by key (year-week)
    return Array.from(groups.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [invoices]);

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
    <TableRow key={invoice.id}>
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
      <TableCell className="text-right font-medium">{formatAmount(invoice.total_amount)}</TableCell>
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
              setSelectedInvoice(invoice);
              setDetailOpen(true);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Prehľad faktúr
              {overdueCount > 0 && (
                <span className="flex items-center gap-1 text-sm font-normal text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {overdueCount} po splatnosti
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Faktúry zoskupené podľa kalendárneho týždňa
              {dueSoonCount > 0 && (
                <span className="ml-2 text-orange-600 dark:text-orange-400">
                  • {dueSoonCount} blíži sa splatnosť
                </span>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {weekGroups.length === 0 ? (
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
                          totalAmount={invoice.total_amount}
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
      </CardContent>
    </Card>
  );
}
