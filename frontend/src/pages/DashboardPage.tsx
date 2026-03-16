import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Users, Home, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PropertyApiItem = {
  id: number;
  name: string;
  rent: number;
  paymentStatus: string;
};

type TenantApiItem = {
  id: number;
  name: string;
  apartment: string;
  deposit: number;
  currentDebt: number;
};

const statusLabelMap: Record<string, string> = {
  uhrazeno: "Zaplaceno",
  "po splatnosti": "Po splatnosti",
  "ceka na platbu": "Ceka na platbu",
};

export default function DashboardPage() {
  const [properties, setProperties] = useState<PropertyApiItem[]>([]);
  const [tenants, setTenants] = useState<TenantApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboardData() {
      try {
        setLoading(true);
        setError("");

        const [propertiesRes, tenantsRes] = await Promise.all([
          fetch("http://localhost:5000/api/properties", { signal: controller.signal }),
          fetch("http://localhost:5000/api/tenants", { signal: controller.signal }),
        ]);

        if (!propertiesRes.ok || !tenantsRes.ok) {
          throw new Error("Backend request failed");
        }

        const [propertiesData, tenantsData] = await Promise.all([
          propertiesRes.json() as Promise<PropertyApiItem[]>,
          tenantsRes.json() as Promise<TenantApiItem[]>,
        ]);

        setProperties(propertiesData);
        setTenants(tenantsData);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        setError("Nepodarilo se nacist data dashboardu z backendu.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadDashboardData();
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
    };
  }, [properties, tenants]);

  const recentRows = useMemo(() => {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Prehled nemovitosti a najemniku z backend API.</p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Nacitam data...</p>}
      {!loading && error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              <p className="text-2xl font-bold">{kpis.totalRent.toLocaleString("cs-CZ")} Kc</p>
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
      </div>

      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-base">Stav plateb podle nemovitosti</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nemovitost</TableHead>
                <TableHead>Udalost</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentRows.map((row) => (
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
          {!loading && !error && recentRows.length === 0 && (
            <p className="text-sm text-muted-foreground pt-3">Zatim nejsou dostupna zadna data.</p>
          )}
        </CardContent>
      </Card>

      <Card className="card-shadow">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Uhrazene nemovitosti</p>
            <p className="text-xl font-semibold">
              {kpis.paidCount} / {kpis.propertiesCount}
            </p>
          </div>
          <Badge className="bg-primary/10 text-primary border-0">Live API</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
