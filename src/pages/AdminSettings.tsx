import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Database, Shield, FolderPlus, FileCheck } from "lucide-react";
import { Navigate } from "react-router-dom";
import { addDays, format, startOfWeek, getISOWeek, getYear } from "date-fns";

export default function AdminSettings() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [seeding, setSeeding] = useState(false);

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
      </div>
    </div>
  );
}
