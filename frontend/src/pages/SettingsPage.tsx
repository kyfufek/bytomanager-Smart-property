import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Nastavení</h1>
        <p className="text-muted-foreground">Správa účtu a preferencí</p>
      </div>

      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-base">Profil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Jméno</Label>
              <Input defaultValue="Jan Novák" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input defaultValue="jan@example.cz" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Telefon</Label>
            <Input defaultValue="+420 777 123 456" />
          </div>
          {/* TODO: napojit na API */}
          <Button variant="cta">Uložit změny</Button>
        </CardContent>
      </Card>

      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-base">Notifikace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">E-mailové notifikace</p>
              <p className="text-xs text-muted-foreground">Upozornění o platbách a událostech</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">AI doporučení</p>
              <p className="text-xs text-muted-foreground">Automatické návrhy od AI asistenta</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">SMS upozornění</p>
              <p className="text-xs text-muted-foreground">Kritické události (dluhy, výpadky)</p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
