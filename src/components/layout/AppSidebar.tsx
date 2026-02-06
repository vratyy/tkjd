import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Building2,
  LayoutDashboard,
  ClipboardList,
  FolderOpen,
  CalendarDays,
  FileText,
  CheckCircle,
  Lock,
  Users,
  UserCircle,
  Settings,
  Wallet,
  Home,
  Network,
  AlertTriangle,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

const mainNavItems: NavItem[] = [
  { title: "Prehľad", url: "/dashboard", icon: LayoutDashboard },
  { title: "Môj Výkaz", url: "/daily-entry", icon: ClipboardList },
  { title: "Kalendár", url: "/calendar", icon: CalendarDays },
  { title: "Faktúry", url: "/weekly-closings", icon: FileText },
  { title: "Profil", url: "/profile", icon: UserCircle },
];

const managementNavItems: NavItem[] = [
  { title: "Finančný prehľad", url: "/financial-dashboard", icon: Wallet, roles: ["admin"] },
  { title: "Spolupracovníci", url: "/employees", icon: Network, roles: ["admin"] },
  { title: "Sankcie", url: "/sanctions", icon: AlertTriangle, roles: ["admin"] },
  { title: "Ubytovanie", url: "/accommodations", icon: Home, roles: ["manager", "admin"] },
  { title: "Schvaľovanie", url: "/approvals", icon: CheckCircle, roles: ["manager", "admin"] },
  { title: "Všetky projekty", url: "/projects", icon: FolderOpen, roles: ["manager", "admin"] },
  { title: "Všetky uzávierky", url: "/lock-weeks", icon: Lock, roles: ["admin"] },
  { title: "Správa používateľov", url: "/users", icon: Users, roles: ["admin"] },
  { title: "Administrácia", url: "/admin-settings", icon: Settings, roles: ["admin"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { role, loading } = useUserRole();

  const filterByRole = (items: NavItem[]) => {
    if (loading || !role) return [];
    return items.filter((item) => {
      if (!item.roles) return true;
      return item.roles.includes(role);
    });
  };

  const filteredManagementItems = filterByRole(managementNavItems);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <NavLink to="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center flex-shrink-0">
            <Building2 className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-semibold text-sidebar-foreground truncate">TKJD APP</h1>
              <p className="text-xs text-sidebar-foreground/60 truncate">Evidencia výkonov</p>
            </div>
          )}
        </NavLink>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Hlavné</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {filteredManagementItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Správa</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredManagementItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        className="flex items-center gap-3"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                      >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
