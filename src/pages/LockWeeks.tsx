import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, User, ChevronDown, ChevronUp, FileSpreadsheet, FileText } from "lucide-react";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Navigate } from "react-router-dom";
import { exportWeeklyRecordsToExcel } from "@/lib/excelExport";
import { generateInvoicePDF } from "@/lib/invoiceGenerator";

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
  total_hours: number;
  status: string;
  note: string | null;
  projects: { name: string } | null;
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

export default function LockWeeks() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [approvedWeeks, setApprovedWeeks] = useState<ApprovedWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const [generatingInvoice, setGeneratingInvoice] = useState<string | null>(null);

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

    // Fetch profiles separately
    const userIds = [...new Set(closings?.map(c => c.user_id) || [])];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, company_name, billing_address, hourly_rate, iban, swift_bic, signature_url, is_vat_payer, vat_number, ico, dic")
      .in("user_id", userIds);

    const weeks: ApprovedWeek[] = [];

    for (const closing of closings || []) {
      const profile = profiles?.find(p => p.user_id === closing.user_id);
      
      const { data: records } = await supabase
        .from("performance_records")
        .select("id, date, time_from, time_to, break_start, break_end, total_hours, status, note, projects(name)")
        .eq("user_id", closing.user_id)
        .eq("status", "approved")
        .is("deleted_at", null);

      const weekRecords = (records as PerformanceRecord[] || []).filter((r) => {
        const recordDate = new Date(r.date);
        const week = getWeek(recordDate);
        const year = recordDate.getFullYear();
        return week === closing.calendar_week && year === closing.year;
      });

      const totalHours = weekRecords.reduce((sum, r) => sum + (Number(r.total_hours) || 0), 0);

      const closingWithProfile: WeeklyClosing = {
        ...closing,
        profiles: profile ? {
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
        } : null
      };

      weeks.push({
        closing: closingWithProfile,
        records: weekRecords,
        totalHours,
      });
    }

    setApprovedWeeks(weeks);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const getWeek = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  };

  const handleLock = async (week: ApprovedWeek) => {
    setProcessing(week.closing.id);

    try {
      // Update closing status to locked
      const { error: closingError } = await supabase
        .from("weekly_closings")
        .update({ status: "locked" })
        .eq("id", week.closing.id);

      if (closingError) throw closingError;

      toast({
        title: "Uzamknuté",
        description: `KW ${week.closing.calendar_week}/${week.closing.year} bol uzamknutý.`,
      });

      await fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: error.message,
      });
    }

    setProcessing(null);
  };

  const handleExport = (week: ApprovedWeek) => {
    const projectNames = [...new Set(week.records.map((r) => r.projects?.name).filter(Boolean))];
    const projectName = projectNames.join(", ") || "Neznámy projekt";

    exportWeeklyRecordsToExcel({
      records: week.records.map((r) => ({
        date: r.date,
        time_from: r.time_from,
        time_to: r.time_to,
        break_start: r.break_start,
        break_end: r.break_end,
        total_hours: r.total_hours,
        note: r.note,
      })),
      projectName,
      workerName: week.closing.profiles?.full_name || "Neznámy používateľ",
      calendarWeek: week.closing.calendar_week,
      year: week.closing.year,
    });

    toast({
      title: "Export úspešný",
      description: `Leistungsnachweis bol stiahnutý.`,
    });
  };

  const canGenerateInvoice = (week: ApprovedWeek) => {
    return (
      week.closing.profiles?.hourly_rate &&
      week.closing.profiles.hourly_rate > 0
    );
  };

  const handleGenerateInvoice = async (week: ApprovedWeek) => {
    const profile = week.closing.profiles;
    if (!profile || !profile.hourly_rate) {
      toast({
        variant: "destructive",
        title: "Chýbajúce údaje",
        description: "Používateľ nemá nastavenú hodinovú sadzbu.",
      });
      return;
    }

    setGeneratingInvoice(week.closing.id);

    try {
      const projectNames = [...new Set(week.records.map((r) => r.projects?.name).filter(Boolean))];
      const projectName = projectNames.join(", ") || "Projekt";

      await generateInvoicePDF({
        supplierName: profile.full_name,
        supplierCompany: profile.company_name,
        supplierAddress: profile.billing_address,
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
      });

      toast({
        title: "Faktúra vygenerovaná",
        description: `PDF faktúra bola stiahnutá.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: error.message,
      });
    }

    setGeneratingInvoice(null);
  };

  const toggleItem = (id: string) => {
    const newOpen = new Set(openItems);
    if (newOpen.has(id)) {
      newOpen.delete(id);
    } else {
      newOpen.add(id);
    }
    setOpenItems(newOpen);
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

      {approvedWeeks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Lock className="h-12 w-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">Žiadne schválené týždne na uzamknutie.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {approvedWeeks.map((week) => {
            const isOpen = openItems.has(week.closing.id);

            return (
              <Card key={week.closing.id}>
                <Collapsible open={isOpen} onOpenChange={() => toggleItem(week.closing.id)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="p-0 h-auto">
                            {isOpen ? (
                              <ChevronUp className="h-5 w-5" />
                            ) : (
                              <ChevronDown className="h-5 w-5" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                          <User className="h-5 w-5 text-success" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {week.closing.profiles?.full_name || "Neznámy používateľ"}
                          </CardTitle>
                          <CardDescription>
                            KW {week.closing.calendar_week}/{week.closing.year} •{" "}
                            {week.records.length} záznamov •{" "}
                            {Math.round(week.totalHours * 10) / 10}h
                            {week.closing.profiles?.company_name && (
                              <> • {week.closing.profiles.company_name}</>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status="approved" />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleExport(week)}
                        >
                          <FileSpreadsheet className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Export</span>
                        </Button>
                        {canGenerateInvoice(week) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleGenerateInvoice(week)}
                            disabled={generatingInvoice === week.closing.id}
                          >
                            {generatingInvoice === week.closing.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <FileText className="h-4 w-4 sm:mr-1" />
                                <span className="hidden sm:inline">Faktúra</span>
                              </>
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleLock(week)}
                          disabled={processing === week.closing.id}
                        >
                          {processing === week.closing.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Lock className="h-4 w-4 sm:mr-1" />
                              <span className="hidden sm:inline">Uzamknúť</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {week.records.map((record) => (
                          <div
                            key={record.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {format(new Date(record.date), "EEEE, d. MMM", { locale: sk })}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {record.projects?.name || "—"} • {record.time_from} - {record.time_to}
                                {record.note && ` • ${record.note}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="font-semibold">{record.total_hours}h</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
