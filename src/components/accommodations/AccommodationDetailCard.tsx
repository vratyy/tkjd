import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Users, Euro, MapPin, Mail, Phone, Ruler, X, Edit2, Save, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import AssignSubcontractorModal from "./AssignSubcontractorModal";
import { format } from "date-fns";
import { sk } from "date-fns/locale";

interface Accommodation {
  id: string;
  name: string;
  address: string;
  city: string | null;
  capacity: number | null;
  distance_from_center: string | null;
  price_total: number | null;
  price_per_person: number | null;
  amenities: string[] | null;
  owner_email: string | null;
  owner_phone: string | null;
  rating: number | null;
  rating_location: number | null;
  rating_price: number | null;
  rating_extension: number | null;
  rating_amenities: number | null;
  rating_overall: number | null;
  notes: string | null;
}

interface Assignment {
  id: string;
  user_id: string;
  check_in: string;
  check_out: string | null;
  user_name: string;
}

interface Props {
  accommodation: Accommodation;
  onClose: () => void;
  onUpdated?: () => void;
}

function RatingBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}/10</span>
      </div>
      <Progress value={value * 10} className="h-1.5" />
    </div>
  );
}

export default function AccommodationDetailCard({ accommodation: acc, onClose, onUpdated }: Props) {
  const { isAdmin, isManager } = useUserRole();
  const { toast } = useToast();
  const canManage = isAdmin || isManager;
  const amenities: string[] = Array.isArray(acc.amenities) ? acc.amenities : [];

  const [editing, setEditing] = useState(false);
  const [editNotes, setEditNotes] = useState(acc.notes ?? "");
  const [editRatings, setEditRatings] = useState({
    rating_location: acc.rating_location ?? 0,
    rating_price: acc.rating_price ?? 0,
    rating_extension: acc.rating_extension ?? 0,
    rating_amenities: acc.rating_amenities ?? 0,
    rating_overall: acc.rating_overall ?? 0,
  });
  const [saving, setSaving] = useState(false);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  useEffect(() => {
    setEditing(false);
    setEditNotes(acc.notes ?? "");
    setEditRatings({
      rating_location: acc.rating_location ?? 0,
      rating_price: acc.rating_price ?? 0,
      rating_extension: acc.rating_extension ?? 0,
      rating_amenities: acc.rating_amenities ?? 0,
      rating_overall: acc.rating_overall ?? 0,
    });
  }, [acc.id]);

  // Fetch assignments
  useEffect(() => {
    const fetchAssignments = async () => {
      setLoadingAssignments(true);
      const { data } = await supabase
        .from("accommodation_assignments")
        .select("id, user_id, check_in, check_out")
        .eq("accommodation_id", acc.id)
        .is("deleted_at", null)
        .order("check_in", { ascending: false });

      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((a) => a.user_id))];
        const { data: profiles } = await supabase.rpc("get_team_profiles_safe", {
          target_user_ids: userIds,
        });
        const nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));

        setAssignments(
          data.map((a) => ({
            ...a,
            user_name: nameMap.get(a.user_id) || "Neznámy",
          }))
        );
      } else {
        setAssignments([]);
      }
      setLoadingAssignments(false);
    };

    fetchAssignments();
  }, [acc.id]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("accommodations")
      .update({
        notes: editNotes || null,
        rating_location: editRatings.rating_location,
        rating_price: editRatings.rating_price,
        rating_extension: editRatings.rating_extension,
        rating_amenities: editRatings.rating_amenities,
        rating_overall: editRatings.rating_overall,
      } as any)
      .eq("id", acc.id);

    if (error) {
      toast({ title: "Chyba", description: "Nepodarilo sa uložiť.", variant: "destructive" });
    } else {
      toast({ title: "Uložené", description: "Hodnotenie a poznámky boli aktualizované." });
      setEditing(false);
      onUpdated?.();
    }
    setSaving(false);
  };

  const handleAssigned = () => {
    setShowAssignModal(false);
    const fetchAssignments = async () => {
      const { data } = await supabase
        .from("accommodation_assignments")
        .select("id, user_id, check_in, check_out")
        .eq("accommodation_id", acc.id)
        .is("deleted_at", null)
        .order("check_in", { ascending: false });

      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((a) => a.user_id))];
        const { data: profiles } = await supabase.rpc("get_team_profiles_safe", {
          target_user_ids: userIds,
        });
        const nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));
        setAssignments(data.map((a) => ({ ...a, user_name: nameMap.get(a.user_id) || "Neznámy" })));
      } else {
        setAssignments([]);
      }
    };
    fetchAssignments();
  };

  const today = new Date().toISOString().split("T")[0];
  const currentAssignments = assignments.filter(
    (a) => a.check_in <= today && (a.check_out === null || a.check_out >= today)
  );
  const pastAssignments = assignments.filter(
    (a) => a.check_out !== null && a.check_out < today
  );

  const overallRating = acc.rating_overall ?? 0;

  return (
    <Card className="border-primary/30 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{acc.name || acc.address}</CardTitle>
            {acc.city && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3" /> {acc.city}
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {overallRating > 0 && (
          <div className="flex items-center gap-1.5 mt-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="font-semibold text-sm">{overallRating} / 10</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{acc.address}</p>

        <div className="grid grid-cols-2 gap-2">
          {acc.capacity && (
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>Kapacita: {acc.capacity}</span>
            </div>
          )}
          {(acc.price_per_person ?? 0) > 0 && (
            <div className="flex items-center gap-1.5">
              <Euro className="h-4 w-4 text-muted-foreground" />
              <span>{Number(acc.price_per_person).toFixed(2)} €/os.</span>
            </div>
          )}
          {(acc.price_total ?? 0) > 0 && (
            <div className="flex items-center gap-1.5">
              <Euro className="h-4 w-4 text-muted-foreground" />
              <span>Celkom: {Number(acc.price_total).toFixed(2)} €</span>
            </div>
          )}
          {acc.distance_from_center && (
            <div className="flex items-center gap-1.5">
              <Ruler className="h-4 w-4 text-muted-foreground" />
              <span>{acc.distance_from_center}</span>
            </div>
          )}
        </div>

        {amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {amenities.map((a) => (
              <Badge key={a} variant="secondary" className="text-xs">
                {a}
              </Badge>
            ))}
          </div>
        )}

        {/* Rating Card */}
        <div className="border-t pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium text-xs text-muted-foreground uppercase">Hodnotenie</p>
            {canManage && !editing && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setEditing(true)}>
                <Edit2 className="h-3 w-3 mr-1" /> Upraviť
              </Button>
            )}
          </div>
          {editing ? (
            <div className="space-y-3">
              {[
                { key: "rating_location" as const, label: "Lokalita / Blízkosť centra" },
                { key: "rating_price" as const, label: "Cena / Osoba" },
                { key: "rating_extension" as const, label: "Možnosť predlžovania" },
                { key: "rating_amenities" as const, label: "Vybavenie" },
                { key: "rating_overall" as const, label: "Celkové hodnotenie" },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span>{label}</span>
                    <span className="font-medium tabular-nums">{editRatings[key]}/10</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={editRatings[key]}
                    onChange={(e) => setEditRatings({ ...editRatings, [key]: parseFloat(e.target.value) })}
                    className="w-full h-1.5 accent-primary"
                  />
                </div>
              ))}
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Pridajte poznámky..."
                className="min-h-[60px] text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                  Uložiť
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  setEditing(false);
                  setEditRatings({
                    rating_location: acc.rating_location ?? 0,
                    rating_price: acc.rating_price ?? 0,
                    rating_extension: acc.rating_extension ?? 0,
                    rating_amenities: acc.rating_amenities ?? 0,
                    rating_overall: acc.rating_overall ?? 0,
                  });
                  setEditNotes(acc.notes ?? "");
                }}>
                  Zrušiť
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <RatingBar label="Lokalita / Blízkosť centra" value={acc.rating_location ?? 0} />
              <RatingBar label="Cena / Osoba" value={acc.rating_price ?? 0} />
              <RatingBar label="Možnosť predlžovania" value={acc.rating_extension ?? 0} />
              <RatingBar label="Vybavenie" value={acc.rating_amenities ?? 0} />
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="border-t pt-3">
          <p className="font-medium text-xs text-muted-foreground uppercase mb-1">Poznámky</p>
          <p className="text-muted-foreground">{acc.notes || "Žiadne poznámky"}</p>
        </div>

        {(acc.owner_email || acc.owner_phone) && (
          <div className="border-t pt-3 space-y-1">
            <p className="font-medium text-xs text-muted-foreground uppercase">Kontakt majiteľa</p>
            {acc.owner_email && (
              <a href={`mailto:${acc.owner_email}`} className="flex items-center gap-1.5 text-primary hover:underline">
                <Mail className="h-3.5 w-3.5" /> {acc.owner_email}
              </a>
            )}
            {acc.owner_phone && (
              <a href={`tel:${acc.owner_phone}`} className="flex items-center gap-1.5 text-primary hover:underline">
                <Phone className="h-3.5 w-3.5" /> {acc.owner_phone}
              </a>
            )}
          </div>
        )}

        {/* Assigned Subcontractors */}
        <div className="border-t pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium text-xs text-muted-foreground uppercase">Ubytovaní montéri</p>
            {canManage && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setShowAssignModal(true)}>
                <Plus className="h-3 w-3 mr-1" /> Priradiť
              </Button>
            )}
          </div>
          {loadingAssignments ? (
            <div className="flex justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : assignments.length === 0 ? (
            <p className="text-muted-foreground text-xs">Žiadni priradení montéri</p>
          ) : (
            <div className="space-y-1.5">
              {currentAssignments.length > 0 && (
                <>
                  <p className="text-xs font-medium text-primary">Aktuálne</p>
                  {currentAssignments.map((a) => (
                    <div key={a.id} className="flex items-center justify-between text-xs bg-primary/5 rounded px-2 py-1.5">
                      <span className="font-medium">{a.user_name}</span>
                      <span className="text-muted-foreground">
                        {format(new Date(a.check_in), "d.M.", { locale: sk })} – {a.check_out ? format(new Date(a.check_out), "d.M.yy", { locale: sk }) : "∞"}
                      </span>
                    </div>
                  ))}
                </>
              )}
              {pastAssignments.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground mt-2">Minulé</p>
                  {pastAssignments.slice(0, 3).map((a) => (
                    <div key={a.id} className="flex items-center justify-between text-xs text-muted-foreground px-2 py-1">
                      <span>{a.user_name}</span>
                      <span>
                        {format(new Date(a.check_in), "d.M.", { locale: sk })} – {format(new Date(a.check_out!), "d.M.yy", { locale: sk })}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>

      <AssignSubcontractorModal
        open={showAssignModal}
        onOpenChange={setShowAssignModal}
        accommodationId={acc.id}
        onAssigned={handleAssigned}
      />
    </Card>
  );
}
