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
type NumericFieldValue = number | "";

type TenantItem = { id: string; full_name: string; property_id: string | null };
type PropertyItem = { id: string; name: string };
type PaymentItem = { id?: string; tenant_id: string; property_id?: string | null; amount: number; status: string; due_date: string; paid_date: string | null; note?: string | null; payment_type?: string | null };
type AllocationMethod = "persons" | "area" | "meter" | "fixed";
type SettlementItem = { id?: string; service_name: string; allocation_method?: AllocationMethod; advances_paid: NumericFieldValue; actual_cost: NumericFieldValue; difference: number; note: string | null; sort_order: number };
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
  advance_payment_ids?: string[];
  items?: SettlementItem[];
};

const baseItems: SettlementItem[] = [
  { service_name: "Voda a stocne", allocation_method: "meter", advances_paid: 0, actual_cost: 0, difference: 0, note: null, sort_order: 0 },
  { service_name: "Teplo", allocation_method: "area", advances_paid: 0, actual_cost: 0, difference: 0, note: null, sort_order: 1 },
  { service_name: "Tepla voda", allocation_method: "meter", advances_paid: 0, actual_cost: 0, difference: 0, note: null, sort_order: 2 },
  { service_name: "Elektrina spolecnych prostor", allocation_method: "area", advances_paid: 0, actual_cost: 0, difference: 0, note: null, sort_order: 3 },
  { service_name: "Uklid spolecnych prostor", allocation_method: "area", advances_paid: 0, actual_cost: 0, difference: 0, note: null, sort_order: 4 },
  { service_name: "Odvoz odpadu", allocation_method: "persons", advances_paid: 0, actual_cost: 0, difference: 0, note: null, sort_order: 5 },
  { service_name: "Vytah", allocation_method: "persons", advances_paid: 0, actual_cost: 0, difference: 0, note: null, sort_order: 6 },
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
    allocation_method: item.allocation_method ?? "fixed",
    sort_order: index,
    difference: Number(item.advances_paid || 0) - Number(item.actual_cost || 0),
  }));
}

function allocationMethodLabel(value: AllocationMethod | undefined) {
  return {
    persons: "Podle osob",
    area: "Podle plochy",
    meter: "Podle meridla",
    fixed: "Pevna castka",
  }[value ?? "fixed"];
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paymentTypeLooksLikeUtilityAdvance(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return false;
  return ["service", "services", "utility", "utilities", "zalohy", "zaloha", "sluzby", "sluzba"].some((token) => normalized.includes(token));
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
  const [selectedAdvancePaymentIds, setSelectedAdvancePaymentIds] = useState<string[]>([]);
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
  const inlinePeriodError = periodFrom || periodTo ? periodError : null;

  const paymentsInPeriod = useMemo(() => {
    return payments.filter((payment) => {
      if (payment.tenant_id !== tenantId) return false;
      if (propertyId && payment.property_id && payment.property_id !== propertyId) return false;
      if (!periodFrom || !periodTo) return true;
      return payment.due_date >= periodFrom && payment.due_date <= periodTo;
    });
  }, [payments, periodFrom, periodTo, propertyId, tenantId]);

  const defaultAdvancePaymentIds = useMemo(() => {
    const paidPayments = paymentsInPeriod.filter((payment) => payment.status === "paid" && payment.id);
    const utilityTaggedPayments = paidPayments.filter((payment) => paymentTypeLooksLikeUtilityAdvance(payment.payment_type));
    return (utilityTaggedPayments.length > 0 ? utilityTaggedPayments : paidPayments).map((payment) => String(payment.id));
  }, [paymentsInPeriod]);
  const usesLoadedSettlementContext = Boolean(
    selectedId
    && selected
    && tenantId === selected.tenant_id
    && propertyId === selected.property_id
    && periodFrom === selected.period_from
    && periodTo === selected.period_to,
  );

  useEffect(() => {
    setSelectedAdvancePaymentIds(
      usesLoadedSettlementContext && selected?.advance_payment_ids?.length
        ? selected.advance_payment_ids
        : defaultAdvancePaymentIds,
    );
  }, [defaultAdvancePaymentIds, selected?.advance_payment_ids, usesLoadedSettlementContext]);

  const selectedAdvancePayments = useMemo(() => {
    const selectedIds = new Set(selectedAdvancePaymentIds);
    return paymentsInPeriod.filter((payment) => payment.status === "paid" && payment.id && selectedIds.has(String(payment.id)));
  }, [paymentsInPeriod, selectedAdvancePaymentIds]);

  const computedAdvances = useMemo(() => {
    return selectedAdvancePayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }, [selectedAdvancePayments]);

  const actualTotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.actual_cost || 0), 0), [items]);
  const balance = computedAdvances - actualTotal;
  const resultType: ResultType = Math.abs(balance) < 1 ? "vyrovnano" : balance >= 0 ? "preplatek" : "nedoplatek";
  const activeTenantName = selectedTenant?.full_name ?? "-";
  const activePropertyName = selectedProperty?.name ?? "-";

  const filteredHistory = useMemo(() => {
    return history.filter((settlement) => historyStatusFilter === "all" || settlement.status === historyStatusFilter);
  }, [history, historyStatusFilter]);

  const importRows = useMemo(() => paymentsInPeriod, [paymentsInPeriod]);
  const importPaidTotal = useMemo(() => importRows.filter((payment) => payment.status === "paid").reduce((sum, payment) => sum + Number(payment.amount || 0), 0), [importRows]);
  const issueDate = selected?.created_at ? selected.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const settlementDueDate = useMemo(() => {
    const baseDate = issueDate ? new Date(`${issueDate}T00:00:00.000Z`) : new Date();
    baseDate.setUTCDate(baseDate.getUTCDate() + 30);
    return baseDate.toISOString().slice(0, 10);
  }, [issueDate]);

  function toggleAdvancePayment(paymentId: string) {
    setSelectedAdvancePaymentIds((current) => (
      current.includes(paymentId)
        ? current.filter((item) => item !== paymentId)
        : [...current, paymentId]
    ));
  }

  function selectAllAdvancePayments() {
    setSelectedAdvancePaymentIds(defaultAdvancePaymentIds);
  }

  function clearAdvancePayments() {
    setSelectedAdvancePaymentIds([]);
  }

  function transferImportSummaryToNotes() {
    const lines = selectedAdvancePayments.map((payment) => `- ${formatDate(payment.due_date)} | ${formatCurrency(payment.amount)} | zahrnuto do zaloh${payment.note ? ` | ${payment.note}` : ""}`);
    const summary = [`Import podkladu pro vyuctovani:`, `- vybrane zalohy: ${selectedAdvancePayments.length} plateb / ${formatCurrency(computedAdvances)}`, ...lines].join("\n");
    setNotes((current) => (current.trim() ? `${current}\n\n${summary}` : summary));
    setMode("manual");
    toast({ title: "Podklady preneseny", description: "Souhrn importnich plateb byl vlozen do interni poznamky vyuctovani." });
  }

  function openPdfPreview() {
    if (!tenantId || !propertyId || periodError) {
      toast({ title: "PDF nelze vygenerovat", description: "Doplnte zakladni udaje a validni obdobi vyuctovani.", variant: "destructive" });
      return;
    }

    const preview = window.open("", "_blank", "noopener,noreferrer,width=1100,height=900");
    if (!preview) {
      toast({ title: "Okno s PDF se nepodarilo otevrit", description: "Zkontrolujte blokovani vyskakovacich oken v prohlizeci.", variant: "destructive" });
      return;
    }

    const safeTitle = escapeHtml(title || "Vyuctovani sluzeb");
    const safeTenantName = escapeHtml(activeTenantName);
    const safePropertyName = escapeHtml(activePropertyName);
    const safeIssueDate = escapeHtml(formatDate(issueDate));
    const safeSettlementDueDate = escapeHtml(formatDate(settlementDueDate));
    const safePeriodLabel = escapeHtml(`${formatDate(periodFrom)} - ${formatDate(periodTo)}`);
    const safeAdvancesSummary = escapeHtml(`${selectedAdvancePayments.length} uhrazenych plateb / ${formatCurrency(computedAdvances)}`);
    const safeNotes = escapeHtml(notes || "Bez poznamky").replace(/\n/g, "<br/>");

    const rowsHtml = items
      .map((item) => `
        <tr>
          <td>${escapeHtml(item.service_name || "-")}</td>
          <td>${escapeHtml(allocationMethodLabel(item.allocation_method))}</td>
          <td style="text-align:right;">${escapeHtml(formatCurrency(item.advances_paid))}</td>
          <td style="text-align:right;">${escapeHtml(formatCurrency(item.actual_cost))}</td>
          <td style="text-align:right;">${escapeHtml(formatCurrency(Math.abs(item.difference)))}</td>
          <td>${escapeHtml(item.note || "-")}</td>
        </tr>
      `)
      .join("");

    preview.document.write(`
      <html>
        <head>
          <title>${safeTitle}</title>
          <style>
            @page { size: A4; margin: 14mm; }
            body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
            h1, h2 { margin: 0 0 12px; }
            p { margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #d1d5db; padding: 10px; font-size: 13px; vertical-align: top; }
            th { background: #f3f4f6; text-align: left; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
            .box { border: 1px solid #d1d5db; padding: 12px; border-radius: 8px; }
            .summary { margin-top: 20px; }
            .topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
            .hint { color: #4b5563; font-size: 12px; }
            .pill { display: inline-flex; align-items: center; border-radius: 999px; background: #f3f4f6; padding: 6px 10px; font-size: 12px; font-weight: 700; }
            @media print {
              body { padding: 0; }
              .topbar .hint { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="topbar">
            <div>
              <h1>${safeTitle}</h1>
              <p><strong>Najemnik:</strong> ${safeTenantName}</p>
              <p><strong>Nemovitost / jednotka:</strong> ${safePropertyName}</p>
            </div>
            <div>
              <span class="pill">${escapeHtml(statusLabel(selected?.status ?? "draft"))}</span>
              <p class="hint">Po otevreni dialogu vyberte "Ulozit jako PDF".</p>
            </div>
          </div>

          <p><strong>Zuctovaci obdobi:</strong> ${safePeriodLabel}</p>
          <p><strong>Datum vystaveni:</strong> ${safeIssueDate}</p>
          <p><strong>Termin vyporadani:</strong> ${safeSettlementDueDate}</p>
          <p><strong>Zalohy zahrnute do souhrnu:</strong> ${safeAdvancesSummary}</p>

          <table>
            <thead>
              <tr>
                <th>Sluzba / polozka</th>
                <th>Zpusob rozuctovani</th>
                <th>Prijate zalohy</th>
                <th>Skutecne naklady</th>
                <th>Rozdil</th>
                <th>Poznamka / podklad</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>

          <div class="grid summary">
            <div class="box"><strong>Prijate zalohy</strong><p>${escapeHtml(formatCurrency(computedAdvances))}</p></div>
            <div class="box"><strong>Skutecne naklady</strong><p>${escapeHtml(formatCurrency(actualTotal))}</p></div>
            <div class="box"><strong>Vysledek</strong><p>${escapeHtml(resultLabel(resultType))} ${escapeHtml(formatCurrency(Math.abs(balance)))}</p></div>
            <div class="box"><strong>Stav workflow</strong><p>${escapeHtml(statusLabel(selected?.status ?? "draft"))}</p></div>
          </div>

          <div class="box" style="margin-top:20px;">
            <strong>Poznamka / podklady</strong>
            <p>${safeNotes}</p>
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => window.print(), 150);
            };
          </script>
        </body>
      </html>
    `);
    preview.document.close();
    preview.focus();
    toast({ title: "PDF pripraveno", description: "Otevrelo se tiskove okno. V dialogu zvolte Ulozit jako PDF." });
  }

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
    setSelectedAdvancePaymentIds([]);
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
    setSelectedAdvancePaymentIds(detail.advance_payment_ids ?? []);
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
      const payload = {
        tenant_id: tenantId,
        property_id: propertyId,
        period_from: periodFrom,
        period_to: periodTo,
        title,
        notes,
        status: nextStatus,
        items: normalizeSettlementItems(items),
        advance_payment_ids: selectedAdvancePaymentIds,
      };
      const response = selectedId
        ? await apiFetch(`/api/billing/settlements/${selectedId}`, { method: "PUT", body: JSON.stringify(payload) })
        : await apiFetch("/api/billing/settlements", { method: "POST", body: JSON.stringify(payload) });
      if (!response.ok) throw new Error("save-failed");

      const detail = (await response.json()) as Settlement;
      setSelectedId(detail.id);
      setSelected(detail);
      setItems(detail.items?.length ? detail.items : normalizeSettlementItems(items));
      setSelectedAdvancePaymentIds(detail.advance_payment_ids ?? selectedAdvancePaymentIds);
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
                <CardContent className="space-y-4">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium">Nazev vyuctovani</label>
                        <Input
                          value={title}
                          onChange={(event) => setTitle(event.target.value)}
                          placeholder="Nazev vyuctovani"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Najemnik</label>
                        <select
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Nemovitost / jednotka</label>
                        <select
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={propertyId}
                          onChange={(event) => setPropertyId(event.target.value)}
                        >
                          <option value="">Vyberte nemovitost</option>
                          {properties.map((property) => (
                            <option key={property.id} value={property.id}>
                              {property.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Obdobi od</label>
                        <Input type="date" value={periodFrom} onChange={(event) => setPeriodFrom(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Obdobi do</label>
                        <Input type="date" value={periodTo} onChange={(event) => setPeriodTo(event.target.value)} />
                      </div>
                    </div>

                    <div className="rounded-lg border bg-muted/20 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Stav workflow</p>
                          <Badge variant="secondary">{statusLabel(selected?.status ?? "draft")}</Badge>
                        </div>
                        <Button variant="outline" onClick={() => resetDraft()}>
                          Novy koncept
                        </Button>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                        <SummaryLine label="Najemnik" value={selectedTenant?.full_name ?? "Nevybran"} />
                        <SummaryLine label="Nemovitost / jednotka" value={selectedProperty?.name ?? "Nevybrana"} />
                        <SummaryLine
                          label="Zuctovaci obdobi"
                          value={
                            periodFrom && periodTo
                              ? `${formatDate(periodFrom)} - ${formatDate(periodTo)}`
                              : "Zatim nedoplneno"
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Interni poznamka</label>
                    <Textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Interni poznamka k vyuctovani"
                      rows={4}
                    />
                  </div>

                  {inlinePeriodError ? <p className="text-sm text-destructive">{inlinePeriodError}</p> : null}
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
                    <SummaryLine label="Najemnik" value={activeTenantName} />
                    <SummaryLine label="Nemovitost / jednotka" value={activePropertyName} />
                    <SummaryLine label="Prijate zalohy" value={formatCurrency(computedAdvances)} />
                    <SummaryLine label="Skutecne naklady" value={formatCurrency(actualTotal)} />
                    <SummaryLine label="Preplatek / nedoplatek" value={`${resultLabel(resultType)} ${formatCurrency(Math.abs(balance))}`} tone={resultType === "nedoplatek" ? "danger" : "success"} />
                    <SummaryLine label="Stav workflow" value={statusLabel(selected?.status ?? "draft")} />
                    <SummaryLine label="Obdobi" value={`${formatDate(periodFrom)} - ${formatDate(periodTo)}`} />
                    <SummaryLine label="PDF podklad" value={`${items.filter((item) => item.service_name.trim()).length} polozek / ${selectedAdvancePayments.length} zaloh`} />
                    <SummaryLine label="Datum vystaveni" value={formatDate(issueDate)} />
                    <SummaryLine label="Termin vyporadani" value={formatDate(settlementDueDate)} />
                  </div>

                  <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                    PDF vznikne z aktualne vybraneho najemnika, jednotky, zuctovaciho obdobi, teto tabulky polozek a z prave vypocteneho souhrnu. Do souhrnu zaloh se zapocitavaji jen vybrane uhrazene platby z importu.
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
                    <Button variant="cta" disabled={saving || !tenantId || !propertyId || Boolean(periodError)} onClick={openPdfPreview}>
                      <Download className="mr-2 h-4 w-4" />
                      Generovat PDF
                    </Button>
                    <Button variant="outline" disabled={saving || !selectedId || !canPersistSettlements} onClick={() => updateStatus("exported")}>
                      <Download className="mr-2 h-4 w-4" />
                      Oznacit jako exportovane
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
                    <p className="text-sm text-muted-foreground">Generovat PDF otevre tiskovy dialog i bez backend exportu. Workflow akce jako exportovane nebo odeslane ale zustavaji vypnute, dokud nebude dostupna formalni settlement cast backendu a DB.</p>
                  ) : !selectedId ? (
                    <p className="text-sm text-muted-foreground">Postup je jednoduchy: vyplnte udaje, doplnte polozky, spocitejte vysledek a pak otevrete tiskovy dialog pro ulozeni do PDF. Pro zaznamenani do workflow je potom potreba koncept ulozit.</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Generovat PDF otevira tiskovy dialog z aktualniho formulare a tabulky polozek. Tlacitko Oznacit jako exportovane zaznamena stav ve workflow.</p>
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
                <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Pomocny vstup pro rucni vyuctovani</p>
                    <p className="text-sm text-muted-foreground">Platby se filtruji podle najemnika, jednotky a zuctovaciho obdobi. Oznacene uhrazene platby se zapocitavaji do souhrnu zaloh, ostatni mohou zustat jen jako podklad.</p>
                  </div>
                  <div className="grid gap-2 text-sm text-muted-foreground md:min-w-[260px]">
                    <div><span className="font-medium text-foreground">Najemnik:</span> {selectedTenant?.full_name || "Nevybran"}</div>
                    <div><span className="font-medium text-foreground">Nemovitost / jednotka:</span> {selectedProperty?.name || "Nevybrana"}</div>
                    <div><span className="font-medium text-foreground">Obdobi:</span> {periodFrom ? formatDate(periodFrom) : "-"} - {periodTo ? formatDate(periodTo) : "-"}</div>
                    <div><span className="font-medium text-foreground">Uhrazene platby v obdobi:</span> {formatCurrency(importPaidTotal)}</div>
                    <div><span className="font-medium text-foreground">Vybrane zalohy do souhrnu:</span> {formatCurrency(computedAdvances)}</div>
                  </div>
                </div>
                {!tenantId ? (
                  <DataState title="Nejprve vyberte najemnika v rucnim rezimu" description="Importni nahled navazuje na vybraneho najemnika a zuctovaci obdobi." actionLabel="Prejit na rucni vyuctovani" onAction={() => setMode("manual")} />
                ) : importRows.length === 0 ? (
                  <DataState title="Pro vybrane obdobi nejsou zadne platby" description="Pokud potrebujete vytvorit vyuctovani, muzete pokracovat rucne a doplnit polozky sami." actionLabel="Prejit na rucni vyuctovani" onAction={() => setMode("manual")} />
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="text-sm text-muted-foreground">
                        Oznacte, ktere uhrazene platby se maji pouzit jako zalohy do vyuctovani. Vyber se propsise do souhrnu i do PDF nahledu, ale jednotlive polozky sluzeb zustavaji editovatelne rucne.
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={selectAllAdvancePayments}>
                          Vybrat vsechny uhrazene
                        </Button>
                        <Button variant="outline" onClick={clearAdvancePayments}>
                          Vymazat vyber
                        </Button>
                        <Button variant="outline" onClick={transferImportSummaryToNotes}>
                          Prenest souhrn do poznamky
                        </Button>
                      </div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pouzit</TableHead>
                          <TableHead>Splatnost</TableHead>
                          <TableHead>Najemnik / jednotka</TableHead>
                          <TableHead>Castka</TableHead>
                          <TableHead>Uhrazeno</TableHead>
                          <TableHead>Stav</TableHead>
                          <TableHead>Pouziti</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importRows.map((payment) => (
                          <TableRow key={String(payment.id)}>
                            <TableCell>
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-input"
                                checked={payment.status === "paid" && payment.id ? selectedAdvancePaymentIds.includes(String(payment.id)) : false}
                                disabled={payment.status !== "paid" || !payment.id}
                                onChange={() => payment.id && toggleAdvancePayment(String(payment.id))}
                              />
                            </TableCell>
                            <TableCell>{formatDate(payment.due_date)}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="font-medium">{selectedTenant?.full_name || "-"}</div>
                                <div className="text-xs text-muted-foreground">{selectedProperty?.name || "Bez prirazene jednotky"}</div>
                              </div>
                            </TableCell>
                            <TableCell>{formatCurrency(payment.amount)}</TableCell>
                            <TableCell>{formatDate(payment.paid_date)}</TableCell>
                            <TableCell>
                              <Badge variant={payment.status === "paid" ? "default" : "secondary"}>{payment.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <Badge variant="outline">
                                  {payment.status === "paid" && payment.id && selectedAdvancePaymentIds.includes(String(payment.id)) ? "Zahrnuto do zaloh" : "Jen podklad"}
                                </Badge>
                                {payment.payment_type ? <div className="text-xs text-muted-foreground">Typ platby: {payment.payment_type}</div> : null}
                                {payment.note ? <div className="text-xs text-muted-foreground">{payment.note}</div> : <div className="text-xs text-muted-foreground">Bez doplnujici poznamky</div>}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
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
        const normalizedAdvances = Number(next.advances_paid || 0);
        const normalizedActualCost = Number(next.actual_cost || 0);
        next.difference = normalizedAdvances - normalizedActualCost;
        return next;
      }),
    );
  };

  const updateNumericField = (index: number, field: "advances_paid" | "actual_cost", value: string) => {
    onChange(
      items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const parsedValue = value === "" ? "" : Number(value);
        const next = { ...item, [field]: parsedValue } as SettlementItem;
        const normalizedAdvances = Number(next.advances_paid || 0);
        const normalizedActualCost = Number(next.actual_cost || 0);
        next.difference = normalizedAdvances - normalizedActualCost;
        return next;
      }),
    );
  };

  const restoreNumericFieldDefault = (index: number, field: "advances_paid" | "actual_cost") => {
    const currentValue = items[index]?.[field];
    if (currentValue !== "") return;
    updateNumericField(index, field, "0");
  };

  const remove = (index: number) => {
    onChange(items.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, sort_order: itemIndex })));
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Sluzba / polozka</TableHead>
          <TableHead>Zpusob rozuctovani</TableHead>
          <TableHead className="text-right">Prijate zalohy</TableHead>
          <TableHead className="text-right">Skutecne naklady</TableHead>
          <TableHead className="text-right">Rozdil</TableHead>
          <TableHead>Poznamka / podklad</TableHead>
          <TableHead className="text-right">Akce</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, index) => (
          <TableRow key={item.id ?? `row-${index}`}>
            <TableCell>
              <Input value={item.service_name} onChange={(event) => update(index, "service_name", event.target.value)} />
            </TableCell>
            <TableCell>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={item.allocation_method || "fixed"}
                onChange={(event) => update(index, "allocation_method", event.target.value as AllocationMethod)}
              >
                <option value="persons">Podle osob</option>
                <option value="area">Podle plochy</option>
                <option value="meter">Podle meridla</option>
                <option value="fixed">Pevna castka</option>
              </select>
            </TableCell>
            <TableCell>
              <Input
                type="number"
                className="text-right"
                value={item.advances_paid}
                onChange={(event) => updateNumericField(index, "advances_paid", event.target.value)}
                onBlur={() => restoreNumericFieldDefault(index, "advances_paid")}
              />
            </TableCell>
            <TableCell>
              <Input
                type="number"
                className="text-right"
                value={item.actual_cost}
                onChange={(event) => updateNumericField(index, "actual_cost", event.target.value)}
                onBlur={() => restoreNumericFieldDefault(index, "actual_cost")}
              />
            </TableCell>
            <TableCell className={cn("text-right font-medium", item.difference < 0 ? "text-destructive" : item.difference > 0 ? "text-success" : "text-muted-foreground")}>
              {formatCurrency(Math.abs(item.difference))}
            </TableCell>
            <TableCell>
              <Input value={item.note || ""} onChange={(event) => update(index, "note", event.target.value)} placeholder="Faktura, odecty meridel, podklad SVJ..." />
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
