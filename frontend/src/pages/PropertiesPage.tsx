import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Building, CalendarClock, FileSpreadsheet, MapPin, Pencil, Plus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DataState } from "@/components/product/DataState";
import { PageHeader } from "@/components/product/PageHeader";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

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

type TenantApiItem = {
  id: string;
  property_id?: string | null;
  payment_status?: "paid" | "pending" | "overdue" | "none";
};

type SettlementApiItem = {
  id: string;
  property_id: string;
  status: "draft" | "calculated" | "reviewed" | "exported" | "sent";
  created_at: string;
};

export default function PropertiesPage() {
  const [open, setOpen] = useState(false);
  const [properties, setProperties] = useState<PropertyApiItem[]>([]);
  const [tenants, setTenants] = useState<TenantApiItem[]>([]);
  const [settlements, setSettlements] = useState<SettlementApiItem[]>([]);
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

  const summary = {
    total: properties.length,
    monthlyRent: properties.reduce((sum, item) => sum + Number(item.rent ?? 0), 0),
    unresolved: properties.filter((item) => item.paymentStatus !== "uhrazeno").length,
  };

  const propertyInsights = useMemo(() => {
    const map = new Map<string, { activeTenants: number; paymentState: string; settlementsState: string; lastActivity: string }>();

    properties.forEach((property) => {
      const propertyId = String(property.id);
      const propertyTenants = tenants.filter((tenant) => String(tenant.property_id ?? "") === propertyId);
      const propertySettlements = settlements.filter((settlement) => String(settlement.property_id) === propertyId);
      const overdueCount = propertyTenants.filter((tenant) => tenant.payment_status === "overdue").length;
      const pendingCount = propertyTenants.filter((tenant) => tenant.payment_status === "pending").length;
      const activeSettlements = propertySettlements.filter((settlement) => settlement.status !== "sent").length;
      const lastActivityDate = propertySettlements
        .map((settlement) => settlement.created_at)
        .sort((a, b) => +new Date(b) - +new Date(a))[0] ?? null;

      map.set(propertyId, {
        activeTenants: propertyTenants.length,
        paymentState: overdueCount > 0 ? `${overdueCount} po splatnosti` : pendingCount > 0 ? `${pendingCount} ceka na uhradu` : propertyTenants.length > 0 ? "Platby v poradku" : "Bez najemniku",
        settlementsState: activeSettlements > 0 ? `${activeSettlements} aktivni` : propertySettlements.length > 0 ? "Historie existuje" : "Zatim bez vyuctovani",
        lastActivity: lastActivityDate ? new Date(lastActivityDate).toLocaleDateString("cs-CZ") : "Bez aktivity",
      });
    });

    return map;
  }, [properties, settlements, tenants]);

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

      const [propertiesRes, tenantsRes, settlementsRes] = await Promise.all([
        apiFetch("/api/properties", { signal }),
        apiFetch("/api/tenants", { signal }),
        apiFetch("/api/billing/settlements", { signal }),
      ]);
      if (!propertiesRes.ok || !tenantsRes.ok) {
        throw new Error(`HTTP ${propertiesRes.status}`);
      }

      const [propertiesData, tenantsData] = await Promise.all([
        propertiesRes.json() as Promise<PropertyApiItem[]>,
        tenantsRes.json() as Promise<TenantApiItem[]>,
      ]);
      setProperties(propertiesData.map(normalizeProperty));
      setTenants(tenantsData);
      if (settlementsRes.ok) {
        setSettlements((await settlementsRes.json()) as SettlementApiItem[]);
      } else {
        setSettlements([]);
      }
    } catch {
      if (signal?.aborted) {
        return;
      }
      setError("Nemovitosti se nepodarilo nacist. Zkuste obnovit stranku nebo opakovat akci.");
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
      setFormError("Nazev nemovitosti je povinny.");
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
        throw new Error(`HTTP ${response.status}`);
      }

      const saved = normalizeProperty((await response.json()) as PropertyApiItem);
      setProperties((prev) =>
        isEditing ? prev.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...prev],
      );

      toast({
        title: isEditing ? "Nemovitost upravena" : "Nemovitost vytvorena",
        description: isEditing
          ? "Zmeny byly uspesne ulozeny."
          : "Nova nemovitost byla pridana do seznamu.",
      });

      setOpen(false);
      setEditingId(null);
      resetForm();
    } catch {
      const message = editingId ? "Nepodarilo se upravit nemovitost." : "Nepodarilo se ulozit nemovitost.";
      setFormError(message);
      toast({
        title: "Akce se nepodarila",
        description: message,
        variant: "destructive",
      });
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

      if (!response.ok && response.status !== 204 && response.status !== 404) {
        throw new Error(`HTTP ${response.status}`);
      }

      setProperties((prev) => prev.filter((item) => item.id !== propertyId));
      toast({
        title: "Nemovitost smazana",
        description: "Nemovitost byla odebrana ze seznamu.",
      });
    } catch {
      setError("Mazani se nepodarilo. Zkuste to prosim znovu.");
      toast({
        title: "Nepodarilo se smazat nemovitost",
        description: "Akce nebyla dokoncena.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Moje nemovitosti"
        description="Sprava bytovych jednotek a jejich zakladnich informaci."
        actions={
          <Dialog open={open} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button variant="cta" onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Pridat nemovitost
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
                  <Input placeholder="Praha" value={city} onChange={(e) => setCity(e.target.value)} />
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
                {formError ? <p className="text-xs text-destructive">{formError}</p> : null}
                <Button type="submit" variant="cta" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Ukladam..." : editingId ? "Ulozit zmeny" : "Ulozit nemovitost"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {error && !loading ? (
        <DataState
          variant="error"
          title="Nemovitosti se nepodarilo nacist"
          description={error}
          actionLabel="Zkusit znovu"
          onAction={() => loadProperties()}
        />
      ) : null}

      {!loading && !error ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="card-shadow">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Nemovitosti celkem</p>
              <p className="mt-1 text-2xl font-bold">{summary.total}</p>
            </CardContent>
          </Card>
          <Card className="card-shadow">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Mesicni najemne</p>
              <p className="mt-1 text-2xl font-bold">{summary.monthlyRent.toLocaleString("cs-CZ")} Kc</p>
            </CardContent>
          </Card>
          <Card className="card-shadow">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Vyžaduje kontrolu</p>
              <p className="mt-1 text-2xl font-bold text-warning">{summary.unresolved}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <Card className="card-shadow" key={`property-skeleton-${index}`}>
                <Skeleton className="h-36 w-full rounded-t-lg rounded-b-none" />
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="grid grid-cols-2 gap-2">
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))
          : properties.map((property) => (
              <Card
                key={property.id}
                className="card-shadow hover:card-shadow-hover transition-shadow cursor-pointer group"
              >
                <div className="h-36 bg-accent flex items-center justify-center rounded-t-lg">
                  <Building className="h-12 w-12 text-muted-foreground/30 group-hover:text-primary/40 transition-colors" />
                </div>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold truncate">{property.name}</h3>
                    <Badge
                      variant="secondary"
                      className={
                        property.paymentStatus === "uhrazeno"
                          ? "bg-success/10 text-success border-0"
                          : property.paymentStatus === "po splatnosti"
                            ? "bg-destructive/10 text-destructive border-0"
                            : "bg-warning/10 text-warning border-0"
                      }
                    >
                      {property.paymentStatus === "uhrazeno"
                        ? "Zaplaceno"
                        : property.paymentStatus === "po splatnosti"
                          ? "Po splatnosti"
                          : "Ceka na platbu"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {property.address || property.city
                        ? [property.address, property.city].filter(Boolean).join(", ")
                        : "Adresa neni dostupna"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Najemne</span>
                    <span className="font-semibold">
                      {Number(property.rent ?? 0).toLocaleString("cs-CZ")} Kc
                    </span>
                  </div>
                  <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-sm">
                    <InsightRow icon={<Users className="h-3.5 w-3.5" />} label="Aktivni najemnici" value={String(propertyInsights.get(String(property.id))?.activeTenants ?? 0)} />
                    <InsightRow icon={<Building className="h-3.5 w-3.5" />} label="Stav plateb" value={propertyInsights.get(String(property.id))?.paymentState ?? "Bez dat"} />
                    <InsightRow icon={<FileSpreadsheet className="h-3.5 w-3.5" />} label="Vyuctovani" value={propertyInsights.get(String(property.id))?.settlementsState ?? "Bez dat"} />
                    <InsightRow icon={<CalendarClock className="h-3.5 w-3.5" />} label="Posledni aktivita" value={propertyInsights.get(String(property.id))?.lastActivity ?? "Bez aktivity"} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(property)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Upravit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
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

      {!loading && !error && properties.length === 0 ? (
        <DataState
          title="Zatim nemate zadne nemovitosti"
          description="Prvni nemovitost pridate behem chvilky, potom se tu zobrazi detailni prehled."
          actionLabel="Pridat nemovitost"
          onAction={openCreateDialog}
        />
      ) : null}
    </div>
  );
}

function InsightRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="shrink-0">{icon}</span>
        <span>{label}</span>
      </div>
      <span className={cn("text-right font-medium", value.includes("po splatnosti") && "text-destructive")}>{value}</span>
    </div>
  );
}
