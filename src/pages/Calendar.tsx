import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, Clock, MapPin, FileText, Navigation } from "lucide-react";
import { format, startOfMonth, endOfMonth, isSameDay, isWeekend, parseISO } from "date-fns";
import { sk } from "date-fns/locale";

interface WorkRecord {
  id: string;
  date: string;
  time_from: string;
  time_to: string;
  total_hours: number;
  status: string;
  note: string | null;
  project: { name: string } | null;
}

interface AssignedProject {
  id: string;
  name: string;
  address: string | null;
  location: string | null;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [assignedProject, setAssignedProject] = useState<AssignedProject | null>(null);

  // Fetch assigned project for the user
  useEffect(() => {
    async function fetchAssignedProject() {
      if (!user) return;
      const { data } = await supabase
        .from("project_assignments")
        .select("project_id, projects:projects(id, name, address, location)")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (data?.projects) {
        const p = data.projects as unknown as AssignedProject;
        setAssignedProject(p);
      }
    }
    fetchAssignedProject();
  }, [user]);

  useEffect(() => {
    async function fetchRecords() {
      if (!user) return;
      setLoading(true);

      const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("performance_records")
        .select("id, date, time_from, time_to, total_hours, status, note, project:projects(name)")
        .eq("user_id", user.id)
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .is("deleted_at", null)
        .order("date", { ascending: true });

      if (error) {
        console.error("Error fetching records:", error);
      } else {
        setRecords(data as WorkRecord[]);
      }
      setLoading(false);
    }

    fetchRecords();
  }, [user, currentMonth]);

  // Group records by date for quick lookup
  const recordsByDate = useMemo(() => {
    const map = new Map<string, WorkRecord[]>();
    records.forEach((record) => {
      const dateKey = record.date;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(record);
    });
    return map;
  }, [records]);

  // Calculate total hours for a date
  const getHoursForDate = (date: Date): number => {
    const dateKey = format(date, "yyyy-MM-dd");
    const dayRecords = recordsByDate.get(dateKey) || [];
    return dayRecords.reduce((sum, r) => sum + (Number(r.total_hours) || 0), 0);
  };

  // Get all dates that have work records
  const workedDates = useMemo(() => {
    return Array.from(recordsByDate.keys()).map((d) => parseISO(d));
  }, [recordsByDate]);

  const handleDayClick = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    setDetailOpen(true);
  };

  const selectedDateRecords = selectedDate
    ? recordsByDate.get(format(selectedDate, "yyyy-MM-dd")) || []
    : [];

  // Custom modifiers for the calendar
  const modifiers = {
    worked: workedDates,
    weekend: (date: Date) => isWeekend(date),
  };

  const modifiersStyles = {
    worked: {
      backgroundColor: "hsl(var(--primary) / 0.2)",
      color: "hsl(var(--primary))",
      fontWeight: "bold",
    },
  };

  // Calculate monthly statistics
  const monthStats = useMemo(() => {
    const totalHours = records.reduce((sum, r) => sum + (Number(r.total_hours) || 0), 0);
    const uniqueDays = recordsByDate.size;
    const avgHoursPerDay = uniqueDays > 0 ? totalHours / uniqueDays : 0;
    return { totalHours, uniqueDays, avgHoursPerDay };
  }, [records, recordsByDate]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
          <CalendarDays className="h-7 w-7" />
          Môj kalendár
        </h1>
        <p className="text-muted-foreground">Prehľad odpracovaných dní</p>
      </div>

      {/* Project Location Card */}
      {assignedProject && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Miesto výkonu diela
                  </p>
                  <p className="font-semibold truncate">
                    {assignedProject.name}
                    {assignedProject.address && (
                      <span className="font-normal text-muted-foreground"> – {assignedProject.address}</span>
                    )}
                  </p>
                  {!assignedProject.address && (
                    <p className="text-sm text-muted-foreground italic">Adresa nie je nastavená.</p>
                  )}
                </div>
              </div>
              {assignedProject.address && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-shrink-0"
                  asChild
                >
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(assignedProject.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Navigation className="h-4 w-4" />
                    📍 Navigovať na stavbu
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Stats */}
      <div className="grid gap-4 grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-primary">
              {monthStats.totalHours.toFixed(1)} h
            </div>
            <p className="text-xs text-muted-foreground">Celkom tento mesiac</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{monthStats.uniqueDays}</div>
            <p className="text-xs text-muted-foreground">Odpracovaných dní</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{monthStats.avgHoursPerDay.toFixed(1)} h</div>
            <p className="text-xs text-muted-foreground">Priemer na deň</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {format(currentMonth, "LLLL yyyy", { locale: sk })}
          </CardTitle>
          <CardDescription>
            Kliknite na deň pre zobrazenie detailov
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Skeleton className="h-[300px] w-full max-w-[350px]" />
            </div>
          ) : (
            <div className="flex justify-center">
              <CalendarComponent
                mode="single"
                selected={selectedDate || undefined}
                onSelect={handleDayClick}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                locale={sk}
                modifiers={modifiers}
                modifiersStyles={modifiersStyles}
                className="rounded-md border"
                components={{
                  DayContent: ({ date }) => {
                    const hours = getHoursForDate(date);
                    return (
                      <div className="relative w-full h-full flex flex-col items-center justify-center">
                        <span>{date.getDate()}</span>
                        {hours > 0 && (
                          <span className="absolute -bottom-1 text-[9px] font-medium text-primary">
                            {hours}h
                          </span>
                        )}
                      </div>
                    );
                  },
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-primary/20" />
          <span>Odpracovaný deň</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-muted" />
          <span>Bez záznamu</span>
        </div>
      </div>

      {/* Day Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedDate && format(selectedDate, "EEEE, d. MMMM yyyy", { locale: sk })}
            </DialogTitle>
            <DialogDescription>
              {selectedDateRecords.length === 0
                ? "Žiadne záznamy pre tento deň"
                : `${selectedDateRecords.length} záznam${selectedDateRecords.length > 1 ? "y" : ""}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedDateRecords.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>V tento deň neboli zaznamenané žiadne hodiny.</p>
              </div>
            ) : (
              selectedDateRecords.map((record) => (
                <div
                  key={record.id}
                  className="p-4 rounded-lg border bg-card space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {record.project?.name || "—"}
                      </span>
                    </div>
                    <Badge variant={record.status === "approved" ? "default" : "secondary"}>
                      {record.status === "approved"
                        ? "Schválené"
                        : record.status === "submitted"
                        ? "Odoslané"
                        : "Koncept"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {record.time_from} – {record.time_to}
                      </span>
                    </div>
                    <div className="font-medium text-primary">
                      {Number(record.total_hours).toFixed(2)} h
                    </div>
                  </div>

                  {record.note && (
                    <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{record.note}</span>
                    </div>
                  )}
                </div>
              ))
            )}

            {selectedDateRecords.length > 0 && (
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Celkom za deň:</span>
                  <span className="text-lg text-primary">
                    {selectedDateRecords
                      .reduce((sum, r) => sum + (Number(r.total_hours) || 0), 0)
                      .toFixed(2)}{" "}
                    h
                  </span>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
