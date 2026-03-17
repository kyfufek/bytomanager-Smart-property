import { useEffect, useState } from "react";
import { Plus, Building, MapPin, Pencil } from "lucide-react";
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
  postal_code?: string | null;
  units_count?: number | null;
  notes?: string | null;
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
  const [editingId, setEditingId] = useState<string | number | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [unitsCount, setUnitsCount] = useState("1");
  const [rent, setRent] = useState("");
  const [notes, setNotes] = useState("");

  function parseRentInput(value: string) {
    const cleaned = value.replace(/[^0-9.,]/g, "").replace(",", ".");
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
  }

  function resetForm() {
    setName("");
    setAddress("");
    setCity("");
    setPostalCode("");
    setUnitsCount("1");
    setRent("");
    setNotes("");
    setFormError("");
  }

  function normalizeProperty(item: PropertyApiItem): PropertyApiItem {
    return {
      ...item,
      rent: Number(item.rent ?? 0),
      paymentStatus: item.paymentStatus ?? "ceka na platbu",
    };
  }

  function openCreateDialog() {
    setEditingId(null);
    resetForm();
    setOpen(true);
  }

  function openEditDialog(property: PropertyApiItem) {
    setEditingId(property.id);
    setName(property.name ?? "");
    setAddress(property.address ?? "");
    setCity(property.city ?? "");
    setPostalCode(property.postal_code ?? "");
    setUnitsCount(String(property.units_count ?? 1));
    setRent(String(property.rent ?? 0));
    setNotes(property.notes ?? "");
    setFormError("");
    setOpen(true);
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setEditingId(null);
      resetForm();
    }
  }

  async function loadProperties(signal?: AbortSignal) {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch("/api/properties", { signal });
      if (!response.ok) {
        let backendMessage = "";
        try {
          const errorBody = await response.json();
          backendMessage = errorBody?.error || errorBody?.details || "";
        } catch {
          backendMessage = "";
        }
        throw new Error(backendMessage || `HTTP ${response.status}`);
      }

      const data = (await response.json()) as PropertyApiItem[];
      setProperties(data.map(normalizeProperty));
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
      const payload = {
        name: name.trim(),
        address: address.trim() || null,
        city: city.trim() || null,
        postal_code: postalCode.trim() || null,
        units_count: Number(unitsCount) > 0 ? Number(unitsCount) : 1,
        rent: parseRentInput(rent),
        notes: notes.trim() || null,
      };

      const isEditing = editingId !== null;
      const response = await apiFetch(
        isEditing ? `/api/properties/${editingId}` : "/api/properties",
        {
          method: isEditing ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        let backendMessage = "";
        try {
          const errorBody = await response.json();
          backendMessage = errorBody?.error || errorBody?.details || "";
        } catch {
          backendMessage = "";
        }
        throw new Error(backendMessage || `HTTP ${response.status}`);
      }

      const saved = normalizeProperty((await response.json()) as PropertyApiItem);
      setProperties((prev) =>
        isEditing ? prev.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...prev],
      );

      setOpen(false);
      setEditingId(null);
      resetForm();
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      if (editingId) {
        setFormError(detail ? `Nepodarilo se upravit nemovitost: ${detail}` : "Nepodarilo se upravit nemovitost.");
      } else {
        setFormError(detail ? `Nepodarilo se ulozit nemovitost: ${detail}` : "Nepodarilo se ulozit nemovitost.");
      }
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

      setProperties((prev) => prev.filter((item) => item.id !== propertyId));
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
        <Dialog open={open} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button variant="cta" onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" /> Pridat nemovitost
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Upravit nemovitost" : "Pridat novou nemovitost"}</DialogTitle>
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
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9., ]*"
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
                {isSubmitting ? "Ukladam..." : editingId ? "Ulozit zmeny" : "Ulozit nemovitost"}
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
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" onClick={() => openEditDialog(property)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Upravit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={deletingId === property.id}
                    onClick={() => handleDelete(property.id)}
                  >
                    {deletingId === property.id ? "Mazani..." : "Smazat"}
                  </Button>
                </div>
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
