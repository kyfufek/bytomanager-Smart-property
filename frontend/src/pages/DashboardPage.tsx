import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Home, AlertTriangle, Plus, ReceiptText, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataState } from "@/components/product/DataState";
import { PageHeader } from "@/components/product/PageHeader";
import { apiFetch } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
};

type PaymentApiItem = {
  id: number | string;
  status: "paid" | "pending" | "overdue";
};

const statusLabelMap: Record<string, string> = {
  uhrazeno: "Zaplaceno",
  "po splatnosti": "Po splatnosti",
  "ceka na platbu": "Ceka na platbu",
};

function formatCurrency(value: number) {
  return `${value.toLocaleString("cs-CZ")} Kc`;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<PropertyApiItem[]>([]);
  const [tenants, setTenants] = useState<TenantApiItem[]>([]);
  const [payments, setPayments] = useState<PaymentApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboardData(signal?: AbortSignal) {
    try {
      setLoading(true);
      setError("");

      const [propertiesRes, tenantsRes, paymentsRes] = await Promise.all([
        apiFetch("/api/properties", { signal }),
        apiFetch("/api/tenants", { signal }),
        apiFetch("/api/payments", { signal }),
      ]);

      if (!propertiesRes.ok || !tenantsRes.ok) {
        throw new Error("Backend request failed");
      }

      const [propertiesData, tenantsData] = await Promise.all([
        propertiesRes.json() as Promise<PropertyApiItem[]>,
        tenantsRes.json() as Promise<TenantApiItem[]>,
      ]);

      const paymentsData = paymentsRes.ok
        ? ((await paymentsRes.json()) as PaymentApiItem[])
        : [];

      setProperties(propertiesData);
      setTenants(tenantsData);
      setPayments(paymentsData);
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

  const kpis = useMemo(() => {
    const totalRent = properties.reduce((sum, p) => sum + Number(p.rent || 0), 0);
    const paidCount = properties.filter((p) => p.paymentStatus === "uhrazeno").length;
    const debtTenants = tenants.filter((t) => Number(t.currentDebt || 0) > 0).length;

    return {
      totalRent,
      paidCount,
      propertiesCount: properties.length,
      tenantsCount: tenants.length,
      debtTenants,
      paidPayments: payments.filter((p) => p.status === "paid").length,
      unpaidPayments: payments.filter((p) => p.status !== "paid").length,
    };
  }, [payments, properties, tenants]);

  const paymentRows = useMemo(() => {
    return properties.map((property) => ({
      key: property.id,
      property: property.name,
      event:
        property.paymentStatus === "uhrazeno"
          ? "Platba prijata"
          : property.paymentStatus === "po splatnosti"
            ? "Platba po splatnosti"
            : "Ceka se na platbu",
      status: property.paymentStatus,
    }));
  }, [properties]);

  const alerts = useMemo(() => {
    const unresolved = properties.filter((item) => item.paymentStatus !== "uhrazeno").length;
    const debt = tenants.filter((item) => Number(item.currentDebt || 0) > 0).length;
    const list: string[] = [];

    if (unresolved > 0) {
      list.push(`${unresolved} nemovitosti cekaji na platbu nebo jsou po splatnosti.`);
    }
    if (debt > 0) {
      list.push(`${debt} najemniku ma evidovany dluh.`);
    }
    if (list.length === 0) {
      list.push("Vsechny sledovane platby jsou aktualne v poradku.");
    }

    return list;
  }, [properties, tenants]);

  const recentActivity = useMemo(() => {
    const propertyEvents = properties.slice(0, 3).map((property) => ({
      id: `property-${property.id}`,
      title: property.name,
      detail:
        property.paymentStatus === "uhrazeno"
          ? "Platba prijata"
          : property.paymentStatus === "po splatnosti"
            ? "Platba po splatnosti"
            : "Ceka na platbu",
    }));

    const tenantEvents = tenants
      .filter((tenant) => Number(tenant.currentDebt || 0) > 0)
      .slice(0, 3)
      .map((tenant) => ({
        id: `tenant-${tenant.id}`,
        title: tenant.name,
        detail: `Evidovan dluh ${formatCurrency(Number(tenant.currentDebt || 0))}`,
      }));

    return [...tenantEvents, ...propertyEvents].slice(0, 5);
  }, [properties, tenants]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Prehled nemovitosti, najemniku a plateb na jednom miste."
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Card className="card-shadow" key={`kpi-skeleton-${index}`}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card className="card-shadow">
              <CardContent className="p-5 flex items-center gap-3">
                <Home className="h-6 w-6 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Nemovitosti</p>
                  <p className="text-2xl font-bold">{kpis.propertiesCount}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="card-shadow">
              <CardContent className="p-5 flex items-center gap-3">
                <Users className="h-6 w-6 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Najemnici</p>
                  <p className="text-2xl font-bold">{kpis.tenantsCount}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="card-shadow">
              <CardContent className="p-5 flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-success" />
                <div>
                  <p className="text-sm text-muted-foreground">Mesicni najem</p>
                  <p className="text-2xl font-bold">{formatCurrency(kpis.totalRent)}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="card-shadow">
              <CardContent className="p-5 flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-warning" />
                <div>
                  <p className="text-sm text-muted-foreground">Najemnici s dluhem</p>
                  <p className="text-2xl font-bold">{kpis.debtTenants}</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="card-shadow lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Stav plateb podle nemovitosti</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={`table-skeleton-${index}`} className="h-10 w-full" />
                ))}
              </div>
            ) : paymentRows.length === 0 ? (
              <DataState
                title="Zatim nejsou zadna data plateb"
                description="Jakmile pridate prvni nemovitosti a najemniky, objevi se zde souhrn plateb."
                actionLabel="Pridat nemovitost"
                onAction={() => navigate("/properties")}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nemovitost</TableHead>
                    <TableHead>Udalost</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentRows.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="font-medium">{row.property}</TableCell>
                      <TableCell>{row.event}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            row.status === "uhrazeno"
                              ? "bg-success/10 text-success border-0"
                              : row.status === "po splatnosti"
                                ? "bg-destructive/10 text-destructive border-0"
                                : "bg-warning/10 text-warning border-0"
                          }
                        >
                          {statusLabelMap[row.status] ?? row.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="card-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Rychle akce</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-between" variant="outline" onClick={() => navigate("/properties")}>
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Pridat nemovitost
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button className="w-full justify-between" variant="outline" onClick={() => navigate("/tenants")}>
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Sprava najemniku
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                className="w-full justify-between"
                variant="outline"
                onClick={() => navigate("/finance/utility-billing")}
              >
                <span className="flex items-center gap-2">
                  <ReceiptText className="h-4 w-4" />
                  Vyuctovani sluzeb
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <Card className="card-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Upozorneni</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.map((item) => (
                <div key={item} className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="card-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Posledni aktivita</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={`activity-skeleton-${index}`} className="h-12 w-full" />
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aktivita se zobrazi po prvnich zmenach v datech.</p>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.detail}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!loading && !error && (
          <Card className="card-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Uhrazene nemovitosti</p>
                <p className="text-xl font-semibold">
                  {kpis.paidCount} / {kpis.propertiesCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Platby: {kpis.paidPayments} uhrazeno / {kpis.unpaidPayments} neuhrazeno
                </p>
              </div>
              <Badge className="bg-primary/10 text-primary border-0">Live API</Badge>
            </CardContent>
          </Card>
      )}
    </div>
  );
}
