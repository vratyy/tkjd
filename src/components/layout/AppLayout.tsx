import { Link, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Footer } from "@/components/Footer";
import { AppSidebar } from "./AppSidebar";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { LogOut, Menu, Loader2, Building2 } from "lucide-react";

export function AppLayout() {
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
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger>
                <Menu className="h-5 w-5" />
              </SidebarTrigger>
              {/* Mobile Home Link - visible on small screens */}
              <Link 
                to="/dashboard" 
                className="flex items-center gap-2 md:hidden"
                aria-label="Go to Dashboard"
              >
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-semibold text-foreground text-sm">TKJD</span>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden sm:block">{user.email}</span>
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Odhlásiť</span>
              </Button>
            </div>
          </header>

          {/* Main content - reduced padding on mobile, extra bottom padding for sticky button */}
          <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 overflow-auto">
            <div className="max-w-7xl mx-auto animate-fade-in">
              <Outlet />
            </div>
          </main>

          <Footer />
        </div>
      </div>
    </SidebarProvider>
  );
}
