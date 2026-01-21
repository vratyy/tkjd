import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Calendar, ClipboardList, FolderOpen, LogOut, Loader2 } from "lucide-react";

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">TKJD APP</h1>
              <p className="text-xs text-muted-foreground">Dashboard</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Odhlásiť
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
          {/* Welcome section */}
          <div>
            <h2 className="text-2xl font-bold text-foreground">Vitajte späť</h2>
            <p className="text-muted-foreground">{user.email}</p>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Otvorené týždňové uzávierky</CardDescription>
                <CardTitle className="text-3xl">0</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 mr-1" />
                  Aktuálny týždeň
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Aktívne projekty</CardDescription>
                <CardTitle className="text-3xl">0</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-sm text-muted-foreground">
                  <FolderOpen className="h-4 w-4 mr-1" />
                  Priradené projekty
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Výkony tento mesiac</CardDescription>
                <CardTitle className="text-3xl">0h</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-sm text-muted-foreground">
                  <ClipboardList className="h-4 w-4 mr-1" />
                  Celkový čas
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Placeholder for recent activity */}
          <Card>
            <CardHeader>
              <CardTitle>Posledné záznamy</CardTitle>
              <CardDescription>Vaše nedávne výkony</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Zatiaľ nemáte žiadne záznamy.</p>
                <Button className="mt-4" size="sm">
                  Pridať prvý záznam
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
