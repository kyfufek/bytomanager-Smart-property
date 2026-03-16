import { useState, useMemo } from "react";
import { format } from "date-fns";
import { CalendarIcon, FileText, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

// ── Section 1: Building Shared Costs ──

interface BuildingCost {
  name: string;
  total: number;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
}

const initialBuildingCosts: BuildingCost[] = [
  { name: "Osvětlení spol. prostory", total: 21840, q1: 5460, q2: 5460, q3: 5460, q4: 5460 },
  { name: "Popelnice", total: 18000, q1: 4500, q2: 4500, q3: 4500, q4: 4500 },
  { name: "Úklid", total: 50000, q1: 12500, q2: 12500, q3: 12500, q4: 12500 },
  { name: "Revize hasicích přístrojů", total: 4800, q1: 0, q2: 0, q3: 4800, q4: 0 },
];

// ── Section 2: Occupancy ──

const months = ["I.", "II.", "III.", "IV.", "V.", "VI.", "VII.", "VIII.", "IX.", "X.", "XI.", "XII."];

interface OccupancyRow {
  totalPersons: number;
  aptPersons: number;
}

const initialOccupancy: OccupancyRow[] = [
  { totalPersons: 35, aptPersons: 3 },
  { totalPersons: 35, aptPersons: 3 },
  { totalPersons: 34, aptPersons: 3 },
  { totalPersons: 34, aptPersons: 3 },
  { totalPersons: 34, aptPersons: 2 },
  { totalPersons: 33, aptPersons: 2 },
  { totalPersons: 33, aptPersons: 2 },
  { totalPersons: 33, aptPersons: 2 },
  { totalPersons: 34, aptPersons: 3 },
  { totalPersons: 35, aptPersons: 3 },
  { totalPersons: 35, aptPersons: 3 },
  { totalPersons: 35, aptPersons: 3 },
];

// ── Section 3: Water ──

interface WaterData {
  startM3: number;
  endM3: number;
  pricePerM3: number;
}

// ── Component ──

export default function UtilityBillingPage() {
  // Section 1 state
  const [buildingCosts, setBuildingCosts] = useState<BuildingCost[]>(initialBuildingCosts);

  // Section 2 state
  const [occupancy, setOccupancy] = useState<OccupancyRow[]>(initialOccupancy);

  // Section 3 state
  const [water, setWater] = useState<WaterData>({ startM3: 510.0, endM3: 532.0, pricePerM3: 151.3 });
  const [servisKotel, setServisKotel] = useState(1650);
  const [internet, setInternet] = useState(3588);
  const [gasFrom, setGasFrom] = useState<Date | undefined>(new Date(2025, 1, 14));
  const [gasTo, setGasTo] = useState<Date | undefined>(new Date(2026, 1, 13));
  const [gasAmount, setGasAmount] = useState(12450);
  const [elFrom, setElFrom] = useState<Date | undefined>(new Date(2025, 1, 14));
  const [elTo, setElTo] = useState<Date | undefined>(new Date(2026, 1, 13));
  const [elAmount, setElAmount] = useState(8920);

  // Derived
  const totalBuildingCostYearly = useMemo(
    () => buildingCosts.reduce((s, c) => s + c.total, 0),
    [buildingCosts]
  );

  const monthlyCostPerBuilding = useMemo(
    () => totalBuildingCostYearly / 12,
    [totalBuildingCostYearly]
  );

  const occupancyCalc = useMemo(() => {
    return occupancy.map((row) => {
      const costPerPerson = row.totalPersons > 0 ? monthlyCostPerBuilding / row.totalPersons : 0;
      const aptTotal = costPerPerson * row.aptPersons;
      return { costPerPerson, aptTotal };
    });
  }, [occupancy, monthlyCostPerBuilding]);

  const totalAptSharedCosts = useMemo(
    () => occupancyCalc.reduce((s, r) => s + r.aptTotal, 0),
    [occupancyCalc]
  );

  const waterConsumption = water.endM3 - water.startM3;
  const waterTotal = waterConsumption * water.pricePerM3;

  const totalBezVody = totalAptSharedCosts + servisKotel + internet;
  const totalEnergies = gasAmount + elAmount;
  const grandTotal = totalBezVody + waterTotal + totalEnergies;

  // Mock: tenant paid 8000 Kč in advances
  const paidAdvances = 8000;
  const balance = paidAdvances - grandTotal;

  const updateBuildingCost = (idx: number, field: keyof BuildingCost, val: number) => {
    setBuildingCosts((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      if (field !== "total") {
        copy[idx].total = copy[idx].q1 + copy[idx].q2 + copy[idx].q3 + copy[idx].q4;
      }
      return copy;
    });
  };

  const updateOccupancy = (idx: number, field: keyof OccupancyRow, val: number) => {
    setOccupancy((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const fmt = (n: number) =>
    n.toLocaleString("cs-CZ", { maximumFractionDigits: 0 });

  const fmtDec = (n: number) =>
    n.toLocaleString("cs-CZ", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

  return (
    <div className="space-y-6 pb-40">
      <div>
        <h1 className="text-2xl font-bold">Vyúčtování služeb</h1>
        <p className="text-muted-foreground">
          Roční vyúčtování na základě osoboměsíců
        </p>
      </div>

      {/* ── 1. Building Shared Costs ── */}
      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-base">Náklady na dům (roční)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Položka</TableHead>
                <TableHead className="text-right min-w-[100px]">Celkem</TableHead>
                <TableHead className="text-right min-w-[90px]">1.Q</TableHead>
                <TableHead className="text-right min-w-[90px]">2.Q</TableHead>
                <TableHead className="text-right min-w-[90px]">3.Q</TableHead>
                <TableHead className="text-right min-w-[90px]">4.Q</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buildingCosts.map((cost, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{cost.name}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {fmt(cost.total)} Kč
                  </TableCell>
                  {(["q1", "q2", "q3", "q4"] as const).map((q) => (
                    <TableCell key={q} className="text-right">
                      <Input
                        type="number"
                        className="w-24 ml-auto text-right"
                        value={cost[q]}
                        onChange={(e) => updateBuildingCost(i, q, Number(e.target.value))}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>Celkem</TableCell>
                <TableCell className="text-right">{fmt(totalBuildingCostYearly)} Kč</TableCell>
                <TableCell colSpan={4} className="text-right text-muted-foreground text-sm">
                  Měsíčně: {fmt(monthlyCostPerBuilding)} Kč
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── 2. Dynamic Occupancy Table ── */}
      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-base">Počet osob v domě (osoboměsíce)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[60px]">Měsíc</TableHead>
                <TableHead className="text-right min-w-[120px]">Osob v domě</TableHead>
                <TableHead className="text-right min-w-[140px]">Kč / osoba / měs.</TableHead>
                <TableHead className="text-right min-w-[120px]">Osob v bytě</TableHead>
                <TableHead className="text-right min-w-[130px]">Celkem byt / měs.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((m, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{m}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      className="w-20 ml-auto text-right"
                      value={occupancy[i].totalPersons}
                      onChange={(e) => updateOccupancy(i, "totalPersons", Number(e.target.value))}
                    />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {fmtDec(occupancyCalc[i].costPerPerson)} Kč
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      className="w-20 ml-auto text-right"
                      value={occupancy[i].aptPersons}
                      onChange={(e) => updateOccupancy(i, "aptPersons", Number(e.target.value))}
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {fmt(occupancyCalc[i].aptTotal)} Kč
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={4}>Celkem za byt (sdílené náklady / rok)</TableCell>
                <TableCell className="text-right">{fmt(totalAptSharedCosts)} Kč</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── 3. Apartment Specific Costs ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Water */}
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="text-base">Voda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Počáteční stav (m³)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={water.startM3}
                  onChange={(e) => setWater({ ...water, startM3: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Koncový stav (m³)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={water.endM3}
                  onChange={(e) => setWater({ ...water, endM3: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Cena za 1 m³</label>
                <Input
                  type="number"
                  step="0.1"
                  value={water.pricePerM3}
                  onChange={(e) => setWater({ ...water, pricePerM3: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Spotřeba (m³)</label>
                <div className="h-10 flex items-center font-semibold">{fmtDec(waterConsumption)} m³</div>
              </div>
            </div>
            <div className="rounded-md bg-muted p-3 text-center">
              <span className="text-sm text-muted-foreground">Vyúčtování vody: </span>
              <span className="text-lg font-bold">{fmt(waterTotal)} Kč</span>
            </div>
          </CardContent>
        </Card>

        {/* Other Direct Costs */}
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="text-base">Individuální náklady bytu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Servis kotel (Kč / rok)</label>
              <Input
                type="number"
                value={servisKotel}
                onChange={(e) => setServisKotel(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Internet (Kč / rok)</label>
              <Input
                type="number"
                value={internet}
                onChange={(e) => setInternet(Number(e.target.value))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Energies – Gas */}
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="text-base">Plyn</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Od</label>
                <DatePicker date={gasFrom} onChange={setGasFrom} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Do</label>
                <DatePicker date={gasTo} onChange={setGasTo} />
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Částka (Kč)</label>
              <Input
                type="number"
                value={gasAmount}
                onChange={(e) => setGasAmount(Number(e.target.value))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Energies – Electricity */}
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="text-base">Elektřina</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Od</label>
                <DatePicker date={elFrom} onChange={setElFrom} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Do</label>
                <DatePicker date={elTo} onChange={setElTo} />
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Částka (Kč)</label>
              <Input
                type="number"
                value={elAmount}
                onChange={(e) => setElAmount(Number(e.target.value))}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 4. Sticky Summary Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-lg">
        <div className="mx-auto max-w-5xl flex flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span>
              <span className="text-muted-foreground">Sdílené náklady: </span>
              <span className="font-semibold">{fmt(totalAptSharedCosts)} Kč</span>
            </span>
            <span>
              <span className="text-muted-foreground">Voda: </span>
              <span className="font-semibold">{fmt(waterTotal)} Kč</span>
            </span>
            <span>
              <span className="text-muted-foreground">Energie: </span>
              <span className="font-semibold">{fmt(totalEnergies)} Kč</span>
            </span>
            <span>
              <span className="text-muted-foreground">Ostatní: </span>
              <span className="font-semibold">{fmt(servisKotel + internet)} Kč</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              className={cn(
                "text-base px-3 py-1",
                balance >= 0
                  ? "bg-success text-success-foreground"
                  : "bg-destructive text-destructive-foreground"
              )}
            >
              {balance >= 0 ? "PŘEPLATEK" : "NEDOPLATEK"}: {fmt(Math.abs(balance))} Kč
            </Badge>
            <Button
              variant="cta"
              onClick={() => {
                // TODO: napojit na API – generování PDF
                toast({
                  title: "PDF vygenerováno",
                  description: "Vyúčtování podepsala: ing. Kateřina Hrušková, 05.03.2026",
                });
              }}
            >
              <FileText className="mr-2 h-4 w-4" />
              Generovat PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DatePicker helper ──

function DatePicker({
  date,
  onChange,
}: {
  date: Date | undefined;
  onChange: (d: Date | undefined) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "dd.MM.yyyy") : "Vyberte datum"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onChange}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
