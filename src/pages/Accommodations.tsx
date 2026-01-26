import { useState, useEffect } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, MapPin, Home, Euro, Users } from "lucide-react";
import { format } from "date-fns";
import { sk } from "date-fns/locale";

interface Accommodation {
  id: string;
  name: string;
  address: string;
  contact: string | null;
  default_price_per_night: number;
  lat: number | null;
  lng: number | null;
  is_active: boolean;
}

interface AccommodationAssignment {
  id: string;
  user_id: string;
  accommodation_id: string;
  project_id: string | null;
  check_in: string;
  check_out: string | null;
  price_per_night: number;
  total_cost: number | null;
  note: string | null;
  accommodation?: { id: string; name: string; address: string };
  profile?: { full_name: string };
  project?: { id: string; name: string };
}

interface Profile {
  user_id: string;
  full_name: string;
}

interface Project {
  id: string;
  name: string;
}

export default function Accommodations() {
  const { isAdmin, isManager, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [assignments, setAssignments] = useState<AccommodationAssignment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [showAccommodationDialog, setShowAccommodationDialog] = useState(false);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form states
  const [accommodationForm, setAccommodationForm] = useState({
    name: "",
    address: "",
    contact: "",
    default_price_per_night: "",
    lat: "",
    lng: "",
  });
  
  const [assignmentForm, setAssignmentForm] = useState({
    user_id: "",
    accommodation_id: "",
    project_id: "",
    check_in: "",
    check_out: "",
    price_per_night: "",
    note: "",
  });

  const canManage = isAdmin || isManager;

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch accommodations
    const { data: accData } = await supabase
      .from("accommodations")
      .select("*")
      .is("deleted_at", null)
      .order("name");
    
    setAccommodations(accData || []);
    
    // Fetch assignments with related data
    const { data: assignData } = await supabase
      .from("accommodation_assignments")
      .select(`
        *,
        accommodation:accommodations(id, name, address),
        project:projects(id, name)
      `)
      .is("deleted_at", null)
      .order("check_in", { ascending: false });
    
    // Enrich with profiles
    const enrichedAssignments = await Promise.all(
      (assignData || []).map(async (a) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", a.user_id)
          .maybeSingle();
        return { ...a, profile } as AccommodationAssignment;
      })
    );
    
    setAssignments(enrichedAssignments);
    
    // Fetch profiles for assignment form
    if (canManage) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .is("deleted_at", null)
        .order("full_name");
      
      setProfiles(profileData || []);
      
      const { data: projectData } = await supabase
        .from("projects")
        .select("id, name")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name");
      
      setProjects(projectData || []);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    if (!roleLoading) {
      fetchData();
    }
  }, [roleLoading, canManage]);

  const handleCreateAccommodation = async () => {
    if (!accommodationForm.name || !accommodationForm.address) {
      toast({ variant: "destructive", title: "Vyplňte názov a adresu" });
      return;
    }
    
    setSaving(true);
    
    const { error } = await supabase.from("accommodations").insert({
      name: accommodationForm.name,
      address: accommodationForm.address,
      contact: accommodationForm.contact || null,
      default_price_per_night: parseFloat(accommodationForm.default_price_per_night) || 0,
      lat: accommodationForm.lat ? parseFloat(accommodationForm.lat) : null,
      lng: accommodationForm.lng ? parseFloat(accommodationForm.lng) : null,
    });
    
    if (error) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    } else {
      toast({ title: "Ubytovanie vytvorené" });
      setShowAccommodationDialog(false);
      setAccommodationForm({ name: "", address: "", contact: "", default_price_per_night: "", lat: "", lng: "" });
      fetchData();
    }
    
    setSaving(false);
  };

  const handleCreateAssignment = async () => {
    if (!assignmentForm.user_id || !assignmentForm.accommodation_id || !assignmentForm.check_in) {
      toast({ variant: "destructive", title: "Vyplňte povinné polia" });
      return;
    }
    
    setSaving(true);
    
    const selectedAcc = accommodations.find(a => a.id === assignmentForm.accommodation_id);
    const pricePerNight = parseFloat(assignmentForm.price_per_night) || selectedAcc?.default_price_per_night || 0;
    
    const { error } = await supabase.from("accommodation_assignments").insert({
      user_id: assignmentForm.user_id,
      accommodation_id: assignmentForm.accommodation_id,
      project_id: assignmentForm.project_id || null,
      check_in: assignmentForm.check_in,
      check_out: assignmentForm.check_out || null,
      price_per_night: pricePerNight,
      note: assignmentForm.note || null,
    });
    
    if (error) {
      toast({ variant: "destructive", title: "Chyba", description: error.message });
    } else {
      toast({ title: "Priradenie vytvorené" });
      setShowAssignmentDialog(false);
      setAssignmentForm({ user_id: "", accommodation_id: "", project_id: "", check_in: "", check_out: "", price_per_night: "", note: "" });
      fetchData();
    }
    
    setSaving(false);
  };

  // Calculate stats
  const currentlyAccommodated = assignments.filter(a => !a.check_out || new Date(a.check_out) >= new Date());
  const totalCosts = assignments.reduce((sum, a) => sum + (Number(a.total_cost) || 0), 0);

  if (roleLoading || loading) {
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
          <h2 className="text-2xl font-bold text-foreground">Evidencia ubytovania</h2>
          <p className="text-muted-foreground">Prehľad ubytovaní a nákladov</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAccommodationDialog(true)}>
              <Home className="h-4 w-4 mr-2" />
              Nové ubytovanie
            </Button>
            <Button onClick={() => setShowAssignmentDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Priradiť pracovníka
            </Button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Aktuálne ubytovaní</CardDescription>
            <CardTitle className="text-3xl">{currentlyAccommodated.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <Users className="h-4 w-4 mr-1" />
              pracovníkov
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ubytovacie zariadenia</CardDescription>
            <CardTitle className="text-3xl">{accommodations.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <Home className="h-4 w-4 mr-1" />
              aktívne
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Celkové náklady</CardDescription>
            <CardTitle className="text-3xl">{totalCosts.toFixed(2)} €</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <Euro className="h-4 w-4 mr-1" />
              evidované
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Map placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Mapa ubytovaní
          </CardTitle>
          <CardDescription>Geografické rozmiestnenie ubytovacích zariadení</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
            <div className="text-center text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Mapový prehľad ({accommodations.length} lokácií)</p>
              <p className="text-sm">Interaktívna mapa bude zobrazená tu</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accommodations List */}
      <Card>
        <CardHeader>
          <CardTitle>Ubytovacie zariadenia</CardTitle>
          <CardDescription>Zoznam všetkých ubytovaní</CardDescription>
        </CardHeader>
        <CardContent>
          {accommodations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Home className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Zatiaľ nie sú pridané žiadne ubytovanie.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Názov</TableHead>
                  <TableHead>Adresa</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead className="text-right">Cena/noc</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accommodations.map((acc) => (
                  <TableRow key={acc.id}>
                    <TableCell className="font-medium">{acc.name}</TableCell>
                    <TableCell>{acc.address}</TableCell>
                    <TableCell>{acc.contact || "—"}</TableCell>
                    <TableCell className="text-right">{acc.default_price_per_night.toFixed(2)} €</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Current Assignments */}
      <Card>
        <CardHeader>
          <CardTitle>Aktuálne priradenia</CardTitle>
          <CardDescription>Kto je kde ubytovaný</CardDescription>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Zatiaľ nie sú priradení žiadni pracovníci.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pracovník</TableHead>
                  <TableHead>Ubytovanie</TableHead>
                  <TableHead>Projekt</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead className="text-right">Náklady</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.profile?.full_name || "—"}</TableCell>
                    <TableCell>{a.accommodation?.name || "—"}</TableCell>
                    <TableCell>{a.project?.name || "—"}</TableCell>
                    <TableCell>{format(new Date(a.check_in), "d. MMM yyyy", { locale: sk })}</TableCell>
                    <TableCell>
                      {a.check_out ? format(new Date(a.check_out), "d. MMM yyyy", { locale: sk }) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {a.total_cost ? `${Number(a.total_cost).toFixed(2)} €` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Accommodation Dialog */}
      <Dialog open={showAccommodationDialog} onOpenChange={setShowAccommodationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nové ubytovanie</DialogTitle>
            <DialogDescription>Pridajte nové ubytovacie zariadenie</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Názov *</Label>
              <Input
                value={accommodationForm.name}
                onChange={(e) => setAccommodationForm({ ...accommodationForm, name: e.target.value })}
                placeholder="napr. Penzión Pod Dubom"
              />
            </div>
            <div>
              <Label>Adresa *</Label>
              <Input
                value={accommodationForm.address}
                onChange={(e) => setAccommodationForm({ ...accommodationForm, address: e.target.value })}
                placeholder="napr. Hlavná 123, Bratislava"
              />
            </div>
            <div>
              <Label>Kontakt</Label>
              <Input
                value={accommodationForm.contact}
                onChange={(e) => setAccommodationForm({ ...accommodationForm, contact: e.target.value })}
                placeholder="napr. +421 900 123 456"
              />
            </div>
            <div>
              <Label>Cena za noc (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={accommodationForm.default_price_per_night}
                onChange={(e) => setAccommodationForm({ ...accommodationForm, default_price_per_night: e.target.value })}
                placeholder="napr. 25.00"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Lat (GPS)</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={accommodationForm.lat}
                  onChange={(e) => setAccommodationForm({ ...accommodationForm, lat: e.target.value })}
                  placeholder="48.1486"
                />
              </div>
              <div>
                <Label>Lng (GPS)</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={accommodationForm.lng}
                  onChange={(e) => setAccommodationForm({ ...accommodationForm, lng: e.target.value })}
                  placeholder="17.1077"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAccommodationDialog(false)}>Zrušiť</Button>
            <Button onClick={handleCreateAccommodation} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Vytvoriť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Assignment Dialog */}
      <Dialog open={showAssignmentDialog} onOpenChange={setShowAssignmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Priradiť pracovníka</DialogTitle>
            <DialogDescription>Priraďte pracovníka k ubytovaniu</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Pracovník *</Label>
              <Select
                value={assignmentForm.user_id}
                onValueChange={(v) => setAssignmentForm({ ...assignmentForm, user_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte pracovníka" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ubytovanie *</Label>
              <Select
                value={assignmentForm.accommodation_id}
                onValueChange={(v) => {
                  const acc = accommodations.find(a => a.id === v);
                  setAssignmentForm({
                    ...assignmentForm,
                    accommodation_id: v,
                    price_per_night: acc?.default_price_per_night.toString() || "",
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte ubytovanie" />
                </SelectTrigger>
                <SelectContent>
                  {accommodations.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name} - {a.address}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Projekt</Label>
              <Select
                value={assignmentForm.project_id}
                onValueChange={(v) => setAssignmentForm({ ...assignmentForm, project_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte projekt (voliteľné)" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Check-in *</Label>
                <Input
                  type="date"
                  value={assignmentForm.check_in}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, check_in: e.target.value })}
                />
              </div>
              <div>
                <Label>Check-out</Label>
                <Input
                  type="date"
                  value={assignmentForm.check_out}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, check_out: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Cena za noc (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={assignmentForm.price_per_night}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, price_per_night: e.target.value })}
                placeholder="napr. 25.00"
              />
            </div>
            <div>
              <Label>Poznámka</Label>
              <Input
                value={assignmentForm.note}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, note: e.target.value })}
                placeholder="Voliteľná poznámka"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignmentDialog(false)}>Zrušiť</Button>
            <Button onClick={handleCreateAssignment} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Priradiť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
