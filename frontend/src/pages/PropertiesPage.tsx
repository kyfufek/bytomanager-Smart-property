import { useEffect, useState } from "react";
import { Plus, Building, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type PropertyApiItem = {
  id: number | string;
  name: string;
  address?: string | null;
  city?: string | null;
  rent: number;
  paymentStatus: string;
};

export default function PropertiesPage() {
  const [open, setOpen] = useState(false);
  const [properties, setProperties] = useState<PropertyApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [unitsCount, setUnitsCount] = useState("1");
  const [rent, setRent] = useState("");
  const [notes, setNotes] = useState("");

  async function loadProperties(signal?: AbortSignal) {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch("/api/properties", { signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as PropertyApiItem[];
      setProperties(data);
    } catch {
      if (signal?.aborted) {
        return;
      }
      setError("Nepodarilo se nacist nemovitosti z backendu.");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    loadProperties(controller.signal);
    return () => controller.abort();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setFormError("");

    if (!name.trim()) {
      setFormError("Nazev je povinny.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await apiFetch("/api/properties", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim() || null,
          city: city.trim() || null,
          postal_code: postalCode.trim() || null,
          units_count: Number(unitsCount) > 0 ? Number(unitsCount) : 1,
          rent: Number(rent) >= 0 ? Number(rent) : 0,
          notes: notes.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      setOpen(false);
      setName("");
      setAddress("");
      setCity("");
      setPostalCode("");
      setUnitsCount("1");
      setRent("");
      setNotes("");
      await loadProperties();
    } catch {
      setFormError("Nepodarilo se ulozit nemovitost.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(propertyId: string | number) {
    if (deletingId !== null) return;

    const confirmed = window.confirm("Opravdu chcete tuto nemovitost smazat?");
    if (!confirmed) return;

    try {
      setDeletingId(propertyId);
      const response = await apiFetch(`/api/properties/${propertyId}`, {
        method: "DELETE",
      });

      // If the item was already deleted by a duplicate request, treat as success.
      if (!response.ok && response.status !== 204 && response.status !== 404) {
        throw new Error(`HTTP ${response.status}`);
      }

      await loadProperties();
    } catch {
      setError("Nepodarilo se smazat nemovitost.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Moje nemovitosti</h1>
          <p className="text-muted-foreground">Sprava bytovych jednotek z backend API</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="cta">
              <Plus className="mr-2 h-4 w-4" /> Pridat nemovitost
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Pridat novou nemovitost</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label>Nazev</Label>
                <Input
                  placeholder="Byt 2+1 Praha"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Adresa</Label>
                <Input
                  placeholder="Ulice a cislo"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Mesto</Label>
                <Input
                  placeholder="Praha"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>PSC</Label>
                <Input
                  placeholder="12000"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Pocet jednotek</Label>
                <Input
                  type="number"
                  min="1"
                  value={unitsCount}
                  onChange={(e) => setUnitsCount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Najemne (Kc)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={rent}
                  onChange={(e) => setRent(e.target.value)}
                  placeholder="18000"
                />
              </div>
              <div className="space-y-2">
                <Label>Poznamka</Label>
                <Input
                  placeholder="Nepovinny komentar"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              {formError && <p className="text-xs text-destructive">{formError}</p>}
              <Button type="submit" variant="cta" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Ukladam..." : "Ulozit nemovitost"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Nacitam nemovitosti...</p>}
      {!loading && error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {!loading &&
          !error &&
          properties.map((property) => (
            <Card
              key={property.id}
              className="card-shadow hover:card-shadow-hover transition-shadow cursor-pointer group"
            >
              <div className="h-36 bg-accent flex items-center justify-center rounded-t-lg">
                <Building className="h-12 w-12 text-muted-foreground/30 group-hover:text-primary/40 transition-colors" />
              </div>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold">{property.name}</h3>
                  <Badge
                    variant="secondary"
                    className={
                      property.paymentStatus === "uhrazeno"
                        ? "bg-success/10 text-success border-0"
                        : "bg-destructive/10 text-destructive border-0"
                    }
                  >
                    {property.paymentStatus === "uhrazeno" ? "Zaplaceno" : "Dluh"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {property.address || property.city
                    ? [property.address, property.city].filter(Boolean).join(", ")
                    : "Adresa neni dostupna"}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Najemne</span>
                  <span className="font-semibold">{Number(property.rent ?? 0).toLocaleString("cs-CZ")} Kc</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={deletingId === property.id}
                  onClick={() => handleDelete(property.id)}
                >
                  {deletingId === property.id ? "Mazani..." : "Smazat"}
                </Button>
              </CardContent>
            </Card>
          ))}
      </div>

      {!loading && !error && properties.length === 0 && (
        <p className="text-sm text-muted-foreground">Backend nevratil zadne nemovitosti.</p>
      )}
    </div>
  );
}
