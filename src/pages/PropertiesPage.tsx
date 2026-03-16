import { useState } from "react";
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

// TODO: napojit na API
const mockProperties = [
  { id: 1, name: "Byt 3+1 Praha", address: "Vinohradská 45", rent: "18 500 Kč", owner: "Jan Novák", paid: true, image: "" },
  { id: 2, name: "Byt 2+kk Brno", address: "Masarykova 12", rent: "14 000 Kč", owner: "Jan Novák", paid: false, image: "" },
  { id: 3, name: "Byt 1+1 Ostrava", address: "Hlavní třída 88", rent: "9 500 Kč", owner: "Jan Novák", paid: true, image: "" },
  { id: 4, name: "Byt 4+kk Plzeň", address: "Americká 20", rent: "22 000 Kč", owner: "Jan Novák", paid: true, image: "" },
];

export default function PropertiesPage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mé nemovitosti</h1>
          <p className="text-muted-foreground">Správa vašich bytových jednotek</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="cta">
              <Plus className="mr-2 h-4 w-4" /> Přidat nemovitost
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Přidat novou nemovitost</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setOpen(false); }}>
              <div className="space-y-2">
                <Label>Název</Label>
                <Input placeholder="Byt 2+1 Praha" />
              </div>
              <div className="space-y-2">
                <Label>Adresa</Label>
                <Input placeholder="Ulice a číslo" />
              </div>
              <div className="space-y-2">
                <Label>Měsíční nájemné</Label>
                <Input placeholder="15 000 Kč" />
              </div>
              {/* TODO: napojit na API */}
              <Button type="submit" variant="cta" className="w-full">
                Uložit nemovitost
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {mockProperties.map((p) => (
          <Card key={p.id} className="card-shadow hover:card-shadow-hover transition-shadow cursor-pointer group">
            <div className="h-36 bg-accent flex items-center justify-center rounded-t-lg">
              <Building className="h-12 w-12 text-muted-foreground/30 group-hover:text-primary/40 transition-colors" />
            </div>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold">{p.name}</h3>
                <Badge
                  variant="secondary"
                  className={
                    p.paid
                      ? "bg-success/10 text-success border-0"
                      : "bg-destructive/10 text-destructive border-0"
                  }
                >
                  {p.paid ? "Zaplaceno" : "Dluh"}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {p.address}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Nájemné</span>
                <span className="font-semibold">{p.rent}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
