import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Download, FileText, Plus, RefreshCcw, Send, ShieldCheck, Sparkles, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DataState } from "@/components/product/DataState";
import { PageHeader } from "@/components/product/PageHeader";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type WorkflowStatus = "draft" | "calculated" | "reviewed" | "exported" | "sent";
type ResultType = "preplatek" | "nedoplatek" | "vyrovnano";
type BillingMode = "manual" | "import" | "automatic";
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

function countInclusiveMonths(periodFrom: string, periodTo: string) {
  const from = new Date(`${periodFrom}T00:00:00.000Z`);
  const to = new Date(`${periodTo}T00:00:00.000Z`);
  return ((to.getUTCFullYear() - from.getUTCFullYear()) * 12) + (to.getUTCMonth() - from.getUTCMonth()) + 1;
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

export default function UtilityBillingPage() {
  const [mode, setMode] = useState<BillingMode>("manual");
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
  const [showSecondary, setShowSecondary] = useState(false);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<HistoryStatusFilter>("all");

  const selectedTenant = useMemo(() => tenants.find((tenant) => tenant.id === tenantId) ?? null, [tenants, tenantId]);
  const selectedProperty = useMemo(() => properties.find((property) => property.id === propertyId) ?? null, [properties, propertyId]);
  const canPersistSettlements = !settlementsError;
  const periodError = getPeriodError(periodFrom, periodTo);

  const paymentsInPeriod = useMemo(() => {
    return payments.filter((payment) => {
      if (payment.tenant_id !== tenantId) return false;
      if (!periodFrom || !periodTo) return true;
      return payment.due_date >= periodFrom && payment.due_date <= periodTo;
    });
  }, [payments, periodFrom, periodTo, tenantId]);

  const computedAdvances = useMemo(() => {
    return paymentsInPeriod.reduce((sum, payment) => {
      if (payment.status !== "paid") return sum;
      return sum + Number(payment.amount || 0);
    }, 0);
  }, [paymentsInPeriod]);

  const actualTotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.actual_cost || 0), 0), [items]);
  const balance = computedAdvances - actualTotal;
  const resultType: ResultType = Math.abs(balance) < 1 ? "vyrovnano" : balance >= 0 ? "preplatek" : "nedoplatek";

  const filteredHistory = useMemo(() => {
    return history.filter((settlement) => historyStatusFilter === "all" || settlement.status === historyStatusFilter);
  }, [history, historyStatusFilter]);

  const importRows = useMemo(() => paymentsInPeriod.slice(0, 8), [paymentsInPeriod]);

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

      if (!tenantsRes.ok || !propertiesRes.ok || !paymentsRes.ok) throw new Error("load-failed");

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
          await selectSettlement(historyData[0].id);
        } else {
          resetDraft(tenantsData[0]);
        }
      } catch {
        setHistory([]);
        setSelectedId(null);
        setSelected(null);
        setSettlementsError("Formalni cast zatim neni plne dostupna. Rucni priprava podkladu funguje, ale ulozeni a export potrebuji settlement backend a DB schema.");
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
    const response = await apiFetch("/api/billing/settlements");
    if (!response.ok) throw new Error("history-reload-failed");
    const historyData = (await response.json()) as Settlement[];
    setHistory(historyData);
    if (preferredId) {
      const match = historyData.find((item) => item.id === preferredId);
      if (match) await selectSettlement(preferredId);
    }
  }

  async function selectSettlement(id: string) {
    const response = await apiFetch(`/api/billing/settlements/${id}`);
    if (!response.ok) {
      toast({ title: "Detail se nepodarilo nacist", description: "Zkuste vyuctovani otevrit znovu.", variant: "destructive" });
      return;
    }

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
    setMode("manual");
  }

  async function saveDraft(nextStatus?: WorkflowStatus) {
    if (!canPersistSettlements) {
      toast({ title: "Formalni cast neni dostupna", description: settlementsError || "Settlement backend neni pripraveny.", variant: "destructive" });
      return;
    }

    if (!tenantId || !propertyId) {
      toast({ title: "Chybi najemnik nebo nemovitost", description: "Vyberte najemnika a nemovitost pro formalni vyuctovani.", variant: "destructive" });
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
      toast({ title: "Vyuctovani ulozeno", description: `Aktualni stav: ${statusLabel(detail.status)}.` });
    } catch {
      toast({ title: "Ulozeni selhalo", description: "Zkontrolujte zadane udaje a zkuste akci znovu.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function calculateSettlement() {
    if (!selectedId) {
      await saveDraft("draft");
      return;
    }

    if (!canPersistSettlements) {
      toast({ title: "Formalni cast neni dostupna", description: settlementsError || "Settlement backend neni pripraveny.", variant: "destructive" });
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
      toast({ title: "Vyuctovani spocitano", description: `${resultLabel(detail.result_type)} ${formatCurrency(Math.abs(detail.balance_total))}` });
    } catch {
      toast({ title: "Vypocet selhal", description: "Nejprve ulozte koncept a doplnte polozky vyuctovani.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(status: WorkflowStatus) {
    await saveDraft(status);
  }

  function addItem() {
    setItems((current) => [...current, { service_name: "", advances_paid: 0, actual_cost: 0, difference: 0, note: null, sort_order: current.length }]);
  }

  function resetToDefaults() {
    setItems(baseItems);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Vyuctovani sluzeb" description="Jednoducha cesta: vyplnit udaje, zadat polozky, spocitat vysledek a vygenerovat PDF." />
      {error ? <DataState variant="error" title="Chyba nacitani" description={error} actionLabel="Nacist znovu" onAction={loadAll} /> : null}
      {!error ? (
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-3">
            <ModeCard
              title="Rucni vyuctovani"
              description="Hlavni cesta pro skutecne vytvoreni vyuctovani a PDF z rucne zadanych polozek."
              icon={<FileText className="h-4 w-4" />}
              active={mode === "manual"}
              onClick={() => setMode("manual")}
              badge="Doporuceno"
            />
            <ModeCard
              title="Import plateb / podkladu"
              description="Jednoduchy nahled na prijate platby a podklady pro rucni doplneni polozek."
              icon={<Upload className="h-4 w-4" />}
              active={mode === "import"}
              onClick={() => setMode("import")}
            />
            <ModeCard
              title="Automaticky navrh"
              description="Priprava pro budouci automaticke predvyplneni z podkladu a plateb."
              icon={<Sparkles className="h-4 w-4" />}
              active={false}
              onClick={() => undefined}
              disabled
              badge="Coming soon"
            />
          </div>

          {mode === "manual" ? (
            <div className="space-y-4">
              {!canPersistSettlements ? (
                <Card className="card-shadow border-warning/30">
                  <CardContent className="flex flex-col gap-2 p-4">
                    <p className="text-sm font-medium">Formalni backend cast je zatim omezena.</p>
                    <p className="text-sm text-muted-foreground">{settlementsError}</p>
                  </CardContent>
                </Card>
              ) : null}

              <Card className="card-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">A) Zakladni udaje</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nazev vyuctovani" />
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={tenantId}
                    onChange={(event) => {
                      const nextTenant = tenants.find((tenant) => tenant.id === event.target.value) ?? null;
                      setTenantId(event.target.value);
                      setPropertyId(nextTenant?.property_id ?? "");
                    }}
                  >
                    <option value="">Vyberte najemnika</option>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.full_name}
                      </option>
                    ))}
                  </select>
                  <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={propertyId} onChange={(event) => setPropertyId(event.target.value)}>
                    <option value="">Vyberte nemovitost</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name}
                      </option>
                    ))}
                  </select>
                  <Input type="date" value={periodFrom} onChange={(event) => setPeriodFrom(event.target.value)} />
                  <Input type="date" value={periodTo} onChange={(event) => setPeriodTo(event.target.value)} />
                  <Button variant="outline" onClick={() => resetDraft()}>
                    Novy koncept
                  </Button>
                  <div className="md:col-span-2 xl:col-span-3">
                    <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Interni poznamka k vyuctovani" rows={3} />
                  </div>
                  {periodError ? <p className="md:col-span-2 xl:col-span-3 text-sm text-destructive">{periodError}</p> : null}
                </CardContent>
              </Card>

              <Card className="card-shadow">
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle className="text-base">B) Polozky sluzeb / vydaju</CardTitle>
                      <p className="text-sm text-muted-foreground">Prave tato tabulka tvori hlavni obsah formalniho PDF vyuctovani.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={resetToDefaults}>
                        Obnovit vzorove polozky
                      </Button>
                      <Button variant="outline" onClick={addItem}>
                        <Plus className="mr-2 h-4 w-4" />
                        Pridat polozku
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ServiceItemsEditor items={items} onChange={setItems} />
                </CardContent>
              </Card>

              <Card className="card-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">C) Vysledek a akce</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryLine label="Najemnik" value={selected?.tenant_name ?? selectedTenant?.full_name ?? "-"} />
                    <SummaryLine label="Nemovitost / jednotka" value={selected?.property_name ?? selectedProperty?.name ?? "-"} />
                    <SummaryLine label="Prijate zalohy" value={formatCurrency(selected?.advances_total ?? computedAdvances)} />
                    <SummaryLine label="Skutecne naklady" value={formatCurrency(selected?.actual_cost_total ?? actualTotal)} />
                    <SummaryLine label="Preplatek / nedoplatek" value={`${resultLabel(selected?.result_type ?? resultType)} ${formatCurrency(Math.abs(selected?.balance_total ?? balance))}`} tone={selected?.result_type === "nedoplatek" || resultType === "nedoplatek" ? "danger" : "success"} />
                    <SummaryLine label="Stav workflow" value={statusLabel(selected?.status ?? "draft")} />
                    <SummaryLine label="Obdobi" value={`${formatDate(periodFrom)} - ${formatDate(periodTo)}`} />
                    <SummaryLine label="PDF podklad" value={`${items.filter((item) => item.service_name.trim()).length} polozek`} />
                  </div>

                  <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                    PDF vznikne z vyplnenych zakladnich udaju a z tabulky polozek sluzeb / vydaju uvedene vyse.
                  </div>

                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                    <Button variant="outline" disabled={saving || !canPersistSettlements} onClick={() => saveDraft("draft")}>
                      <FileText className="mr-2 h-4 w-4" />
                      Ulozit koncept
                    </Button>
                    <Button variant="outline" disabled={saving || !canPersistSettlements} onClick={calculateSettlement}>
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      Spocitat
                    </Button>
                    <Button variant="cta" disabled={saving || !selectedId || !canPersistSettlements} onClick={() => void updateStatus("exported")}>
                      <Download className="mr-2 h-4 w-4" />
                      Generovat PDF
                    </Button>
                    <Button variant="outline" disabled={saving || !selectedId || !canPersistSettlements} onClick={() => updateStatus("reviewed")}>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Oznacit jako zkontrolovane
                    </Button>
                    <Button variant="outline" disabled={saving || !selectedId || !canPersistSettlements} onClick={() => updateStatus("sent")}>
                      <Send className="mr-2 h-4 w-4" />
                      Oznacit jako odeslane
                    </Button>
                  </div>

                  {!canPersistSettlements ? (
                    <p className="text-sm text-muted-foreground">Generovat PDF je viditelne, ale vypnute, dokud nebude dostupna formalni settlement cast backendu a DB.</p>
                  ) : !selectedId ? (
                    <p className="text-sm text-muted-foreground">Pro generovani PDF nejprve ulozte nebo otevrete konkretni vyuctovani.</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Tlacitko Generovat PDF aktualne oznaci vyuctovani jako exportovane a pripravi ho pro dokumentovy vystup.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="card-shadow">
                <CardHeader className="pb-3">
                  <button type="button" onClick={() => setShowSecondary((current) => !current)} className="flex w-full items-center justify-between text-left">
                    <CardTitle className="text-base">Sekundarni informace: historie, podklady a stav</CardTitle>
                    {showSecondary ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </CardHeader>
                {showSecondary ? (
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                      <div className="space-y-3">
                        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={historyStatusFilter} onChange={(event) => setHistoryStatusFilter(event.target.value as HistoryStatusFilter)}>
                          <option value="all">Vsechny stavy</option>
                          <option value="draft">Koncept</option>
                          <option value="calculated">Spocitano</option>
                          <option value="reviewed">Zkontrolovano</option>
                          <option value="exported">Exportovano</option>
                          <option value="sent">Odeslano</option>
                        </select>

                        {!canPersistSettlements ? (
                          <DataState title="Historie formalnich vyuctovani neni dostupna" description={settlementsError} />
                        ) : filteredHistory.length === 0 ? (
                          <DataState title="Historie je prazdna" description="Po ulozeni prvniho konceptu se zde objevi drivejsi vyuctovani." />
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Obdobi</TableHead>
                                <TableHead>Najemnik</TableHead>
                                <TableHead>Stav</TableHead>
                                <TableHead className="text-right">Akce</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredHistory.map((settlement) => (
                                <TableRow key={settlement.id}>
                                  <TableCell>{formatDate(settlement.period_from)} - {formatDate(settlement.period_to)}</TableCell>
                                  <TableCell>{settlement.tenant_name ?? "-"}</TableCell>
                                  <TableCell>
                                    <Badge variant="secondary">{statusLabel(settlement.status)}</Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button size="sm" variant="outline" onClick={() => void selectSettlement(settlement.id)}>
                                      Otevrit
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>

                      <div className="space-y-3">
                        <SummaryLine label="Interni podklad / poznamka" value={notes.trim() || "Zatim bez doplnujici poznamky"} />
                        <SummaryLine label="Polozky s poznamkou" value={`${items.filter((item) => item.note && item.note.trim()).length} z ${items.length}`} />
                        <SummaryLine label="Vytvoreno" value={formatDate(selected?.created_at)} />
                        <SummaryLine label="Spocitano" value={formatDate(selected?.calculated_at)} />
                        <SummaryLine label="Exportovano" value={formatDate(selected?.exported_at)} />
                        <SummaryLine label="Odeslano" value={formatDate(selected?.sent_at)} />
                      </div>
                    </div>
                  </CardContent>
                ) : null}
              </Card>
            </div>
          ) : mode === "import" ? (
            <Card className="card-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Import plateb / podkladu</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Importni rezim je zatim zjednoduseny. Slouzi hlavne jako nahled plateb, ktere muzete pouzit pri rucnim vyuctovani.</p>
                {!tenantId ? (
                  <DataState title="Nejprve vyberte najemnika v rucnim rezimu" description="Importni nahled navazuje na vybraneho najemnika a zuctovaci obdobi." actionLabel="Prejit na rucni vyuctovani" onAction={() => setMode("manual")} />
                ) : importRows.length === 0 ? (
                  <DataState title="Pro vybrane obdobi nejsou zadne platby" description="Pokud potrebujete vytvorit vyuctovani, muzete pokracovat rucne a doplnit polozky sami." actionLabel="Prejit na rucni vyuctovani" onAction={() => setMode("manual")} />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Splatnost</TableHead>
                        <TableHead>Castka</TableHead>
                        <TableHead>Uhrazeno</TableHead>
                        <TableHead>Stav</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importRows.map((payment) => (
                        <TableRow key={String(payment.id)}>
                          <TableCell>{formatDate(payment.due_date)}</TableCell>
                          <TableCell>{formatCurrency(payment.amount)}</TableCell>
                          <TableCell>{formatDate(payment.paid_date)}</TableCell>
                          <TableCell>{payment.status}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="card-shadow">
              <CardContent className="p-6">
                <DataState title="Automaticky navrh se pripravuje" description="Jakmile bude hotovy, predvyplni cast udaju a navrhne polozky z plateb a podkladu. Prozatim pouzijte rucni vyuctovani." actionLabel="Prejit na rucni vyuctovani" onAction={() => setMode("manual")} />
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ModeCard({
  title,
  description,
  icon,
  active,
  onClick,
  disabled,
  badge,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cn("text-left", disabled && "cursor-not-allowed")}>
      <Card className={cn("card-shadow transition-colors", active ? "border-primary bg-primary/5" : "hover:bg-accent", disabled && "opacity-70")}>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-medium">
              {icon}
              {title}
            </div>
            {badge ? <Badge variant="secondary">{badge}</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </button>
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

  const remove = (index: number) => {
    onChange(items.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, sort_order: itemIndex })));
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Sluzba / polozka</TableHead>
          <TableHead className="text-right">Prijate zalohy</TableHead>
          <TableHead className="text-right">Skutecne naklady</TableHead>
          <TableHead className="text-right">Rozdil</TableHead>
          <TableHead>Poznamka</TableHead>
          <TableHead className="text-right">Akce</TableHead>
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
            <TableCell className="text-right">
              <Button variant="ghost" size="sm" onClick={() => remove(index)} disabled={items.length === 1}>
                Smazat
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
