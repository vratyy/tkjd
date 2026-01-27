import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { MobileRecordCard } from "@/components/mobile/MobileRecordCard";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Calendar, ChevronDown, ChevronUp, FileSpreadsheet, FileText, Clock } from "lucide-react";
import { format, getWeek, getYear } from "date-fns";
import { sk } from "date-fns/locale";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportWeeklyRecordsToExcel } from "@/lib/excelExport";
import { exportStundenzettelToExcel } from "@/lib/stundenzettelExport";
import { generateInvoicePDF } from "@/lib/invoiceGenerator";

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
  projects: { name: string; client: string; location: string | null } | null;
}

interface WeekGroup {
  week: number;
  year: number;
  records: PerformanceRecord[];
  closingId?: string;
  closingStatus?: string;
  returnComment?: string | null;
  totalHours: number;
}

export default function WeeklyClosings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [weekGroups, setWeekGroups] = useState<WeekGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(new Set());
  const [userProfile, setUserProfile] = useState<{
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
  } | null>(null);
  const [generatingInvoice, setGeneratingInvoice] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) return;

    // Fetch user profile with billing info
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, company_name, billing_address, hourly_rate, iban, swift_bic, signature_url, is_vat_payer, vat_number, ico, dic")
      .eq("user_id", user.id)
      .maybeSingle();

    setUserProfile(profile);

    // Fetch all records for the user
    const { data: records, error: recordsError } = await supabase
      .from("performance_records")
      .select("id, date, time_from, time_to, break_start, break_end, total_hours, status, note, projects(name, client, location)")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("date", { ascending: false });

    if (recordsError) {
      console.error("Error fetching records:", recordsError);
      setLoading(false);
      return;
    }

    // Fetch all weekly closings for the user
    const { data: closings, error: closingsError } = await supabase
      .from("weekly_closings")
      .select("*")
      .eq("user_id", user.id);

    if (closingsError) {
      console.error("Error fetching closings:", closingsError);
    }

    // Group records by week
    const grouped = new Map<string, WeekGroup>();
    
    (records as PerformanceRecord[] || []).forEach((record) => {
      const recordDate = new Date(record.date);
      const week = getWeek(recordDate, { weekStartsOn: 1 });
      const year = getYear(recordDate);
      const key = `${year}-${week}`;

      if (!grouped.has(key)) {
        // Find corresponding closing
        const closing = closings?.find(
          (c: any) => c.calendar_week === week && c.year === year
        );

        grouped.set(key, {
          week,
          year,
          records: [],
          closingId: closing?.id,
          closingStatus: closing?.status || "open",
          returnComment: (closing as any)?.return_comment,
          totalHours: 0,
        });
      }

      const group = grouped.get(key)!;
      group.records.push(record);
      group.totalHours += Number(record.total_hours) || 0;
    });

    // Sort by year and week descending
    const sortedGroups = Array.from(grouped.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.week - a.week;
    });

    setWeekGroups(sortedGroups);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleSubmitWeek = async (group: WeekGroup) => {
    if (!user) return;

    const key = `${group.year}-${group.week}`;
    setSubmitting(key);

    try {
      // Update all draft/returned records in this week to submitted
      const recordIds = group.records
        .filter((r) => r.status === "draft" || r.status === "returned")
        .map((r) => r.id);

      if (recordIds.length > 0) {
        const { error: updateError } = await supabase
          .from("performance_records")
          .update({ status: "submitted" })
          .in("id", recordIds);

        if (updateError) throw updateError;
      }

      // Create or update weekly closing
      if (group.closingId) {
        const { error: closingError } = await supabase
          .from("weekly_closings")
          .update({ status: "submitted", submitted_at: new Date().toISOString() })
          .eq("id", group.closingId);

        if (closingError) throw closingError;
      } else {
        const { error: insertError } = await supabase.from("weekly_closings").insert({
          user_id: user.id,
          calendar_week: group.week,
          year: group.year,
          status: "submitted",
          submitted_at: new Date().toISOString(),
        });

        if (insertError) throw insertError;
      }

      toast({
        title: "Týždeň odoslaný",
        description: `KW ${group.week}/${group.year} bol odoslaný na schválenie.`,
      });

      await fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: error.message,
      });
    }

    setSubmitting(null);
  };

  const toggleWeek = (key: string) => {
    const newOpen = new Set(openWeeks);
    if (newOpen.has(key)) {
      newOpen.delete(key);
    } else {
      newOpen.add(key);
    }
    setOpenWeeks(newOpen);
  };

  const canSubmit = (group: WeekGroup) => {
    const hasEditableRecords = group.records.some(
      (r) => r.status === "draft" || r.status === "returned"
    );
    return hasEditableRecords && group.closingStatus !== "locked";
  };

  const handleExportLeistungsnachweis = (group: WeekGroup) => {
    // Get unique project name(s) for this week
    const projectNames = [...new Set(group.records.map((r) => r.projects?.name).filter(Boolean))];
    const projectName = projectNames.join(", ") || "Neznámy projekt";

    exportWeeklyRecordsToExcel({
      records: group.records.map((r) => ({
        date: r.date,
        time_from: r.time_from,
        time_to: r.time_to,
        break_start: r.break_start,
        break_end: r.break_end,
        total_hours: r.total_hours,
        note: r.note,
      })),
      projectName,
      workerName: userProfile?.full_name || "Neznámy používateľ",
      calendarWeek: group.week,
      year: group.year,
    });

    toast({
      title: "Export úspešný",
      description: `Leistungsnachweis pre KW ${group.week}/${group.year} bol stiahnutý.`,
    });
  };

  const handleExportStundenzettel = (group: WeekGroup) => {
    // Get project info for this week
    const firstProject = group.records.find((r) => r.projects)?.projects;
    const projectName = firstProject?.name || "Neznámy projekt";
    const projectClient = firstProject?.client || "";
    const projectLocation = firstProject?.location || null;

    exportStundenzettelToExcel({
      records: group.records.map((r) => ({
        date: r.date,
        time_from: r.time_from,
        time_to: r.time_to,
        break_start: r.break_start,
        break_end: r.break_end,
        total_hours: r.total_hours,
        note: r.note,
      })),
      projectName,
      projectClient,
      projectLocation,
      workerName: userProfile?.full_name || "Neznámy používateľ",
      calendarWeek: group.week,
      year: group.year,
    });

    toast({
      title: "Export úspešný",
      description: `Stundenzettel pre KW ${group.week}/${group.year} bol stiahnutý.`,
    });
  };

  const canGenerateInvoice = (group: WeekGroup) => {
    return (
      (group.closingStatus === "approved" || group.closingStatus === "locked") &&
      userProfile?.hourly_rate &&
      userProfile.hourly_rate > 0
    );
  };

  const handleGenerateInvoice = async (group: WeekGroup) => {
    if (!userProfile || !userProfile.hourly_rate) {
      toast({
        variant: "destructive",
        title: "Chýbajúce údaje",
        description: "Najprv vyplňte hodinovú sadzbu v profile.",
      });
      return;
    }

    const key = `${group.year}-${group.week}`;
    setGeneratingInvoice(key);

    try {
      const projectNames = [...new Set(group.records.map((r) => r.projects?.name).filter(Boolean))];
      const projectName = projectNames.join(", ") || "Projekt";

      await generateInvoicePDF({
        supplierName: userProfile.full_name,
        supplierCompany: userProfile.company_name,
        supplierAddress: userProfile.billing_address,
        supplierIco: userProfile.ico,
        supplierDic: userProfile.dic,
        supplierIban: userProfile.iban,
        supplierSwiftBic: userProfile.swift_bic,
        signatureUrl: userProfile.signature_url,
        hourlyRate: userProfile.hourly_rate,
        isVatPayer: userProfile.is_vat_payer ?? false,
        vatNumber: userProfile.vat_number,
        isReverseCharge: false,
        projectName,
        calendarWeek: group.week,
        year: group.year,
        totalHours: group.totalHours,
        odberatelId: group.closingId,
      });

      toast({
        title: "Faktúra vygenerovaná",
        description: `PDF faktúra pre KW ${group.week}/${group.year} bola stiahnutá.`,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-foreground">Týždňové uzávierky</h2>
        <p className="text-muted-foreground text-sm md:text-base">Prehľad a odoslanie vašich výkonov po týždňoch</p>
      </div>

      {weekGroups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">Zatiaľ nemáte žiadne záznamy.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {weekGroups.map((group) => {
            const key = `${group.year}-${group.week}`;
            const isOpen = openWeeks.has(key);

            return (
              <Card key={key}>
                <Collapsible open={isOpen} onOpenChange={() => toggleWeek(key)}>
                  <CardHeader className="pb-3 p-4 md:p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 md:gap-4">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="p-0 h-auto">
                            {isOpen ? (
                              <ChevronUp className="h-5 w-5" />
                            ) : (
                              <ChevronDown className="h-5 w-5" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <div>
                          <CardTitle className="text-base md:text-lg">
                            KW {group.week}/{group.year}
                          </CardTitle>
                          <CardDescription className="text-xs md:text-sm">
                            {group.records.length} záznamov • {Math.round(group.totalHours * 10) / 10}h
                          </CardDescription>
                        </div>
                        <StatusBadge status={group.closingStatus as any} />
                      </div>
                      
                      {/* Desktop action buttons */}
                      <div className="hidden md:flex items-center gap-2 sm:gap-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline">
                              <FileSpreadsheet className="h-4 w-4 sm:mr-2" />
                              <span className="hidden sm:inline">Export Excel</span>
                              <ChevronDown className="h-3 w-3 ml-1" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleExportStundenzettel(group)}>
                              <Clock className="h-4 w-4 mr-2" />
                              Stundenzettel (hodinový)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportLeistungsnachweis(group)}>
                              <FileSpreadsheet className="h-4 w-4 mr-2" />
                              Leistungsnachweis (prehľad)
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {canGenerateInvoice(group) && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleGenerateInvoice(group)}
                            disabled={generatingInvoice === key}
                          >
                            {generatingInvoice === key ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <FileText className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Faktúra PDF</span>
                              </>
                            )}
                          </Button>
                        )}
                        {canSubmit(group) && (
                          <Button
                            size="sm"
                            onClick={() => handleSubmitWeek(group)}
                            disabled={submitting === key}
                          >
                            {submitting === key ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Send className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Odoslať týždeň</span>
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Mobile action buttons - stacked */}
                    <div className="flex flex-wrap gap-2 mt-3 md:hidden">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" className="flex-1 h-10 text-sm">
                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                            Excel
                            <ChevronDown className="h-3 w-3 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={() => handleExportStundenzettel(group)}>
                            <Clock className="h-4 w-4 mr-2" />
                            Stundenzettel
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExportLeistungsnachweis(group)}>
                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                            Leistungsnachweis
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {canGenerateInvoice(group) && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleGenerateInvoice(group)}
                          disabled={generatingInvoice === key}
                          className="flex-1 h-10 text-sm"
                        >
                          {generatingInvoice === key ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <FileText className="h-4 w-4 mr-2" />
                              Faktúra
                            </>
                          )}
                        </Button>
                      )}
                      {canSubmit(group) && (
                        <Button
                          size="sm"
                          onClick={() => handleSubmitWeek(group)}
                          disabled={submitting === key}
                          className="w-full h-10 text-sm"
                        >
                          {submitting === key ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Odoslať týždeň
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                    
                    {group.returnComment && (
                      <div className="mt-3 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                        <p className="text-sm text-destructive">
                          <strong>Dôvod vrátenia:</strong> {group.returnComment}
                        </p>
                      </div>
                    )}
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="pt-0 px-4 pb-4 md:px-6 md:pb-6">
                      {/* Mobile: Card view */}
                      <div className="md:hidden space-y-0">
                        {group.records.map((record) => (
                          <MobileRecordCard
                            key={record.id}
                            id={record.id}
                            date={record.date}
                            projectName={record.projects?.name}
                            timeFrom={record.time_from}
                            timeTo={record.time_to}
                            totalHours={record.total_hours}
                            status={record.status}
                            note={record.note}
                          />
                        ))}
                      </div>
                      
                      {/* Desktop: List view */}
                      <div className="hidden md:block space-y-2">
                        {group.records.map((record) => (
                          <div
                            key={record.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {format(new Date(record.date), "EEEE, d. MMM", { locale: sk })}
                                </span>
                                <StatusBadge status={record.status as any} />
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
