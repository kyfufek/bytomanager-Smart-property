import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Bot, FileWarning, FileX, Mail, Send, Settings, Shield, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/product/PageHeader";
import { DataState } from "@/components/product/DataState";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

type PaymentStatus = "paid" | "pending" | "overdue" | "none";

type TenantApiItem = {
  id: string;
  name: string;
  apartment: string | null;
  deposit: number;
  currentDebt: number;
  property_id?: string;
  property_rent?: number;
  payment_status?: PaymentStatus;
  payment_due_date?: string | null;
  payment_paid_date?: string | null;
  payment_amount_paid?: number;
  payment_amount_due?: number;
  has_payment_history?: boolean;
  properties?: {
    name?: string | null;
    rent?: number | null;
  } | null;
};

type TenantViewModel = {
  id: string;
  propertyId?: string;
  name: string;
  unit: string;
  propertyRent: number;
  paid: boolean;
  initials: string;
  deposit: number;
  debt: number;
  dueDay: number;
  toleranceDays: number;
  paymentStatus: PaymentStatus;
  paymentDueDate: string | null;
  paymentPaidDate: string | null;
  paymentAmountPaid: number;
  paymentAmountDue: number;
  hasPaymentHistory: boolean;
};

type PropertyOption = {
  id: string;
  name: string;
};

type PaymentApiItem = {
  id: string;
  tenant_id: string;
  property_id: string | null;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: Exclude<PaymentStatus, "none">;
  note?: string | null;
};

const mockMessages = [
  { id: 1, from: "tenant", text: "Dobry den, chtel bych nahlasit rozbitou pracku v byte." },
  {
    id: 2,
    from: "ai",
    text: "Automaticky navrh odpovedi: Dekujeme za hlaseni, technik se ozve do 48 hodin.",
  },
];

const paymentStatusLabels: Record<PaymentStatus, string> = {
  paid: "Uhrazeno",
  pending: "Ceka na uhradu",
  overdue: "Po splatnosti",
  none: "Bez plateb",
};

function getPaymentStatusBadgeClass(status: PaymentStatus) {
  if (status === "paid") return "bg-success/10 text-success border-0 shrink-0";
  if (status === "overdue") return "bg-destructive/10 text-destructive border-0 shrink-0";
  if (status === "pending") return "bg-warning/10 text-warning border-0 shrink-0";
  return "bg-muted text-muted-foreground border-0 shrink-0";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function mapTenantApiToViewModel(item: TenantApiItem): TenantViewModel {
  const resolvedUnit = item.apartment ?? item.properties?.name ?? "Bez bytu";
  const paymentStatus: PaymentStatus = item.payment_status ?? "none";
  return {
    id: item.id,
    propertyId: item.property_id,
    name: item.name,
    unit: resolvedUnit,
    propertyRent: Number(item.property_rent ?? item.properties?.rent ?? 0),
    paid: paymentStatus === "paid",
    initials: getInitials(item.name),
    deposit: Number(item.deposit || 0),
    debt: Number(item.currentDebt || 0),
    dueDay: 15,
    toleranceDays: 5,
    paymentStatus,
    paymentDueDate: item.payment_due_date ?? null,
    paymentPaidDate: item.payment_paid_date ?? null,
    paymentAmountPaid: Number(item.payment_amount_paid ?? 0),
    paymentAmountDue: Number(item.payment_amount_due ?? 0),
    hasPaymentHistory: Boolean(item.has_payment_history),
  };
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("cs-CZ");
}

function DepositHealthBar({ deposit, debt }: { deposit: number; debt: number }) {
  const remaining = Math.max(0, deposit - debt);
  const percentage = deposit > 0 ? (remaining / deposit) * 100 : 100;
  const isWarning = percentage <= 50;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Kauce: {deposit.toLocaleString("cs-CZ")} Kc</span>
        {debt > 0 ? (
          <span className={isWarning ? "text-destructive font-medium" : "text-warning font-medium"}>
            Dluh: {debt.toLocaleString("cs-CZ")} Kc
          </span>
        ) : null}
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

function PrescribedRent({ propertyId, rent }: { propertyId?: string; rent: number }) {
  return (
    <p className="text-xs text-muted-foreground">
      {propertyId ? `Predepsane najemne: ${rent.toLocaleString("cs-CZ")} Kc` : "Bez bytu"}
    </p>
  );
}

function ContractSettingsModal({ tenant }: { tenant: TenantViewModel }) {
  const [dueDay, setDueDay] = useState(String(tenant.dueDay));
  const [toleranceDays, setToleranceDays] = useState(String(tenant.toleranceDays));
  const [depositAmount, setDepositAmount] = useState(String(tenant.deposit));

  function handleSave() {
    toast({
      title: "Parametry ulozeny",
      description: `Splatnost ${dueDay}. den, tolerance ${toleranceDays} dni, kauce ${depositAmount} Kc.`,
    });
  }

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
          <Button variant="cta" className="w-full" onClick={handleSave}>
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

  function handleToggle(stepLabel: string, checked: boolean) {
    toast({
      title: "Nastaveni auto-pilota upraveno",
      description: `${stepLabel}: ${checked ? "zapnuto" : "vypnuto"}.`,
    });
  }

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
          <Switch
            checked={step1}
            onCheckedChange={(checked) => {
              setStep1(checked);
              handleToggle("Auto-upominka", checked);
            }}
          />
        </div>

        <div className="flex items-start gap-3 rounded-lg border p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/10">
            <FileWarning className="h-4 w-4 text-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Krok 2: Oficialni vystraha</p>
            <p className="text-xs text-muted-foreground">Predzalobni vyzva po Y dnech</p>
          </div>
          <Switch
            checked={step2}
            onCheckedChange={(checked) => {
              setStep2(checked);
              handleToggle("Oficialni vystraha", checked);
            }}
          />
        </div>

        <div className="flex items-start gap-3 rounded-lg border p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <FileX className="h-4 w-4 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Krok 3: Auto-vypoved</p>
            <p className="text-xs text-muted-foreground">Generovani vypovedi pri propadnuti kauce</p>
          </div>
          <Switch
            checked={step3}
            onCheckedChange={(checked) => {
              setStep3(checked);
              handleToggle("Auto-vypoved", checked);
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function TenantsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tenants, setTenants] = useState<TenantViewModel[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<TenantViewModel | null>(null);
  const [inputMsg, setInputMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createPropertyId, setCreatePropertyId] = useState("");
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentApiItem[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState("");
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDueDate, setPaymentDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentPaidDate, setPaymentPaidDate] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null);
  const [isSendingAiReply, setIsSendingAiReply] = useState(false);

  async function loadTenants(signal?: AbortSignal) {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch("/api/tenants", { signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as TenantApiItem[];
      const mapped = data.map(mapTenantApiToViewModel);
      setTenants(mapped);
      setSelectedTenant((prev) => {
        if (!mapped.length) return null;
        if (!prev) return mapped[0];
        return mapped.find((item) => item.id === prev.id) ?? mapped[0];
      });
    } catch {
      if (signal?.aborted) return;
      setError("Najemniky se nepodarilo nacist. Zkuste obnovit stranku.");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }

  async function loadProperties(signal?: AbortSignal) {
    try {
      const response = await apiFetch("/api/properties", { signal });
      if (!response.ok) return;
      const data = (await response.json()) as PropertyOption[];
      setProperties(data);
      if (data.length && !createPropertyId) {
        setCreatePropertyId(data[0].id);
      }
    } catch {
      // Optional data; ignore hard failure here.
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    loadTenants(controller.signal);
    loadProperties(controller.signal);
    return () => controller.abort();
  }, []);

  async function loadPayments(tenantId: string, signal?: AbortSignal) {
    try {
      setPaymentsLoading(true);
      setPaymentsError("");

      const response = await apiFetch(`/api/payments/tenant/${tenantId}`, { signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as PaymentApiItem[];
      setPayments(data);
    } catch {
      if (signal?.aborted) return;
      setPayments([]);
      setPaymentsError("Historii plateb se nepodarilo nacist.");
    } finally {
      if (!signal?.aborted) {
        setPaymentsLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!selectedTenant?.id) {
      setPayments([]);
      setPaymentsError("");
      return;
    }

    const controller = new AbortController();
    loadPayments(selectedTenant.id, controller.signal);
    return () => controller.abort();
  }, [selectedTenant?.id]);

  async function handleCreateTenant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreating) return;
    setCreateError("");

    if (!createName.trim() || !createPropertyId) {
      setCreateError("Vyplnte jmeno a vyberte nemovitost.");
      return;
    }

    try {
      setIsCreating(true);
      const response = await apiFetch("/api/tenants", {
        method: "POST",
        body: JSON.stringify({
          full_name: createName.trim(),
          property_id: createPropertyId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      setCreateName("");
      setIsCreateOpen(false);
      await loadTenants();
      toast({
        title: "Najemnik vytvoren",
        description: "Novy najemnik byl uspesne pridan.",
      });
    } catch {
      setCreateError("Nepodarilo se vytvorit najemnika.");
      toast({
        title: "Akce se nepodarila",
        description: "Najemnika se nepodarilo vytvorit.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteTenant() {
    if (!selectedTenant || deletingId !== null) return;
    const confirmed = window.confirm(`Opravdu smazat najemnika ${selectedTenant.name}?`);
    if (!confirmed) return;

    try {
      setDeletingId(selectedTenant.id);
      const response = await apiFetch(`/api/tenants/${selectedTenant.id}`, {
        method: "DELETE",
      });

      if (!response.ok && response.status !== 204 && response.status !== 404) {
        throw new Error(`HTTP ${response.status}`);
      }

      await loadTenants();
      toast({
        title: "Najemnik smazan",
        description: `${selectedTenant.name} byl odebran ze seznamu.`,
      });
    } catch {
      setError("Najemnika se nepodarilo smazat.");
      toast({
        title: "Mazani se nepodarilo",
        description: "Zkuste akci opakovat.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreatePayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTenant || isSavingPayment) return;

    const parsedAmount = Number(paymentAmount.replace(",", "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setPaymentsError("Castka musi byt cislo vetsi nez 0.");
      return;
    }

    if (!paymentDueDate) {
      setPaymentsError("Vyberte datum splatnosti.");
      return;
    }

    try {
      setIsSavingPayment(true);
      setPaymentsError("");

      const response = await apiFetch("/api/payments", {
        method: "POST",
        body: JSON.stringify({
          tenant_id: selectedTenant.id,
          property_id: selectedTenant.propertyId,
          amount: parsedAmount,
          due_date: paymentDueDate,
          paid_date: paymentPaidDate || null,
          note: paymentNote.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const created = (await response.json()) as PaymentApiItem;
      setPayments((prev) => [created, ...prev]);
      setPaymentAmount("");
      setPaymentDueDate(new Date().toISOString().slice(0, 10));
      setPaymentPaidDate("");
      setPaymentNote("");
      setIsPaymentOpen(false);
      await loadTenants();
      toast({
        title: "Platba ulozena",
        description: "Platba byla uspesne zapsana do historie.",
      });
    } catch {
      setPaymentsError("Platbu se nepodarilo ulozit.");
      toast({
        title: "Ulozeni platby selhalo",
        description: "Zkuste akci opakovat.",
        variant: "destructive",
      });
    } finally {
      setIsSavingPayment(false);
    }
  }

  async function handleMarkPaymentAsPaid(paymentId: string) {
    if (!selectedTenant || updatingPaymentId) return;

    try {
      setUpdatingPaymentId(paymentId);
      const today = new Date().toISOString().slice(0, 10);
      const response = await apiFetch(`/api/payments/${paymentId}`, {
        method: "PUT",
        body: JSON.stringify({
          paid_date: today,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const updated = (await response.json()) as PaymentApiItem;
      setPayments((prev) => prev.map((item) => (item.id === paymentId ? updated : item)));
      await loadTenants();
      toast({
        title: "Platba oznacena jako uhrazena",
        description: "Stav platby byl aktualizovan.",
      });
    } catch {
      toast({
        title: "Aktualizace selhala",
        description: "Platbu se nepodarilo oznacit jako uhrazenou.",
        variant: "destructive",
      });
    } finally {
      setUpdatingPaymentId(null);
    }
  }

  const headerName = useMemo(() => selectedTenant?.name ?? "-", [selectedTenant]);
  const paymentSummary = useMemo(() => {
    if (!selectedTenant) {
      return { statusText: "Vyberte najemnika", amountText: "-", dueText: "-", historyText: "Bez dat" };
    }

    const statusText = paymentStatusLabels[selectedTenant.paymentStatus];
    const amountText = selectedTenant.paymentStatus === "paid"
      ? `${selectedTenant.paymentAmountPaid.toLocaleString("cs-CZ")} Kc uhrazeno`
      : `${selectedTenant.paymentAmountDue.toLocaleString("cs-CZ")} Kc k uhrade`;
    const dueText = selectedTenant.hasPaymentHistory ? formatDate(selectedTenant.paymentDueDate) : "Bez evidovane splatnosti";
    const historyText = selectedTenant.hasPaymentHistory ? `${payments.length} zaznamu v historii` : "Historie plateb zatim nevznikla";

    return { statusText, amountText, dueText, historyText };
  }, [payments.length, selectedTenant]);

  useEffect(() => {
    const tenantId = searchParams.get("tenantId");
    if (!tenantId || !tenants.length) return;
    const match = tenants.find((tenant) => tenant.id === tenantId);
    if (match) {
      setSelectedTenant(match);
    }
  }, [searchParams, tenants]);

  function handleSelectTenant(tenant: TenantViewModel) {
    setSelectedTenant(tenant);
    setSearchParams({ tenantId: tenant.id });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Najemnici a komunikace"
        description="Prioritou je platebni stav, historie a operativni prace s najemnikem. Automatizace zustava jako sekundarni podpora."
        actions={
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="cta">Pridat najemnika</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Pridat najemnika</DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleCreateTenant}>
                <div className="space-y-2">
                  <Label htmlFor="tenant-name">Cele jmeno</Label>
                  <Input
                    id="tenant-name"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Jan Novak"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenant-property">Nemovitost</Label>
                  <select
                    id="tenant-property"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={createPropertyId}
                    onChange={(e) => setCreatePropertyId(e.target.value)}
                  >
                    <option value="">Vyber nemovitost</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name}
                      </option>
                    ))}
                  </select>
                </div>
                {createError ? <p className="text-xs text-destructive">{createError}</p> : null}
                <Button type="submit" variant="cta" className="w-full" disabled={isCreating}>
                  {isCreating ? "Ukladam..." : "Ulozit najemnika"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {error && !loading ? (
        <DataState
          variant="error"
          title="Najemniky se nepodarilo nacist"
          description={error}
          actionLabel="Zkusit znovu"
          onAction={() => loadTenants()}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5 min-h-[500px]">
        <Card className="lg:col-span-2 card-shadow flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Seznam najemniku</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-1 p-3">
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <div className="rounded-lg border p-3 space-y-2" key={`tenant-skeleton-${index}`}>
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-2 w-full" />
                    </div>
                  ))
                ) : tenants.length === 0 ? (
                  <DataState
                    title="Zatim nemate zadne najemniky"
                    description="Prvniho najemnika pridate tlacitkem nahore."
                    actionLabel="Pridat najemnika"
                    onAction={() => setIsCreateOpen(true)}
                  />
                ) : (
                  tenants.map((tenant) => (
                    <button
                      key={tenant.id}
                      onClick={() => handleSelectTenant(tenant)}
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
                          <PrescribedRent propertyId={tenant.propertyId} rent={tenant.propertyRent} />
                          {tenant.hasPaymentHistory ? (
                            <p className="text-xs text-muted-foreground">
                              Splatnost: {formatDate(tenant.paymentDueDate)}
                              {tenant.paymentStatus === "paid" ? `, uhrazeno: ${formatDate(tenant.paymentPaidDate)}` : ""}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Zatim bez evidovane platby</p>
                          )}
                        </div>
                        <Badge variant="secondary" className={getPaymentStatusBadgeClass(tenant.paymentStatus)}>
                          {paymentStatusLabels[tenant.paymentStatus]}
                        </Badge>
                      </div>
                      <DepositHealthBar deposit={tenant.deposit} debt={tenant.debt} />
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 flex flex-col gap-4">
          <Card className="card-shadow">
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {selectedTenant?.initials ?? "--"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{selectedTenant?.name ?? "Neni vybran najemnik"}</p>
                    <p className="text-sm text-muted-foreground truncate">{selectedTenant?.unit ?? "-"}</p>
                    {selectedTenant ? (
                      <PrescribedRent propertyId={selectedTenant.propertyId} rent={selectedTenant.propertyRent} />
                    ) : null}
                    {selectedTenant ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Stav platby: {paymentStatusLabels[selectedTenant.paymentStatus]}
                        {selectedTenant.paymentStatus === "paid"
                          ? `, zaplaceno ${selectedTenant.paymentAmountPaid.toLocaleString("cs-CZ")} Kc (${formatDate(selectedTenant.paymentPaidDate)})`
                          : selectedTenant.hasPaymentHistory
                            ? `, k uhrade ${selectedTenant.paymentAmountDue.toLocaleString("cs-CZ")} Kc (splatnost ${formatDate(selectedTenant.paymentDueDate)})`
                            : ", zatim bez plateb"}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <DepositHealthBar deposit={selectedTenant?.deposit ?? 0} debt={selectedTenant?.debt ?? 0} />
                </div>

                <div className="flex flex-wrap gap-2 xl:justify-end">
                  {selectedTenant ? <ContractSettingsModal tenant={selectedTenant} /> : null}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDeleteTenant}
                    disabled={!selectedTenant || deletingId === selectedTenant?.id}
                  >
                    {deletingId === selectedTenant?.id ? "Mazani..." : "Smazat najemnika"}
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                <SummaryMetric label="Platebni stav" value={paymentSummary.statusText} tone={selectedTenant?.paymentStatus === "overdue" ? "danger" : selectedTenant?.paymentStatus === "paid" ? "success" : "default"} />
                <SummaryMetric label="Platebni castka" value={paymentSummary.amountText} />
                <SummaryMetric label="Historie plateb" value={paymentSummary.historyText} />
              </div>
            </CardContent>
          </Card>

          <Card className="card-shadow">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Historie plateb</CardTitle>
                <div className="flex items-center gap-2">
                  {selectedTenant ? (
                    <Button variant="outline" size="sm" onClick={() => navigate("/finance")}>
                      Otevrit finance
                    </Button>
                  ) : null}
                  <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
                    <DialogTrigger asChild>
                      <Button variant="cta" size="sm" disabled={!selectedTenant}>
                        Pridat platbu
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Pridat platbu</DialogTitle>
                      </DialogHeader>
                      <form className="space-y-4" onSubmit={handleCreatePayment}>
                        <div className="space-y-2">
                          <Label htmlFor="payment-amount">Castka</Label>
                          <Input id="payment-amount" type="number" min="0" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="15000" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="payment-due-date">Datum splatnosti</Label>
                          <Input id="payment-due-date" type="date" value={paymentDueDate} onChange={(e) => setPaymentDueDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="payment-paid-date">Datum uhrady (volitelne)</Label>
                          <Input id="payment-paid-date" type="date" value={paymentPaidDate} onChange={(e) => setPaymentPaidDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="payment-note">Poznamka</Label>
                          <Input id="payment-note" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="Volitelna poznamka" />
                        </div>
                        <Button type="submit" variant="cta" className="w-full" disabled={isSavingPayment}>
                          {isSavingPayment ? "Ukladam..." : "Ulozit platbu"}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {!selectedTenant ? (
                <DataState
                  title="Nejdriv vyberte najemnika"
                  description="Historie plateb se zobrazi po vyberu najemnika v levem panelu."
                />
              ) : paymentsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={`payment-skeleton-${index}`} className="h-10 w-full" />
                  ))}
                </div>
              ) : paymentsError ? (
                <DataState variant="error" title="Platby se nepodarilo nacist" description={paymentsError} />
              ) : payments.length === 0 ? (
                <DataState
                  title="Zatim nejsou evidovane zadne platby"
                  description="Po ulozeni prvni platby se historie zobrazi zde."
                />
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-3">
                    <SummaryMetric label="Posledni splatnost" value={paymentSummary.dueText} />
                    <SummaryMetric label="Platebni vysledek" value={paymentSummary.amountText} tone={selectedTenant?.paymentStatus === "overdue" ? "danger" : selectedTenant?.paymentStatus === "paid" ? "success" : "default"} />
                    <SummaryMetric label="Stav evidence" value={paymentSummary.historyText} />
                  </div>
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-2 pr-4 font-medium">Castka</th>
                        <th className="py-2 pr-4 font-medium">Splatnost</th>
                        <th className="py-2 pr-4 font-medium">Uhrazeno</th>
                        <th className="py-2 pr-4 font-medium">Stav</th>
                        <th className="py-2 pr-4 font-medium">Poznamka</th>
                        <th className="py-2 pr-4 font-medium text-right">Akce</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id} className="border-b last:border-b-0">
                          <td className="py-2 pr-4">{Number(payment.amount ?? 0).toLocaleString("cs-CZ")} Kc</td>
                          <td className="py-2 pr-4">{formatDate(payment.due_date)}</td>
                          <td className="py-2 pr-4">{formatDate(payment.paid_date)}</td>
                          <td className="py-2 pr-4">
                            <Badge variant="secondary" className={getPaymentStatusBadgeClass(payment.status)}>
                              {paymentStatusLabels[payment.status]}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4">{payment.note || "-"}</td>
                          <td className="py-2 pr-4 text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={payment.status === "paid" || updatingPaymentId === payment.id}
                              onClick={() => handleMarkPaymentAsPaid(payment.id)}
                            >
                              {updatingPaymentId === payment.id
                                ? "Ukladam..."
                                : payment.status === "paid"
                                  ? "Uhrazeno"
                                  : "Oznacit jako zaplaceno"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

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
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                    Chat slouzi pro rychle pravni nebo komunikacni navrhy k vybranemu najemnikovi. Odeslani zustava pod lidskou kontrolou.
                  </div>
                  {mockMessages.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.from === "ai" ? "" : "justify-end"}`}>
                      {msg.from === "ai" ? (
                        <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      ) : null}
                      <div
                        className={`rounded-xl px-4 py-3 max-w-[80%] text-sm ${
                          msg.from === "ai" ? "bg-accent" : "bg-primary text-primary-foreground"
                        }`}
                      >
                        {msg.text}
                      </div>
                      {msg.from === "tenant" ? (
                        <div className="h-8 w-8 shrink-0 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ) : null}
                    </div>
                  ))}
                  <div className="flex justify-start pl-11">
                    <Button
                      variant="cta"
                      size="sm"
                      disabled={!selectedTenant || isSendingAiReply}
                      onClick={async () => {
                        if (!selectedTenant) return;
                        try {
                          setIsSendingAiReply(true);
                          await new Promise((resolve) => setTimeout(resolve, 350));
                          toast({
                            title: "Odpoved byla odeslana",
                            description: `Zprava byla ulozena do konverzace najemnika ${selectedTenant.name}.`,
                          });
                        } finally {
                          setIsSendingAiReply(false);
                        }
                      }}
                    >
                      {isSendingAiReply ? "Odesilam..." : "Schvalit a odeslat"}
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
                <Button
                  variant="cta"
                  size="icon"
                  disabled={!selectedTenant || !inputMsg.trim() || isSendingAiReply}
                  onClick={() =>
                    toast({
                      title: "Navrh odpovedi pripraven",
                      description: "Text byl pripraven k finalnimu schvaleni a odeslani.",
                    })
                  }
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Auto-Pilot / Eskalacni proces</h2>
          <p className="text-sm text-muted-foreground">
            Sekundarni vrstva pro budouci automatizaci pripominek a eskalace. Hlavni praci s najemnikem a platbami resi sekce vys.
          </p>
        </div>
        <EscalationAutoPilot />
      </div>
    </div>
  );
}

function SummaryMetric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "danger" }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={tone === "danger" ? "text-sm font-medium text-destructive" : tone === "success" ? "text-sm font-medium text-success" : "text-sm font-medium"}>{value}</p>
    </div>
  );
}
