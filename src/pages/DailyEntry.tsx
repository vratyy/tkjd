import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Info, Edit, Trash2, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { GraceCountdown } from "@/components/GraceCountdown";
import { isWithinGracePeriod } from "@/hooks/useGracePeriod";
import { StatusBadge } from "@/components/StatusBadge";
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

interface Project {
  id: string;
  name: string;
  client: string;
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
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [todayRecords, setTodayRecords] = useState<TodayRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, setTick] = useState(0); // Force re-render for grace period updates

  // Form state
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [timeFrom, setTimeFrom] = useState("07:00");
  const [timeTo, setTimeTo] = useState("15:30");
  const [breakStart, setBreakStart] = useState("12:00");
  const [breakEnd, setBreakEnd] = useState("12:30");
  const [break2Start, setBreak2Start] = useState("");
  const [break2End, setBreak2End] = useState("");
  const [note, setNote] = useState("");
  const [manualHours, setManualHours] = useState<string>("");
  const [isManualOverride, setIsManualOverride] = useState(false);

  // Tick every 10 seconds to update grace period visibility
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

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
    const { data } = await supabase
      .from("performance_records")
      .select("id, date, time_from, time_to, break_start, break_end, break2_start, break2_end, total_hours, status, note, created_at, project_id, projects(name)")
      .eq("user_id", user.id)
      .eq("date", today)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    setTodayRecords((data as TodayRecord[]) || []);
  }, [user]);

  useEffect(() => {
    async function fetchProjects() {
      const { data, error } = await supabase.from("projects").select("id, name, client").eq("is_active", true).order("name");
      if (error) {
        console.error("Error fetching projects:", error);
      } else {
        setProjects(data || []);
      }
      setLoading(false);
    }
    fetchProjects();
    fetchTodayRecords();
  }, [fetchTodayRecords]);

  const resetForm = () => {
    setNote("");
    setProjectId("");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !projectId) return;

    const finalHours = parseFloat(manualHours) || calculatedHours;
    if (finalHours <= 0) {
      toast({ variant: "destructive", title: "Chyba", description: "Odpracované hodiny musia byť väčšie ako 0." });
      return;
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
      // Update existing record
      const { error } = await supabase
        .from("performance_records")
        .update(recordData)
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
                <Select value={projectId} onValueChange={setProjectId} required>
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
              Dnešné záznamy
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Záznamy z dnešného dňa • úpravy sú možné 5 minút po vytvorení
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 md:px-6 md:pb-6 pt-0">
            <div className="space-y-3">
              {todayRecords.map((record) => {
                const inGrace = record.status === "draft" && isWithinGracePeriod(record.created_at, 5);

                return (
                  <div
                    key={record.id}
                    className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                      editingId === record.id ? "bg-primary/10 border border-primary/30" : "bg-muted/50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {record.projects?.name || "—"}
                        </span>
                        <StatusBadge status={record.status as any} />
                        {inGrace && <GraceCountdown createdAt={record.created_at} durationMinutes={5} />}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {record.time_from} - {record.time_to} • {Number(record.total_hours) || 0}h
                        {record.note && ` • ${record.note}`}
                      </p>
                    </div>
                    {inGrace && (
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(record)}
                          title="Upraviť"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setDeletingId(record.id); setDeleteDialogOpen(true); }}
                          title="Zmazať"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
