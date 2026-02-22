import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, Search, FileSpreadsheet, FileText, Trash2 } from "lucide-react";
import { format, startOfISOWeek, endOfISOWeek, addDays } from "date-fns";
import { sk } from "date-fns/locale";
import { isDateInWeek } from "@/lib/dateUtils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
import { Navigate } from "react-router-dom";
import { exportWeeklyRecordsToExcel } from "@/lib/excelExport";
import { generateInvoicePDF } from "@/lib/invoiceGenerator";
import { ProjectExportSection } from "@/components/approvals/ProjectExportSection";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Profile {
  full_name: string;
  company_name: string | null;
  billing_address: string | null;
  hourly_rate: number | null;
  iban: string | null;
  swift_bic: string | null;
  signature_url: string | null;
  is_vat_payer: boolean;
  vat_number: string | null;
  ico: string | null;
  dic: string | null;
}

interface PerformanceRecord {
  id: string;
  date: string;
  time_from: string;
  time_to: string;
  break_start: string | null;
  break_end: string | null;
  break2_start: string | null;
  break2_end: string | null;
  total_hours: number;
  status: string;
  note: string | null;
  projects: { name: string; address: string | null; location: string | null } | null;
}

interface WeeklyClosing {
  id: string;
  user_id: string;
  calendar_week: number;
  year: number;
  status: string;
  profiles?: Profile | null;
}

interface ApprovedWeek {
  closing: WeeklyClosing;
  records: PerformanceRecord[];
  totalHours: number;
}

/** A week bucket grouping multiple workers */
interface WeekBucket {
  week: number;
  year: number;
  items: ApprovedWeek[];
  totalHours: number;
  totalAmount: number;
}

function getWeekDateRange(week: number, year: number): string {
  // Build a date in the target ISO week (Thursday is always in the correct week)
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${format(monday, "d.M.", { locale: sk })} – ${format(sunday, "d.M.yyyy", { locale: sk })}`;
}

export default function LockWeeks() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [approvedWeeks, setApprovedWeeks] = useState<ApprovedWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [generatingInvoice, setGeneratingInvoice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteClosingId, setDeleteClosingId] = useState<string | null>(null);
  const [deletingClosing, setDeletingClosing] = useState(false);

  const fetchData = async () => {
    if (!user) return;

    const { data: closings, error: closingsError } = await supabase
      .from("weekly_closings")
      .select("*")
      .eq("status", "approved")
      .order("year", { ascending: false })
      .order("calendar_week", { ascending: false });

    if (closingsError) {
      console.error("Error fetching closings:", closingsError);
      setLoading(false);
      return;
    }

    const userIds = [...new Set(closings?.map((c) => c.user_id) || [])];
    const { data: profiles } = await supabase
      .from("profiles")
      .select(
        "user_id, full_name, company_name, billing_address, hourly_rate, iban, swift_bic, signature_url, is_vat_payer, vat_number, ico, dic",
      )
      .in("user_id", userIds);

    const weeks: ApprovedWeek[] = [];

    for (const closing of closings || []) {
      const profile = profiles?.find((p) => p.user_id === closing.user_id);

      const { data: records } = await supabase
        .from("performance_records")
        .select(
          "id, date, time_from, time_to, break_start, break_end, break2_start, break2_end, total_hours, status, note, projects(name, address, location)",
        )
        .eq("user_id", closing.user_id)
        .eq("status", "approved")
        .is("deleted_at", null);

      const weekRecords = ((records as PerformanceRecord[]) || []).filter((r) => {
        return isDateInWeek(r.date, closing.calendar_week, closing.year);
      });

      const totalHours = weekRecords.reduce((sum, r) => sum + (Number(r.total_hours) || 0), 0);

      const closingWithProfile: WeeklyClosing = {
        ...closing,
        profiles: profile
          ? {
              full_name: profile.full_name,
              company_name: profile.company_name,
              billing_address: profile.billing_address,
              hourly_rate: profile.hourly_rate,
              iban: profile.iban,
              swift_bic: profile.swift_bic,
              signature_url: profile.signature_url,
              is_vat_payer: profile.is_vat_payer,
              vat_number: profile.vat_number,
              ico: profile.ico,
              dic: profile.dic,
            }
          : null,
      };

      weeks.push({ closing: closingWithProfile, records: weekRecords, totalHours });
    }

    setApprovedWeeks(weeks);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Group by week and filter by search
  const filteredBuckets = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    // Filter items by surname
    const filtered = q
      ? approvedWeeks.filter((w) => w.closing.profiles?.full_name?.toLowerCase().includes(q))
      : approvedWeeks;

    // Group into week buckets
    const map = new Map<string, WeekBucket>();
    for (const item of filtered) {
      const key = `${item.closing.year}-${item.closing.calendar_week}`;
      if (!map.has(key)) {
        map.set(key, {
          week: item.closing.calendar_week,
          year: item.closing.year,
          items: [],
          totalHours: 0,
          totalAmount: 0,
        });
      }
      const bucket = map.get(key)!;
      bucket.items.push(item);
      bucket.totalHours += item.totalHours;
      const rate = item.closing.profiles?.hourly_rate || 0;
      bucket.totalAmount += item.totalHours * rate;
    }

    // Sort items within each bucket by surname ascending
    for (const bucket of map.values()) {
      bucket.items.sort((a, b) => {
        const nameA = a.closing.profiles?.full_name || "";
        const nameB = b.closing.profiles?.full_name || "";
        return nameA.localeCompare(nameB, "sk");
      });
    }

    // Sort buckets by year desc, then week desc
    return Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.week - a.week;
    });
  }, [approvedWeeks, searchQuery]);

  const handleLock = async (week: ApprovedWeek) => {
    setProcessing(week.closing.id);
    try {
      const { error: closingError } = await supabase
        .from("weekly_closings")
        .update({ status: "locked" })
        .eq("id", week.closing.id);
      if (closingError) throw closingError;

      toast({
        title: "Uzamknuté",
        description: `KW ${week.closing.calendar_week}/${week.closing.year} – ${week.closing.profiles?.full_name || "?"} bol uzamknutý.`,
      });
      await fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    }
    setProcessing(null);
  };

  const handleDeleteClosing = async () => {
    if (!deleteClosingId) return;
    setDeletingClosing(true);
    try {
      // Soft-delete related invoices
      const { error: invError } = await supabase
        .from("invoices")
        .update({ deleted_at: new Date().toISOString() })
        .eq("week_closing_id", deleteClosingId);
      if (invError) throw invError;

      // Soft-delete the weekly closing
      const { error: closingError } = await supabase
        .from("weekly_closings")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", deleteClosingId);
      if (closingError) throw closingError;

      toast({
        title: "Uzávierka vymazaná",
        description: "Uzávierka a súvisiace faktúry boli vymazané.",
      });
      setDeleteClosingId(null);
      await fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    }
    setDeletingClosing(false);
  };

  const handleExport = async (week: ApprovedWeek) => {
    const firstProject = week.records.find((r) => r.projects)?.projects;

    const projectName = firstProject?.name || "Neznámy projekt";
    const projectClient = firstProject?.client || "";
    const projectLocation = firstProject?.location || null;

    try {
      const companySignatureBase64 = await getCompanySignatureBase64();

      await exportStundenzettelToExcel({
        records: week.records.map((r) => ({
          date: r.date,
          time_from: r.time_from,
          time_to: r.time_to,
          break_start: r.break_start,
          break_end: r.break_end,
          break2_start: r.break2_start,
          break2_end: r.break2_end,
          total_hours: r.total_hours,
          note: r.note,
        })),
        projectName,
        projectClient,
        projectLocation,
        workerName: week.closing.profiles?.full_name || "Neznámy používateľ",
        calendarWeek: week.closing.calendar_week,
        year: week.closing.year,
        companySignatureBase64,
      });

      toast({
        title: "Export úspešný",
        description: "Stundenzettel bol stiahnutý.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Chyba pri exporte",
        description: error.message,
      });
    }
  };

  const handleGenerateInvoice = async (week: ApprovedWeek) => {
    const profile = week.closing.profiles;
    if (!profile || !profile.hourly_rate || profile.hourly_rate <= 0) {
      toast({
        variant: "destructive",
        title: "Chýbajú fakturačné údaje používateľa",
        description: "Používateľ nemá nastavenú hodinovú sadzbu alebo chýbajú fakturačné údaje v profile.",
      });
      return;
    }

    setGeneratingInvoice(week.closing.id);
    try {
      const projectNames = [...new Set(week.records.map((r) => r.projects?.name).filter(Boolean))];
      const projectName = projectNames.join(", ") || "Projekt";

      // Calculate historical dates from the week data
      // Delivery date = last recorded working day in this week
      const workDates = week.records
        .map((r) => r.date)
        .filter(Boolean)
        .sort();
      const lastWorkDay = workDates.length > 0 ? workDates[workDates.length - 1] : null;

      // Issue date = Monday immediately after the work week
      const weekRef = new Date(week.closing.year, 0, 4); // Jan 4 is always in week 1
      const weekStart = startOfISOWeek(weekRef);
      const mondayAfterWeek = addDays(weekStart, week.closing.calendar_week * 7);
      const historicalIssueDate = format(mondayAfterWeek, "yyyy-MM-dd");
      const historicalDeliveryDate = lastWorkDay || historicalIssueDate;
      const historicalDueDate = format(addDays(mondayAfterWeek, 21), "yyyy-MM-dd");

      await generateInvoicePDF({
        supplierName: profile.full_name,
        supplierCompany: profile.company_name,
        supplierAddress: profile.billing_address,
        supplierCountry: (profile as any).country,
        supplierIco: profile.ico,
        supplierDic: profile.dic,
        supplierIban: profile.iban,
        supplierSwiftBic: profile.swift_bic,
        signatureUrl: profile.signature_url,
        hourlyRate: profile.hourly_rate,
        isVatPayer: profile.is_vat_payer ?? false,
        vatNumber: profile.vat_number,
        isReverseCharge: false,
        projectName,
        calendarWeek: week.closing.calendar_week,
        year: week.closing.year,
        totalHours: week.totalHours,
        odberatelId: week.closing.id,
        historicalIssueDate,
        historicalDeliveryDate,
        historicalDueDate,
      });
      toast({ title: "Faktúra vygenerovaná", description: "PDF faktúra bola stiahnutá." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    }
    setGeneratingInvoice(null);
  };

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

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
        <h2 className="text-2xl font-bold text-foreground">Uzamknutie týždňov</h2>
        <p className="text-muted-foreground">Finálne uzamknutie schválených týždňov</p>
      </div>

      <ProjectExportSection />

      {/* Search filter */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Hľadať podľa priezviska..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {filteredBuckets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Lock className="h-12 w-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">
              {searchQuery ? "Žiadne výsledky pre zadané meno." : "Žiadne schválené týždne na uzamknutie."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Accordion
          type="single"
          collapsible
          defaultValue={
            filteredBuckets.length > 0 ? `${filteredBuckets[0].year}-${filteredBuckets[0].week}` : undefined
          }
        >
          {filteredBuckets.map((bucket) => {
            const key = `${bucket.year}-${bucket.week}`;
            const dateRange = getWeekDateRange(bucket.week, bucket.year);

            return (
              <AccordionItem key={key} value={key} className="border-b-0 mb-3">
                <AccordionTrigger className="hover:no-underline rounded-lg bg-muted/50 px-3 py-3 md:px-4 [&[data-state=open]]:bg-muted">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full pr-2 gap-1 sm:gap-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="font-semibold text-sm sm:text-base">
                        KW {bucket.week}{" "}
                        <span className="text-muted-foreground font-normal text-xs sm:text-sm">({dateRange})</span>
                      </span>
                      <StatusBadge status="approved" />
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                      <span>
                        {bucket.items.length} {bucket.items.length === 1 ? "osoba" : "osôb"}
                      </span>
                      <span>{Math.round(bucket.totalHours * 10) / 10}h</span>
                      <span className="font-semibold text-foreground">
                        €
                        {bucket.totalAmount.toLocaleString("de-DE", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-0">
                  {/* Desktop: Table view */}
                  <Card className="hidden md:block">
                    <div className="overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Spolupracovník</TableHead>
                            <TableHead className="text-right">Hodiny</TableHead>
                            <TableHead className="text-right">Suma (€)</TableHead>
                            <TableHead className="text-right">Akcie</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bucket.items.map((item) => {
                            const rate = item.closing.profiles?.hourly_rate || 0;
                            const amount = item.totalHours * rate;

                            return (
                              <TableRow key={item.closing.id}>
                                <TableCell>
                                  <div>
                                    <span className="font-medium">{item.closing.profiles?.full_name || "Neznámy"}</span>
                                    {item.closing.profiles?.company_name && (
                                      <span className="text-muted-foreground text-xs ml-2">
                                        {item.closing.profiles.company_name}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {Math.round(item.totalHours * 10) / 10}h
                                </TableCell>
                                <TableCell className="text-right font-mono font-semibold">
                                  €
                                  {amount.toLocaleString("de-DE", {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 2,
                                  })}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleExport(item)}
                                      title="Export Excel"
                                    >
                                      <FileSpreadsheet className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleGenerateInvoice(item)}
                                      disabled={generatingInvoice === item.closing.id}
                                      title="Generovať faktúru"
                                    >
                                      {generatingInvoice === item.closing.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <FileText className="h-4 w-4" />
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => handleLock(item)}
                                      disabled={processing === item.closing.id}
                                      title="Uzamknúť"
                                    >
                                      {processing === item.closing.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Lock className="h-4 w-4" />
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setDeleteClosingId(item.closing.id)}
                                      title="Vymazať uzávierku"
                                      className="text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>

                  {/* Mobile: Card view */}
                  <div className="md:hidden space-y-2">
                    {bucket.items.map((item) => {
                      const rate = item.closing.profiles?.hourly_rate || 0;
                      const amount = item.totalHours * rate;

                      return (
                        <Card key={item.closing.id} className="p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-medium text-sm">{item.closing.profiles?.full_name || "Neznámy"}</p>
                              {item.closing.profiles?.company_name && (
                                <p className="text-xs text-muted-foreground">{item.closing.profiles.company_name}</p>
                              )}
                            </div>
                            <span className="font-semibold text-sm">
                              €{amount.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground font-mono">
                              {Math.round(item.totalHours * 10) / 10}h × €{rate}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => handleExport(item)}
                                title="Export Excel"
                              >
                                <FileSpreadsheet className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => handleGenerateInvoice(item)}
                                disabled={generatingInvoice === item.closing.id}
                                title="Generovať faktúru"
                              >
                                {generatingInvoice === item.closing.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <FileText className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-8 w-8 p-0"
                                onClick={() => handleLock(item)}
                                disabled={processing === item.closing.id}
                                title="Uzamknúť"
                              >
                                {processing === item.closing.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Lock className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                onClick={() => setDeleteClosingId(item.closing.id)}
                                title="Vymazať uzávierku"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Delete closing confirmation */}
      <AlertDialog open={!!deleteClosingId} onOpenChange={(open) => !open && setDeleteClosingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Naozaj zmazať uzávierku a súvisiace faktúry?</AlertDialogTitle>
            <AlertDialogDescription>
              Táto akcia vymaže uzávierku a všetky prepojené faktúry. Údaje budú označené ako vymazané.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingClosing}>Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClosing}
              disabled={deletingClosing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingClosing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Vymazať
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
