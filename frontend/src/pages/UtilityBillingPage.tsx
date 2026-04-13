import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, FileText, Send, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataState } from "@/components/product/DataState";
import { PageHeader } from "@/components/product/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type WorkflowStatus = "draft" | "calculated" | "reviewed" | "exported" | "sent";
type ResultType = "preplatek" | "nedoplatek" | "vyrovnano";
type BillingTab = "prehled" | "mesicni" | "rocni" | "historie" | "nastaveni";

type TenantItem = { id: string; full_name: string; property_id: string | null; };
type PropertyItem = { id: string; name: string; };
type PaymentItem = { tenant_id: string; amount: number; status: string; due_date: string; paid_date: string | null; };
type SettlementItem = { id?: string; service_name: string; advances_paid: number; actual_cost: number; difference: number; note: string | null; sort_order: number; };
type Settlement = {
  id: string; tenant_id: string; property_id: string; tenant_name: string | null; property_name: string | null;
  period_from: string; period_to: string; title: string | null; notes: string | null;
  status: WorkflowStatus; advances_total: number; actual_cost_total: number; balance_total: number; result_type: ResultType;
  created_at: string; items?: SettlementItem[];
};

const baseItems: SettlementItem[] = [
  { service_name: "Voda", advances_paid: 0, actual_cost: 0, difference: 0, note: null, sort_order: 0 },
  { service_name: "Plyn", advances_paid: 0, actual_cost: 0, difference: 0, note: null, sort_order: 1 },
  { service_name: "Elektrina", advances_paid: 0, actual_cost: 0, difference: 0, note: null, sort_order: 2 },
  { service_name: "Spolecne prostory", advances_paid: 0, actual_cost: 0, difference: 0, note: null, sort_order: 3 },
];

function formatCurrency(value: number) { return `${Number(value || 0).toLocaleString("cs-CZ")} Kc`; }
function formatDate(value: string | null) { if (!value) return "-"; return new Date(value).toLocaleDateString("cs-CZ"); }
function statusLabel(status: WorkflowStatus) { return ({ draft: "Koncept", calculated: "Spocitano", reviewed: "Zkontrolovano", exported: "Exportovano", sent: "Odeslano" })[status]; }
function resultLabel(result: ResultType) { return ({ preplatek: "Preplatek", nedoplatek: "Nedoplatek", vyrovnano: "Vyrovnano" })[result]; }

export default function UtilityBillingPage() {
  const [activeTab, setActiveTab] = useState<BillingTab>("prehled");
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

  const byTenantPayments = useMemo(() => payments.filter((payment) => payment.tenant_id === tenantId), [payments, tenantId]);
  const computedAdvances = useMemo(() => {
    return byTenantPayments
      .filter((payment) => {
        if (payment.status !== "paid") return false;
        if (!periodFrom || !periodTo) return true;
        const due = payment.due_date;
        return due >= periodFrom && due <= periodTo;
      })
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }, [byTenantPayments, periodFrom, periodTo]);
  const actualTotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.actual_cost || 0), 0), [items]);
  const balance = computedAdvances - actualTotal;
  const resultType: ResultType = Math.abs(balance) < 1 ? "vyrovnano" : balance >= 0 ? "preplatek" : "nedoplatek";

  const workflowStep = useMemo(() => {
    if (!tenantId || !propertyId) return 1;
    if (!periodFrom || !periodTo) return 2;
    if (!items.some((item) => item.service_name.trim())) return 3;
    if (!selected || selected.status === "draft") return 4;
    return 5;
  }, [tenantId, propertyId, periodFrom, periodTo, items, selected]);

  async function loadAll() {
    try {
      setLoading(true);
      setError("");
      const [tenantsRes, propertiesRes, paymentsRes, historyRes] = await Promise.all([
        apiFetch("/api/tenants"),
        apiFetch("/api/properties"),
        apiFetch("/api/payments"),
        apiFetch("/api/billing/settlements"),
      ]);
      if (!tenantsRes.ok || !propertiesRes.ok || !paymentsRes.ok || !historyRes.ok) throw new Error("load failed");
      const tenantsData = (await tenantsRes.json()) as TenantItem[];
      const propertiesData = (await propertiesRes.json()) as PropertyItem[];
      const paymentsData = (await paymentsRes.json()) as PaymentItem[];
      const historyData = (await historyRes.json()) as Settlement[];
      setTenants(tenantsData);
      setProperties(propertiesData);
      setPayments(paymentsData);
      setHistory(historyData);
      if (historyData[0]?.id) { await selectSettlement(historyData[0].id); } else { resetDraft(tenantsData[0]); }
    } catch {
      setError("Vyuctovani se nepodarilo nacist.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  function resetDraft(defaultTenant?: TenantItem) {
    setSelectedId(null); setSelected(null); setTitle("");
    const tenant = defaultTenant ?? tenants[0];
    setTenantId(tenant?.id ?? ""); setPropertyId(tenant?.property_id ?? "");
    setPeriodFrom(""); setPeriodTo(""); setNotes(""); setItems(baseItems);
  }

  async function selectSettlement(id: string) {
    const response = await apiFetch(`/api/billing/settlements/${id}`);
    if (!response.ok) return;
    const detail = (await response.json()) as Settlement;
    setSelectedId(detail.id); setSelected(detail);
    setTenantId(detail.tenant_id); setPropertyId(detail.property_id);
    setPeriodFrom(detail.period_from); setPeriodTo(detail.period_to);
    setTitle(detail.title ?? ""); setNotes(detail.notes ?? ""); setItems(detail.items?.length ? detail.items : baseItems);
  }

  async function saveDraft(nextStatus?: WorkflowStatus) {
    if (!tenantId || !propertyId || !periodFrom || !periodTo) {
      toast({ title: "Chybi povinna data", description: "Vyberte najemnika, nemovitost a obdobi.", variant: "destructive" }); return;
    }
    try {
      setSaving(true);
      const payload = { tenant_id: tenantId, property_id: propertyId, period_from: periodFrom, period_to: periodTo, title, notes, status: nextStatus, items };
      const response = selectedId
        ? await apiFetch(`/api/billing/settlements/${selectedId}`, { method: "PUT", body: JSON.stringify(payload) })
        : await apiFetch("/api/billing/settlements", { method: "POST", body: JSON.stringify(payload) });
      if (!response.ok) throw new Error("save failed");
      const detail = (await response.json()) as Settlement;
      setSelectedId(detail.id); setSelected(detail); setItems(detail.items || items);
      const historyRes = await apiFetch("/api/billing/settlements");
      if (historyRes.ok) setHistory((await historyRes.json()) as Settlement[]);
      toast({ title: "Vyuctovani ulozeno", description: `Stav: ${statusLabel(detail.status)}` });
    } catch {
      toast({ title: "Ulozeni selhalo", description: "Zkuste akci opakovat.", variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function calculateSettlement() {
    if (!selectedId) { await saveDraft("draft"); return; }
    try {
      setSaving(true);
      const response = await apiFetch(`/api/billing/settlements/${selectedId}/calculate`, { method: "POST" });
      if (!response.ok) throw new Error("calculate failed");
      const detail = (await response.json()) as Settlement;
      setSelected(detail); setItems(detail.items || items);
      toast({ title: "Vyuctovani spocitano", description: `${resultLabel(detail.result_type)} ${formatCurrency(Math.abs(detail.balance_total))}` });
    } catch {
      toast({ title: "Vypocet selhal", description: "Nejprve ulozte koncept a doplnte polozky.", variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function updateStatus(status: WorkflowStatus) { await saveDraft(status); }

  function setMonthlyPeriod() {
    const now = new Date(); const from = new Date(now.getFullYear(), now.getMonth(), 1); const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setPeriodFrom(from.toISOString().slice(0, 10)); setPeriodTo(to.toISOString().slice(0, 10)); setActiveTab("mesicni");
  }
  function setYearlyPeriod() {
    const now = new Date(); const from = new Date(now.getFullYear(), 0, 1); const to = new Date(now.getFullYear(), 11, 31);
    setPeriodFrom(from.toISOString().slice(0, 10)); setPeriodTo(to.toISOString().slice(0, 10)); setActiveTab("rocni");
  }

  if (loading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Vyuctovani sluzeb" description="Workflow od konceptu po odeslani s vazbou na najemnika, nemovitost a zalohy." />
      {error ? <DataState variant="error" title="Chyba nacitani" description={error} actionLabel="Nacist znovu" onAction={loadAll} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Aktivni vyuctovani" value={String(history.filter((s) => s.status !== "sent").length)} />
        <KpiCard label="Nedoplatky" value={String(history.filter((s) => s.result_type === "nedoplatek").length)} tone="danger" />
        <KpiCard label="Preplatky" value={String(history.filter((s) => s.result_type === "preplatek").length)} tone="success" />
        <KpiCard label="Posledni stav" value={selected ? statusLabel(selected.status) : "Koncept"} />
        <Card className="card-shadow"><CardContent className="p-4 space-y-2"><Button variant="outline" className="w-full justify-between" onClick={setMonthlyPeriod}>Mesicni workflow <ArrowRight className="h-4 w-4" /></Button><Button variant="outline" className="w-full justify-between" onClick={setYearlyPeriod}>Rocni workflow <ArrowRight className="h-4 w-4" /></Button></CardContent></Card>
      </div>

      <Card className="card-shadow"><CardHeader className="pb-3"><CardTitle className="text-base">Krokovy workflow</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-5">{["Vyber najemnika a nemovitost","Nastav obdobi","Zkontroluj polozky sluzeb","Spocitej vysledek","Potvrd, exportuj, odesli"].map((label, i)=><div key={label} className={cn("rounded-md border px-3 py-2 text-sm",workflowStep===i+1?"border-primary bg-primary/5":"bg-muted/30")}><p className="text-xs text-muted-foreground">Krok {i+1}</p><p className="font-medium">{label}</p></div>)}</CardContent></Card>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as BillingTab)}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
          <TabsTrigger value="prehled">Prehled</TabsTrigger><TabsTrigger value="mesicni">Mesicni vyuctovani</TabsTrigger><TabsTrigger value="rocni">Rocni vyuctovani</TabsTrigger><TabsTrigger value="historie">Historie vyuctovani</TabsTrigger><TabsTrigger value="nastaveni">Nastaveni sluzeb</TabsTrigger>
        </TabsList>

        <TabsContent value="prehled" className="space-y-4">
          <Card className="card-shadow"><CardHeader className="pb-3"><CardTitle className="text-base">Identifikace vyuctovani</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nazev vyuctovani (volitelne)" />
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={tenantId} onChange={(e) => { setTenantId(e.target.value); const t = tenants.find((x) => x.id === e.target.value); setPropertyId(t?.property_id || ""); }}><option value="">Vyberte najemnika</option>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.full_name}</option>)}</select>
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}><option value="">Vyberte nemovitost</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select>
            <Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
            <Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Poznamka k vyuctovani" />
          </CardContent></Card>
          <SettlementSummary advances={selected?.advances_total ?? computedAdvances} actual={selected?.actual_cost_total ?? actualTotal} balance={selected?.balance_total ?? balance} result={selected?.result_type ?? resultType} tenant={tenants.find((t) => t.id === tenantId)?.full_name || "-"} property={properties.find((p) => p.id === propertyId)?.name || "-"} period={`${formatDate(periodFrom)} - ${formatDate(periodTo)}`} />
        </TabsContent>

        <TabsContent value="mesicni" className="space-y-4"><Card className="card-shadow"><CardHeader className="pb-3"><CardTitle className="text-base">Mesicni workflow</CardTitle></CardHeader><CardContent className="space-y-3"><Button variant="outline" onClick={setMonthlyPeriod}>Nastavit aktualni mesic</Button><ServiceItemsEditor items={items} onChange={setItems} /></CardContent></Card></TabsContent>
        <TabsContent value="rocni" className="space-y-4"><Card className="card-shadow"><CardHeader className="pb-3"><CardTitle className="text-base">Rocni workflow</CardTitle></CardHeader><CardContent className="space-y-3"><Button variant="outline" onClick={setYearlyPeriod}>Nastavit aktualni rok</Button><ServiceItemsEditor items={items} onChange={setItems} /></CardContent></Card></TabsContent>

        <TabsContent value="historie" className="space-y-4">
          <Card className="card-shadow"><CardHeader className="pb-3"><CardTitle className="text-base">Historie vyuctovani</CardTitle></CardHeader><CardContent>
            {history.length === 0 ? <DataState title="Historie je prazdna" description="Ulozte prvni koncept vyuctovani." /> : (
              <Table><TableHeader><TableRow><TableHead>Obdobi</TableHead><TableHead>Najemnik</TableHead><TableHead>Nemovitost</TableHead><TableHead>Stav</TableHead><TableHead>Vysledek</TableHead><TableHead>Porovnani</TableHead><TableHead className="text-right">Akce</TableHead></TableRow></TableHeader><TableBody>
                {history.map((settlement, index) => {
                  const previous = history[index + 1];
                  const delta = previous ? settlement.balance_total - previous.balance_total : null;
                  return <TableRow key={settlement.id}><TableCell>{formatDate(settlement.period_from)} - {formatDate(settlement.period_to)}</TableCell><TableCell>{settlement.tenant_name || "-"}</TableCell><TableCell>{settlement.property_name || "-"}</TableCell><TableCell><Badge variant="secondary">{statusLabel(settlement.status)}</Badge></TableCell><TableCell className={cn(settlement.result_type === "nedoplatek" ? "text-destructive" : settlement.result_type === "preplatek" ? "text-success" : "text-muted-foreground")}>{resultLabel(settlement.result_type)} {formatCurrency(Math.abs(settlement.balance_total))}</TableCell><TableCell>{delta === null ? "-" : `${delta >= 0 ? "+" : "-"} ${formatCurrency(Math.abs(delta))}`}</TableCell><TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => selectSettlement(settlement.id)}>Otevrit</Button></TableCell></TableRow>;
                })}
              </TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="nastaveni" className="space-y-4"><Card className="card-shadow"><CardHeader className="pb-3"><CardTitle className="text-base">Sprava polozek sluzeb</CardTitle></CardHeader><CardContent>{items.length === 0 ? <DataState title="Zadne polozky sluzeb" description="Pridete polozku pomoci tlacitka nize." /> : <p className="text-sm text-muted-foreground">Polozky spravujete primo v mesicnim/rocnim workflow. Zde je stav pripravenosti modulu.</p>}<Button variant="outline" className="mt-3" onClick={() => setItems((prev) => [...prev, { service_name: "", advances_paid: 0, actual_cost: 0, difference: 0, note: null, sort_order: prev.length }])}>Pridat polozku</Button></CardContent></Card></TabsContent>
      </Tabs>

      <Card className="card-shadow"><CardHeader className="pb-3"><CardTitle className="text-base">Akce nad vyuctovanim</CardTitle></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Button variant="outline" disabled={saving} onClick={() => saveDraft("draft")}>Ulozit koncept</Button>
        <Button variant="outline" disabled={saving} onClick={calculateSettlement}>Oznacit jako spocitane</Button>
        <Button variant="outline" disabled={saving || !selectedId} onClick={() => updateStatus("reviewed")}><ShieldCheck className="mr-2 h-4 w-4" />Zkontrolovano</Button>
        <Button variant="outline" disabled={saving || !selectedId} onClick={() => updateStatus("exported")}><FileText className="mr-2 h-4 w-4" />Exportovano PDF</Button>
        <Button variant="cta" disabled={saving || !selectedId} onClick={() => updateStatus("sent")}><Send className="mr-2 h-4 w-4" />Odeslano</Button>
      </CardContent></Card>
    </div>
  );
}

function KpiCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "danger"; }) {
  return <Card className="card-shadow"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className={cn("mt-1 text-2xl font-bold", tone === "success" && "text-success", tone === "danger" && "text-destructive")}>{value}</p></CardContent></Card>;
}

function ServiceItemsEditor({ items, onChange }: { items: SettlementItem[]; onChange: (items: SettlementItem[]) => void; }) {
  const update = (index: number, field: keyof SettlementItem, value: string | number | null) => {
    onChange(items.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const next = { ...item, [field]: value } as SettlementItem;
      next.difference = Number(next.advances_paid || 0) - Number(next.actual_cost || 0);
      return next;
    }));
  };
  return <Table><TableHeader><TableRow><TableHead>Sluzba</TableHead><TableHead className="text-right">Zaplacene zalohy</TableHead><TableHead className="text-right">Skutecny naklad</TableHead><TableHead className="text-right">Rozdil</TableHead><TableHead>Poznamka</TableHead></TableRow></TableHeader><TableBody>{items.map((item, index) => <TableRow key={`${index}-${item.service_name}`}><TableCell><Input value={item.service_name} onChange={(e) => update(index, "service_name", e.target.value)} /></TableCell><TableCell><Input type="number" className="text-right" value={item.advances_paid} onChange={(e) => update(index, "advances_paid", Number(e.target.value))} /></TableCell><TableCell><Input type="number" className="text-right" value={item.actual_cost} onChange={(e) => update(index, "actual_cost", Number(e.target.value))} /></TableCell><TableCell className={cn("text-right font-medium", item.difference < 0 ? "text-destructive" : item.difference > 0 ? "text-success" : "text-muted-foreground")}>{formatCurrency(Math.abs(item.difference))}</TableCell><TableCell><Input value={item.note || ""} onChange={(e) => update(index, "note", e.target.value)} /></TableCell></TableRow>)}</TableBody></Table>;
}

function SettlementSummary({ advances, actual, balance, result, tenant, property, period }: { advances: number; actual: number; balance: number; result: ResultType; tenant: string; property: string; period: string; }) {
  return <Card className="card-shadow"><CardHeader className="pb-3"><CardTitle className="text-base">Vysledek vyuctovani</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><SummaryLine label="Najemnik" value={tenant} /><SummaryLine label="Nemovitost" value={property} /><SummaryLine label="Obdobi" value={period} /><SummaryLine label="Zalohy (z plateb)" value={formatCurrency(advances)} /><SummaryLine label="Skutecne naklady" value={formatCurrency(actual)} /><SummaryLine label="Rozdil" value={formatCurrency(Math.abs(balance))} /><SummaryLine label="Vysledek" value={resultLabel(result)} tone={result === "nedoplatek" ? "danger" : result === "preplatek" ? "success" : "default"} /></CardContent></Card>;
}

function SummaryLine({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "danger"; }) {
  return <div className="rounded-md border bg-muted/30 px-3 py-2"><p className="text-xs text-muted-foreground">{label}</p><p className={cn("text-sm font-semibold", tone === "success" && "text-success", tone === "danger" && "text-destructive")}>{value}</p></div>;
}
