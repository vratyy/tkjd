import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface Filters {
  search: string;
  minCapacity: string;
  maxPricePerPerson: string;
  minRating: string;
  amenities: string[];
}

const AMENITY_OPTIONS = ["WiFi", "Parkovanie", "Práčka", "Kuchyňa", "TV", "Klimatizácia"];

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export default function AccommodationFilters({ filters, onChange }: Props) {
  const toggleAmenity = (amenity: string) => {
    const next = filters.amenities.includes(amenity)
      ? filters.amenities.filter((a) => a !== amenity)
      : [...filters.amenities, amenity];
    onChange({ ...filters, amenities: next });
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
      <div className="relative flex-1 w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Hľadať podľa mesta alebo adresy..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-9"
        />
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Filtre
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-4" align="end">
          <div>
            <Label className="text-xs">Min. kapacita</Label>
            <Input
              type="number"
              min="1"
              placeholder="napr. 2"
              value={filters.minCapacity}
              onChange={(e) => onChange({ ...filters, minCapacity: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Max. cena/osoba (€)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="napr. 15"
              value={filters.maxPricePerPerson}
              onChange={(e) => onChange({ ...filters, maxPricePerPerson: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Min. hodnotenie (0-10)</Label>
            <Input
              type="number"
              min="0"
              max="10"
              step="0.5"
              placeholder="napr. 6"
              value={filters.minRating}
              onChange={(e) => onChange({ ...filters, minRating: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs mb-2 block">Vybavenie</Label>
            <div className="grid grid-cols-2 gap-2">
              {AMENITY_OPTIONS.map((a) => (
                <label key={a} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={filters.amenities.includes(a)}
                    onCheckedChange={() => toggleAmenity(a)}
                  />
                  {a}
                </label>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
