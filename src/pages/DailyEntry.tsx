import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Info, Edit, Trash2, Clock, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { StatusBadge } from "@/components/StatusBadge";
import { getISOWeekLocal, getISOWeekYear, parseLocalDate } from "@/lib/dateUtils";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Project {
  id: string;
  name: string;
  client: string;
  standard_hours: number | null;
}

interface TodayRecord {
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
  created_at: string;
  project_id: string;
  projects: { name: string } | null;
}

export default function DailyEntry() {
  const { user } = useAuth();
  const { isAdmin, isDirector } = useUserRole();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [todayRecords, setTodayRecords] = useState<TodayRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Grace period state removed

  // Form state
  const [projectId, setProjectId] = useState("");
  const [selectedStandardHours, setSelectedStandardHours] = useState<number | null>(null);
  const [date, setDate] = useState(searchParams.get("date") || format(new Date(), "yyyy-MM-dd"));
  const [timeFrom, setTimeFrom] = useState("07:00");
  const [timeTo, setTimeTo] = useState("15:30");
  const [breakStart, setBreakStart] = useState("12:00");
  const [breakEnd, setBreakEnd] = useState("12:30");
  const [break2Start, setBreak2Start] = useState("");
  const [break2End, setBreak2End] = useState("");
  const [note, setNote] = useState("");
  const [manualHours, setManualHours] = useState<string>("");
  const [isManualOverride, setIsManualOverride] = useState(false);

  // No longer needed — grace period removed
  // Kept for potential future use with other timed UI updates

  // Calculate duration with two breaks
  const calculatedHours = useMemo(() => {
    if (!timeFrom || !timeTo) return 0;
    const [fromH, fromM] = timeFrom.split(":").map(Number);
    const [toH, toM] = timeTo.split(":").map(Number);
    const fromMinutes = fromH * 60 + fromM;
    const toMinutes = toH * 60 + toM;

    let break1Mins = 0;
    if (breakStart && breakEnd) {
      const [breakStartH, breakStartM] = breakStart.split(":").map(Number);
      const [breakEndH, breakEndM] = breakEnd.split(":").map(Number);
      break1Mins = breakEndH * 60 + breakEndM - (breakStartH * 60 + breakStartM);
    }

    let break2Mins = 0;
    if (break2Start && break2End) {
      const [break2StartH, break2StartM] = break2Start.split(":").map(Number);
      const [break2EndH, break2EndM] = break2End.split(":").map(Number);
      break2Mins = break2EndH * 60 + break2EndM - (break2StartH * 60 + break2StartM);
    }

    const totalMinutes = toMinutes - fromMinutes - break1Mins - break2Mins;
    return Math.round(totalMinutes / 60 * 100) / 100;
  }, [timeFrom, timeTo, breakStart, breakEnd, break2Start, break2End]);

  useEffect(() => {
    if (!isManualOverride && calculatedHours > 0) {
      setManualHours(calculatedHours.toString());
    }
  }, [calculatedHours, isManualOverride]);

  const handleManualHoursChange = (value: string) => {
    setManualHours(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue !== calculatedHours) {
      setIsManualOverride(true);
    }
  };

  const handleTimeFromChange = (value: string) => { setTimeFrom(value); setIsManualOverride(false); };
  const handleTimeToChange = (value: string) => { setTimeTo(value); setIsManualOverride(false); };

  /** Auto-suggest +30 min for break end when break start is entered */
  const addMinutes = (time: string, mins: number): string => {
    const [h, m] = time.split(":").map(Number);
    const total = h * 60 + m + mins;
    const newH = Math.floor(total / 60) % 24;
    const newM = total % 60;
    return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
  };

  const handleBreakStartChange = (value: string) => {
    setBreakStart(value);
    // Auto-suggest end = start + 30 min (user can still change it)
    if (value && !breakEnd) {
      setBreakEnd(addMinutes(value, 30));
    } else if (value) {
      // If end already set but user changed start, suggest new end
      setBreakEnd(addMinutes(value, 30));
    }
    setIsManualOverride(false);
  };
  const handleBreakEndChange = (value: string) => { setBreakEnd(value); setIsManualOverride(false); };

  const handleBreak2StartChange = (value: string) => {
    setBreak2Start(value);
    // Auto-suggest end = start + 30 min (user can still change it)
    if (value) {
      setBreak2End(addMinutes(value, 30));
    }
    setIsManualOverride(false);
  };
  const handleBreak2EndChange = (value: string) => { setBreak2End(value); setIsManualOverride(false); };

  const fetchTodayRecords = useCallback(async () => {
    if (!user) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const selectCols = "id, date, time_from, time_to, break_start, break_end, break2_start, break2_end, total_hours, status, note, created_at, project_id, projects(name)";

    // Fetch today's records + any returned/rejected records (any date)
    const [todayRes, returnedRes] = await Promise.all([
      supabase
        .from("performance_records")
        .select(selectCols)
        .eq("user_id", user.id)
        .eq("date", today)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("performance_records")
        .select(selectCols)
        .eq("user_id", user.id)
        .in("status", ["returned", "rejected"])
        .neq("date", today) // avoid duplicates with today query
        .is("deleted_at", null)
        .order("date", { ascending: false }),
    ]);

    const todayData = (todayRes.data as TodayRecord[]) || [];
    const returnedData = (returnedRes.data as TodayRecord[]) || [];
    setTodayRecords([...todayData, ...returnedData]);
  }, [user]);

  useEffect(() => {
    async function fetchProjects() {
      if (!user) return;

      if (isAdmin) {
        // Admins see all active projects
        const { data, error } = await supabase
          .from("projects")
          .select("id, name, client, standard_hours")
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("name");
        if (error) {
          console.error("Error fetching projects:", error);
        } else {
          setProjects(data || []);
        }
      } else {
        // Monters/others: only see assigned projects
        const { data: assignments, error: aErr } = await supabase
          .from("project_assignments")
          .select("project_id")
          .eq("user_id", user.id);

        if (aErr) {
          console.error("Error fetching assignments:", aErr);
          setProjects([]);
        } else {
          const assignedIds = (assignments || []).map((a) => a.project_id);
          if (assignedIds.length === 0) {
            setProjects([]);
          } else {
            const { data, error } = await supabase
              .from("projects")
              .select("id, name, client, standard_hours")
              .eq("is_active", true)
              .is("deleted_at", null)
              .in("id", assignedIds)
              .order("name");
            if (error) {
              console.error("Error fetching projects:", error);
            } else {
              setProjects(data || []);
            }
          }
        }
      }
      setLoading(false);
    }
    fetchProjects();
    fetchTodayRecords();
  }, [fetchTodayRecords, user, isAdmin]);

  const resetForm = () => {
    setNote("");
    setProjectId("");
    setSelectedStandardHours(null);
    setManualHours("");
    setIsManualOverride(false);
    setBreak2Start("");
    setBreak2End("");
    setTimeFrom("07:00");
    setTimeTo("15:30");
    setBreakStart("12:00");
    setBreakEnd("12:30");
    setEditingId(null);
  };

  const handleEdit = (record: TodayRecord) => {
    setEditingId(record.id);
    setProjectId(record.project_id);
    setDate(record.date);
    setTimeFrom(record.time_from);
    setTimeTo(record.time_to);
    setBreakStart(record.break_start || "");
    setBreakEnd(record.break_end || "");
    setBreak2Start(record.break2_start || "");
    setBreak2End(record.break2_end || "");
    setNote(record.note || "");
    setManualHours(String(record.total_hours));
    setIsManualOverride(false);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const { error } = await supabase
      .from("performance_records")
      .delete()
      .eq("id", deletingId);

    if (error) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    } else {
      toast({ title: "Zmazané", description: "Záznam bol odstránený." });
      await fetchTodayRecords();
    }
    setDeleteDialogOpen(false);
    setDeletingId(null);
  };

  /** Handle project selection — pre-fill times if standard_hours is set */
  const handleProjectChange = (value: string) => {
    setProjectId(value);
    const selected = projects.find((p) => p.id === value);
    const stdHours = selected?.standard_hours ?? null;
    setSelectedStandardHours(stdHours);

    // Pre-fill times based on project (only when not editing)
    if (!editingId) {
      const isRivaLiving = selected?.name?.toLowerCase().includes("riva living");

      if (isRivaLiving) {
        // Riva Living specific schedule
        setTimeFrom("06:30");
        setTimeTo("17:30");
        setBreakStart("09:30");
        setBreakEnd("10:00");
        setBreak2Start("13:30");
        setBreak2End("14:00");
        setIsManualOverride(false);
      } else if (stdHours && stdHours > 0) {
        const startHour = 7;
        const startMin = 0;
        const breakDuration = 30; // 30 min default break
        const totalMinutes = stdHours * 60 + breakDuration;
        const endHour = Math.floor((startHour * 60 + startMin + totalMinutes) / 60);
        const endMin = (startHour * 60 + startMin + totalMinutes) % 60;

        setTimeFrom(`${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`);
        setTimeTo(`${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`);
        setBreakStart("12:00");
        setBreakEnd("12:30");
        setBreak2Start("");
        setBreak2End("");
        setIsManualOverride(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !projectId) return;

    const finalHours = parseFloat(manualHours) || calculatedHours;
    if (finalHours <= 0) {
      toast({ variant: "destructive", title: "Chyba", description: "Odpracované hodiny musia byť väčšie ako 0." });
      return;
    }

    // Check if target date belongs to a locked week
    if (editingId) {
      const targetDate = parseLocalDate(date);
      const targetWeek = getISOWeekLocal(targetDate);
      const targetYear = getISOWeekYear(targetDate);

      const { data: lockedClosing } = await supabase
        .from("weekly_closings")
        .select("id, status")
        .eq("user_id", user.id)
        .eq("calendar_week", targetWeek)
        .eq("year", targetYear)
        .eq("status", "locked")
        .maybeSingle();

      if (lockedClosing) {
        toast({
          variant: "destructive",
          title: "Uzamknutý týždeň",
          description: `Tento týždeň (KW ${targetWeek}/${targetYear}) je už uzavretý. Záznam nie je možné presunúť.`,
        });
        setSaving(false);
        return;
      }
    }

    // Warn about standard hours mismatch but still allow submission
    if (selectedStandardHours && selectedStandardHours > 0 && Math.abs(finalHours - selectedStandardHours) > 0.01) {
      const confirmed = confirm(`Na tomto projekte je povolený len ${selectedStandardHours} hodinový úväzok. Napriek tomu chcete odoslať ${finalHours}h?`);
      if (!confirmed) return;
    }

    setSaving(true);

    const recordData = {
      project_id: projectId,
      date,
      time_from: timeFrom,
      time_to: timeTo,
      break_start: breakStart || null,
      break_end: breakEnd || null,
      break2_start: break2Start || null,
      break2_end: break2End || null,
      note: note || null,
      total_hours: finalHours,
    };

    if (editingId) {
      // Update existing record — reset returned/rejected status back to draft
      const editingRecord = todayRecords.find(r => r.id === editingId);
      const shouldResetStatus = editingRecord && (editingRecord.status === "returned" || editingRecord.status === "rejected");
      const updateData = shouldResetStatus ? { ...recordData, status: "draft" as const } : recordData;

      const { error } = await supabase
        .from("performance_records")
        .update(updateData)
        .eq("id", editingId);

      if (error) {
        toast({ variant: "destructive", title: "Chyba pri ukladaní", description: error.message });
      } else {
        toast({ title: "Záznam aktualizovaný", description: "Váš výkon bol úspešne upravený." });
        resetForm();
        await fetchTodayRecords();
      }
    } else {
      // Insert new record
      const { error } = await supabase.from("performance_records").insert({
        user_id: user.id,
        ...recordData,
        status: "draft",
      });

      if (error) {
        toast({ variant: "destructive", title: "Chyba pri ukladaní", description: error.message });
      } else {
        toast({ title: "Záznam uložený", description: "Váš výkon bol úspešne zaznamenaný." });
        resetForm();
        await fetchTodayRecords();
      }
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-foreground">Denný záznam</h2>
        <p className="text-muted-foreground text-sm md:text-base">Zaznamenajte svoj výkon pre fakturáciu</p>
      </div>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-base md:text-lg">
            {editingId ? "Upraviť záznam" : "Nový záznam výkonu"}
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            {editingId ? "Upravujete existujúci záznam" : "Vyplňte údaje o vykonanej práci"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* Project selection */}
              <div className="space-y-2">
                <Label htmlFor="project">Projekt</Label>
                {!isAdmin && projects.length === 0 ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Žiadne projekty</AlertTitle>
                    <AlertDescription>
                      Nemáte pridelený žiadny projekt, kontaktujte admina.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Select value={projectId} onValueChange={handleProjectChange} required>
                    <SelectTrigger id="project">
                      <SelectValue placeholder="Vyberte projekt" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(project => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selectedStandardHours && selectedStandardHours > 0 && (
                  <p className="text-xs text-primary font-medium">
                    ⏱ Fixná smena: {selectedStandardHours}h — časy boli predvyplnené
                  </p>
                )}
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label htmlFor="date">Dátum</Label>
                <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>

              {/* Time From */}
              <div className="space-y-2">
                <Label htmlFor="timeFrom">Začiatok práce</Label>
                <Input id="timeFrom" type="time" value={timeFrom} onChange={e => handleTimeFromChange(e.target.value)} required />
              </div>

              {/* Time To */}
              <div className="space-y-2">
                <Label htmlFor="timeTo">Koniec práce</Label>
                <Input id="timeTo" type="time" value={timeTo} onChange={e => handleTimeToChange(e.target.value)} required />
              </div>

              {/* Break 1 */}
              <div className="space-y-2">
                <Label htmlFor="breakStart">1. prestávka – od</Label>
                <Input id="breakStart" type="time" value={breakStart} onChange={e => handleBreakStartChange(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="breakEnd">1. prestávka – do</Label>
                <Input id="breakEnd" type="time" value={breakEnd} onChange={e => handleBreakEndChange(e.target.value)} />
              </div>

              {/* Break 2 */}
              <div className="space-y-2">
                <Label htmlFor="break2Start">2. prestávka – od</Label>
                <div className="flex gap-2">
                  <Input id="break2Start" type="time" value={break2Start} onChange={e => handleBreak2StartChange(e.target.value)} className="flex-1" />
                  {break2Start && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setBreak2Start(""); setBreak2End(""); setIsManualOverride(false); }} className="px-2">✕</Button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="break2End">2. prestávka – do</Label>
                <div className="flex gap-2">
                  <Input id="break2End" type="time" value={break2End} onChange={e => handleBreak2EndChange(e.target.value)} className="flex-1" />
                  {break2End && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setBreak2Start(""); setBreak2End(""); setIsManualOverride(false); }} className="px-2">✕</Button>
                  )}
                </div>
              </div>

              {/* Total hours */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="totalHours">Odpracované hodiny</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p>Automaticky vypočítané. V prípade potreby upravte manuálne.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input id="totalHours" type="number" step="0.01" min="0" placeholder="0.00" value={manualHours} onChange={e => handleManualHoursChange(e.target.value)} className={isManualOverride ? "border-primary ring-1 ring-primary" : ""} />
                {isManualOverride && calculatedHours > 0 && (
                  <p className="text-xs text-muted-foreground">Vypočítané: {calculatedHours} h</p>
                )}
              </div>
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label htmlFor="note">Poznámka (voliteľné)</Label>
              <Textarea id="note" placeholder="Popis vykonaných prác..." value={note} onChange={e => setNote(e.target.value)} rows={3} />
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm} className="h-12 md:h-10 text-base md:text-sm">
                  Zrušiť úpravu
                </Button>
              )}
              <Button type="submit" disabled={saving || !projectId} className="h-12 md:h-10 text-base md:text-sm">
                {saving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Ukladám...</>
                ) : editingId ? (
                  <><Edit className="mr-2 h-4 w-4" />Uložiť zmeny</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" />Uložiť záznam</>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Today's Records with Grace Period */}
      {todayRecords.length > 0 && (
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Záznamy na úpravu
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Dnešné záznamy a vrátené záznamy čakajúce na opravu
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 md:px-6 md:pb-6 pt-0">
            <div className="space-y-3">
              {todayRecords.map((record) => {
                const isReturned = record.status === "returned" || record.status === "rejected";
                const isApprovedOrLocked = record.status === "approved" || record.status === "locked";
                // Admin/Director: always can edit/delete. Monter: only if NOT approved/locked.
                const canEdit = isAdmin || isDirector || !isApprovedOrLocked;
                const canDelete = isAdmin || isDirector || !isApprovedOrLocked;
                const today = format(new Date(), "yyyy-MM-dd");
                const isOldRecord = record.date !== today;

                return (
                  <div
                    key={record.id}
                    className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                      editingId === record.id ? "bg-primary/10 border border-primary/30" : isReturned && isOldRecord ? "bg-destructive/5 border border-destructive/20" : "bg-muted/50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isOldRecord && (
                          <span className="text-xs font-mono text-muted-foreground">
                            {format(new Date(record.date + "T12:00:00"), "d. MMM", { locale: sk })}
                          </span>
                        )}
                        <span className="font-medium text-sm">
                          {record.projects?.name || "—"}
                        </span>
                        <StatusBadge status={record.status as any} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {record.time_from} - {record.time_to} • {Number(record.total_hours) || 0}h
                        {record.note && ` • ${record.note}`}
                      </p>
                      {isReturned && (
                        <p className="text-xs text-destructive font-medium mt-1">
                          ⚠ Vrátené na opravu — kliknite na ceruzku pre úpravu
                        </p>
                      )}
                    </div>
                    {(canEdit || canDelete) && (
                      <div className="flex items-center gap-1 ml-2">
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(record)}
                            title="Upraviť"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setDeletingId(record.id); setDeleteDialogOpen(true); }}
                            title="Zmazať"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zmazať záznam?</AlertDialogTitle>
            <AlertDialogDescription>
              Táto akcia je nevratná. Záznam bude trvalo odstránený.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Zmazať
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
