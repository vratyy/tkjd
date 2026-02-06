import { useState, useEffect, useMemo } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, ChevronRight, ChevronDown, Download, Building2, Filter, Search, Edit2, UserX, UserCheck } from "lucide-react";
import { Navigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  company_name: string | null;
  parent_user_id: string | null;
  fixed_wage: number | null;
  hourly_rate: number | null;
  is_active: boolean;
  role?: string;
  invoices: {
    paid: number;
    unpaid: number;
    total_paid_amount: number;
    total_unpaid_amount: number;
  };
  housing_cost: number;
  children?: Employee[];
}

export default function Employees() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "salary" | "project">("name");
  
  // Edit parent dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [newParentId, setNewParentId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  
  // Deactivate dialog
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [employeeToDeactivate, setEmployeeToDeactivate] = useState<Employee | null>(null);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      
      // Fetch all profiles with roles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, company_name, parent_user_id, fixed_wage, hourly_rate, is_active")
        .is("deleted_at", null);
        
      if (profilesError) throw profilesError;

      // Fetch roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .is("deleted_at", null);

      // Fetch invoices for each user
      const { data: invoices } = await supabase
        .from("invoices")
        .select("user_id, status, total_amount")
        .is("deleted_at", null);

      // Fetch housing costs
      const { data: accommodations } = await supabase
        .from("accommodation_assignments")
        .select("user_id, total_cost")
        .is("deleted_at", null);

      // Build employee objects
      const employeeMap = new Map<string, Employee>();
      
      (profiles || []).forEach(profile => {
        const userInvoices = (invoices || []).filter(inv => inv.user_id === profile.user_id);
        const paidInvoices = userInvoices.filter(inv => inv.status === "paid");
        const unpaidInvoices = userInvoices.filter(inv => inv.status !== "paid" && inv.status !== "void");
        
        const housingTotal = (accommodations || [])
          .filter(acc => acc.user_id === profile.user_id)
          .reduce((sum, acc) => sum + (Number(acc.total_cost) || 0), 0);

        const userRole = roles?.find(r => r.user_id === profile.user_id);

        employeeMap.set(profile.user_id, {
          id: profile.id,
          user_id: profile.user_id,
          full_name: profile.full_name,
          company_name: profile.company_name,
          parent_user_id: profile.parent_user_id,
          fixed_wage: profile.fixed_wage,
          hourly_rate: profile.hourly_rate,
          is_active: profile.is_active ?? true,
          role: userRole?.role || "monter",
          invoices: {
            paid: paidInvoices.length,
            unpaid: unpaidInvoices.length,
            total_paid_amount: paidInvoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0),
            total_unpaid_amount: unpaidInvoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0),
          },
          housing_cost: housingTotal,
          children: [],
        });
      });

      setEmployees(Array.from(employeeMap.values()));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  // Build tree structure
  const tree = useMemo(() => {
    const employeesCopy = employees.map(e => ({ ...e, children: [] as Employee[] }));
    const roots: Employee[] = [];
    const map = new Map<string, Employee>();
    
    employeesCopy.forEach(e => map.set(e.user_id, e));
    
    employeesCopy.forEach(e => {
      if (e.parent_user_id && map.has(e.parent_user_id)) {
        const parent = map.get(e.parent_user_id)!;
        parent.children = parent.children || [];
        parent.children.push(e);
      } else {
        roots.push(e);
      }
    });

    // Sort
    const sortFn = (a: Employee, b: Employee) => {
      if (sortBy === "name") return a.full_name.localeCompare(b.full_name);
      if (sortBy === "salary") return (b.fixed_wage || b.hourly_rate || 0) - (a.fixed_wage || a.hourly_rate || 0);
      return 0;
    };
    
    const sortTree = (nodes: Employee[]) => {
      nodes.sort(sortFn);
      nodes.forEach(n => n.children && sortTree(n.children));
    };
    
    sortTree(roots);
    return roots;
  }, [employees, sortBy]);

  // Filter by search
  const filteredTree = useMemo(() => {
    if (!search.trim()) return tree;
    
    const filterNodes = (nodes: Employee[]): Employee[] => {
      return nodes.filter(node => {
        const matches = node.full_name.toLowerCase().includes(search.toLowerCase()) ||
                       node.company_name?.toLowerCase().includes(search.toLowerCase());
        const childMatches = node.children && filterNodes(node.children).length > 0;
        return matches || childMatches;
      }).map(node => ({
        ...node,
        children: node.children ? filterNodes(node.children) : [],
      }));
    };
    
    return filterNodes(tree);
  }, [tree, search]);

  const toggleNode = (userId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedNodes(newExpanded);
  };

  const openEditDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    setNewParentId(employee.parent_user_id || "");
    setEditDialogOpen(true);
  };

  const handleSaveParent = async () => {
    if (!selectedEmployee) return;
    setSaving(true);
    
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ parent_user_id: newParentId || null })
        .eq("user_id", selectedEmployee.user_id);
        
      if (error) throw error;
      
      toast({
        title: "Uložené",
        description: "Nadradený používateľ bol aktualizovaný.",
      });
      
      setEditDialogOpen(false);
      await fetchEmployees();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivateAccess = async () => {
    if (!employeeToDeactivate) return;
    setSaving(true);
    
    try {
      const newActiveStatus = !employeeToDeactivate.is_active;
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: newActiveStatus })
        .eq("user_id", employeeToDeactivate.user_id);
        
      if (error) throw error;
      
      toast({
        title: newActiveStatus ? "Prístup obnovený" : "Prístup deaktivovaný",
        description: newActiveStatus 
          ? `Používateľ ${employeeToDeactivate.full_name} môže opäť pristupovať do systému.`
          : `Používateľ ${employeeToDeactivate.full_name} už nemá prístup do systému.`,
      });
      
      setDeactivateDialogOpen(false);
      await fetchEmployees();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: error.message,
      });
    } finally {
      setSaving(false);
      setEmployeeToDeactivate(null);
    }
  };

  const openDeactivateDialog = (employee: Employee) => {
    setEmployeeToDeactivate(employee);
    setDeactivateDialogOpen(true);
  };

  const handleDownloadAllInvoices = async (employee: Employee) => {
    toast({
      title: "Príprava súboru",
      description: `Generujem ZIP súbor pre ${employee.full_name}...`,
    });
    // TODO: Implement ZIP download via edge function
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin": return "bg-destructive text-destructive-foreground";
      case "manager": return "bg-primary text-primary-foreground";
      case "accountant": return "bg-secondary text-secondary-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const renderNode = (node: Employee, level: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.user_id);
    
    return (
      <div key={node.user_id} className="select-none">
        <div 
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
          style={{ paddingLeft: `${level * 24 + 12}px` }}
        >
          {hasChildren ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => toggleNode(node.user_id)}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          ) : (
            <div className="w-6" />
          )}
          
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {node.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`font-medium truncate ${!node.is_active ? "text-muted-foreground line-through" : ""}`}>
                {node.full_name}
              </span>
              <Badge className={getRoleBadgeColor(node.role || "monter")} variant="secondary">
                {node.role}
              </Badge>
              {!node.is_active && (
                <Badge variant="outline" className="text-destructive border-destructive">
                  Neaktívny
                </Badge>
              )}
            </div>
            {node.company_name && (
              <p className="text-sm text-muted-foreground truncate">{node.company_name}</p>
            )}
          </div>
          
          <div className="hidden md:flex items-center gap-6 text-sm">
            <div className="text-right">
              <p className="text-muted-foreground text-xs">Zaplatené</p>
              <p className="font-medium text-primary">{node.invoices.paid} ({node.invoices.total_paid_amount.toFixed(0)}€)</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-xs">Nezaplatené</p>
              <p className="font-medium text-destructive">{node.invoices.unpaid} ({node.invoices.total_unpaid_amount.toFixed(0)}€)</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-xs">Ubytovanie</p>
              <p className="font-medium">{node.housing_cost.toFixed(0)}€</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openDeactivateDialog(node)}
              title={node.is_active ? "Deaktivovať prístup" : "Obnoviť prístup"}
            >
              {node.is_active ? (
                <UserX className="h-4 w-4 text-destructive" />
              ) : (
                <UserCheck className="h-4 w-4 text-primary" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEditDialog(node)}
              title="Upraviť nadradeného"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDownloadAllInvoices(node)}
              title="Stiahnuť všetky faktúry"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!roleLoading && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Users className="h-7 w-7" />
            Prehľad tímu
          </h1>
          <p className="text-muted-foreground">Hierarchická štruktúra a prehľad tímu</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Hľadať podľa mena..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Zoradiť" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Podľa mena</SelectItem>
                  <SelectItem value="salary">Podľa mzdy</SelectItem>
                  <SelectItem value="project">Podľa projektu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Company Root Node */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 mb-4">
            <div className="w-6" />
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <span className="font-semibold">TKJD s.r.o.</span>
              <p className="text-sm text-muted-foreground">Hlavná spoločnosť</p>
            </div>
          </div>
          
          {/* Employee Tree */}
          <div className="divide-y divide-border">
            {filteredTree.map(node => renderNode(node))}
          </div>
          
          {filteredTree.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Žiadni spolupracovníci nenájdení.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Parent Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upraviť nadradeného</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Vyberte nadradeného používateľa pre <strong>{selectedEmployee?.full_name}</strong>
            </p>
            <div className="space-y-2">
              <Label>Nadradený (recruiter)</Label>
              <Select value={newParentId} onValueChange={setNewParentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Žiadny (root)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Žiadny (priamo pod firmou)</SelectItem>
                  {employees
                    .filter(e => e.user_id !== selectedEmployee?.user_id)
                    .map(e => (
                      <SelectItem key={e.user_id} value={e.user_id}>
                        {e.full_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Zrušiť
            </Button>
            <Button onClick={handleSaveParent} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Uložiť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Access Dialog */}
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {employeeToDeactivate?.is_active ? "Deaktivovať prístup" : "Obnoviť prístup"}
            </DialogTitle>
            <DialogDescription>
              {employeeToDeactivate?.is_active 
                ? "Používateľ stratí prístup do systému, ale jeho historické údaje (faktúry, záznamy) zostanú zachované."
                : "Používateľ získa opätovný prístup do systému."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm">
              {employeeToDeactivate?.is_active ? "Deaktivujete" : "Aktivujete"} prístup pre: <strong>{employeeToDeactivate?.full_name}</strong>
            </p>
            {employeeToDeactivate?.company_name && (
              <p className="text-sm text-muted-foreground">{employeeToDeactivate.company_name}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateDialogOpen(false)}>
              Zrušiť
            </Button>
            <Button 
              variant={employeeToDeactivate?.is_active ? "destructive" : "default"}
              onClick={handleDeactivateAccess} 
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {employeeToDeactivate?.is_active ? "Deaktivovať" : "Aktivovať"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
