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
import { Loader2, Save, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
interface Project {
  id: string;
  name: string;
  client: string;
}
export default function DailyEntry() {
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  // Calculate duration with two breaks
  const calculatedHours = useMemo(() => {
    if (!timeFrom || !timeTo) return 0;
    const [fromH, fromM] = timeFrom.split(":").map(Number);
    const [toH, toM] = timeTo.split(":").map(Number);
    const fromMinutes = fromH * 60 + fromM;
    const toMinutes = toH * 60 + toM;

    // Calculate break 1 duration
    let break1Mins = 0;
    if (breakStart && breakEnd) {
      const [breakStartH, breakStartM] = breakStart.split(":").map(Number);
      const [breakEndH, breakEndM] = breakEnd.split(":").map(Number);
      break1Mins = breakEndH * 60 + breakEndM - (breakStartH * 60 + breakStartM);
    }

    // Calculate break 2 duration
    let break2Mins = 0;
    if (break2Start && break2End) {
      const [break2StartH, break2StartM] = break2Start.split(":").map(Number);
      const [break2EndH, break2EndM] = break2End.split(":").map(Number);
      break2Mins = break2EndH * 60 + break2EndM - (break2StartH * 60 + break2StartM);
    }

    const totalMinutes = toMinutes - fromMinutes - break1Mins - break2Mins;
    return Math.round(totalMinutes / 60 * 100) / 100;
  }, [timeFrom, timeTo, breakStart, breakEnd, break2Start, break2End]);

  // Auto-update manual hours when calculated hours change (unless user manually overrode)
  useEffect(() => {
    if (!isManualOverride && calculatedHours > 0) {
      setManualHours(calculatedHours.toString());
    }
  }, [calculatedHours, isManualOverride]);

  // Handle manual hours input change
  const handleManualHoursChange = (value: string) => {
    setManualHours(value);
    // Mark as manual override if user types something different from calculated
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue !== calculatedHours) {
      setIsManualOverride(true);
    }
  };

  // Reset manual override when time fields change
  const handleTimeFromChange = (value: string) => {
    setTimeFrom(value);
    setIsManualOverride(false);
  };
  const handleTimeToChange = (value: string) => {
    setTimeTo(value);
    setIsManualOverride(false);
  };
  const handleBreakStartChange = (value: string) => {
    setBreakStart(value);
    setIsManualOverride(false);
  };
  const handleBreakEndChange = (value: string) => {
    setBreakEnd(value);
    setIsManualOverride(false);
  };
  const handleBreak2StartChange = (value: string) => {
    setBreak2Start(value);
    setIsManualOverride(false);
  };
  const handleBreak2EndChange = (value: string) => {
    setBreak2End(value);
    setIsManualOverride(false);
  };
  
  useEffect(() => {
    async function fetchProjects() {
      const {
        data,
        error
      } = await supabase.from("projects").select("id, name, client").eq("is_active", true).order("name");
      if (error) {
        console.error("Error fetching projects:", error);
      } else {
        setProjects(data || []);
      }
      setLoading(false);
    }
    fetchProjects();
  }, []);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !projectId) return;

    // Parse the final hours value (manual input or calculated)
    const finalHours = parseFloat(manualHours) || calculatedHours;
    if (finalHours <= 0) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Odpracované hodiny musia byť väčšie ako 0."
      });
      return;
    }
    setSaving(true);
    const {
      error
    } = await supabase.from("performance_records").insert({
      user_id: user.id,
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
      status: "draft"
    });
    if (error) {
      toast({
        variant: "destructive",
        title: "Chyba pri ukladaní",
        description: error.message
      });
    } else {
      toast({
        title: "Záznam uložený",
        description: "Váš výkon bol úspešne zaznamenaný."
      });
      // Reset form
      setNote("");
      setProjectId("");
      setManualHours("");
      setIsManualOverride(false);
      setBreak2Start("");
      setBreak2End("");
    }
    setSaving(false);
  };
  if (loading) {
    return <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>;
  }
  return <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-foreground">Denný záznam</h2>
        <p className="text-muted-foreground text-sm md:text-base">Zaznamenajte svoj výkon pre fakturáciu</p>
      </div>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-base md:text-lg">Nový záznam výkonu</CardTitle>
          <CardDescription className="text-xs md:text-sm">Vyplňte údaje o vykonanej práci</CardDescription>
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
                    {projects.map(project => <SelectItem key={project.id} value={project.id}>
                        {project.name} ({project.client})
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label htmlFor="date">Dátum</Label>
                <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>

              {/* Time From (Von) */}
              <div className="space-y-2">
                <Label htmlFor="timeFrom">Von (začiatok)</Label>
                <Input id="timeFrom" type="time" value={timeFrom} onChange={e => handleTimeFromChange(e.target.value)} required />
              </div>

              {/* Time To (Bis) */}
              <div className="space-y-2">
                <Label htmlFor="timeTo">Bis (koniec)</Label>
                <Input id="timeTo" type="time" value={timeTo} onChange={e => handleTimeToChange(e.target.value)} required />
              </div>

              {/* Break 1 Start */}
              <div className="space-y-2">
                <Label htmlFor="breakStart">Prestávka 1 od</Label>
                <Input id="breakStart" type="time" value={breakStart} onChange={e => handleBreakStartChange(e.target.value)} />
              </div>

              {/* Break 1 End */}
              <div className="space-y-2">
                <Label htmlFor="breakEnd">Prestávka 1 do</Label>
                <Input id="breakEnd" type="time" value={breakEnd} onChange={e => handleBreakEndChange(e.target.value)} />
              </div>

              {/* Break 2 Start */}
              <div className="space-y-2">
                <Label htmlFor="break2Start">Prestávka 2 od</Label>
                <Input id="break2Start" type="time" value={break2Start} onChange={e => handleBreak2StartChange(e.target.value)} placeholder="Voliteľné" />
              </div>

              {/* Break 2 End */}
              <div className="space-y-2">
                <Label htmlFor="break2End">Prestávka 2 do</Label>
                <Input id="break2End" type="time" value={break2End} onChange={e => handleBreak2EndChange(e.target.value)} placeholder="Voliteľné" />
              </div>

              {/* Editable total hours with tooltip */}
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
                <div className="relative">
                  <Input id="totalHours" type="number" step="0.01" min="0" placeholder="0.00" value={manualHours} onChange={e => handleManualHoursChange(e.target.value)} className={isManualOverride ? "border-primary ring-1 ring-primary" : ""} />
                  {isManualOverride}
                </div>
                {isManualOverride && calculatedHours > 0 && <p className="text-xs text-muted-foreground">
                    Vypočítané: {calculatedHours} h
                  </p>}
              </div>
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label htmlFor="note">Poznámka (voliteľné)</Label>
              <Textarea id="note" placeholder="Popis vykonaných prác..." value={note} onChange={e => setNote(e.target.value)} rows={3} />
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
              <Button type="submit" disabled={saving || !projectId} className="h-12 md:h-10 text-base md:text-sm">
                {saving ? <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ukladám...
                  </> : <>
                    <Save className="mr-2 h-4 w-4" />
                    Uložiť záznam
                  </>}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>;
}