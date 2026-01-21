import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Save } from "lucide-react";
import { format } from "date-fns";

interface Project {
  id: string;
  name: string;
  client: string;
}

export default function DailyEntry() {
  const { user } = useAuth();
  const { toast } = useToast();
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
  const [note, setNote] = useState("");

  // Calculate duration
  const calculatedHours = useMemo(() => {
    if (!timeFrom || !timeTo) return 0;
    const [fromH, fromM] = timeFrom.split(":").map(Number);
    const [toH, toM] = timeTo.split(":").map(Number);
    const fromMinutes = fromH * 60 + fromM;
    const toMinutes = toH * 60 + toM;
    
    // Calculate break duration
    let breakMins = 0;
    if (breakStart && breakEnd) {
      const [breakStartH, breakStartM] = breakStart.split(":").map(Number);
      const [breakEndH, breakEndM] = breakEnd.split(":").map(Number);
      breakMins = (breakEndH * 60 + breakEndM) - (breakStartH * 60 + breakStartM);
    }
    
    const totalMinutes = toMinutes - fromMinutes - breakMins;
    return Math.round((totalMinutes / 60) * 100) / 100;
  }, [timeFrom, timeTo, breakStart, breakEnd]);

  useEffect(() => {
    async function fetchProjects() {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, client")
        .eq("is_active", true)
        .order("name");

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

    setSaving(true);

    const { error } = await supabase.from("performance_records").insert({
      user_id: user.id,
      project_id: projectId,
      date,
      time_from: timeFrom,
      time_to: timeTo,
      break_start: breakStart || null,
      break_end: breakEnd || null,
      note: note || null,
      status: "draft",
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Chyba pri ukladaní",
        description: error.message,
      });
    } else {
      toast({
        title: "Záznam uložený",
        description: "Váš výkon bol úspešne zaznamenaný.",
      });
      // Reset form
      setNote("");
      setProjectId("");
    }

    setSaving(false);
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
        <h2 className="text-2xl font-bold text-foreground">Denný záznam</h2>
        <p className="text-muted-foreground">Zaznamenajte svoj výkon pre fakturáciu</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nový záznam výkonu</CardTitle>
          <CardDescription>Vyplňte údaje o vykonanej práci</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Project selection */}
              <div className="space-y-2">
                <Label htmlFor="project">Projekt</Label>
                <Select value={projectId} onValueChange={setProjectId} required>
                  <SelectTrigger id="project">
                    <SelectValue placeholder="Vyberte projekt" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name} ({project.client})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label htmlFor="date">Dátum</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              {/* Time From (Von) */}
              <div className="space-y-2">
                <Label htmlFor="timeFrom">Von (začiatok)</Label>
                <Input
                  id="timeFrom"
                  type="time"
                  value={timeFrom}
                  onChange={(e) => setTimeFrom(e.target.value)}
                  required
                />
              </div>

              {/* Time To (Bis) */}
              <div className="space-y-2">
                <Label htmlFor="timeTo">Bis (koniec)</Label>
                <Input
                  id="timeTo"
                  type="time"
                  value={timeTo}
                  onChange={(e) => setTimeTo(e.target.value)}
                  required
                />
              </div>

              {/* Break Start */}
              <div className="space-y-2">
                <Label htmlFor="breakStart">Prestávka od</Label>
                <Input
                  id="breakStart"
                  type="time"
                  value={breakStart}
                  onChange={(e) => setBreakStart(e.target.value)}
                />
              </div>

              {/* Break End */}
              <div className="space-y-2">
                <Label htmlFor="breakEnd">Prestávka do</Label>
                <Input
                  id="breakEnd"
                  type="time"
                  value={breakEnd}
                  onChange={(e) => setBreakEnd(e.target.value)}
                />
              </div>

              {/* Calculated hours display */}
              <div className="space-y-2">
                <Label>Odpracované hodiny</Label>
                <div className="h-10 px-3 py-2 rounded-md border border-input bg-muted flex items-center">
                  <span className="font-semibold text-lg">
                    {calculatedHours > 0 ? `${calculatedHours} h` : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label htmlFor="note">Poznámka (voliteľné)</Label>
              <Textarea
                id="note"
                placeholder="Popis vykonaných prác..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="submit" disabled={saving || !projectId}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ukladám...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Uložiť záznam
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
