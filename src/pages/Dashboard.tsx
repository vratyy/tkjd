import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Calendar, ClipboardList, FolderOpen, Plus } from "lucide-react";
import { format, getWeek, getYear } from "date-fns";
import { sk } from "date-fns/locale";

interface WeeklyClosing {
  id: string;
  calendar_week: number;
  year: number;
  status: string;
  return_comment?: string | null;
}

interface PerformanceRecord {
  id: string;
  date: string;
  time_from: string;
  time_to: string;
  total_hours: number;
  status: string;
  projects: { name: string } | null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { role, isManager, isAdmin } = useUserRole();
  const [openClosings, setOpenClosings] = useState<WeeklyClosing[]>([]);
  const [recentRecords, setRecentRecords] = useState<PerformanceRecord[]>([]);
  const [stats, setStats] = useState({ monthlyHours: 0, activeProjects: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;

      // Fetch open weekly closings
      const { data: closings } = await supabase
        .from("weekly_closings")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["open", "returned"] as any)
        .order("year", { ascending: false })
        .order("calendar_week", { ascending: false })
        .limit(5);

      setOpenClosings((closings as unknown as WeeklyClosing[]) || []);

      // Fetch recent performance records
      const { data: records } = await supabase
        .from("performance_records")
        .select("id, date, time_from, time_to, total_hours, status, projects(name)")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(5);

      setRecentRecords((records as PerformanceRecord[]) || []);

      // Calculate monthly stats
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: monthRecords } = await supabase
        .from("performance_records")
        .select("total_hours")
        .eq("user_id", user.id)
        .gte("date", startOfMonth.toISOString().split("T")[0]);

      const monthlyHours = (monthRecords || []).reduce(
        (sum, r) => sum + (Number(r.total_hours) || 0),
        0
      );

      // Count active projects
      const { count: projectCount } = await supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      setStats({
        monthlyHours: Math.round(monthlyHours * 10) / 10,
        activeProjects: projectCount || 0,
      });

      setLoading(false);
    }

    fetchData();
  }, [user]);

  const currentWeek = getWeek(new Date(), { weekStartsOn: 1 });
  const currentYear = getYear(new Date());

  return (
    <div className="space-y-6">
      {/* Welcome section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="text-muted-foreground">
            KW {currentWeek}/{currentYear}
          </p>
        </div>
        <Button asChild>
          <Link to="/daily-entry">
            <Plus className="h-4 w-4 mr-2" />
            Nový záznam
          </Link>
        </Button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Otvorené uzávierky</CardDescription>
            <CardTitle className="text-3xl">{openClosings.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 mr-1" />
              Na schválenie
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Aktívne projekty</CardDescription>
            <CardTitle className="text-3xl">{stats.activeProjects}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <FolderOpen className="h-4 w-4 mr-1" />
              K dispozícii
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Hodiny tento mesiac</CardDescription>
            <CardTitle className="text-3xl">{stats.monthlyHours}h</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <ClipboardList className="h-4 w-4 mr-1" />
              Celkový čas
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Open closings alert */}
      {openClosings.some((c) => c.status === "returned") && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-destructive text-lg">
              Vrátené na opravu
            </CardTitle>
          </CardHeader>
          <CardContent>
            {openClosings
              .filter((c) => c.status === "returned")
              .map((closing) => (
                <div key={closing.id} className="flex items-center justify-between py-2">
                  <div>
                    <span className="font-medium">
                      KW {closing.calendar_week}/{closing.year}
                    </span>
                    {closing.return_comment && (
                      <p className="text-sm text-destructive mt-1">
                        {closing.return_comment}
                      </p>
                    )}
                  </div>
                  <StatusBadge status="returned" />
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Recent records */}
      <Card>
        <CardHeader>
          <CardTitle>Posledné záznamy</CardTitle>
          <CardDescription>Vaše nedávne výkony</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Načítavam...</div>
          ) : recentRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Zatiaľ nemáte žiadne záznamy.</p>
              <Button className="mt-4" size="sm" asChild>
                <Link to="/daily-entry">Pridať prvý záznam</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentRecords.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {format(new Date(record.date), "d. MMM yyyy", { locale: sk })}
                      </span>
                      <StatusBadge status={record.status as any} />
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {record.projects?.name || "—"} • {record.time_from} - {record.time_to}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">{record.total_hours}h</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
