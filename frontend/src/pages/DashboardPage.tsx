import { TrendingUp, Users, Zap, AlertTriangle, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Legend,
} from "recharts";

// TODO: napojit na API
const chartData = [
  { month: "Led", příjmy: 120000, výdaje: 45000 },
  { month: "Úno", příjmy: 118000, výdaje: 52000 },
  { month: "Bře", příjmy: 125000, výdaje: 48000 },
  { month: "Dub", příjmy: 122000, výdaje: 41000 },
  { month: "Kvě", příjmy: 130000, výdaje: 55000 },
  { month: "Čvn", příjmy: 125000, výdaje: 47000 },
];

const alerts = [
  {
    icon: AlertTriangle,
    text: "🚨 Byt C: Dluh přesáhl 50 % kauce. Eskalační Auto-pilot dnes odeslal oficiální Výstrahu před výpovědí.",
    type: "critical" as const,
  },
  {
    icon: AlertTriangle,
    text: "Nájemník v Bytě A má 3 dny zpoždění s platbou.",
    type: "warning" as const,
  },
  {
    icon: Lightbulb,
    text: "Inflace vzrostla o 2%. Zvažte aktualizaci nájmu.",
    type: "info" as const,
  },
  {
    icon: AlertTriangle,
    text: "Smlouva s nájemníkem Krejčí vyprší za 30 dní.",
    type: "warning" as const,
  },
];

const activities = [
  { date: "12.06.2025", property: "Byt 3+1 Praha", event: "Platba přijata", status: "success" },
  { date: "11.06.2025", property: "Byt 2+kk Brno", event: "Hlášení závady", status: "warning" },
  { date: "10.06.2025", property: "Byt 1+1 Ostrava", event: "Nový nájemník", status: "success" },
  { date: "09.06.2025", property: "Byt 3+1 Praha", event: "Dluh na nájmu", status: "destructive" },
  { date: "08.06.2025", property: "Byt 2+kk Brno", event: "Platba přijata", status: "success" },
];

const kpiCards = [
  {
    title: "Měsíční příjmy",
    value: "125 000 Kč",
    change: "+5%",
    icon: TrendingUp,
    positive: true,
  },
  {
    title: "Aktivní nájemníci",
    value: "18 / 20",
    change: "90%",
    icon: Users,
    positive: true,
  },
  {
    title: "AI Akce",
    value: "3 čekající",
    change: "úkoly",
    icon: Zap,
    positive: false,
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold">
          Vítej zpět, <span className="text-primary">Jan</span>
        </h1>
        {/* TODO: napojit na API - Jméno */}
        <p className="text-muted-foreground">Zde je přehled tvých nemovitostí.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title} className="card-shadow hover:card-shadow-hover transition-shadow">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <kpi.icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{kpi.title}</p>
                <p className="text-2xl font-bold">{kpi.value}</p>
                <Badge
                  variant={kpi.positive ? "default" : "secondary"}
                  className={
                    kpi.positive
                      ? "bg-success/10 text-success border-0 mt-1"
                      : "bg-primary/10 text-primary border-0 mt-1"
                  }
                >
                  {kpi.change}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart + Alerts */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3 card-shadow">
          <CardHeader>
            <CardTitle className="text-base">Příjmy vs Výdaje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
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
                  <Legend />
                  <Bar dataKey="příjmy" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="výdaje" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 card-shadow">
          <CardHeader>
            <CardTitle className="text-base">AI Smart Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map((alert, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded-lg border p-3 ${
                    alert.type === "critical" ? "bg-destructive/5 border-destructive/30" : "bg-accent/50"
                  }`}
                >
                  <alert.icon
                    className={`h-5 w-5 shrink-0 mt-0.5 ${
                      alert.type === "critical" ? "text-destructive" : alert.type === "warning" ? "text-warning" : "text-primary"
                  }`}
                />
                <div className="flex-1">
                  <p className="text-sm">{alert.text}</p>
                  <Button variant="ghost" size="sm" className="mt-1 h-7 text-xs text-primary">
                    Zobrazit detail →
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Activity Table */}
      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-base">Poslední aktivity</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Nemovitost</TableHead>
                <TableHead>Událost</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.map((a, i) => (
                <TableRow key={i}>
                  <TableCell className="text-muted-foreground">{a.date}</TableCell>
                  <TableCell className="font-medium">{a.property}</TableCell>
                  <TableCell>{a.event}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        a.status === "success"
                          ? "bg-success/10 text-success border-0"
                          : a.status === "destructive"
                          ? "bg-destructive/10 text-destructive border-0"
                          : "bg-warning/10 text-warning border-0"
                      }
                    >
                      {a.status === "success"
                        ? "OK"
                        : a.status === "destructive"
                        ? "Dluh"
                        : "Pozor"}
                    </Badge>
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
