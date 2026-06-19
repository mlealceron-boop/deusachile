import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid 
} from "recharts";
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Percent, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  User,
  Sparkles,
  Trophy
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatCLP, parseProductoNombre } from "@/lib/products";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

type PeriodType = "hoy" | "semana" | "mes" | "ultimo_mes" | "personalizado";

interface VentaData {
  id: string;
  fecha: string;
  total_neto: number;
  total_bruto: number;
  total_comision: number;
  ejecutivo_id: string;
  clientes: { nombre: string } | null;
  usuarios: { nombre: string } | null;
}

interface ItemData {
  subtotal_neto: number;
  productos: {
    nombre: string;
    marcas?: { nombre: string } | null;
  } | null;
}

interface TareaAlerta {
  id: string;
  titulo: string;
  fecha_limite: string | null;
  usuarios?: { nombre: string } | null;
}

interface ReunionAlerta {
  id: string;
  fecha_hora: string;
  clientes?: { nombre: string } | null;
  usuarios?: { nombre: string } | null;
  objetivo: string;
}

interface StockAlerta {
  id: string;
  stock_actual: number;
  stock_minimo: number;
  productos?: {
    nombre: string;
    marcas?: { nombre: string } | null;
  } | null;
}

function DashboardPage() {
  const { user } = useCurrentUser();
  const isAdmin = user?.rol === "admin";

  const [periodo, setPeriodo] = useState<PeriodType>("mes");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [loading, setLoading] = useState(true);

  // States for stats
  const [ventas, setVentas] = useState<VentaData[]>([]);
  const [items, setItems] = useState<ItemData[]>([]);
  const [totalNeto, setTotalNeto] = useState(0);
  const [totalBruto, setTotalBruto] = useState(0);
  const [totalComisiones, setTotalComisiones] = useState(0);
  
  // Charts data
  const [chartEjecutivos, setChartEjecutivos] = useState<{ name: string; ventas: number }[]>([]);
  const [chartMarcas, setChartMarcas] = useState<{ name: string; ventas: number }[]>([]);

  // Alerts
  const [alertasTareas, setAlertasTareas] = useState<TareaAlerta[]>([]);
  const [alertasReuniones, setAlertasReuniones] = useState<ReunionAlerta[]>([]);
  const [alertasStock, setAlertasStock] = useState<StockAlerta[]>([]);

  // Calculate Dates according to period selection
  function getDatesRange(type: PeriodType): { from: Date; to: Date } {
    const now = new Date();
    let from = new Date();
    let to = new Date();

    switch (type) {
      case "hoy":
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        break;
      case "semana":
        // Start of current week (Monday)
        const day = from.getDay();
        const diff = from.getDate() - day + (day === 0 ? -6 : 1);
        from.setDate(diff);
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        break;
      case "mes":
        // Start of current month
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to.setHours(23, 59, 59, 999);
        break;
      case "ultimo_mes":
        // Previous month's full range
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case "personalizado":
        from = desde ? new Date(desde + "T00:00:00") : new Date(now.getFullYear(), now.getMonth(), 1);
        to = hasta ? new Date(hasta + "T23:59:59") : new Date();
        break;
    }
    return { from, to };
  }

  async function cargarDashboard() {
    setLoading(true);
    try {
      const { from, to } = getDatesRange(periodo);

      // --- 1. FETCH SALES & ITEMS ---
      let salesQuery = supabase
        .from("ventas")
        .select("id, fecha, total_neto, total_bruto, total_comision, ejecutivo_id, clientes:cliente_id(nombre), usuarios:ejecutivo_id(nombre)")
        .gte("fecha", from.toISOString())
        .lte("fecha", to.toISOString());

      if (!isAdmin && user) {
        salesQuery = salesQuery.eq("ejecutivo_id", user.id);
      }

      const { data: sData, error: sErr } = await salesQuery;
      if (sErr) throw sErr;
      const fetchedSales = (sData as any) ?? [];
      setVentas(fetchedSales);

      // Calculate totals
      let sumNeto = 0;
      let sumBruto = 0;
      let sumComision = 0;
      fetchedSales.forEach((v: VentaData) => {
        sumNeto += Number(v.total_neto || 0);
        sumBruto += Number(v.total_bruto || 0);
        sumComision += Number(v.total_comision || 0);
      });
      setTotalNeto(sumNeto);
      setTotalBruto(sumBruto);
      setTotalComisiones(sumComision);

      // Fetch items details for brand performance
      const saleIds = fetchedSales.map((s: VentaData) => s.id);
      let itemsData: ItemData[] = [];
      if (saleIds.length > 0) {
        const { data: iData, error: iErr } = await supabase
          .from("venta_items")
          .select("subtotal_neto, productos:producto_id(nombre, marcas:marca_id(nombre))")
          .in("venta_id", saleIds);
        if (iErr) throw iErr;
        itemsData = (iData as any) ?? [];
      }
      setItems(itemsData);

      // --- 2. CALCULATE CHARTS ---
      // Chart 1: Executives Performance (Admin only)
      if (isAdmin) {
        const execMap: Record<string, number> = {};
        fetchedSales.forEach((v: VentaData) => {
          const name = v.usuarios?.nombre ?? "Desconocido";
          execMap[name] = (execMap[name] || 0) + Number(v.total_neto || 0);
        });
        const execChart = Object.keys(execMap).map((k) => ({
          name: k,
          ventas: execMap[k],
        })).sort((a, b) => b.ventas - a.ventas);
        setChartEjecutivos(execChart);
      }

      // Chart 2: Sales by Brand
      const brandMap: Record<string, number> = {};
      itemsData.forEach((item) => {
        const brandName = item.productos?.marcas?.nombre ?? "Genérico/Otros";
        brandMap[brandName] = (brandMap[brandName] || 0) + Number(item.subtotal_neto || 0);
      });
      const brandChart = Object.keys(brandMap).map((k) => ({
        name: k,
        ventas: brandMap[k],
      })).sort((a, b) => b.ventas - a.ventas);
      setChartMarcas(brandChart);

      // --- 3. FETCH ALERTS ---
      const nowString = new Date().toISOString();

      // Tasks alert (estado != completada and limit date < now)
      let tasksQuery = supabase
        .from("tareas")
        .select("id, titulo, fecha_limite, usuarios:ejecutivo_id(nombre)")
        .neq("estado", "completada")
        .lt("fecha_limite", nowString);
      
      if (!isAdmin && user) {
        tasksQuery = tasksQuery.eq("ejecutivo_id", user.id);
      }
      const { data: taskAlerts } = await tasksQuery.limit(5);
      setAlertasTareas((taskAlerts as any) ?? []);

      // Weekly meetings (from Mon to Sun of current week)
      const weekDates = getDatesRange("semana");
      let meetingsQuery = supabase
        .from("reuniones")
        .select("id, fecha_hora, clientes:cliente_id(nombre), usuarios:ejecutivo_id(nombre), objetivo")
        .gte("fecha_hora", weekDates.from.toISOString())
        .lte("fecha_hora", weekDates.to.toISOString())
        .order("fecha_hora", { ascending: true });

      if (!isAdmin && user) {
        meetingsQuery = meetingsQuery.eq("ejecutivo_id", user.id);
      }
      const { data: meetAlerts } = await meetingsQuery.limit(5);
      setAlertasReuniones((meetAlerts as any) ?? []);

      // Critical Stock (Admin only can view global, Executive can view all because it's stock)
      const { data: stockAlerts } = await supabase
        .from("inventario")
        .select("id, stock_actual, stock_minimo, productos:producto_id(nombre, marcas:marca_id(nombre))")
        .order("stock_actual", { ascending: true });
      
      const lowStockList = ((stockAlerts as any) ?? []).filter((item: any) => {
        return Number(item.stock_actual) <= Number(item.stock_minimo);
      }).slice(0, 5);
      setAlertasStock(lowStockList);

    } catch (err: any) {
      toast.error("Error al cargar datos del panel: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarDashboard();
  }, [periodo, desde, hasta, user]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            Panel Comercial <Sparkles className="h-5 w-5 text-secondary animate-pulse" />
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Vista global de rendimiento corporativo." : "Vista de tus metas y ventas acumuladas."}
          </p>
        </div>

        {/* PERIOD SELECTOR */}
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            onClick={() => setPeriodo("hoy")} 
            variant={periodo === "hoy" ? "default" : "outline"} 
            className="text-xs h-8"
          >
            Hoy
          </Button>
          <Button 
            onClick={() => setPeriodo("semana")} 
            variant={periodo === "semana" ? "default" : "outline"} 
            className="text-xs h-8"
          >
            Esta semana
          </Button>
          <Button 
            onClick={() => setPeriodo("mes")} 
            variant={periodo === "mes" ? "default" : "outline"} 
            className="text-xs h-8"
          >
            Este mes
          </Button>
          <Button 
            onClick={() => setPeriodo("ultimo_mes")} 
            variant={periodo === "ultimo_mes" ? "default" : "outline"} 
            className="text-xs h-8"
          >
            Último mes
          </Button>
          <Button 
            onClick={() => setPeriodo("personalizado")} 
            variant={periodo === "personalizado" ? "default" : "outline"} 
            className="text-xs h-8"
          >
            Personalizado
          </Button>
        </div>
      </div>

      {/* CUSTOM DATE FIELD ROW */}
      {periodo === "personalizado" && (
        <Card className="border border-border">
          <CardContent className="pt-4 pb-4 flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Desde</Label>
              <Input type="date" className="h-9 text-xs" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Hasta</Label>
              <Input type="date" className="h-9 text-xs" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI METRICS ROW */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1 */}
        <Card className="border border-border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <span className="text-sm font-semibold text-slate-500">Ventas Netas</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">{formatCLP(totalNeto)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Facturación neta del período</p>
          </CardContent>
        </Card>

        {/* KPI 2 */}
        <Card className="border border-border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <span className="text-sm font-semibold text-slate-500">Ventas Brutas (IVA)</span>
            <div className="h-7 w-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">{formatCLP(totalBruto)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Total bruto facturado (19% IVA)</p>
          </CardContent>
        </Card>

        {/* KPI 3 */}
        <Card className="border border-border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <span className="text-sm font-semibold text-slate-500">Cantidad Pedidos</span>
            <div className="h-7 w-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">{ventas.length}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Pedidos cerrados con éxito</p>
          </CardContent>
        </Card>

        {/* KPI 4 */}
        <Card className="border border-border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <span className="text-sm font-semibold text-slate-500">Comisiones Sugeridas</span>
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Percent className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">{formatCLP(totalComisiones)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {isAdmin ? "Comisión total a liquidar" : "Tu comisión acumulada"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* CHARTS CONTAINER GRID */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* CHART 1: EXECUTIVES (ADMIN ONLY) */}
        {isAdmin && (
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base text-primary font-bold">Rendimiento por Ejecutivo</CardTitle>
              <CardDescription>Ventas netas totales en pesos (CLP) por comercial.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Cargando gráfico...</div>
              ) : chartEjecutivos.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Sin datos en este período.</div>
              ) : (
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartEjecutivos}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" fontSize={11} stroke="#888" tickLine={false} />
                      <YAxis fontSize={10} stroke="#888" tickFormatter={(v) => `$${v / 1000}k`} tickLine={false} />
                      <Tooltip formatter={(v) => formatCLP(Number(v))} />
                      <Bar dataKey="ventas" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* CHART 2: BRANDS PERFORMANCE */}
        <Card className={`border border-border shadow-sm ${!isAdmin ? "md:col-span-2" : ""}`}>
          <CardHeader>
            <CardTitle className="text-base text-primary font-bold">Distribución por Marcas</CardTitle>
            <CardDescription>Valor de ventas netas por línea o laboratorio farmacéutico.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Cargando gráfico...</div>
            ) : chartMarcas.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Sin datos en este período.</div>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartMarcas}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={11} stroke="#888" tickLine={false} />
                    <YAxis fontSize={10} stroke="#888" tickFormatter={(v) => `$${v / 1000}k`} tickLine={false} />
                    <Tooltip formatter={(v) => formatCLP(Number(v))} />
                    <Bar dataKey="ventas" fill="#c9a84c" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* TWO COLUMNS: ALERTS & RECENT SALES */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* ALERTS AND FOLLOW-UPS */}
        <div className="space-y-6 md:col-span-1">
          {/* TAREAS VENCIDAS */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="bg-red-50/50 pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-red-800 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Tareas Vencidas ({alertasTareas.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {alertasTareas.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">No tienes tareas atrasadas. ¡Excelente!</div>
              ) : (
                alertasTareas.map((t) => (
                  <div key={t.id} className="text-xs border-b pb-2 last:border-b-0 last:pb-0">
                    <div className="font-semibold text-slate-800">{t.titulo}</div>
                    <div className="text-[10px] text-red-600 font-bold mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Límite: {t.fecha_limite ? new Date(t.fecha_limite).toLocaleDateString() : "Sin fecha"}
                      {isAdmin && <span className="text-slate-400 font-medium">· Asignado: {t.usuarios?.nombre}</span>}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* REUNIONES DE LA SEMANA */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="bg-blue-50/50 pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> Reuniones de esta Semana ({alertasReuniones.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {alertasReuniones.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">Sin reuniones programadas para esta semana.</div>
              ) : (
                alertasReuniones.map((r) => (
                  <div key={r.id} className="text-xs border-b pb-2 last:border-b-0 last:pb-0">
                    <div className="font-semibold text-slate-800">{r.clientes?.nombre}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{r.objetivo}</div>
                    <div className="text-[10px] text-blue-700 font-bold mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(r.fecha_hora).toLocaleString()}
                      {isAdmin && <span className="text-slate-400 font-medium">· Ejecutivo: {r.usuarios?.nombre}</span>}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* STOCK CRÍTICO */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="bg-amber-50/50 pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4" /> Stock Bajo Mínimo ({alertasStock.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {alertasStock.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">Niveles de stock correctos en catálogo.</div>
              ) : (
                alertasStock.map((s) => {
                  const { nombre } = parseProductoNombre(s.productos?.nombre || "");
                  return (
                    <div key={s.id} className="text-xs border-b pb-2 last:border-b-0 last:pb-0 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-slate-800">{nombre}</div>
                        <div className="text-[9px] text-slate-500">{s.productos?.marcas?.nombre}</div>
                      </div>
                      <Badge className="bg-amber-100 text-amber-900 border-none font-bold text-[9px]">
                        Stock: {s.stock_actual} (Mín: {s.stock_minimo})
                      </Badge>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* RECENT SALES LISTING */}
        <Card className="border border-border shadow-sm md:col-span-2">
          <CardHeader className="bg-slate-50/50">
            <CardTitle className="text-base text-primary font-bold">Últimos Pedidos Registrados</CardTitle>
            <CardDescription>Resumen de las últimas 10 ventas del período.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Cargando listado...</div>
            ) : ventas.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Sin transacciones registradas.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    {isAdmin && <TableHead>Ejecutivo</TableHead>}
                    <TableHead className="text-right">Neto Neto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ventas.slice(0, 10).map((v) => (
                    <TableRow key={v.id} className="hover:bg-slate-50/30">
                      <TableCell className="text-xs text-slate-500">
                        {new Date(v.fecha).toLocaleDateString("es-ES")}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-800">
                        {v.clientes?.nombre ?? "—"}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="font-medium text-slate-600">
                          {v.usuarios?.nombre ?? "—"}
                        </TableCell>
                      )}
                      <TableCell className="text-right font-bold text-primary">
                        {formatCLP(v.total_neto)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
