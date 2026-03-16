import { useState } from "react";
import { Send, Bot, User, Settings, Shield, Mail, FileWarning, FileX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// TODO: napojit na API
const mockTenants = [
  { id: 1, name: "Petr Krejčí", unit: "Byt 3+1 Praha", paid: true, initials: "PK", deposit: 30000, debt: 0, dueDay: 15, toleranceDays: 5 },
  { id: 2, name: "Marie Nová", unit: "Byt 2+kk Brno", paid: false, initials: "MN", deposit: 25000, debt: 15000, dueDay: 10, toleranceDays: 3 },
  { id: 3, name: "Tomáš Horák", unit: "Byt 1+1 Ostrava", paid: true, initials: "TH", deposit: 20000, debt: 0, dueDay: 1, toleranceDays: 5 },
  { id: 4, name: "Eva Malá", unit: "Byt 4+kk Plzeň", paid: true, initials: "EM", deposit: 35000, debt: 5000, dueDay: 20, toleranceDays: 7 },
  { id: 5, name: "Jan Svoboda", unit: "Byt 2+1 Olomouc", paid: false, initials: "JS", deposit: 28000, debt: 18000, dueDay: 15, toleranceDays: 5 },
];

const mockMessages = [
  { id: 1, from: "tenant", text: "Dobrý den, chtěl bych nahlásit rozbitou pračku v bytě." },
  { id: 2, from: "ai", text: "📋 Automaticky přiřazeno: štítek **Údržba**\n\nNavrhovaná odpověď pro manažera:\n\n\"Dobrý den, děkujeme za nahlášení. Technika vám pošleme do 48 hodin.\"" },
];

function DepositHealthBar({ deposit, debt }: { deposit: number; debt: number }) {
  const remaining = Math.max(0, deposit - debt);
  const percentage = deposit > 0 ? (remaining / deposit) * 100 : 100;
  const isWarning = percentage <= 50;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Kauce: {deposit.toLocaleString("cs-CZ")} Kč</span>
        {debt > 0 && (
          <span className={isWarning ? "text-destructive font-medium" : "text-warning font-medium"}>
            Dluh: {debt.toLocaleString("cs-CZ")} Kč
          </span>
        )}
      </div>
      <Progress
        value={percentage}
        className={`h-2 ${isWarning ? "[&>div]:bg-destructive" : debt > 0 ? "[&>div]:bg-warning" : "[&>div]:bg-success"}`}
      />
      <p className="text-[11px] text-muted-foreground">
        Zbývá: {remaining.toLocaleString("cs-CZ")} Kč ({Math.round(percentage)} %)
      </p>
    </div>
  );
}

function ContractSettingsModal({ tenant }: { tenant: typeof mockTenants[0] }) {
  const [dueDay, setDueDay] = useState(String(tenant.dueDay));
  const [toleranceDays, setToleranceDays] = useState(String(tenant.toleranceDays));
  const [depositAmount, setDepositAmount] = useState(String(tenant.deposit));

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings className="h-3.5 w-3.5" />
          Nastavit parametry
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Parametry smlouvy – {tenant.name}</DialogTitle>
        </DialogHeader>
        {/* TODO: napojit na API */}
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="dueDay">Den splatnosti (v měsíci)</Label>
            <Input
              id="dueDay"
              type="number"
              min="1"
              max="28"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              placeholder="15"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tolerance">Dny tolerance</Label>
            <Input
              id="tolerance"
              type="number"
              min="0"
              max="30"
              value={toleranceDays}
              onChange={(e) => setToleranceDays(e.target.value)}
              placeholder="5"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deposit">Výše kauce (Kč)</Label>
            <Input
              id="deposit"
              type="number"
              min="0"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="30000"
            />
          </div>
          <Button variant="cta" className="w-full">
            Uložit parametry
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EscalationAutoPilot() {
  const [step1, setStep1] = useState(true);
  const [step2, setStep2] = useState(true);
  const [step3, setStep3] = useState(false);

  return (
    <Card className="card-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Auto-Pilot / Eskalační proces
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* TODO: napojit na API */}
        <div className="flex items-start gap-3 rounded-lg border p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/10">
            <Mail className="h-4 w-4 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Krok 1: Auto-upomínka (SMS)</p>
            <p className="text-xs text-muted-foreground">Odeslání upomínky po X dnech prodlení</p>
          </div>
          <Switch checked={step1} onCheckedChange={setStep1} />
        </div>

        <div className="flex items-start gap-3 rounded-lg border p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/10">
            <FileWarning className="h-4 w-4 text-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Krok 2: Oficiální výstraha</p>
            <p className="text-xs text-muted-foreground">Předžalobní výzva po Y dnech</p>
          </div>
          <Switch checked={step2} onCheckedChange={setStep2} />
        </div>

        <div className="flex items-start gap-3 rounded-lg border p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <FileX className="h-4 w-4 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Krok 3: Auto-výpověď</p>
            <p className="text-xs text-muted-foreground">Generování výpovědi při propadnutí kauce</p>
          </div>
          <Switch checked={step3} onCheckedChange={setStep3} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function TenantsPage() {
  const [selectedTenant, setSelectedTenant] = useState(mockTenants[0]);
  const [inputMsg, setInputMsg] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nájemníci & AI Komunikace</h1>
        <p className="text-muted-foreground">Správa nájemníků, kauce a eskalační auto-pilot</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-5 min-h-[500px]">
        {/* Tenant list */}
        <Card className="lg:col-span-2 card-shadow flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Seznam nájemníků</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-1 p-3">
                {mockTenants.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTenant(t)}
                    className={`w-full flex flex-col gap-2 rounded-lg p-3 text-left transition-colors ${
                      selectedTenant.id === t.id ? "bg-sidebar-accent" : "hover:bg-accent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {t.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.unit}</p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={
                          t.paid
                            ? "bg-success/10 text-success border-0 shrink-0"
                            : "bg-destructive/10 text-destructive border-0 shrink-0"
                        }
                      >
                        {t.paid ? "OK" : "Dluh"}
                      </Badge>
                    </div>
                    <DepositHealthBar deposit={t.deposit} debt={t.debt} />
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right panel: AI Inbox + Detail */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* Tenant detail header */}
          <Card className="card-shadow">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {selectedTenant.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{selectedTenant.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{selectedTenant.unit}</p>
                </div>
              </div>
              <div className="flex-1">
                <DepositHealthBar deposit={selectedTenant.deposit} debt={selectedTenant.debt} />
              </div>
              <ContractSettingsModal tenant={selectedTenant} />
            </CardContent>
          </Card>

          {/* Escalation Auto-Pilot */}
          <EscalationAutoPilot />

          {/* AI Inbox */}
          <Card className="card-shadow flex flex-col flex-1 min-h-[300px]">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                AI Inbox – {selectedTenant.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {mockMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${msg.from === "ai" ? "" : "justify-end"}`}
                    >
                      {msg.from === "ai" && (
                        <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={`rounded-xl px-4 py-3 max-w-[80%] text-sm ${
                          msg.from === "ai"
                            ? "bg-accent"
                            : "bg-primary text-primary-foreground"
                        }`}
                      >
                        {msg.text}
                      </div>
                      {msg.from === "tenant" && (
                        <div className="h-8 w-8 shrink-0 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="flex justify-start pl-11">
                    <Button variant="cta" size="sm">
                      Schválit a odeslat
                    </Button>
                  </div>
                </div>
              </ScrollArea>
              <div className="border-t p-3 flex gap-2">
                <Input
                  placeholder="Napište zprávu..."
                  value={inputMsg}
                  onChange={(e) => setInputMsg(e.target.value)}
                  className="flex-1"
                />
                <Button variant="cta" size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
