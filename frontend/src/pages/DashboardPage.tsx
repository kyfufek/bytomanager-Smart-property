import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CreditCard,
  FileSpreadsheet,
  Plus,
  ReceiptText,
  RefreshCcw,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataState } from "@/components/product/DataState";
import { PageHeader } from "@/components/product/PageHeader";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type PropertyApiItem = {
  id: number | string;
  name: string;
  rent: number;
  paymentStatus: string;
};

type TenantApiItem = {
  id: number | string;
  name: string;
  apartment: string;
  currentDebt: number;
  payment_status?: "paid" | "pending" | "overdue" | "none";
  payment_due_date?: string | null;
};

type PaymentApiItem = {
  id: number | string;
  tenant_id: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  due_date: string;
  paid_date: string | null;
};

type SettlementApiItem = {
  id: string;
  status: "draft" | "calculated" | "reviewed" | "exported" | "sent";
  result_type: "preplatek" | "nedoplatek" | "vyrovnano";
  balance_total: number;
  tenant_name?: string | null;
  property_name?: string | null;
  period_from: string;
  period_to: string;
  created_at: string;
};

function formatCurrency(value: number) {
  return `${Number(value || 0).toLocaleString("cs-CZ")} Kc`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("cs-CZ");
}

function settlementStatusLabel(status: SettlementApiItem["status"]) {
  return {
    draft: "Koncept",
    calculated: "Spocitano",
    reviewed: "Zkontrolovano",
    exported: "Exportovano",
    sent: "Odeslano",
  }[status];
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<PropertyApiItem[]>([]);
  const [tenants, setTenants] = useState<TenantApiItem[]>([]);
  const [payments, setPayments] = useState<PaymentApiItem[]>([]);
  const [settlements, setSettlements] = useState<SettlementApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  async function loadDashboardData(signal?: AbortSignal) {
    try {
      setLoading(true);
      setError("");

      const [propertiesRes, tenantsRes, paymentsRes, settlementsRes] = await Promise.all([
        apiFetch("/api/properties", { signal }),
        apiFetch("/api/tenants", { signal }),
        apiFetch("/api/payments", { signal }),
        apiFetch("/api/billing/settlements", { signal }),
      ]);

      if (!propertiesRes.ok || !tenantsRes.ok || !paymentsRes.ok) {
        throw new Error("Backend request failed");
      }

      const [propertiesData, tenantsData, paymentsData] = await Promise.all([
        propertiesRes.json() as Promise<PropertyApiItem[]>,
        tenantsRes.json() as Promise<TenantApiItem[]>,
        paymentsRes.json() as Promise<PaymentApiItem[]>,
      ]);

      setProperties(propertiesData);
      setTenants(tenantsData);
      setPayments(paymentsData);

      if (settlementsRes.ok) {
        const settlementsData = (await settlementsRes.json()) as SettlementApiItem[];
        setSettlements(settlementsData);
      } else {
        setSettlements([]);
      }

      setLastUpdatedAt(new Date());
    } catch {
      if (signal?.aborted) return;
      setError("Data se nepodarilo nacist. Zkontrolujte pripojeni k backendu a zkuste to znovu.");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    loadDashboardData(controller.signal);
    return () => controller.abort();
  }, []);

  const tenantNameMap = useMemo(() => {
    const map = new Map<string, string>();
    tenants.forEach((tenant) => map.set(String(tenant.id), tenant.name));
    return map;
  }, [tenants]);

  const kpis = useMemo(() => {
    const monthlyRent = properties.reduce((sum, property) => sum + Number(property.rent || 0), 0);
    const unpaidPayments = payments.filter((payment) => payment.status !== "paid").length;
    const overdueTenants = tenants.filter((tenant) => {
      const debt = Number(tenant.currentDebt || 0) > 0;
      const overdue = tenant.payment_status === "overdue";
      return debt || overdue;
    }).length;
    const activeSettlements = settlements.filter((settlement) => settlement.status !== "sent").length;

    return {
      propertiesCount: properties.length,
      tenantsCount: tenants.length,
      monthlyRent,
      unpaidPayments,
      overdueTenants,
      activeSettlements,
    };
  }, [payments, properties, settlements, tenants]);

  const recentPaidPayments = useMemo(() => {
    return payments
      .filter((payment) => payment.status === "paid")
      .sort((a, b) => +new Date(b.paid_date ?? b.due_date) - +new Date(a.paid_date ?? a.due_date))
      .slice(0, 5);
  }, [payments]);

  const overdueTenantRows = useMemo(() => {
    return tenants
      .filter((tenant) => tenant.payment_status === "overdue" || Number(tenant.currentDebt || 0) > 0)
      .sort((a, b) => Number(b.currentDebt || 0) - Number(a.currentDebt || 0))
      .slice(0, 6);
  }, [tenants]);

  const activeSettlementRows = useMemo(() => {
    return settlements
      .filter((settlement) => settlement.status !== "sent")
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      .slice(0, 5);
  }, [settlements]);

  const alerts = useMemo(() => {
    const items: { tone: "danger" | "warning" | "neutral"; text: string }[] = [];

    if (kpis.overdueTenants > 0) {
      items.push({ tone: "danger", text: `${kpis.overdueTenants} najemniku je po splatnosti nebo ma dluh.` });
    }
    if (kpis.unpaidPayments > 0) {
      items.push({ tone: "warning", text: `${kpis.unpaidPayments} plateb ceka na uhradu.` });
    }
    if (kpis.activeSettlements > 0) {
      items.push({ tone: "neutral", text: `${kpis.activeSettlements} vyuctovani je aktivnich (nedokoncenych).` });
    }
    if (items.length === 0) {
      items.push({ tone: "neutral", text: "Aktualne nejsou zadna kriticka upozorneni." });
    }

    return items;
  }, [kpis.activeSettlements, kpis.overdueTenants, kpis.unpaidPayments]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Aktualni stav plateb, najemniku a vyuctovani na jednom miste."
        actions={
          <div className="flex items-center gap-2">
            {lastUpdatedAt ? (
              <span className="text-xs text-muted-foreground">
                Aktualizovano: {lastUpdatedAt.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
              </span>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || refreshing}
              onClick={async () => {
                try {
                  setRefreshing(true);
                  await loadDashboardData();
                } finally {
                  setRefreshing(false);
                }
              }}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              {refreshing ? "Obnovuji..." : "Obnovit"}
            </Button>
          </div>
        }
      />

      {error && !loading ? (
        <DataState
          variant="error"
          title="Dashboard se nepodarilo nacist"
          description={error}
          actionLabel="Zkusit znovu"
          onAction={() => loadDashboardData()}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <Card className="card-shadow" key={`kpi-skeleton-${index}`}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <KpiCard icon={<Building2 className="h-5 w-5 text-primary" />} label="Nemovitosti" value={String(kpis.propertiesCount)} />
            <KpiCard icon={<Users className="h-5 w-5 text-primary" />} label="Najemnici" value={String(kpis.tenantsCount)} />
            <KpiCard icon={<CreditCard className="h-5 w-5 text-success" />} label="Mesicni najemne" value={formatCurrency(kpis.monthlyRent)} />
            <KpiCard icon={<AlertTriangle className="h-5 w-5 text-warning" />} label="Neuhrazene platby" value={String(kpis.unpaidPayments)} />
            <KpiCard icon={<Users className="h-5 w-5 text-destructive" />} label="Najemnici po splatnosti" value={String(kpis.overdueTenants)} />
            <KpiCard icon={<FileSpreadsheet className="h-5 w-5 text-primary" />} label="Aktivni vyuctovani" value={String(kpis.activeSettlements)} />
          </>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card className="card-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Posledni prijate platby</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={`paid-skeleton-${index}`} className="h-10 w-full" />
                  ))}
                </div>
              ) : recentPaidPayments.length === 0 ? (
                <DataState
                  title="Zatim nejsou zadne prijate platby"
                  description="Jakmile bude prvni platba uhrazena, objevi se zde."
                  actionLabel="Pridat platbu"
                  onAction={() => navigate("/finance")}
                />
              ) : (
                <div className="space-y-2">
                  {recentPaidPayments.map((payment) => (
                    <div key={String(payment.id)} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{tenantNameMap.get(payment.tenant_id) || "Neznamy najemnik"}</p>
                        <p className="text-xs text-muted-foreground">Uhrazeno: {formatDate(payment.paid_date)}</p>
                      </div>
                      <p className="text-sm font-semibold text-success">{formatCurrency(payment.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="card-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Najemnici po splatnosti</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={`overdue-skeleton-${index}`} className="h-10 w-full" />
                  ))}
                </div>
              ) : overdueTenantRows.length === 0 ? (
                <DataState
                  title="Skvele, nikdo neni po splatnosti"
                  description="Aktualne nejsou evidovani najemnici po splatnosti."
                />
              ) : (
                <div className="space-y-2">
                  {overdueTenantRows.map((tenant) => (
                    <div key={String(tenant.id)} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{tenant.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {tenant.apartment || "Bez bytu"} | splatnost: {formatDate(tenant.payment_due_date ?? null)}
                        </p>
                      </div>
                      <Badge className={cn("border-0", Number(tenant.currentDebt || 0) > 0 ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning")}>
                        {Number(tenant.currentDebt || 0) > 0 ? `Dluh ${formatCurrency(Number(tenant.currentDebt || 0))}` : "Po splatnosti"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="card-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Rychle akce</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <QuickAction icon={<Plus className="h-4 w-4" />} label="Pridat nemovitost" onClick={() => navigate("/properties")} />
              <QuickAction icon={<Users className="h-4 w-4" />} label="Pridat najemnika" onClick={() => navigate("/tenants")} />
              <QuickAction icon={<CreditCard className="h-4 w-4" />} label="Pridat platbu" onClick={() => navigate("/finance")} />
              <QuickAction icon={<ReceiptText className="h-4 w-4" />} label="Vytvorit vyuctovani" onClick={() => navigate("/finance/utility-billing")} />
            </CardContent>
          </Card>

          <Card className="card-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Upozorneni</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.map((item, index) => (
                <div
                  key={`alert-${index}`}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm",
                    item.tone === "danger" && "border-destructive/30 bg-destructive/5",
                    item.tone === "warning" && "border-warning/40 bg-warning/5",
                    item.tone === "neutral" && "bg-muted/40",
                  )}
                >
                  {item.text}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="card-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Aktivni vyuctovani</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={`settlement-skeleton-${index}`} className="h-10 w-full" />
                  ))}
                </div>
              ) : activeSettlementRows.length === 0 ? (
                <DataState
                  title="Zatim nejsou aktivni vyuctovani"
                  description="Prvni vyuctovani muzete vytvorit v modulu Vyuctovani sluzeb."
                  actionLabel="Otevrit vyuctovani"
                  onAction={() => navigate("/finance/utility-billing")}
                />
              ) : (
                <div className="space-y-2">
                  {activeSettlementRows.map((settlement) => (
                    <div key={settlement.id} className="rounded-md border px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{settlement.tenant_name || "Bez najemnika"}</p>
                        <Badge variant="secondary">{settlementStatusLabel(settlement.status)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(settlement.period_from)} - {formatDate(settlement.period_to)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="card-shadow">
      <CardContent className="p-5 flex items-center gap-3">
        <div className="shrink-0">{icon}</div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <Button className="w-full justify-between" variant="outline" onClick={onClick}>
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <ArrowRight className="h-4 w-4" />
    </Button>
  );
}
