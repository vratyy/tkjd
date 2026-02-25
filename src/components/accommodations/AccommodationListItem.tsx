import { Star, Users, Euro, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Accommodation {
  id: string;
  name: string;
  address: string;
  city: string | null;
  capacity: number | null;
  price_per_person: number | null;
  rating: number | null;
  amenities: string[] | null;
}

interface Props {
  accommodation: Accommodation;
  isSelected: boolean;
  onClick: () => void;
}

export default function AccommodationListItem({ accommodation: acc, isSelected, onClick }: Props) {
  const amenities: string[] = Array.isArray(acc.amenities) ? acc.amenities : [];

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40 hover:bg-muted/50"
      }`}
    >
      <div className="flex items-start justify-between mb-1">
        <h4 className="font-medium text-sm leading-tight">{acc.name || acc.address}</h4>
        {(acc.rating ?? 0) > 0 && (
          <div className="flex items-center gap-0.5 text-xs shrink-0 ml-2">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span>{acc.rating}</span>
          </div>
        )}
      </div>

      {acc.city && (
        <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
          <MapPin className="h-3 w-3" /> {acc.city}
        </p>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {acc.capacity && (
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" /> {acc.capacity}
          </span>
        )}
        {(acc.price_per_person ?? 0) > 0 && (
          <span className="flex items-center gap-1">
            <Euro className="h-3 w-3" /> {Number(acc.price_per_person).toFixed(0)} €/os.
          </span>
        )}
      </div>

      {amenities.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {amenities.slice(0, 3).map((a) => (
            <Badge key={a} variant="outline" className="text-[10px] px-1.5 py-0">
              {a}
            </Badge>
          ))}
          {amenities.length > 3 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              +{amenities.length - 3}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
