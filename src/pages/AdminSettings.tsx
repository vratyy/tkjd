import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Database, Shield, FolderPlus, FileCheck, Download, Trash2, AlertTriangle } from "lucide-react";
import { CreateAnnouncementCard } from "@/components/announcements/CreateAnnouncementCard";
import { Navigate } from "react-router-dom";
import { addDays, format, startOfWeek, getISOWeek, getYear } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

export default function AdminSettings() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [seeding, setSeeding] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const seedTestData = async () => {
    if (!user) return;
    
    setSeeding(true);
    try {
      // 1. Create test project
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          name: "Test Project Berlin",
          client: "Berlin Construction GmbH",
          location: "Berlin, Nemecko",
          is_active: true,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // 2. Get current week info
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const calendarWeek = getISOWeek(today);
      const year = getYear(today);

      // 3. Create performance records for current week (Mon-Fri)
      const records = [];
      for (let i = 0; i < 5; i++) {
        const date = addDays(weekStart, i);
        records.push({
          user_id: user.id,
          project_id: project.id,
          date: format(date, "yyyy-MM-dd"),
          time_from: "07:00",
          time_to: "16:00",
          break_start: "12:00",
          break_end: "12:30",
          status: "approved" as const,
          note: `Test záznam pre ${format(date, "EEEE")}`,
        });
      }

      const { error: recordsError } = await supabase
        .from("performance_records")
        .insert(records);

      if (recordsError) throw recordsError;

      // 4. Create approved weekly closing
      const { error: closingError } = await supabase
        .from("weekly_closings")
        .insert({
          user_id: user.id,
          calendar_week: calendarWeek,
          year: year,
          status: "approved" as const,
          submitted_at: new Date().toISOString(),
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        });

      if (closingError) throw closingError;

      toast({
        title: "Testovacie dáta vytvorené",
        description: `Projekt "Test Project Berlin" s 5 schválenými záznamami pre KW${calendarWeek}.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: error.message,
      });
    } finally {
      setSeeding(false);
    }
  };

  const downloadCsv = (data: Record<string, any>[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(","),
      ...data.map(row =>
        headers.map(h => {
          const val = row[h] === null || row[h] === undefined ? "" : String(row[h]);
          return `"${val.replace(/"/g, '""')}"`;
        }).join(",")
      ),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportTable = async (tableName: string, label: string) => {
    setExporting(tableName);
    try {
      const { data, error } = await supabase
        .from(tableName as any)
        .select("*")
        .is("deleted_at", null);

      if (error) throw error;
      if (!data || data.length === 0) {
        toast({ title: "Žiadne dáta", description: `Tabuľka "${label}" je prázdna.` });
        setExporting(null);
        return;
      }

      downloadCsv(data as Record<string, any>[], `backup_${tableName}_${format(new Date(), "yyyy-MM-dd")}.csv`);
      toast({ title: "Export úspešný", description: `${label} (${data.length} záznamov) exportované.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    } finally {
      setExporting(null);
    }
  };

  const exportBackup = async () => {
    setExporting("all");
    try {
      const [profilesRes, projectsRes, recordsRes, invoicesRes, accommodationsRes, assignmentsRes] = await Promise.all([
        supabase.from("profiles").select("*").is("deleted_at", null),
        supabase.from("projects").select("*").is("deleted_at", null),
        supabase.from("performance_records").select("*").is("deleted_at", null),
        supabase.from("invoices").select("*").is("deleted_at", null),
        supabase.from("accommodations").select("*").is("deleted_at", null),
        supabase.from("accommodation_assignments").select("*").is("deleted_at", null),
      ]);

      const backup = {
        exported_at: new Date().toISOString(),
        version: "1.0",
        data: {
          profiles: profilesRes.data || [],
          projects: projectsRes.data || [],
          performance_records: recordsRes.data || [],
          invoices: invoicesRes.data || [],
          accommodations: accommodationsRes.data || [],
          accommodation_assignments: assignmentsRes.data || [],
        },
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tkjd-backup-${format(new Date(), "yyyy-MM-dd-HHmmss")}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Záloha stiahnutá", description: "Kompletná záloha dát bola úspešne exportovaná." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    } finally {
      setExporting(null);
    }
  };

  const resetTestData = async () => {
    const confirmed = window.confirm(
      "Ste si istý? Táto akcia vymaže všetky faktúry, uzávierky, výkonové záznamy a priradenia ubytovania. Táto akcia je nevratná!"
    );
    
    if (!confirmed) return;
    
    setResetting(true);
    try {
      // Delete in order to respect foreign key constraints
      // 1. First delete invoices (they reference weekly_closings)
      const { error: invoicesError } = await supabase
        .from("invoices")
        .delete()
        .not("id", "is", null); // Delete all rows
      
      if (invoicesError) throw invoicesError;

      // 2. Delete accommodation_assignments
      const { error: assignmentsError } = await supabase
        .from("accommodation_assignments")
        .delete()
        .not("id", "is", null);
      
      if (assignmentsError) throw assignmentsError;

      // 3. Delete performance_records
      const { error: recordsError } = await supabase
        .from("performance_records")
        .delete()
        .not("id", "is", null);
      
      if (recordsError) throw recordsError;

      // 4. Delete weekly_closings
      const { error: closingsError } = await supabase
        .from("weekly_closings")
        .delete()
        .not("id", "is", null);
      
      if (closingsError) throw closingsError;

      // 5. Delete advances (linked to invoices)
      const { error: advancesError } = await supabase
        .from("advances")
        .delete()
        .not("id", "is", null);
      
      if (advancesError) throw advancesError;

      // Invalidate all queries to refresh dashboards
      await queryClient.invalidateQueries();

      toast({
        title: "Systém bol vyčistený",
        description: "Všetky testovacie dáta boli úspešne vymazané.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Chyba pri mazaní dát",
        description: error.message,
      });
    } finally {
      setResetting(false);
    }
  };

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Administrácia</h2>
        <p className="text-muted-foreground">Nastavenia a nástroje pre administrátorov</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Stav systému
            </CardTitle>
            <CardDescription>Aktuálny stav administrátorského prístupu</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Rola</span>
              <span className="font-medium text-primary">Admin</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Správa projektov</span>
              <span className="text-primary">✓ Povolené</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Správa používateľov</span>
              <span className="text-primary">✓ Povolené</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Uzamykanie týždňov</span>
              <span className="text-primary">✓ Povolené</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Testovacie dáta
            </CardTitle>
            <CardDescription>
              Vytvorte vzorové dáta pre testovanie funkcionalít
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="flex items-center gap-2">
                <FolderPlus className="h-4 w-4" />
                Vytvorí projekt "Test Project Berlin"
              </p>
              <p className="flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                Pridá 5 schválených záznamov (Po-Pi)
              </p>
              <p className="flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                Vytvorí schválenú týždňovú uzávierku
              </p>
            </div>
            <Button onClick={seedTestData} disabled={seeding} className="w-full">
              {seeding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Vytváranie...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Vytvoriť testovacie dáta
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Záloha dát
            </CardTitle>
            <CardDescription>
              Exportujte dáta z jednotlivých tabuliek vo formáte CSV alebo kompletnú zálohu JSON
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { table: "profiles", label: "Profily (Používatelia, Sadzby, IBAN)" },
                { table: "performance_records", label: "Denné záznamy (Výkony)" },
                { table: "invoices", label: "Faktúry" },
                { table: "projects", label: "Projekty" },
              ].map(({ table, label }) => (
                <Button
                  key={table}
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                  disabled={!!exporting}
                  onClick={() => exportTable(table, label)}
                >
                  {exporting === table ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin shrink-0" />
                  ) : (
                    <Download className="h-4 w-4 mr-2 shrink-0" />
                  )}
                  <span className="text-left text-xs">{label}</span>
                </Button>
              ))}
            </div>
            <div className="border-t pt-4">
              <Button onClick={exportBackup} disabled={!!exporting} className="w-full" variant="secondary">
                {exporting === "all" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exportujem...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Stiahnuť kompletnú zálohu (JSON)
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Announcement System */}
      <CreateAnnouncementCard />


      {/* Danger Zone */}
      <Card className="border-2 border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Nebezpečná zóna
          </CardTitle>
          <CardDescription>
            Tieto akcie sú nevratné. Použite ich opatrne.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h4 className="font-medium text-destructive">Vymazať všetky testovacie dáta</h4>
                <p className="text-sm text-muted-foreground">
                  Vymaže všetky faktúry, uzávierky, výkonové záznamy a priradenia ubytovania.
                  Profily, projekty a ubytovania zostanú zachované.
                </p>
              </div>
              <Button 
                variant="destructive" 
                onClick={resetTestData} 
                disabled={resetting}
                className="shrink-0"
              >
                {resetting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Mazanie...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Vymazať všetky testovacie dáta
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
