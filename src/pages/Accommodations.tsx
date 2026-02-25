import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Home, Users, Euro, MapPin } from "lucide-react";
import AccommodationFilters, { type Filters } from "@/components/accommodations/AccommodationFilters";
import AccommodationListItem from "@/components/accommodations/AccommodationListItem";
import AccommodationDetailCard from "@/components/accommodations/AccommodationDetailCard";
import CreateAccommodationDialog from "@/components/accommodations/CreateAccommodationDialog";

const AccommodationMap = lazy(() => import("@/components/accommodations/AccommodationMap"));

interface Accommodation {
  id: string;
  name: string;
  address: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  capacity: number | null;
  distance_from_center: string | null;
  price_total: number | null;
  price_per_person: number | null;
  default_price_per_night: number;
  amenities: any;
  owner_email: string | null;
  owner_phone: string | null;
  rating: number | null;
  rating_location: number | null;
  rating_price: number | null;
  rating_extension: number | null;
  rating_amenities: number | null;
  rating_overall: number | null;
  notes: string | null;
  contact: string | null;
  is_active: boolean;
}

const seedRatings = [
  { keyword: 'Adalbertstr', loc: 10, price: 10, ext: 10, am: 10, ov: 10 },
  { keyword: 'Tannenberg', loc: 8, price: 10, ext: 10, am: 10, ov: 10 },
  { keyword: 'Fürreuthweg', loc: 8, price: 10, ext: 10, am: 10, ov: 10 },
  { keyword: 'Fleischergasse', loc: 6, price: 10, ext: 10, am: 10, ov: 9 },
  { keyword: 'Berliner Landstraße', loc: 1, price: 10, ext: 10, am: 10, ov: 7 },
  { keyword: 'Mentelin', loc: 6, price: 10, ext: 3, am: 0, ov: 5 },
  { keyword: 'Traubinger', loc: 10, price: 10, ext: 10, am: 10, ov: 10 },
  { keyword: 'In d. Au', loc: 10, price: 10, ext: 10, am: 10, ov: 10 },
  { keyword: 'Drösslinger', loc: 9, price: 10, ext: 7, am: 5, ov: 7 },
  { keyword: 'Alt-Karow', loc: 3, price: 10, ext: 5, am: 10, ov: 6.5 },
];

export default function Accommodations() {
  const { isAdmin, isManager, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const canManage = isAdmin || isManager;
  const [seeding, setSeeding] = useState(false);

  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    search: "", minCapacity: "", maxPricePerPerson: "", minRating: "", amenities: [],
  });

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("accommodations")
      .select("*")
      .is("deleted_at", null)
      .order("name");
    setAccommodations((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!roleLoading) fetchData();
  }, [roleLoading]);

  const filtered = useMemo(() => {
    return accommodations.filter((a) => {
      const searchLower = filters.search.toLowerCase();
      if (searchLower) {
        const matchCity = a.city?.toLowerCase().includes(searchLower);
        const matchAddr = a.address?.toLowerCase().includes(searchLower);
        const matchName = a.name?.toLowerCase().includes(searchLower);
        if (!matchCity && !matchAddr && !matchName) return false;
      }
      if (filters.minCapacity && (a.capacity ?? 0) < parseInt(filters.minCapacity)) return false;
      if (filters.maxPricePerPerson && (a.price_per_person ?? 0) > parseFloat(filters.maxPricePerPerson)) return false;
      if (filters.minRating && (a.rating_overall ?? 0) < parseFloat(filters.minRating)) return false;
      if (filters.amenities.length > 0) {
        const accAmenities: string[] = Array.isArray(a.amenities) ? a.amenities : [];
        if (!filters.amenities.every((f) => accAmenities.includes(f))) return false;
      }
      return true;
    });
  }, [accommodations, filters]);

  const selected = filtered.find((a) => a.id === selectedId) || null;

  const handleSeedRatings = async () => {
    setSeeding(true);
    toast({ title: "⏳ Aktualizujem hodnotenia..." });
    let updated = 0;
    try {
      for (const item of seedRatings) {
        const { data, error } = await supabase
          .from("accommodations")
          .update({
            rating_location: item.loc,
            rating_price: item.price,
            rating_extension: item.ext,
            rating_amenities: item.am,
            rating_overall: item.ov,
          })
          .ilike("address", `%${item.keyword}%`)
          .select();

        if (error) {
          console.error(`Chyba pri "${item.keyword}":`, error);
          toast({ title: `Chyba pri ${item.keyword}`, description: error.message, variant: "destructive" });
        } else if (!data || data.length === 0) {
          console.warn(`Nenašla sa zhoda pre: "${item.keyword}"`);
        } else {
          updated += data.length;
          console.log(`Aktualizovaných ${data.length} záznamov pre "${item.keyword}"`);
        }
      }
      toast({ title: `✅ Skript dobehol. Aktualizovaných: ${updated} záznamov.` });
      await fetchData();
    } catch (e: any) {
      console.error("Kritická chyba:", e);
      toast({ title: "Kritická chyba", description: e.message, variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  };

  if (roleLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Evidencia ubytovania</h2>
          <p className="text-muted-foreground">Mapa a prehľad ubytovacích zariadení</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={handleSeedRatings} disabled={seeding}>
              {seeding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              ⚙️ Aktualizovať staré hodnotenia (Jednorazovo)
            </Button>
          )}
          {canManage && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nové ubytovanie
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className="text-xs">Celkom zariadení</CardDescription>
            <CardTitle className="text-2xl">{accommodations.length}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex items-center text-xs text-muted-foreground"><Home className="h-3 w-3 mr-1" />aktívnych</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className="text-xs">Zobrazených</CardDescription>
            <CardTitle className="text-2xl">{filtered.length}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex items-center text-xs text-muted-foreground"><MapPin className="h-3 w-3 mr-1" />po filtrácii</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className="text-xs">Celk. kapacita</CardDescription>
            <CardTitle className="text-2xl">{filtered.reduce((s, a) => s + (a.capacity ?? 0), 0)}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex items-center text-xs text-muted-foreground"><Users className="h-3 w-3 mr-1" />osôb</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardDescription className="text-xs">Miest</CardDescription>
            <CardTitle className="text-2xl">{new Set(filtered.map((a) => a.city).filter(Boolean)).size}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex items-center text-xs text-muted-foreground"><Euro className="h-3 w-3 mr-1" />unikátnych</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <AccommodationFilters filters={filters} onChange={setFilters} />

      {/* Map + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Suspense fallback={<div className="h-[500px] bg-muted rounded-lg flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            <AccommodationMap
              accommodations={filtered}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </Suspense>
        </div>
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {selected ? (
            <AccommodationDetailCard accommodation={selected} onClose={() => setSelectedId(null)} onUpdated={fetchData} />
          ) : null}
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Home className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Žiadne výsledky pre zadané filtre</p>
            </div>
          ) : (
            filtered.map((acc) => (
              <AccommodationListItem
                key={acc.id}
                accommodation={acc}
                isSelected={acc.id === selectedId}
                onClick={() => setSelectedId(acc.id === selectedId ? null : acc.id)}
              />
            ))
          )}
        </div>
      </div>

      <CreateAccommodationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={fetchData}
      />
    </div>
  );
}
