import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileSpreadsheet, Loader2, Download } from "lucide-react";
import { exportProjectConsolidatedExcel, type ProjectWorkerSheet } from "@/lib/projectExcelExport";
import { parseLocalDate, getISOWeekLocal, getISOWeekYear } from "@/lib/dateUtils";

interface Project {
  id: string;
  name: string;
  client: string;
  location: string | null;
  address: string | null;
}

export function ProjectExportSection() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [availableWeeks, setAvailableWeeks] = useState<{ week: number; year: number; label: string }[]>([]);
  const [exporting, setExporting] = useState(false);
  const [loadingWeeks, setLoadingWeeks] = useState(false);

  // Load active projects
  useEffect(() => {
    async function fetchProjects() {
      const { data } = await supabase
        .from("projects")
        .select("id, name, client, location, address")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name");
      setProjects(data || []);
    }
    fetchProjects();
  }, []);

  // Load available weeks when project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setAvailableWeeks([]);
      setSelectedWeek("");
      return;
    }

    async function fetchWeeks() {
      setLoadingWeeks(true);
      const { data: records } = await supabase
        .from("performance_records")
        .select("date")
        .eq("project_id", selectedProjectId)
        .is("deleted_at", null)
        .order("date", { ascending: false });

      if (!records || records.length === 0) {
        setAvailableWeeks([]);
        setLoadingWeeks(false);
        return;
      }

      // Get unique weeks
      const weekSet = new Map<string, { week: number; year: number }>();
      for (const r of records) {
        const d = parseLocalDate(r.date);
        const w = getISOWeekLocal(d);
        const y = getISOWeekYear(d);
        const key = `${y}-${w}`;
        if (!weekSet.has(key)) {
          weekSet.set(key, { week: w, year: y });
        }
      }

      const weeks = Array.from(weekSet.values())
        .sort((a, b) => b.year !== a.year ? b.year - a.year : b.week - a.week)
        .map((w) => ({
          ...w,
          label: `KW ${w.week} / ${w.year}`,
        }));

      setAvailableWeeks(weeks);
      setSelectedWeek("");
      setLoadingWeeks(false);
    }
    fetchWeeks();
  }, [selectedProjectId]);

  const handleExport = async () => {
    if (!selectedProjectId || !selectedWeek) return;

    const [yearStr, weekStr] = selectedWeek.split("-");
    const year = parseInt(yearStr, 10);
    const calendarWeek = parseInt(weekStr, 10);
    const project = projects.find((p) => p.id === selectedProjectId);
    if (!project) return;

    setExporting(true);

    try {
      // Fetch all performance records for this project & week
      const { data: records, error } = await supabase
        .from("performance_records")
        .select("date, time_from, time_to, break_start, break_end, break2_start, break2_end, total_hours, note, user_id")
        .eq("project_id", selectedProjectId)
        .is("deleted_at", null)
        .order("date");

      if (error) throw error;

      // Filter to the selected week
      const weekRecords = (records || []).filter((r) => {
        const d = parseLocalDate(r.date);
        return getISOWeekLocal(d) === calendarWeek && getISOWeekYear(d) === year;
      });

      if (weekRecords.length === 0) {
        toast({
          variant: "destructive",
          title: "Žiadne záznamy",
          description: "Pre vybraný projekt a týždeň neboli nájdené žiadne záznamy.",
        });
        setExporting(false);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(weekRecords.map((r) => r.user_id))];

      // Fetch profiles for these users (using secure RPC that excludes financial data)
      const { data: profiles } = await supabase
        .rpc("get_team_profiles_safe", { target_user_ids: userIds });

      // Group records by user
      const workerMap = new Map<string, ProjectWorkerSheet>();
      for (const record of weekRecords) {
        const profile = profiles?.find((p) => p.user_id === record.user_id);
        const workerName = profile?.full_name || "Neznámy";

        if (!workerMap.has(record.user_id)) {
          workerMap.set(record.user_id, {
            workerName,
            records: [],
          });
        }

        workerMap.get(record.user_id)!.records.push({
          date: record.date,
          time_from: record.time_from,
          time_to: record.time_to,
          break_start: record.break_start,
          break_end: record.break_end,
          break2_start: record.break2_start,
          break2_end: record.break2_end,
          total_hours: record.total_hours ?? 0,
          note: record.note,
        });
      }

      const workers = Array.from(workerMap.values()).sort((a, b) =>
        a.workerName.localeCompare(b.workerName)
      );

      await exportProjectConsolidatedExcel({
        projectName: project.name,
        projectClient: project.client,
        projectLocation: project.location,
        projectAddress: project.address,
        calendarWeek,
        year,
        workers,
      });

      toast({
        title: "Export úspešný",
        description: `Stiahnutý hromadný Excel pre ${project.name} – KW ${calendarWeek}/${year} (${workers.length} pracovníkov).`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Chyba pri exporte",
        description: err.message,
      });
    }

    setExporting(false);
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          Hromadný export projektu
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <div className="w-full sm:w-auto sm:min-w-[220px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Projekt</label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Vyberte projekt" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-auto sm:min-w-[180px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Týždeň</label>
            <Select
              value={selectedWeek}
              onValueChange={setSelectedWeek}
              disabled={!selectedProjectId || loadingWeeks}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingWeeks ? "Načítavam..." : "Vyberte týždeň"} />
              </SelectTrigger>
              <SelectContent>
                {availableWeeks.map((w) => (
                  <SelectItem key={`${w.year}-${w.week}`} value={`${w.year}-${w.week}`}>
                    {w.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleExport}
            disabled={!selectedProjectId || !selectedWeek || exporting}
            className="w-full sm:w-auto"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Stiahnuť hromadný Excel
          </Button>
        </div>
        {selectedProject && selectedWeek && (
          <p className="text-xs text-muted-foreground mt-2">
            Výstup: {selectedProject.name}_KW{selectedWeek.split("-")[1]}_{selectedWeek.split("-")[0]}.xlsx – jeden hárok pre každého pracovníka.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
