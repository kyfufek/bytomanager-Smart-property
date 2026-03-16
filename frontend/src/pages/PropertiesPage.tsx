import { useEffect, useState } from "react";
import { Plus, Building, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type PropertyApiItem = {
  id: number;
  name: string;
  rent: number;
  paymentStatus: string;
};

export default function PropertiesPage() {
  const [open, setOpen] = useState(false);
  const [properties, setProperties] = useState<PropertyApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadProperties() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("http://localhost:5000/api/properties", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as PropertyApiItem[];
        setProperties(data);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        setError("Nepodarilo se nacist nemovitosti z backendu.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadProperties();
    return () => controller.abort();
  }, []);

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
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setOpen(false); }}>
              <div className="space-y-2">
                <Label>Nazev</Label>
                <Input placeholder="Byt 2+1 Praha" />
              </div>
              <div className="space-y-2">
                <Label>Adresa</Label>
                <Input placeholder="Ulice a cislo" />
              </div>
              <div className="space-y-2">
                <Label>Mesicni najemne</Label>
                <Input placeholder="15000 Kc" />
              </div>
              <Button type="submit" variant="cta" className="w-full">
                Ulozit nemovitost
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
                  Adresa neni dostupna
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Najemne</span>
                  <span className="font-semibold">{property.rent.toLocaleString("cs-CZ")} Kc</span>
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
