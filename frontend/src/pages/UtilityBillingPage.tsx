import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  Download,
  FileText,
  FolderClock,
  ReceiptText,
  RefreshCcw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DataState } from "@/components/product/DataState";
import { PageHeader } from "@/components/product/PageHeader";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type WorkflowStatus = "draft" | "calculated" | "reviewed" | "exported" | "sent";
type ResultType = "preplatek" | "nedoplatek" | "vyrovnano";
type BillingTab = "prehled" | "zalohy" | "obdobi" | "detail" | "podklady" | "export";
type BillingMode = "operations" | "formal";
type HistoryStatusFilter = WorkflowStatus | "all";

type TenantItem = { id: string; full_name: string; property_id: string | null };
type PropertyItem = { id: string; name: string };
type PaymentItem = { id?: string; tenant_id: string; amount: number; status: string; due_date: string; paid_date: string | null };
type SettlementItem = { id?: string; service_name: string; advances_paid: number; actual_cost: number; difference: number; note: string | null; sort_order: number };
type Settlement = {
  id: string;
  tenant_id: string;
  property_id: string;
  tenant_name: string | null;
  property_name: string | null;
  period_from: string;
  period_to: string;
  title: string | null;
  notes: string | null;
  status: WorkflowStatus;
  advances_total: number;
  actual_cost_total: number;
  balance_total: number;
  result_type: ResultType;
  created_at: string;
  updated_at?: string | null;
  calculated_at?: string | null;
  reviewed_at?: string | null;
  exported_at?: string | null;
  sent_at?: string | null;
  items?: SettlementItem[];
};
type MonthlyRow = { monthKey: string; monthLabel: string; prescribed: number; paid: number; unpaid: number; pendingCount: number; overdueCount: number; statusLabel: string };

const baseItems: SettlementItem[] = [
  { service_name: "Voda", advances_paid: 0, actual_cost: 0, difference: 0, note: null, sort_order: 0 },
  { service_name: "Teplo", advances_paid: 0, actual_cost: 0, difference: 0, note: null, sort_order: 1 },
  { service_name: "Elektrina spolecnych prostor", advances_paid: 0, actual_cost: 0, difference: 0, note: null, sort_order: 2 },
  { service_name: "Uklid a odvoz odpadu", advances_paid: 0, actual_cost: 0, difference: 0, note: null, sort_order: 3 },
];

function formatCurrency(value: number) {
  return `${Number(value || 0).toLocaleString("cs-CZ")} Kc`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("cs-CZ");
}

function statusLabel(status: WorkflowStatus) {
  return { draft: "Koncept", calculated: "Spocitano", reviewed: "Zkontrolovano", exported: "Exportovano", sent: "Odeslano" }[status];
}

function resultLabel(result: ResultType) {
  return { preplatek: "Preplatek", nedoplatek: "Nedoplatek", vyrovnano: "Vyrovnano" }[result];
}

function monthKeyFromDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabelFromKey(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("cs-CZ", { month: "long", year: "numeric" });
}

function countInclusiveMonths(periodFrom: string, periodTo: string) {
  const from = new Date(`${periodFrom}T00:00:00.000Z`);
  const to = new Date(`${periodTo}T00:00:00.000Z`);
  return ((to.getUTCFullYear() - from.getUTCFullYear()) * 12) + (to.getUTCMonth() - from.getUTCMonth()) + 1;
}

function buildMonthRange(periodFrom: string, periodTo: string) {
  const months = countInclusiveMonths(periodFrom, periodTo);
  if (months < 1 || months > 12) return [];

  const [fromYear, fromMonth] = periodFrom.split("-").map(Number);
  return Array.from({ length: months }, (_, index) => {
    const year = fromYear + Math.floor((fromMonth - 1 + index) / 12);
    const month = ((fromMonth - 1 + index) % 12) + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    return { key, label: monthLabelFromKey(key) };
  });
}

function getPeriodError(periodFrom: string, periodTo: string) {
  if (!periodFrom || !periodTo) return "Vyberte zuctovaci obdobi.";
  if (periodTo < periodFrom) return "Datum konce musi byt stejne nebo pozdeji nez datum zacatku.";
  if (countInclusiveMonths(periodFrom, periodTo) > 12) return "Zuctovaci obdobi muze mit maximalne 12 mesicu.";
  return null;
}

function normalizeSettlementItems(items: SettlementItem[]) {
  return items.map((item, index) => ({
    ...item,
    sort_order: index,
    difference: Number(item.advances_paid || 0) - Number(item.actual_cost || 0),
  }));
}

function buildMonthlyRows(payments: PaymentItem[], periodFrom: string, periodTo: string) {
  return buildMonthRange(periodFrom, periodTo).map(({ key, label }) => {
    const rows = payments.filter((payment) => monthKeyFromDate(payment.due_date) === key);
    const prescribed = rows.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const paid = rows.reduce((sum, payment) => sum + (payment.status === "paid" ? Number(payment.amount || 0) : 0), 0);
    const pendingCount = rows.filter((payment) => payment.status === "pending").length;
    const overdueCount = rows.filter((payment) => payment.status === "overdue").length;
    const unpaid = Math.max(prescribed - paid, 0);
    const status = prescribed === 0 ? "Bez predpisu" : overdueCount > 0 ? "Po splatnosti" : pendingCount > 0 ? "Ceka na uhradu" : "Uhrazeno";

    return { monthKey: key, monthLabel: label, prescribed, paid, unpaid, pendingCount, overdueCount, statusLabel: status };
  });
}

function statusBadgeClass(status: WorkflowStatus) {
  return {
    draft: "bg-muted text-muted-foreground",
    calculated: "bg-primary/10 text-primary",
    reviewed: "bg-emerald-500/10 text-emerald-700",
    exported: "bg-amber-500/10 text-amber-700",
    sent: "bg-success/10 text-success",
  }[status];
}

function resultToneClass(result: ResultType) {
  return result === "nedoplatek" ? "text-destructive" : result === "preplatek" ? "text-success" : "text-muted-foreground";
}

export default function UtilityBillingPage() {
  const [activeTab, setActiveTab] = useState<BillingTab>("prehled");
  const [mode, setMode] = useState<BillingMode>("operations");
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [history, setHistory] = useState<Settlement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Settlement | null>(null);
  const [title, setTitle] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<SettlementItem[]>(baseItems);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [settlementsError, setSettlementsError] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<HistoryStatusFilter>("all");
  const [historyYearFilter, setHistoryYearFilter] = useState("all");
  const [historySearch, setHistorySearch] = useState("");

  const selectedTenant = useMemo(() => tenants.find((tenant) => tenant.id === tenantId) ?? null, [tenants, tenantId]);
  const selectedProperty = useMemo(() => properties.find((property) => property.id === propertyId) ?? null, [properties, propertyId]);
  const canPersistSettlements = !settlementsError;
  const periodError = getPeriodError(periodFrom, periodTo);

  const paymentsForSelectedTenant = useMemo(
    () => payments.filter((payment) => payment.tenant_id === tenantId),
    [payments, tenantId],
  );

  const paymentsInPeriod = useMemo(() => {
    if (!periodFrom || !periodTo) return paymentsForSelectedTenant;
    return paymentsForSelectedTenant.filter((payment) => payment.due_date >= periodFrom && payment.due_date <= periodTo);
  }, [paymentsForSelectedTenant, periodFrom, periodTo]);

  const computedAdvances = useMemo(() => {
    return paymentsInPeriod.reduce((sum, payment) => {
      if (payment.status !== "paid") return sum;
      return sum + Number(payment.amount || 0);
    }, 0);
  }, [paymentsInPeriod]);

  const actualTotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.actual_cost || 0), 0), [items]);
  const itemAdvancesTotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.advances_paid || 0), 0), [items]);
  const balance = computedAdvances - actualTotal;
  const resultType: ResultType = Math.abs(balance) < 1 ? "vyrovnano" : balance >= 0 ? "preplatek" : "nedoplatek";

  const monthlyRows = useMemo(() => {
    if (!tenantId || periodError) return [];
    return buildMonthlyRows(paymentsForSelectedTenant, periodFrom, periodTo);
  }, [paymentsForSelectedTenant, periodError, periodFrom, periodTo, tenantId]);

  const activeFormalCount = useMemo(() => history.filter((settlement) => settlement.status !== "sent").length, [history]);
  const historyYears = useMemo(
    () => Array.from(new Set(history.map((settlement) => settlement.period_from.slice(0, 4)))).sort((a, b) => Number(b) - Number(a)),
    [history],
  );

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    return history.filter((settlement) => {
      if (historyStatusFilter !== "all" && settlement.status !== historyStatusFilter) return false;
      if (historyYearFilter !== "all" && !settlement.period_from.startsWith(historyYearFilter)) return false;
      if (!query) return true;

      const haystack = [settlement.title, settlement.tenant_name, settlement.property_name, settlement.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [history, historySearch, historyStatusFilter, historyYearFilter]);

  const workflowStep = useMemo(() => {
    if (!tenantId || !propertyId) return 1;
    if (periodError) return 2;
    if (!items.some((item) => item.service_name.trim())) return 3;
    if (!selected || selected.status === "draft") return 4;
    return 5;
  }, [items, periodError, propertyId, selected, tenantId]);

  const workflowDates = useMemo(() => {
    if (!selected) return [];
    return [
      { label: "Koncept", value: selected.created_at },
      { label: "Spocitano", value: selected.calculated_at ?? null },
      { label: "Zkontrolovano", value: selected.reviewed_at ?? null },
      { label: "Exportovano", value: selected.exported_at ?? null },
      { label: "Odeslano", value: selected.sent_at ?? null },
    ];
  }, [selected]);

  async function loadAll() {
    try {
      setLoading(true);
      setError("");
      setSettlementsError("");

      const [tenantsRes, propertiesRes, paymentsRes] = await Promise.all([
        apiFetch("/api/tenants"),
        apiFetch("/api/properties"),
        apiFetch("/api/payments"),
      ]);

      if (!tenantsRes.ok || !propertiesRes.ok || !paymentsRes.ok) throw new Error("core-load-failed");

      const tenantsData = (await tenantsRes.json()) as TenantItem[];
      const propertiesData = (await propertiesRes.json()) as PropertyItem[];
      const paymentsData = (await paymentsRes.json()) as PaymentItem[];

      setTenants(tenantsData);
      setProperties(propertiesData);
      setPayments(paymentsData);

      try {
        const historyRes = await apiFetch("/api/billing/settlements");
        if (!historyRes.ok) throw new Error("settlement-load-failed");

        const historyData = (await historyRes.json()) as Settlement[];
        setHistory(historyData);

        if (historyData[0]?.id) {
          await selectSettlement(historyData[0].id, false);
        } else {
          resetDraft(tenantsData[0]);
        }
      } catch {
        setHistory([]);
        setSelectedId(null);
        setSelected(null);
        setSettlementsError("Formalni vyuctovani neni v backendu nebo databazi zatim plne dostupne. Operativni prehled zaloh a plateb funguje dal.");
        resetDraft(tenantsData[0]);
      }
    } catch {
      setError("Vyuctovani se nepodarilo nacist.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function resetDraft(defaultTenant?: TenantItem) {
    const tenant = defaultTenant ?? tenants[0];
    setSelectedId(null);
    setSelected(null);
    setTitle("");
    setTenantId(tenant?.id ?? "");
    setPropertyId(tenant?.property_id ?? "");
    setPeriodFrom("");
    setPeriodTo("");
    setNotes("");
    setItems(baseItems);
  }

  async function reloadSettlementHistory(preferredId?: string) {
    if (!canPersistSettlements) return;

    const historyRes = await apiFetch("/api/billing/settlements");
    if (!historyRes.ok) throw new Error("history-reload-failed");

    const historyData = (await historyRes.json()) as Settlement[];
    setHistory(historyData);

    if (preferredId) {
      await selectSettlement(preferredId, false);
      return;
    }

    if (!selectedId && historyData[0]?.id) {
      await selectSettlement(historyData[0].id, false);
    }
  }

  async function selectSettlement(id: string, openDetailTab = true) {
    try {
      const response = await apiFetch(`/api/billing/settlements/${id}`);
      if (!response.ok) throw new Error("detail-load-failed");

      const detail = (await response.json()) as Settlement;
      setSelectedId(detail.id);
      setSelected(detail);
      setTitle(detail.title ?? "");
      setTenantId(detail.tenant_id);
      setPropertyId(detail.property_id);
      setPeriodFrom(detail.period_from);
      setPeriodTo(detail.period_to);
      setNotes(detail.notes ?? "");
      setItems(detail.items?.length ? detail.items : baseItems);

      setMode("formal");
      if (openDetailTab) setActiveTab("detail");
    } catch {
      toast({ title: "Detail se nepodarilo nacist", description: "Zkuste otevrit vyuctovani znovu.", variant: "destructive" });
    }
  }

  async function saveDraft(nextStatus?: WorkflowStatus) {
    if (!canPersistSettlements) {
      toast({ title: "Formalni vyuctovani neni dostupne", description: "Nejprve je potreba nasadit settlement tabulky do Supabase.", variant: "destructive" });
      return;
    }

    if (!tenantId || !propertyId) {
      toast({ title: "Chybi vazba na najemnika nebo nemovitost", description: "Vyberte najemnika a k nemu navazanou nemovitost.", variant: "destructive" });
      return;
    }

    if (periodError) {
      toast({ title: "Neplatne zuctovaci obdobi", description: periodError, variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      const payload = { tenant_id: tenantId, property_id: propertyId, period_from: periodFrom, period_to: periodTo, title, notes, status: nextStatus, items: normalizeSettlementItems(items) };
      const response = selectedId
        ? await apiFetch(`/api/billing/settlements/${selectedId}`, { method: "PUT", body: JSON.stringify(payload) })
        : await apiFetch("/api/billing/settlements", { method: "POST", body: JSON.stringify(payload) });

      if (!response.ok) throw new Error("save-failed");

      const detail = (await response.json()) as Settlement;
      setSelectedId(detail.id);
      setSelected(detail);
      setItems(detail.items?.length ? detail.items : normalizeSettlementItems(items));
      await reloadSettlementHistory(detail.id);
      setMode("formal");
      setActiveTab("detail");
      toast({ title: "Formalni vyuctovani ulozeno", description: `Aktualni stav: ${statusLabel(detail.status)}.` });
    } catch {
      toast({ title: "Ulozeni selhalo", description: "Zkuste akci opakovat po kontrole vybraneho obdobi a polozek.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function calculateSettlement() {
    if (!canPersistSettlements) {
      toast({ title: "Formalni vyuctovani neni dostupne", description: "Po nasazeni DB schematu pujde vyuctovani spocitat a uzamknout do workflow.", variant: "destructive" });
      return;
    }

    if (!selectedId) {
      await saveDraft("draft");
      return;
    }

    try {
      setSaving(true);
      const response = await apiFetch(`/api/billing/settlements/${selectedId}/calculate`, { method: "POST" });
      if (!response.ok) throw new Error("calculate-failed");
      const detail = (await response.json()) as Settlement;
      setSelected(detail);
      setItems(detail.items?.length ? detail.items : items);
      await reloadSettlementHistory(detail.id);
      setMode("formal");
      toast({ title: "Vyuctovani spocitano", description: `${resultLabel(detail.result_type)} ${formatCurrency(Math.abs(detail.balance_total))}` });
    } catch {
      toast({ title: "Vypocet selhal", description: "Nejprve ulozte koncept a doplnte sluzby nebo zkontrolujte backend.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(status: WorkflowStatus) {
    await saveDraft(status);
  }

  function setMonthlyPeriod() {
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    setPeriodFrom(from.toISOString().slice(0, 10));
    setPeriodTo(to.toISOString().slice(0, 10));
    setMode("operations");
    setActiveTab("zalohy");
  }

  function setYearlyPeriod() {
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), 11, 31));
    setPeriodFrom(from.toISOString().slice(0, 10));
    setPeriodTo(to.toISOString().slice(0, 10));
    setMode("formal");
    setActiveTab("obdobi");
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={`utility-billing-skeleton-${index}`} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Vyuctovani sluzeb" description="Jasne oddeleny provozni monitoring zaloh od formalniho workflow vyuctovani za zuctovaci obdobi." />
      {error ? <DataState variant="error" title="Chyba nacitani" description={error} actionLabel="Nacist znovu" onAction={loadAll} /> : null}
      {!error ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard label="Aktivni formalni vyuctovani" value={String(activeFormalCount)} />
            <KpiCard label="Uhrazeno v obdobi" value={formatCurrency(computedAdvances)} tone="success" />
            <KpiCard label="Skutecne naklady" value={formatCurrency(actualTotal)} />
            <KpiCard
              label="Vysledek vyuctovani"
              value={`${resultLabel(selected?.result_type ?? resultType)} ${formatCurrency(Math.abs(selected?.balance_total ?? balance))}`}
              tone={selected?.result_type === "nedoplatek" || resultType === "nedoplatek" ? "danger" : "success"}
            />
            <Card className="card-shadow">
              <CardContent className="space-y-2 p-4">
                <Button variant="outline" className="w-full justify-between" onClick={setMonthlyPeriod}>
                  Operativni mesicni prehled
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="w-full justify-between" onClick={setYearlyPeriod}>
                  Formalni zuctovaci obdobi
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="card-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Krokovy workflow formalniho vyuctovani</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-5">
              {[
                "Vyberte najemnika a jednotku",
                "Nastavte zuctovaci obdobi",
                "Doplnte sluzby a skutecne naklady",
                "Spocitejte formalni vysledek",
                "Zkontrolujte, exportujte a odeslete",
              ].map((label, index) => (
                <div
                  key={label}
                  className={cn("rounded-md border px-3 py-2 text-sm", workflowStep === index + 1 ? "border-primary bg-primary/5" : "bg-muted/30")}
                >
                  <p className="text-xs text-muted-foreground">Krok {index + 1}</p>
                  <p className="font-medium">{label}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <button type="button" onClick={() => { setMode("operations"); setActiveTab("zalohy"); }} className={cn("rounded-xl border p-4 text-left transition-colors", mode === "operations" ? "border-primary bg-primary/5" : "bg-muted/20 hover:bg-accent")}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Operativni mesicni prehled</p>
                  <p className="mt-1 text-sm text-muted-foreground">Interni monitoring predepsanych zaloh, uhrazenych plateb a stavu uhrady bez finalniho dokumentoveho vystupu.</p>
                </div>
                <Badge variant="secondary">Interni provoz</Badge>
              </div>
            </button>
            <button type="button" onClick={() => { if (canPersistSettlements) { setMode("formal"); setActiveTab("obdobi"); } }} className={cn("rounded-xl border p-4 text-left transition-colors", mode === "formal" ? "border-primary bg-primary/5" : "bg-muted/20 hover:bg-accent", !canPersistSettlements && "cursor-not-allowed opacity-70")}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Formalni vyuctovani za obdobi</p>
                  <p className="mt-1 text-sm text-muted-foreground">Workflow od konceptu po odeslani se sluzbami, skutecnymi naklady, prijatymi zalohami a konecnym preplatkem nebo nedoplatkem.</p>
                </div>
                <Badge variant="secondary" className={canPersistSettlements ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning"}>{canPersistSettlements ? "Workflow" : "Beta / ceka na DB"}</Badge>
              </div>
            </button>
          </div>

          {settlementsError ? <DataState variant="error" title="Formalni cast zatim neni plne dostupna" description={settlementsError} /> : null}

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as BillingTab)}>
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
              {mode === "operations" ? (
                <>
                  <TabsTrigger value="prehled">Prehled</TabsTrigger>
                  <TabsTrigger value="zalohy">Prubezne zalohy a platby</TabsTrigger>
                </>
              ) : (
                <>
                  <TabsTrigger value="obdobi">Vyuctovani podle obdobi</TabsTrigger>
                  <TabsTrigger value="detail">Detail vyuctovani</TabsTrigger>
                  <TabsTrigger value="podklady">Podklady / namitky / stav</TabsTrigger>
                  <TabsTrigger value="export">Export / doruceni</TabsTrigger>
                </>
              )}
            </TabsList>

            <TabsContent value="prehled" className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
                <Card className="card-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Kontext vyuctovani</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nazev vyuctovani (napr. Sluzby 2025)" />
                    <select
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={tenantId}
                      onChange={(event) => {
                        const nextTenant = tenants.find((tenant) => tenant.id === event.target.value) ?? null;
                        setTenantId(event.target.value);
                        setPropertyId(nextTenant?.property_id ?? "");
                      }}
                      disabled={Boolean(selectedId)}
                    >
                      <option value="">Vyberte najemnika</option>
                      {tenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.full_name}
                        </option>
                      ))}
                    </select>
                    <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={propertyId} onChange={(event) => setPropertyId(event.target.value)} disabled={Boolean(selectedId)}>
                      <option value="">Vyberte nemovitost</option>
                      {properties.map((property) => (
                        <option key={property.id} value={property.id}>
                          {property.name}
                        </option>
                      ))}
                    </select>
                    <Input type="date" value={periodFrom} onChange={(event) => setPeriodFrom(event.target.value)} />
                    <Input type="date" value={periodTo} onChange={(event) => setPeriodTo(event.target.value)} />
                    <Button variant="outline" onClick={resetDraft}>
                      Novy koncept
                    </Button>
                    <div className="md:col-span-2 xl:col-span-3">
                      <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Interni poznamka k podkladum, namitkam nebo zpusobu rozuctovani." rows={4} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Rozliseni modulu</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="rounded-md border bg-muted/30 p-3">
                      <p className="font-medium">Prubezne zalohy a platby</p>
                      <p className="mt-1 text-muted-foreground">Operativni monitoring mesicnich plateb, stavu uhrady a vyvoje zaloh bez pravni finality.</p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-3">
                      <p className="font-medium">Formalni vyuctovani za obdobi</p>
                      <p className="mt-1 text-muted-foreground">Prehled sluzeb, skutecnych nakladu, prijatych zaloh a konecneho preplatku nebo nedoplatku za max. 12 mesicu.</p>
                    </div>
                    {periodError ? (
                      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive">
                        <p className="font-medium">Kontrola obdobi</p>
                        <p className="mt-1 text-sm">{periodError}</p>
                      </div>
                    ) : (
                      <div className="rounded-md border border-success/30 bg-success/5 p-3 text-success">
                        <p className="font-medium">Obdobi je validni</p>
                        <p className="mt-1 text-sm">Formalni vyuctovani pracuje s obdobim {formatDate(periodFrom)} - {formatDate(periodTo)}.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <SettlementSummary
                status={selected?.status ?? "draft"}
                advances={selected?.advances_total ?? computedAdvances}
                actual={selected?.actual_cost_total ?? actualTotal}
                balance={selected?.balance_total ?? balance}
                result={selected?.result_type ?? resultType}
                tenant={selected?.tenant_name ?? selectedTenant?.full_name ?? "-"}
                property={selected?.property_name ?? selectedProperty?.name ?? "-"}
                period={`${formatDate(periodFrom)} - ${formatDate(periodTo)}`}
              />
            </TabsContent>

            <TabsContent value="zalohy" className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
                <Card className="card-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Operativni prehled zaloh a plateb</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <SummaryLine label="Najemnik" value={selectedTenant?.full_name ?? "-"} />
                    <SummaryLine label="Nemovitost" value={selectedProperty?.name ?? "-"} />
                    <SummaryLine label="Obdobi" value={`${formatDate(periodFrom)} - ${formatDate(periodTo)}`} />
                    <SummaryLine label="Predepsane zalohy" value={formatCurrency(paymentsInPeriod.reduce((sum, payment) => sum + Number(payment.amount || 0), 0))} />
                    <SummaryLine label="Uhrazeno" value={formatCurrency(computedAdvances)} tone="success" />
                    <SummaryLine label="Prubezne skutecne naklady" value={formatCurrency(actualTotal)} />
                    <SummaryLine label="Rucne zadane zalohy po sluzbach" value={formatCurrency(itemAdvancesTotal)} />
                    <Button variant="outline" className="w-full" onClick={setMonthlyPeriod}>
                      Nastavit aktualni mesic
                    </Button>
                  </CardContent>
                </Card>

                <Card className="card-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Mesicni monitoring plateb</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!tenantId ? (
                      <DataState title="Chybi najemnik" description="Vyberte nejprve najemnika, pro ktereho chcete sledovat mesicni zalohy." />
                    ) : periodError ? (
                      <DataState title="Chybi validni obdobi" description={periodError} />
                    ) : monthlyRows.length === 0 ? (
                      <DataState title="Zatim nejsou data pro operativni monitoring" description="V danem obdobi nebyly nalezeny zadne platby nebo predpisy." />
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Mesic</TableHead>
                            <TableHead className="text-right">Predepsano</TableHead>
                            <TableHead className="text-right">Uhrazeno</TableHead>
                            <TableHead className="text-right">Zbyva</TableHead>
                            <TableHead>Stav uhrady</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {monthlyRows.map((row) => (
                            <TableRow key={row.monthKey}>
                              <TableCell>{row.monthLabel}</TableCell>
                              <TableCell className="text-right">{formatCurrency(row.prescribed)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(row.paid)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(row.unpaid)}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{row.statusLabel}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="obdobi" className="space-y-4">
              <Card className="card-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Vyuctovani podle obdobi</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <Input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Hledat najemnika, nemovitost nebo nazev" />
                  <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={historyStatusFilter} onChange={(event) => setHistoryStatusFilter(event.target.value as HistoryStatusFilter)}>
                    <option value="all">Vsechny stavy</option>
                    <option value="draft">Koncept</option>
                    <option value="calculated">Spocitano</option>
                    <option value="reviewed">Zkontrolovano</option>
                    <option value="exported">Exportovano</option>
                    <option value="sent">Odeslano</option>
                  </select>
                  <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={historyYearFilter} onChange={(event) => setHistoryYearFilter(event.target.value)}>
                    <option value="all">Vsechna obdobi</option>
                    {historyYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <Button variant="outline" onClick={setYearlyPeriod}>
                    Aktualni rok
                  </Button>
                  <Button variant="outline" onClick={() => resetDraft()}>
                    Novy koncept
                  </Button>
                </CardContent>
              </Card>

              <Card className="card-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Historie formalnich vyuctovani</CardTitle>
                </CardHeader>
                <CardContent>
                  {!canPersistSettlements ? (
                    <DataState title="Historie formalnich vyuctovani neni k dispozici" description={settlementsError} />
                  ) : filteredHistory.length === 0 ? (
                    <DataState title="Historie je prazdna" description="Po ulozeni prvniho formalniho vyuctovani se zde objevi jednotlive periody." />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Obdobi</TableHead>
                          <TableHead>Najemnik</TableHead>
                          <TableHead>Nemovitost</TableHead>
                          <TableHead>Stav workflow</TableHead>
                          <TableHead>Vysledek</TableHead>
                          <TableHead>Vytvoreno</TableHead>
                          <TableHead className="text-right">Akce</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredHistory.map((settlement) => (
                          <TableRow key={settlement.id}>
                            <TableCell>{formatDate(settlement.period_from)} - {formatDate(settlement.period_to)}</TableCell>
                            <TableCell>{settlement.tenant_name ?? "-"}</TableCell>
                            <TableCell>{settlement.property_name ?? "-"}</TableCell>
                            <TableCell>
                              <Badge className={cn("border-transparent", statusBadgeClass(settlement.status))}>{statusLabel(settlement.status)}</Badge>
                            </TableCell>
                            <TableCell className={cn("font-medium", resultToneClass(settlement.result_type))}>
                              {resultLabel(settlement.result_type)} {formatCurrency(Math.abs(settlement.balance_total))}
                            </TableCell>
                            <TableCell>{formatDate(settlement.created_at)}</TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="outline" onClick={() => selectSettlement(settlement.id)}>
                                Otevrit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="detail" className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
                <Card className="card-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Formalni detail vyuctovani</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <SummaryLine label="Najemnik" value={selected?.tenant_name ?? selectedTenant?.full_name ?? "-"} />
                    <SummaryLine label="Nemovitost / jednotka" value={selected?.property_name ?? selectedProperty?.name ?? "-"} />
                    <SummaryLine label="Zuctovaci obdobi" value={`${formatDate(periodFrom)} - ${formatDate(periodTo)}`} />
                    <SummaryLine label="Stav workflow" value={statusLabel(selected?.status ?? "draft")} />
                    <SummaryLine label="Prijate zalohy" value={formatCurrency(selected?.advances_total ?? computedAdvances)} />
                    <SummaryLine label="Skutecne naklady" value={formatCurrency(selected?.actual_cost_total ?? actualTotal)} />
                    <SummaryLine label="Celkove vyuctovani" value={`${resultLabel(selected?.result_type ?? resultType)} ${formatCurrency(Math.abs(selected?.balance_total ?? balance))}`} tone={selected?.result_type === "nedoplatek" || resultType === "nedoplatek" ? "danger" : "success"} />
                  </CardContent>
                </Card>

                <Card className="card-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Polozky sluzeb ve formalnim vyuctovani</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ServiceItemsEditor items={items} onChange={setItems} />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() =>
                          setItems((current) => [
                            ...current,
                            { service_name: "", advances_paid: 0, actual_cost: 0, difference: 0, note: null, sort_order: current.length },
                          ])
                        }
                      >
                        Pridat sluzbu
                      </Button>
                      <Button variant="outline" onClick={() => setItems(baseItems)}>
                        Obnovit vzorove polozky
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <SettlementSummary
                status={selected?.status ?? "draft"}
                advances={selected?.advances_total ?? computedAdvances}
                actual={selected?.actual_cost_total ?? actualTotal}
                balance={selected?.balance_total ?? balance}
                result={selected?.result_type ?? resultType}
                tenant={selected?.tenant_name ?? selectedTenant?.full_name ?? "-"}
                property={selected?.property_name ?? selectedProperty?.name ?? "-"}
                period={`${formatDate(periodFrom)} - ${formatDate(periodTo)}`}
              />
            </TabsContent>

            <TabsContent value="podklady" className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-2">
                <Card className="card-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Podklady a namitky</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-md border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Interni podklad / poznamka</p>
                      <p className="mt-1 text-sm">{notes.trim() || "Zatim neni evidovana zadna interni poznamka ani namitka."}</p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Polozky se slovnim komentarem</p>
                      <p className="mt-1 text-sm">{items.filter((item) => item.note && item.note.trim()).length} z {items.length} sluzeb obsahuje doplnujici vysvetleni.</p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Doporuceni</p>
                      <p className="mt-1 text-sm text-muted-foreground">Zde evidujte faktury, odecty, rozhodnuti o rozuctovani nebo prijate namitky najemnika. Modul zatim neuklada samostatne dokumenty.</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Stav workflow a kontrolni body</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {workflowDates.length === 0 ? (
                      <DataState title="Zatim neni vybrano formalni vyuctovani" description="Jakmile ulozite nebo otevrete detail, uvidite zde workflow timeline a datumy zpracovani." />
                    ) : (
                      workflowDates.map((step) => (
                        <div key={step.label} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                          <span className="text-sm font-medium">{step.label}</span>
                          <span className="text-sm text-muted-foreground">{formatDate(step.value)}</span>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="export" className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <Card className="card-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Export a doruceni formalniho vyuctovani</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ChecklistLine icon={<CalendarRange className="h-4 w-4" />} label="Obdobi" description={periodError ? periodError : `${formatDate(periodFrom)} - ${formatDate(periodTo)}`} done={!periodError} />
                    <ChecklistLine icon={<ReceiptText className="h-4 w-4" />} label="Polozky sluzeb" description={`${items.filter((item) => item.service_name.trim()).length} evidovanych sluzeb v detailu`} done={items.some((item) => item.service_name.trim())} />
                    <ChecklistLine icon={<ShieldCheck className="h-4 w-4" />} label="Workflow" description={`Aktualni stav: ${statusLabel(selected?.status ?? "draft")}`} done={Boolean(selectedId)} />
                    <ChecklistLine icon={<FolderClock className="h-4 w-4" />} label="Podklady" description={notes.trim() ? "K vyuctovani je prirazena interni poznamka nebo podklad." : "Podklady nejsou v detailu zatim rozepsane."} done={Boolean(notes.trim())} />
                  </CardContent>
                </Card>

                <Card className="card-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Akce nad formalnim vyuctovanim</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    <Button variant="outline" disabled={saving || !canPersistSettlements} onClick={() => saveDraft("draft")}>
                      <FileText className="mr-2 h-4 w-4" />
                      Ulozit koncept
                    </Button>
                    <Button variant="outline" disabled={saving || !canPersistSettlements} onClick={calculateSettlement}>
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      Spocitat
                    </Button>
                    <Button variant="outline" disabled={saving || !selectedId || !canPersistSettlements} onClick={() => updateStatus("reviewed")}>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Zkontrolovano
                    </Button>
                    <Button variant="outline" disabled={saving || !selectedId || !canPersistSettlements} onClick={() => updateStatus("exported")}>
                      <Download className="mr-2 h-4 w-4" />
                      Exportovano
                    </Button>
                    <Button variant="cta" disabled={saving || !selectedId || !canPersistSettlements} onClick={() => updateStatus("sent")}>
                      <Send className="mr-2 h-4 w-4" />
                      Odeslano
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}

function KpiCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "danger" }) {
  return (
    <Card className="card-shadow">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("mt-1 text-2xl font-bold", tone === "success" && "text-success", tone === "danger" && "text-destructive")}>{value}</p>
      </CardContent>
    </Card>
  );
}

function ServiceItemsEditor({ items, onChange }: { items: SettlementItem[]; onChange: (items: SettlementItem[]) => void }) {
  const update = (index: number, field: keyof SettlementItem, value: string | number | null) => {
    onChange(
      items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        const next = { ...item, [field]: value } as SettlementItem;
        next.advances_paid = Number(next.advances_paid || 0);
        next.actual_cost = Number(next.actual_cost || 0);
        next.difference = next.advances_paid - next.actual_cost;
        return next;
      }),
    );
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Sluzba</TableHead>
          <TableHead className="text-right">Prijate zalohy</TableHead>
          <TableHead className="text-right">Skutecne naklady</TableHead>
          <TableHead className="text-right">Rozdil</TableHead>
          <TableHead>Poznamka</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, index) => (
          <TableRow key={`${index}-${item.service_name}`}>
            <TableCell>
              <Input value={item.service_name} onChange={(event) => update(index, "service_name", event.target.value)} />
            </TableCell>
            <TableCell>
              <Input type="number" className="text-right" value={item.advances_paid} onChange={(event) => update(index, "advances_paid", Number(event.target.value))} />
            </TableCell>
            <TableCell>
              <Input type="number" className="text-right" value={item.actual_cost} onChange={(event) => update(index, "actual_cost", Number(event.target.value))} />
            </TableCell>
            <TableCell className={cn("text-right font-medium", item.difference < 0 ? "text-destructive" : item.difference > 0 ? "text-success" : "text-muted-foreground")}>
              {formatCurrency(Math.abs(item.difference))}
            </TableCell>
            <TableCell>
              <Input value={item.note || ""} onChange={(event) => update(index, "note", event.target.value)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SettlementSummary({
  status,
  advances,
  actual,
  balance,
  result,
  tenant,
  property,
  period,
}: {
  status: WorkflowStatus;
  advances: number;
  actual: number;
  balance: number;
  result: ResultType;
  tenant: string;
  property: string;
  period: string;
}) {
  return (
    <Card className="card-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Formalni souhrn vyuctovani</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryLine label="Najemnik" value={tenant} />
        <SummaryLine label="Nemovitost / jednotka" value={property} />
        <SummaryLine label="Zuctovaci obdobi" value={period} />
        <SummaryLine label="Workflow" value={statusLabel(status)} />
        <SummaryLine label="Prijate zalohy" value={formatCurrency(advances)} />
        <SummaryLine label="Skutecne naklady" value={formatCurrency(actual)} />
        <SummaryLine label="Rozdil po zapocteni zaloh" value={formatCurrency(Math.abs(balance))} tone={result === "nedoplatek" ? "danger" : result === "preplatek" ? "success" : "default"} />
        <SummaryLine label="Konecny vysledek" value={resultLabel(result)} tone={result === "nedoplatek" ? "danger" : result === "preplatek" ? "success" : "default"} />
      </CardContent>
    </Card>
  );
}

function SummaryLine({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "danger" }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-semibold", tone === "success" && "text-success", tone === "danger" && "text-destructive")}>{value}</p>
    </div>
  );
}

function ChecklistLine({
  icon,
  label,
  description,
  done,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  done: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
      <div className={cn("mt-0.5", done ? "text-success" : "text-muted-foreground")}>{done ? <CheckCircle2 className="h-4 w-4" /> : icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className={cn("text-sm", done ? "text-muted-foreground" : "text-amber-700")}>{description}</p>
      </div>
    </div>
  );
}
