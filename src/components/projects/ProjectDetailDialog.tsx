import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin, Building2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { ProjectAssignments } from "./ProjectAssignments";

interface Project {
  id: string;
  name: string;
  client: string;
  location: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
}

interface ProjectDetailDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  onUpdated: () => void;
}

export function ProjectDetailDialog({
  project,
  open,
  onOpenChange,
  isAdmin,
  onUpdated,
}: ProjectDetailDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Edit form state
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setClient(project.client);
      setLocation(project.location || "");
      setAddress(project.address || "");
      setIsActive(project.is_active);
    }
  }, [project]);

  if (!project) return null;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);

    const { error } = await supabase
      .from("projects")
      .update({
        name,
        client,
        location: location || null,
        address: address || null,
        is_active: isActive,
      })
      .eq("id", project.id);

    if (error) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    } else {
      toast({ title: "Uložené", description: "Projekt bol aktualizovaný." });
      onUpdated();
      onOpenChange(false);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    const { error } = await supabase
      .from("projects")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", project.id);

    if (error) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    } else {
      toast({ title: "Zmazané", description: "Projekt bol odstránený." });
      onUpdated();
      onOpenChange(false);
    }
    setDeleteDialogOpen(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail projektu</DialogTitle>
            <DialogDescription>
              {isAdmin ? "Upravte údaje projektu a spravujte priradenia." : "Zobraziť údaje projektu."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="detail-name">Názov projektu</Label>
              <Input
                id="detail-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isAdmin}
              />
            </div>

            {isAdmin && (
              <div className="space-y-2">
                <Label htmlFor="detail-client">Klient</Label>
                <Input
                  id="detail-client"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="detail-address">Adresa</Label>
              <Input
                id="detail-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ulica, Mesto, PSČ"
                disabled={!isAdmin}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="detail-location">Miesto plnenia</Label>
              <Input
                id="detail-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Bratislava, Slovensko"
                disabled={!isAdmin}
              />
            </div>

            {isAdmin && (
              <div className="flex items-center justify-between">
                <Label>Aktívny projekt</Label>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            )}

            {/* Project Assignments - Admin only */}
            {isAdmin && (
              <>
                <Separator />
                <ProjectAssignments projectId={project.id} />
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            {isAdmin && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
                className="mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Zmazať
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {isAdmin ? "Zrušiť" : "Zavrieť"}
            </Button>
            {isAdmin && (
              <Button onClick={handleSave} disabled={saving || !name.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Uložiť"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zmazať projekt?</AlertDialogTitle>
            <AlertDialogDescription>
              Projekt „{project.name}" bude označený ako zmazaný. Táto akcia sa nedá vrátiť.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Zmazať
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
