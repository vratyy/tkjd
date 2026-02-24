import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { MobileRecordCard } from "@/components/mobile/MobileRecordCard";
import { StickyActionButton } from "@/components/mobile/StickyActionButton";
import { useIsMobile } from "@/hooks/use-mobile";
import { Calendar, ClipboardList, FolderOpen, Plus, Home, Users } from "lucide-react";
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

interface AccommodationInfo {
  id: string;
  user_name: string;
  accommodation_name: string;
  check_out: string | null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { role, isManager, isAdmin } = useUserRole();
  const isMobile = useIsMobile();
  const [openClosings, setOpenClosings] = useState<WeeklyClosing[]>([]);
  const [recentRecords, setRecentRecords] = useState<PerformanceRecord[]>([]);
  const [currentAccommodations, setCurrentAccommodations] = useState<AccommodationInfo[]>([]);
  const [stats, setStats] = useState({ monthlyHours: 0, activeProjects: 0 });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    if (!user) return;

    // Fetch open weekly closings
    const { data: closings } = await supabase
      .from("weekly_closings")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["returned"] as any)
      .order("year", { ascending: false })
      .order("calendar_week", { ascending: false })
      .limit(5);

    setOpenClosings((closings as unknown as WeeklyClosing[]) || []);

    // Fetch recent performance records
    const { data: records } = await supabase
      .from("performance_records")
      .select("id, date, time_from, time_to, total_hours, status, projects(name)")
      .eq("user_id", user.id)
      .is("deleted_at", null)
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

    // Fetch current accommodations for Admin widget
    if (isAdmin) {
      const today = new Date().toISOString().split("T")[0];
      const { data: assignments } = await supabase
        .from("accommodation_assignments")
        .select(`
          id,
          check_out,
          accommodation:accommodations(name)
        `)
        .is("deleted_at", null)
        .or(`check_out.is.null,check_out.gte.${today}`)
        .limit(5);

      const enrichedAssignments = await Promise.all(
        (assignments || []).map(async (a: any) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", a.user_id)
            .maybeSingle();
          return {
            id: a.id,
            user_name: profile?.full_name || "Neznámy",
            accommodation_name: a.accommodation?.name || "—",
            check_out: a.check_out,
          } as AccommodationInfo;
        })
      );
      setCurrentAccommodations(enrichedAssignments);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user, isAdmin]);

  // Re-fetch when window regains focus (e.g. after editing in DailyEntry)
  useEffect(() => {
    const handleFocus = () => { fetchDashboardData(); };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [user, isAdmin]);

  const currentWeek = getWeek(new Date(), { weekStartsOn: 1 });
  const currentYear = getYear(new Date());

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Hero Action Button - LARGE and PROMINENT for subcontractors - hide on mobile since we have sticky button */}
      <Card className="bg-gradient-to-r from-primary to-primary/80 border-0 shadow-lg hidden md:block">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <h2 className="text-xl md:text-2xl font-bold text-primary-foreground">
                KW {currentWeek}/{currentYear}
              </h2>
              <p className="text-primary-foreground/80 mt-1">
                Zaznamenajte váš dnešný pracovný výkon
              </p>
            </div>
            <Button 
              asChild 
              size="lg" 
              variant="secondary"
              className="h-14 px-8 text-lg font-semibold shadow-md hover:shadow-lg transition-all"
            >
              <Link to="/daily-entry">
                <Plus className="h-6 w-6 mr-3" />
                ➕ Zapísať denný výkon
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Hero - Simplified for small screens */}
      <div className="md:hidden">
        <Card className="bg-gradient-to-r from-primary to-primary/80 border-0">
          <CardContent className="p-4 text-center">
            <h2 className="text-lg font-bold text-primary-foreground">
              KW {currentWeek}/{currentYear}
            </h2>
            <p className="text-primary-foreground/80 text-sm mt-1">
              {format(new Date(), "EEEE, d. MMMM yyyy", { locale: sk })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Welcome section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-foreground">Prehľad</h2>
          <p className="text-muted-foreground text-sm md:text-base">
            Vaše aktuálne štatistiky a úlohy
          </p>
        </div>
      </div>

      {/* Quick stats - Stack on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <Card>
          <CardHeader className="pb-2 p-4 md:p-6">
            <CardDescription className="text-xs md:text-sm">Otvorené uzávierky</CardDescription>
            <CardTitle className="text-2xl md:text-3xl">{openClosings.length}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 md:px-6 md:pb-6 pt-0">
            <div className="flex items-center text-xs md:text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 mr-1" />
              Na schválenie
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 p-4 md:p-6">
            <CardDescription className="text-xs md:text-sm">Aktívne projekty</CardDescription>
            <CardTitle className="text-2xl md:text-3xl">{stats.activeProjects}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 md:px-6 md:pb-6 pt-0">
            <div className="flex items-center text-xs md:text-sm text-muted-foreground">
              <FolderOpen className="h-4 w-4 mr-1" />
              K dispozícii
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 p-4 md:p-6">
            <CardDescription className="text-xs md:text-sm">Hodiny tento mesiac</CardDescription>
            <CardTitle className="text-2xl md:text-3xl">{stats.monthlyHours}h</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 md:px-6 md:pb-6 pt-0">
            <div className="flex items-center text-xs md:text-sm text-muted-foreground">
              <ClipboardList className="h-4 w-4 mr-1" />
              Celkový čas
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Open closings alert */}
      {openClosings.some((c) => c.status === "returned") && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2 p-4 md:p-6">
            <CardTitle className="text-destructive text-base md:text-lg">
              Vrátené na opravu
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 md:px-6 md:pb-6 pt-0">
            {openClosings
              .filter((c) => c.status === "returned")
              .map((closing) => (
                <div key={closing.id} className="flex items-center justify-between py-2">
                  <div>
                    <span className="font-medium text-sm md:text-base">
                      KW {closing.calendar_week}/{closing.year}
                    </span>
                    {closing.return_comment && (
                      <p className="text-xs md:text-sm text-destructive mt-1">
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
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-base md:text-lg">Posledné záznamy</CardTitle>
          <CardDescription className="text-xs md:text-sm">Vaše nedávne výkony</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 md:px-6 md:pb-6 pt-0">
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
            <>
              {/* Mobile: Card view */}
              <div className="md:hidden space-y-0">
                {recentRecords.map((record) => (
                  <MobileRecordCard
                    key={record.id}
                    id={record.id}
                    date={record.date}
                    projectName={record.projects?.name}
                    timeFrom={record.time_from}
                    timeTo={record.time_to}
                    totalHours={record.total_hours}
                    status={record.status}
                  />
                ))}
              </div>
              
              {/* Desktop: List view */}
              <div className="hidden md:block space-y-2">
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Admin Widget: Current Accommodations */}
      {isAdmin && currentAccommodations.length > 0 && (
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Home className="h-5 w-5" />
              Aktuálne ubytovaní
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">Prehľad pracovníkov v ubytovaniach</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 md:px-6 md:pb-6 pt-0">
            <div className="space-y-2">
              {currentAccommodations.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="font-medium text-sm md:text-base">{acc.user_name}</span>
                      <p className="text-xs md:text-sm text-muted-foreground">{acc.accommodation_name}</p>
                    </div>
                  </div>
                  <div className="text-right text-xs md:text-sm text-muted-foreground">
                    {acc.check_out 
                      ? format(new Date(acc.check_out), "d. MMM", { locale: sk })
                      : "Bez dátumu"}
                  </div>
                </div>
              ))}
            </div>
            <Button variant="link" className="mt-2 p-0 text-sm" asChild>
              <Link to="/accommodations">Zobraziť všetky →</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Sticky Mobile Action Button */}
      <StickyActionButton to="/daily-entry" label="Zapísať denný výkon" />
    </div>
  );
}
