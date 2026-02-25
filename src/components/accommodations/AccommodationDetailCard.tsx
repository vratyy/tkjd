import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Users, Euro, MapPin, Mail, Phone, Ruler, X } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  notes: string | null;
}

interface Props {
  accommodation: Accommodation;
  onClose: () => void;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-4 w-4 ${s <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
      <span className="ml-1 text-sm text-muted-foreground">{rating}/5</span>
    </div>
  );
}

export default function AccommodationDetailCard({ accommodation: acc, onClose }: Props) {
  const amenities: string[] = Array.isArray(acc.amenities) ? acc.amenities : [];

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
        {(acc.rating ?? 0) > 0 && <StarRating rating={acc.rating ?? 0} />}
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

        {acc.notes && (
          <div className="border-t pt-3">
            <p className="font-medium text-xs text-muted-foreground uppercase mb-1">Poznámky</p>
            <p className="text-muted-foreground">{acc.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
