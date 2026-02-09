import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format, getISOWeek, getYear } from "date-fns";
import { sk } from "date-fns/locale";
import { CalendarIcon, Loader2, Plus } from "lucide-react";
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
  hours: z.number().min(0.5, "Minimum 0.5 hodiny").max(24, "Maximum 24 hodín"),
  note: z.string().max(500, "Max 500 znakov").optional(),
});

interface Project {
  id: string;
  name: string;
}

interface AdminAddEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetUserName: string;
  onEntryAdded?: () => void;
}

export function AdminAddEntryModal({
  open,
  onOpenChange,
  targetUserId,
  targetUserName,
  onEntryAdded,
}: AdminAddEntryModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [projectId, setProjectId] = useState("");
  const [hours, setHours] = useState("10");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      fetchProjects();
      // Reset form
      setDate(undefined);
      setProjectId("");
      setHours("10");
      setNote("");
    }
  }, [open]);

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
    // Validate
    const parsed = entrySchema.safeParse({
      date,
      projectId,
      hours: parseFloat(hours),
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
      const totalHours = parsed.data.hours;

      // Calculate time_from and time_to from hours (start at 07:00)
      const endHour = 7 + Math.floor(totalHours);
      const endMinutes = Math.round((totalHours % 1) * 60);
      const timeFrom = "07:00";
      const timeTo = `${String(endHour).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;

      // Insert performance record
      const { error: insertError } = await supabase
        .from("performance_records")
        .insert({
          user_id: targetUserId,
          project_id: parsed.data.projectId,
          date: format(selectedDate, "yyyy-MM-dd"),
          time_from: timeFrom,
          time_to: timeTo,
          status: "approved",
          note: parsed.data.note || null,
        });

      if (insertError) throw insertError;

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

      toast({
        title: "Záznam pridaný",
        description: `${totalHours}h pre ${targetUserName} dňa ${format(selectedDate, "d.M.yyyy")}.`,
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
            <Plus className="h-5 w-5" />
            Pridať odpracovaný deň
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

          {/* Hours */}
          <div className="space-y-1.5">
            <Label htmlFor="entry-hours">Hodiny</Label>
            <Input
              id="entry-hours"
              type="number"
              step="0.5"
              min="0.5"
              max="24"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="10"
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
            disabled={saving || !date || !projectId}
            className="w-full"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Ukladám...
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
