import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Calendar, ChevronDown, ChevronUp, FileSpreadsheet } from "lucide-react";
import { format, getWeek, getYear } from "date-fns";
import { sk } from "date-fns/locale";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { exportWeeklyRecordsToExcel } from "@/lib/excelExport";

interface PerformanceRecord {
  id: string;
  date: string;
  time_from: string;
  time_to: string;
  break_minutes: number;
  total_hours: number;
  status: string;
  note: string | null;
  projects: { name: string } | null;
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
  const [weekGroups, setWeekGroups] = useState<WeekGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(new Set());
  const [userProfile, setUserProfile] = useState<{ full_name: string } | null>(null);

  const fetchData = async () => {
    if (!user) return;

    // Fetch user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    setUserProfile(profile);

    // Fetch all records for the user
    const { data: records, error: recordsError } = await supabase
      .from("performance_records")
      .select("id, date, time_from, time_to, break_minutes, total_hours, status, note, projects(name)")
      .eq("user_id", user.id)
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

  const handleExport = (group: WeekGroup) => {
    // Get unique project name(s) for this week
    const projectNames = [...new Set(group.records.map((r) => r.projects?.name).filter(Boolean))];
    const projectName = projectNames.join(", ") || "Neznámy projekt";

    exportWeeklyRecordsToExcel({
      records: group.records.map((r) => ({
        date: r.date,
        time_from: r.time_from,
        time_to: r.time_to,
        break_minutes: r.break_minutes || 0,
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
        <h2 className="text-2xl font-bold text-foreground">Týždňové uzávierky</h2>
        <p className="text-muted-foreground">Prehľad a odoslanie vašich výkonov po týždňoch</p>
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
                        <div>
                          <CardTitle className="text-lg">
                            KW {group.week}/{group.year}
                          </CardTitle>
                          <CardDescription>
                            {group.records.length} záznamov • {Math.round(group.totalHours * 10) / 10}h
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <StatusBadge status={group.closingStatus as any} />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleExport(group)}
                        >
                          <FileSpreadsheet className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Export Excel</span>
                        </Button>
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
                    {group.returnComment && (
                      <div className="mt-3 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                        <p className="text-sm text-destructive">
                          <strong>Dôvod vrátenia:</strong> {group.returnComment}
                        </p>
                      </div>
                    )}
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
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
