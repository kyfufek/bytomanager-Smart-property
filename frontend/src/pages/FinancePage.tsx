import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";
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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// TODO: napojit na API
const monthlyData = [
  { month: "Led", příjmy: 120000, výdaje: 45000 },
  { month: "Úno", příjmy: 118000, výdaje: 52000 },
  { month: "Bře", příjmy: 125000, výdaje: 48000 },
  { month: "Dub", příjmy: 122000, výdaje: 41000 },
  { month: "Kvě", příjmy: 130000, výdaje: 55000 },
  { month: "Čvn", příjmy: 125000, výdaje: 47000 },
];

const transactions = [
  { date: "12.06.2025", desc: "Nájemné – Byt 3+1 Praha", amount: "+18 500 Kč", type: "income" },
  { date: "11.06.2025", desc: "Oprava pračky", amount: "-4 200 Kč", type: "expense" },
  { date: "10.06.2025", desc: "Nájemné – Byt 2+kk Brno", amount: "+14 000 Kč", type: "income" },
  { date: "09.06.2025", desc: "Pojištění nemovitosti", amount: "-2 800 Kč", type: "expense" },
  { date: "08.06.2025", desc: "Nájemné – Byt 1+1 Ostrava", amount: "+9 500 Kč", type: "income" },
];

export default function FinancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Finance</h1>
        <p className="text-muted-foreground">Přehled příjmů a výdajů</p>
      </div>

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="card-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Celkové příjmy</p>
              <ArrowUpRight className="h-4 w-4 text-success" />
            </div>
            <p className="text-2xl font-bold mt-1">740 000 Kč</p>
            <p className="text-xs text-success mt-1">+8% oproti minulému období</p>
          </CardContent>
        </Card>
        <Card className="card-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Celkové výdaje</p>
              <ArrowDownRight className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-2xl font-bold mt-1">288 000 Kč</p>
            <p className="text-xs text-destructive mt-1">+3% oproti minulému období</p>
          </CardContent>
        </Card>
        <Card className="card-shadow">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Čistý zisk</p>
            <p className="text-2xl font-bold mt-1">452 000 Kč</p>
            <p className="text-xs text-success mt-1">Marže 61%</p>
          </CardContent>
        </Card>
        <Card className="card-shadow">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Neuhrazené platby</p>
            <p className="text-2xl font-bold mt-1">32 500 Kč</p>
            <p className="text-xs text-warning mt-1">2 nájemníci</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-base">Měsíční přehled</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    borderRadius: "0.5rem",
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                  }}
                />
                <Bar dataKey="příjmy" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="výdaje" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-base">Poslední transakce</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Popis</TableHead>
                <TableHead className="text-right">Částka</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t, i) => (
                <TableRow key={i}>
                  <TableCell className="text-muted-foreground">{t.date}</TableCell>
                  <TableCell>{t.desc}</TableCell>
                  <TableCell className={`text-right font-medium ${t.type === "income" ? "text-success" : "text-destructive"}`}>
                    {t.amount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
