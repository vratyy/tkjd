import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import DailyEntry from "./pages/DailyEntry";
import WeeklyClosings from "./pages/WeeklyClosings";
import Approvals from "./pages/Approvals";
import LockWeeks from "./pages/LockWeeks";
import Projects from "./pages/Projects";
import Users from "./pages/Users";
import Profile from "./pages/Profile";
import AdminSettings from "./pages/AdminSettings";
import FinancialDashboard from "./pages/FinancialDashboard";
import Accommodations from "./pages/Accommodations";
import Employees from "./pages/Employees";
import Sanctions from "./pages/Sanctions";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/daily-entry" element={<DailyEntry />} />
              <Route path="/weekly-closings" element={<WeeklyClosings />} />
              <Route path="/approvals" element={<Approvals />} />
              <Route path="/lock-weeks" element={<LockWeeks />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/users" element={<Users />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin-settings" element={<AdminSettings />} />
              <Route path="/financial-dashboard" element={<FinancialDashboard />} />
              <Route path="/accommodations" element={<Accommodations />} />
              <Route path="/employees" element={<Employees />} />
              <Route path="/sanctions" element={<Sanctions />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
