import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format, getISOWeek, getYear } from "date-fns";
import { sk } from "date-fns/locale";
import { CalendarIcon, Loader2, Plus, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { z } from "zod";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const entrySchema = z.object({
  date: z.date({ required_error: "Dátum je povinný" }),
  projectId: z.string().min(1, "Projekt je povinný"),
  timeFrom: z.string().min(1, "Začiatok je povinný"),
  timeTo: z.string().min(1, "Koniec je povinný"),
  breakMinutes: z.number().min(0).max(480).optional(),
  note: z.string().max(500, "Max 500 znakov").optional(),
});

interface Project {
  id: string;
  name: string;
}

export interface EditEntryData {
  id: string;
  date: string;
  projectId: string;
  timeFrom: string;
  timeTo: string;
  breakStart: string | null;
  breakEnd: string | null;
  note: string | null;
}

interface AdminAddEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetUserName: string;
  onEntryAdded?: () => void;
  editData?: EditEntryData | null;
}

export function AdminAddEntryModal({
  open,
  onOpenChange,
  targetUserId,
  targetUserName,
  onEntryAdded,
  editData,
}: AdminAddEntryModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEditMode = !!editData;

  // Form state
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [projectId, setProjectId] = useState("");
  const [timeFrom, setTimeFrom] = useState("07:00");
  const [timeTo, setTimeTo] = useState("17:00");
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      fetchProjects();
      if (editData) {
        setDate(new Date(editData.date));
        setProjectId(editData.projectId);
        setTimeFrom(editData.timeFrom);
        setTimeTo(editData.timeTo);
        // Calculate break minutes from break_start/break_end
        if (editData.breakStart && editData.breakEnd) {
          const [bsH, bsM] = editData.breakStart.split(":").map(Number);
          const [beH, beM] = editData.breakEnd.split(":").map(Number);
          setBreakMinutes(String((beH * 60 + beM) - (bsH * 60 + bsM)));
        } else {
          setBreakMinutes("0");
        }
        setNote(editData.note || "");
      } else {
        setDate(undefined);
        setProjectId("");
        setTimeFrom("07:00");
        setTimeTo("17:00");
        setBreakMinutes("0");
        setNote("");
      }
    }
  }, [open, editData]);

  const fetchProjects = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("projects")
      .select("id, name")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name");
    setProjects(data || []);
    setLoading(false);
  };

  const handleSubmit = async () => {
    const parsed = entrySchema.safeParse({
      date,
      projectId,
      timeFrom,
      timeTo,
      breakMinutes: parseFloat(breakMinutes) || 0,
      note: note.trim() || undefined,
    });

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      toast({
        variant: "destructive",
        title: "Chyba",
        description: firstError.message,
      });
      return;
    }

    if (!user) return;

    setSaving(true);
    try {
      const selectedDate = parsed.data.date;
      const breakMins = parsed.data.breakMinutes || 0;

      // Calculate break_start/break_end from break minutes (place break at midpoint)
      let breakStart: string | null = null;
      let breakEnd: string | null = null;
      if (breakMins > 0) {
        breakStart = "12:00";
        const endMins = 12 * 60 + breakMins;
        breakEnd = `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;
      }

      const recordData = {
        user_id: targetUserId,
        project_id: parsed.data.projectId,
        date: format(selectedDate, "yyyy-MM-dd"),
        time_from: parsed.data.timeFrom,
        time_to: parsed.data.timeTo,
        break_start: breakStart,
        break_end: breakEnd,
        status: "approved" as const,
        note: parsed.data.note || null,
      };

      if (isEditMode && editData) {
        const { error } = await supabase
          .from("performance_records")
          .update(recordData)
          .eq("id", editData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("performance_records")
          .insert(recordData);
        if (error) throw error;

        // Ensure weekly closing exists for this week
        const calendarWeek = getISOWeek(selectedDate);
        const year = getYear(selectedDate);

        const { data: existingClosing } = await supabase
          .from("weekly_closings")
          .select("id")
          .eq("user_id", targetUserId)
          .eq("calendar_week", calendarWeek)
          .eq("year", year)
          .is("deleted_at", null)
          .maybeSingle();

        if (!existingClosing) {
          await supabase.from("weekly_closings").insert({
            user_id: targetUserId,
            calendar_week: calendarWeek,
            year: year,
            status: "approved",
            submitted_at: new Date().toISOString(),
            approved_at: new Date().toISOString(),
            approved_by: user.id,
          });
        }
      }

      toast({
        title: isEditMode ? "Záznam aktualizovaný" : "Záznam pridaný",
        description: isEditMode
          ? `Záznam pre ${targetUserName} bol upravený.`
          : `Záznam pre ${targetUserName} dňa ${format(selectedDate, "d.M.yyyy")}.`,
      });

      onEntryAdded?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Chyba pri ukladaní",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditMode ? <Save className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            {isEditMode ? "Upraviť záznam" : "Pridať odpracovaný deň"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Target user (read-only) */}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Pracovník</Label>
            <div className="rounded-md border px-3 py-2 text-sm bg-muted/30 font-medium">
              {targetUserName}
            </div>
          </div>

          {/* Date picker */}
          <div className="space-y-1.5">
            <Label>Dátum</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date
                    ? format(date, "d. MMMM yyyy", { locale: sk })
                    : "Vybrať dátum"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => d > new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Project */}
          <div className="space-y-1.5">
            <Label>Projekt</Label>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Načítavam...
              </div>
            ) : (
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Vybrať projekt" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Time From / To */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="entry-time-from">Začiatok práce</Label>
              <Input
                id="entry-time-from"
                type="time"
                value={timeFrom}
                onChange={(e) => setTimeFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="entry-time-to">Koniec práce</Label>
              <Input
                id="entry-time-to"
                type="time"
                value={timeTo}
                onChange={(e) => setTimeTo(e.target.value)}
              />
            </div>
          </div>

          {/* Break minutes */}
          <div className="space-y-1.5">
            <Label htmlFor="entry-break">Prestávka (minúty)</Label>
            <Input
              id="entry-break"
              type="number"
              step="5"
              min="0"
              max="480"
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(e.target.value)}
              placeholder="0"
            />
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="entry-note">Poznámka (voliteľné)</Label>
            <Textarea
              id="entry-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Napr. manuálny zápis za pracovníka"
              maxLength={500}
              rows={2}
            />
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={saving || !date || !projectId || !timeFrom || !timeTo}
            className="w-full"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Ukladám...
              </>
            ) : isEditMode ? (
              <>
                <Save className="mr-2 h-4 w-4" />
                Uložiť zmeny
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Pridať záznam
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
