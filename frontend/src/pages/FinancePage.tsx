import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Plus, AlertTriangle } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { DataState } from "@/components/product/DataState";
import { PageHeader } from "@/components/product/PageHeader";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PaymentStatus = "paid" | "pending" | "overdue";

type PaymentItem = {
  id: string;
  tenant_id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: PaymentStatus;
  note: string | null;
};

type TenantItem = {
  id: string;
  name: string;
};

const statusLabelMap: Record<PaymentStatus, string> = {
  paid: "Uhrazeno",
  pending: "Ceka na uhradu",
  overdue: "Po splatnosti",
};

function statusClassName(status: PaymentStatus) {
  if (status === "paid") return "bg-success/10 text-success border-0";
  if (status === "overdue") return "bg-destructive/10 text-destructive border-0";
  return "bg-warning/10 text-warning border-0";
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("cs-CZ");
}

function formatCurrency(value: number) {
  return `${Number(value || 0).toLocaleString("cs-CZ")} Kc`;
}

export default function FinancePage() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null);
  const [createTenantId, setCreateTenantId] = useState("");
  const [createAmount, setCreateAmount] = useState("");
  const [createDueDate, setCreateDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [createPaidDate, setCreatePaidDate] = useState("");
  const [createNote, setCreateNote] = useState("");
  const [createError, setCreateError] = useState("");

  async function loadFinance(signal?: AbortSignal) {
    try {
      setLoading(true);
      setError("");
      const [paymentsRes, tenantsRes] = await Promise.all([
        apiFetch("/api/payments", { signal }),
        apiFetch("/api/tenants", { signal }),
      ]);

      if (!tenantsRes.ok) {
        throw new Error("Tenants request failed");
      }

      const tenantsData = (await tenantsRes.json()) as TenantItem[];
      const paymentsData = paymentsRes.ok
        ? ((await paymentsRes.json()) as PaymentItem[])
        : [];

      setPayments(paymentsData);
      setTenants(tenantsData);
      setCreateTenantId((prev) => prev || tenantsData[0]?.id || "");
    } catch {
      if (signal?.aborted) return;
      setError("Finance se nepodarilo nacist. Zkuste akci opakovat.");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    loadFinance(controller.signal);
    return () => controller.abort();
  }, []);

  async function handleCreatePayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreating) return;
    setCreateError("");

    const amount = Number(createAmount.replace(",", "."));
    if (!createTenantId) {
      setCreateError("Vyberte najemnika.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setCreateError("Castka musi byt cislo vetsi nez 0.");
      return;
    }
    if (!createDueDate) {
      setCreateError("Vyberte datum splatnosti.");
      return;
    }

    try {
      setIsCreating(true);
      const response = await apiFetch("/api/payments", {
        method: "POST",
        body: JSON.stringify({
          tenant_id: createTenantId,
          amount,
          due_date: createDueDate,
          paid_date: createPaidDate || null,
          note: createNote.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const created = (await response.json()) as PaymentItem;
      setPayments((prev) => [created, ...prev]);
      setCreateAmount("");
      setCreateDueDate(new Date().toISOString().slice(0, 10));
      setCreatePaidDate("");
      setCreateNote("");
      setIsCreateOpen(false);
      toast({
        title: "Platba ulozena",
        description: "Platba byla uspesne pridana do historie.",
      });
    } catch {
      setCreateError("Platbu se nepodarilo ulozit.");
      toast({
        title: "Ulozeni selhalo",
        description: "Zkuste akci opakovat.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  }

  async function handleMarkPaid(paymentId: string) {
    if (updatingPaymentId) return;
    try {
      setUpdatingPaymentId(paymentId);
      const response = await apiFetch(`/api/payments/${paymentId}`, {
        method: "PUT",
        body: JSON.stringify({
          paid_date: new Date().toISOString().slice(0, 10),
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const updated = (await response.json()) as PaymentItem;
      setPayments((prev) => prev.map((item) => (item.id === paymentId ? updated : item)));
      toast({
        title: "Platba uhrazena",
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

  const tenantNameMap = useMemo(() => {
    const map = new Map<string, string>();
    tenants.forEach((tenant) => map.set(tenant.id, tenant.name));
    return map;
  }, [tenants]);

  const kpis = useMemo(() => {
    const paidCount = payments.filter((item) => item.status === "paid").length;
    const pendingCount = payments.filter((item) => item.status === "pending").length;
    const overdueCount = payments.filter((item) => item.status === "overdue").length;
    const paidAmount = payments
      .filter((item) => item.status === "paid")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const unpaidAmount = payments
      .filter((item) => item.status !== "paid")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      paidCount,
      pendingCount,
      overdueCount,
      paidAmount,
      unpaidAmount,
    };
  }, [payments]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        description="Interni evidence plateb najemniku bez napojeni na banku."
        actions={
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="cta">
                <Plus className="mr-2 h-4 w-4" />
                Pridat platbu
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova platba</DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleCreatePayment}>
                <div className="space-y-2">
                  <Label htmlFor="finance-tenant">Najemnik</Label>
                  <select
                    id="finance-tenant"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={createTenantId}
                    onChange={(e) => setCreateTenantId(e.target.value)}
                  >
                    <option value="">Vyber najemnika</option>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finance-amount">Castka</Label>
                  <Input
                    id="finance-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={createAmount}
                    onChange={(e) => setCreateAmount(e.target.value)}
                    placeholder="15000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finance-due-date">Datum splatnosti</Label>
                  <Input
                    id="finance-due-date"
                    type="date"
                    value={createDueDate}
                    onChange={(e) => setCreateDueDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finance-paid-date">Datum uhrady (volitelne)</Label>
                  <Input
                    id="finance-paid-date"
                    type="date"
                    value={createPaidDate}
                    onChange={(e) => setCreatePaidDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finance-note">Poznamka</Label>
                  <Input
                    id="finance-note"
                    value={createNote}
                    onChange={(e) => setCreateNote(e.target.value)}
                    placeholder="Volitelna poznamka"
                  />
                </div>
                {createError ? <p className="text-xs text-destructive">{createError}</p> : null}
                <Button type="submit" className="w-full" variant="cta" disabled={isCreating}>
                  {isCreating ? "Ukladam..." : "Ulozit platbu"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {error && !loading ? (
        <DataState
          variant="error"
          title="Finance se nepodarilo nacist"
          description={error}
          actionLabel="Zkusit znovu"
          onAction={() => loadFinance()}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Card className="card-shadow" key={`finance-kpi-skeleton-${index}`}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-7 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card className="card-shadow">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Uhrazeno</p>
                <p className="mt-1 text-2xl font-bold">{kpis.paidCount}</p>
                <p className="text-xs text-success mt-1">{formatCurrency(kpis.paidAmount)}</p>
              </CardContent>
            </Card>
            <Card className="card-shadow">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Ceka na uhradu</p>
                <p className="mt-1 text-2xl font-bold">{kpis.pendingCount}</p>
                <p className="text-xs text-warning mt-1">
                  <Clock3 className="h-3 w-3 inline mr-1" />
                  Planovane platby
                </p>
              </CardContent>
            </Card>
            <Card className="card-shadow">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Po splatnosti</p>
                <p className="mt-1 text-2xl font-bold">{kpis.overdueCount}</p>
                <p className="text-xs text-destructive mt-1">
                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                  Vyzadujeme reakci
                </p>
              </CardContent>
            </Card>
            <Card className="card-shadow">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Neuhrazena castka</p>
                <p className="mt-1 text-2xl font-bold">{formatCurrency(kpis.unpaidAmount)}</p>
                <p className="text-xs text-muted-foreground mt-1">pending + overdue</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-base">Historie plateb</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={`finance-table-skeleton-${index}`} className="h-10 w-full" />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <DataState
              title="Zatim nejsou evidovane zadne platby"
              description="Prvni platbu muzete pridat tlacitkem nahore."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Najemnik</TableHead>
                  <TableHead>Castka</TableHead>
                  <TableHead>Splatnost</TableHead>
                  <TableHead>Uhrazeno</TableHead>
                  <TableHead>Stav</TableHead>
                  <TableHead>Poznamka</TableHead>
                  <TableHead className="text-right">Akce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{tenantNameMap.get(payment.tenant_id) || "Neznamy najemnik"}</TableCell>
                    <TableCell>{formatCurrency(payment.amount)}</TableCell>
                    <TableCell>{formatDate(payment.due_date)}</TableCell>
                    <TableCell>{formatDate(payment.paid_date)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusClassName(payment.status)}>
                        {statusLabelMap[payment.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{payment.note || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={payment.status === "paid" || updatingPaymentId === payment.id}
                        onClick={() => handleMarkPaid(payment.id)}
                      >
                        {updatingPaymentId === payment.id ? (
                          "Ukladam..."
                        ) : payment.status === "paid" ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Uhrazeno
                          </>
                        ) : (
                          "Oznacit jako zaplaceno"
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
