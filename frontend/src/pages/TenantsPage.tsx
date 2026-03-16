import { useEffect, useMemo, useState } from "react";
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

type TenantApiItem = {
  id: number;
  name: string;
  apartment: string;
  deposit: number;
  currentDebt: number;
};

type TenantViewModel = {
  id: number;
  name: string;
  unit: string;
  paid: boolean;
  initials: string;
  deposit: number;
  debt: number;
  dueDay: number;
  toleranceDays: number;
};

const mockMessages = [
  { id: 1, from: "tenant", text: "Dobry den, chtel bych nahlasit rozbitou pracku v byte." },
  { id: 2, from: "ai", text: "Automaticky navrh odpovedi: Dekujeme za hlaseni, technik se ozve do 48 hodin." },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function mapTenantApiToViewModel(item: TenantApiItem): TenantViewModel {
  return {
    id: item.id,
    name: item.name,
    unit: item.apartment,
    paid: Number(item.currentDebt || 0) <= 0,
    initials: getInitials(item.name),
    deposit: Number(item.deposit || 0),
    debt: Number(item.currentDebt || 0),
    dueDay: 15,
    toleranceDays: 5,
  };
}

function DepositHealthBar({ deposit, debt }: { deposit: number; debt: number }) {
  const remaining = Math.max(0, deposit - debt);
  const percentage = deposit > 0 ? (remaining / deposit) * 100 : 100;
  const isWarning = percentage <= 50;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Kauce: {deposit.toLocaleString("cs-CZ")} Kc</span>
        {debt > 0 && (
          <span className={isWarning ? "text-destructive font-medium" : "text-warning font-medium"}>
            Dluh: {debt.toLocaleString("cs-CZ")} Kc
          </span>
        )}
      </div>
      <Progress
        value={percentage}
        className={`h-2 ${isWarning ? "[&>div]:bg-destructive" : debt > 0 ? "[&>div]:bg-warning" : "[&>div]:bg-success"}`}
      />
      <p className="text-[11px] text-muted-foreground">
        Zbyva: {remaining.toLocaleString("cs-CZ")} Kc ({Math.round(percentage)} %)
      </p>
    </div>
  );
}

function ContractSettingsModal({ tenant }: { tenant: TenantViewModel }) {
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
          <DialogTitle>Parametry smlouvy - {tenant.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="dueDay">Den splatnosti (v mesici)</Label>
            <Input
              id="dueDay"
              type="number"
              min="1"
              max="28"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
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
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deposit">Vyse kauce (Kc)</Label>
            <Input
              id="deposit"
              type="number"
              min="0"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
          </div>
          <Button variant="cta" className="w-full">
            Ulozit parametry
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
          Auto-Pilot / Eskalacni proces
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/10">
            <Mail className="h-4 w-4 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Krok 1: Auto-upominka (SMS)</p>
            <p className="text-xs text-muted-foreground">Odeslani upominky po X dnech prodleni</p>
          </div>
          <Switch checked={step1} onCheckedChange={setStep1} />
        </div>

        <div className="flex items-start gap-3 rounded-lg border p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/10">
            <FileWarning className="h-4 w-4 text-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Krok 2: Oficialni vystraha</p>
            <p className="text-xs text-muted-foreground">Predzalobni vyzva po Y dnech</p>
          </div>
          <Switch checked={step2} onCheckedChange={setStep2} />
        </div>

        <div className="flex items-start gap-3 rounded-lg border p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <FileX className="h-4 w-4 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Krok 3: Auto-vypoved</p>
            <p className="text-xs text-muted-foreground">Generovani vypovedi pri propadnuti kauce</p>
          </div>
          <Switch checked={step3} onCheckedChange={setStep3} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantViewModel[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<TenantViewModel | null>(null);
  const [inputMsg, setInputMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadTenants() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("http://localhost:5000/api/tenants", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as TenantApiItem[];
        const mapped = data.map(mapTenantApiToViewModel);
        setTenants(mapped);
        setSelectedTenant((prev) => prev ?? mapped[0] ?? null);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        setError("Nepodarilo se nacist najemniky z backendu.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadTenants();
    return () => controller.abort();
  }, []);

  const headerName = useMemo(() => selectedTenant?.name ?? "-", [selectedTenant]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Najemnici a AI komunikace</h1>
        <p className="text-muted-foreground">Sprava najemniku, kauce a eskalacni auto-pilot</p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Nacitam najemniky...</p>}
      {!loading && error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-5 min-h-[500px]">
        <Card className="lg:col-span-2 card-shadow flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Seznam najemniku</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-1 p-3">
                {!loading &&
                  !error &&
                  tenants.map((tenant) => (
                    <button
                      key={tenant.id}
                      onClick={() => setSelectedTenant(tenant)}
                      className={`w-full flex flex-col gap-2 rounded-lg p-3 text-left transition-colors ${
                        selectedTenant?.id === tenant.id ? "bg-sidebar-accent" : "hover:bg-accent"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {tenant.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{tenant.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{tenant.unit}</p>
                        </div>
                        <Badge
                          variant="secondary"
                          className={
                            tenant.paid
                              ? "bg-success/10 text-success border-0 shrink-0"
                              : "bg-destructive/10 text-destructive border-0 shrink-0"
                          }
                        >
                          {tenant.paid ? "OK" : "Dluh"}
                        </Badge>
                      </div>
                      <DepositHealthBar deposit={tenant.deposit} debt={tenant.debt} />
                    </button>
                  ))}

                {!loading && !error && tenants.length === 0 && (
                  <p className="text-sm text-muted-foreground px-3 py-2">Backend nevratil zadne najemniky.</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 flex flex-col gap-4">
          <Card className="card-shadow">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {selectedTenant?.initials ?? "--"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{selectedTenant?.name ?? "Neni vybran najemnik"}</p>
                  <p className="text-sm text-muted-foreground truncate">{selectedTenant?.unit ?? "-"}</p>
                </div>
              </div>
              <div className="flex-1">
                <DepositHealthBar deposit={selectedTenant?.deposit ?? 0} debt={selectedTenant?.debt ?? 0} />
              </div>
              {selectedTenant && <ContractSettingsModal tenant={selectedTenant} />}
            </CardContent>
          </Card>

          <EscalationAutoPilot />

          <Card className="card-shadow flex flex-col flex-1 min-h-[300px]">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                AI Inbox - {headerName}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {mockMessages.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.from === "ai" ? "" : "justify-end"}`}>
                      {msg.from === "ai" && (
                        <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={`rounded-xl px-4 py-3 max-w-[80%] text-sm ${
                          msg.from === "ai" ? "bg-accent" : "bg-primary text-primary-foreground"
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
                      Schvalit a odeslat
                    </Button>
                  </div>
                </div>
              </ScrollArea>
              <div className="border-t p-3 flex gap-2">
                <Input
                  placeholder="Napiste zpravu..."
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
