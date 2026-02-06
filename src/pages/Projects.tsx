import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, FolderOpen, MapPin, Building2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import { ProjectDetailDialog } from "@/components/projects/ProjectDetailDialog";

interface Project {
  id: string;
  name: string;
  client: string;
  location: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  standard_hours: number | null;
}

export default function Projects() {
  const { user } = useAuth();
  const { isAdmin, isManager, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Create form state
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching projects:", error);
    } else {
      setProjects((data as Project[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase.from("projects").insert({
      name,
      client: client || "N/A",
      location: location || null,
      address: address || null,
      is_active: true,
    });

    if (error) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    } else {
      toast({ title: "Projekt vytvorený", description: "Nový projekt bol úspešne pridaný." });
      setCreateDialogOpen(false);
      setName("");
      setClient("");
      setLocation("");
      setAddress("");
      await fetchProjects();
    }
    setSaving(false);
  };

  const toggleActive = async (project: Project) => {
    if (!isAdmin) return;
    const { error } = await supabase
      .from("projects")
      .update({ is_active: !project.is_active })
      .eq("id", project.id);

    if (error) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    } else {
      await fetchProjects();
    }
  };

  const openDetail = (project: Project) => {
    setDetailProject(project);
    setDetailOpen(true);
  };

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin && !isManager) {
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
          <h2 className="text-2xl font-bold text-foreground">Projekty</h2>
          <p className="text-muted-foreground">Správa stavebných projektov</p>
        </div>
        {isAdmin && (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nový projekt
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Nový projekt</DialogTitle>
                  <DialogDescription>Vytvorte nový stavebný projekt</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Názov projektu</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Bytový dom Slnečná"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client">Klient</Label>
                    <Input
                      id="client"
                      value={client}
                      onChange={(e) => setClient(e.target.value)}
                      placeholder="ABC Development s.r.o."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Adresa</Label>
                    <Input
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Ulica, Mesto, PSČ"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Miesto plnenia (voliteľné)</Label>
                    <Input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Bratislava, Slovensko"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Zrušiť
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vytvoriť"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">Zatiaľ nemáte žiadne projekty.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card
              key={project.id}
              className={`cursor-pointer transition-shadow hover:shadow-md ${!project.is_active ? "opacity-60" : ""}`}
              onClick={() => openDetail(project)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{project.name}</CardTitle>
                  {isAdmin && (
                    <Switch
                      checked={project.is_active}
                      onCheckedChange={(e) => {
                        // Prevent card click
                        toggleActive(project);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {project.address && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Building2 className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{project.address}</span>
                    </div>
                  )}
                  {project.location && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{project.location}</span>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Badge variant={project.is_active ? "default" : "secondary"}>
                      {project.is_active ? "Aktívny" : "Neaktívny"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Project Detail Dialog */}
      <ProjectDetailDialog
        project={detailProject}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        isAdmin={isAdmin}
        onUpdated={fetchProjects}
      />
    </div>
  );
}
