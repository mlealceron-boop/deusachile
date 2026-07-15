import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { 
  Percent, 
  Search, 
  Calendar, 
  Coins, 
  Settings, 
  TrendingUp, 
  DollarSign, 
  FileSpreadsheet
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatCLP } from "@/lib/products";

export const Route = createFileRoute("/_authenticated/comisiones")({
  component: ComisionesPage,
});

interface VentaComisionRow {
  id: string;
  fecha: string;
  total_neto: number;
  total_comision: number;
  porcentaje_comision: number;
  ejecutivo_id: string;
  clientes?: { nombre: string } | null;
  usuarios?: { nombre: string } | null;
}

interface ExecutiveSummary {
  ejecutivoId: string;
  nombre: string;
  totalNeto: number;
  porcentajeComision: number;
  totalComision: number;
  cantidadVentas: number;
}

function ComisionesPage() {
  const { user } = useCurrentUser();
  const isAdmin = user?.rol === "admin";

  const [loading, setLoading] = useState(true);
  const [ventas, setVentas] = useState<VentaComisionRow[]>([]);
  const [comisionVigente, setComisionVigente] = useState(8.0);
  const [nuevoPorcentaje, setNuevoPorcentaje] = useState("");

  // Filters
  const [filtroMes, setFiltroMes] = useState(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${now.getFullYear()}-${month}`;
  });
  
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"mes" | "rango">("mes");

  const [configOpen, setConfigOpen] = useState(false);

  // Load comision config & sales data
  async function cargarDatos() {
    setLoading(true);
    try {
      // 1. Fetch current active commission config
      const { data: configData } = await supabase
        .from("config_comision")
        .select("porcentaje")
        .order("vigente_desde", { ascending: false })
        .limit(1);

      if (configData && configData.length > 0) {
        const val = Number(configData[0].porcentaje);
        setComisionVigente(val);
        setNuevoPorcentaje(String(val));
      }

      // Determine date filters
      let fromStr = "";
      let toStr = "";

      if (filtroTipo === "mes") {
        const [year, month] = filtroMes.split("-");
        fromStr = `${year}-${month}-01T00:00:00Z`;
        // Last day of month
        const lastDay = new Date(Number(year), Number(month), 0).getDate();
        toStr = `${year}-${month}-${String(lastDay).padStart(2, "0")}T23:59:59Z`;
      } else {
        fromStr = filtroDesde ? `${filtroDesde}T00:00:00Z` : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        toStr = filtroHasta ? `${filtroHasta}T23:59:59Z` : new Date().toISOString();
      }

      // 2. Fetch sales
      let salesQuery = supabase
        .from("ventas")
        .select("id, fecha, total_neto, total_comision, porcentaje_comision, ejecutivo_id, clientes:cliente_id(nombre), usuarios:ejecutivo_id(nombre)")
        .eq("es_muestra", false)
        .gte("fecha", fromStr)
        .lte("fecha", toStr)
        .order("fecha", { ascending: false });

      if (!isAdmin && user) {
        salesQuery = salesQuery.eq("ejecutivo_id", user.id);
      }

      const { data: sData, error: sErr } = await salesQuery;
      if (sErr) throw sErr;

      setVentas((sData as any) ?? []);
    } catch (err: any) {
      toast.error("Error al cargar liquidaciones: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, [filtroMes, filtroDesde, filtroHasta, filtroTipo, user, isAdmin]);

  // Handle new commission config insert
  async function handleConfigSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pct = parseFloat(nuevoPorcentaje);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast.error("Por favor ingresa un porcentaje válido entre 0% y 100%");
      return;
    }

    try {
      const { error } = await supabase
        .from("config_comision")
        .insert({
          porcentaje: pct,
          vigente_desde: new Date().toISOString()
        });
      
      if (error) throw error;
      toast.success(`Porcentaje de comisión actualizado a ${pct}%`);
      setConfigOpen(false);
      cargarDatos();
    } catch (err: any) {
      toast.error("Error al actualizar configuración: " + err.message);
    }
  }

  // Calculate executive consolidation for Admin table
  const summaries: ExecutiveSummary[] = [];
  if (isAdmin) {
    const execMap: Record<string, { name: string; net: number; com: number; count: number; pct: number }> = {};
    ventas.forEach((v) => {
      const execId = v.ejecutivo_id;
      const execName = v.usuarios?.nombre ?? "Desconocido";
      if (!execMap[execId]) {
        execMap[execId] = { name: execName, net: 0, com: 0, count: 0, pct: v.porcentaje_comision };
      }
      execMap[execId].net += Number(v.total_neto || 0);
      execMap[execId].com += Number(v.total_comision || 0);
      execMap[execId].count += 1;
    });

    Object.keys(execMap).forEach((id) => {
      summaries.push({
        ejecutivoId: id,
        nombre: execMap[id].name,
        totalNeto: execMap[id].net,
        porcentajeComision: execMap[id].pct,
        totalComision: execMap[id].com,
        cantidadVentas: execMap[id].count,
      });
    });
  }

  // Totals for Admin view
  const totalNetoConsolidado = summaries.reduce((acc, curr) => acc + curr.totalNeto, 0);
  const totalComisionConsolidada = summaries.reduce((acc, curr) => acc + curr.totalComision, 0);
  const totalCantidadVentasConsolidada = summaries.reduce((acc, curr) => acc + curr.cantidadVentas, 0);

  // Totals for Executive view
  const miTotalNeto = ventas.reduce((acc, curr) => acc + Number(curr.total_neto || 0), 0);
  const miTotalComision = ventas.reduce((acc, curr) => acc + Number(curr.total_comision || 0), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Comisiones</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin 
              ? "Revisión consolidada y liquidaciones comerciales del equipo." 
              : "Desglose acumulado de tus bonos y comisiones por venta."}
          </p>
        </div>
        
        {isAdmin && (
          <Dialog open={configOpen} onOpenChange={setConfigOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md">
                <Settings className="mr-2 h-4 w-4" /> Configurar Comisión
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Porcentaje de Comisión Base</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleConfigSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cfg-pct">Porcentaje de Comisión Vigente (%)</Label>
                  <div className="relative">
                    <Input
                      id="cfg-pct"
                      type="number"
                      step="0.01"
                      required
                      min="0"
                      max="100"
                      value={nuevoPorcentaje}
                      onChange={(e) => setNuevoPorcentaje(e.target.value)}
                    />
                    <span className="absolute right-3 top-2.5 text-sm text-muted-foreground font-semibold">%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Modificar este valor solo afectará a las nuevas ventas creadas desde este momento en adelante. Las ventas registradas anteriormente mantienen su comisión congelada.
                  </p>
                </div>
                <DialogFooter className="pt-2">
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                    Guardar Configuración
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* FILTER CARD */}
      <Card className="border border-border">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
              <Button 
                variant={filtroTipo === "mes" ? "secondary" : "ghost"} 
                size="sm" 
                className="text-xs h-7 rounded-md"
                onClick={() => setFiltroTipo("mes")}
              >
                Por Mes
              </Button>
              <Button 
                variant={filtroTipo === "rango" ? "secondary" : "ghost"} 
                size="sm" 
                className="text-xs h-7 rounded-md"
                onClick={() => setFiltroTipo("rango")}
              >
                Rango Fechas
              </Button>
            </div>

            {filtroTipo === "mes" ? (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="month"
                  className="h-9 text-xs w-44"
                  value={filtroMes}
                  onChange={(e) => setFiltroMes(e.target.value)}
                />
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  className="h-9 text-xs w-36"
                  value={filtroDesde}
                  onChange={(e) => setFiltroDesde(e.target.value)}
                />
                <span className="text-xs text-muted-foreground font-semibold">hasta</span>
                <Input
                  type="date"
                  className="h-9 text-xs w-36"
                  value={filtroHasta}
                  onChange={(e) => setFiltroHasta(e.target.value)}
                />
              </div>
            )}

            <div className="flex-1 text-right">
              <Badge className="bg-primary/10 text-primary border-none text-[11px] font-bold py-1 px-3">
                Comisión base actual: {comisionVigente}%
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ADMIN CONSOLIDATED VIEW */}
      {isAdmin && (
        <Card className="border border-border shadow-sm">
          <CardHeader className="bg-slate-50/50">
            <CardTitle className="text-base text-primary font-bold">Liquidación Consolidada por Ejecutivo</CardTitle>
            <CardDescription>Resumen de comisiones comerciales acumuladas en el período.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Cargando consolidado…</div>
            ) : summaries.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Sin transacciones registradas en este período.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ejecutivo</TableHead>
                    <TableHead className="text-right">Total Ventas Netas</TableHead>
                    <TableHead className="text-center">Porcentaje Promedio</TableHead>
                    <TableHead className="text-right">Total Comisión</TableHead>
                    <TableHead className="text-center">Ventas Cerradas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaries.map((s) => (
                    <TableRow key={s.ejecutivoId} className="hover:bg-slate-50/50">
                      <TableCell className="font-semibold text-slate-800">{s.nombre}</TableCell>
                      <TableCell className="text-right font-semibold text-slate-700">{formatCLP(s.totalNeto)}</TableCell>
                      <TableCell className="text-center font-medium text-slate-500">{s.porcentajeComision}%</TableCell>
                      <TableCell className="text-right font-bold text-primary">{formatCLP(s.totalComision)}</TableCell>
                      <TableCell className="text-center font-bold text-slate-600">{s.cantidadVentas}</TableCell>
                    </TableRow>
                  ))}
                  {/* Totals footer */}
                  <TableRow className="bg-slate-100/50 font-bold hover:bg-slate-100/50">
                    <TableCell className="text-primary font-extrabold">Total General</TableCell>
                    <TableCell className="text-right text-slate-800">{formatCLP(totalNetoConsolidado)}</TableCell>
                    <TableCell className="text-center text-slate-400">—</TableCell>
                    <TableCell className="text-right text-primary font-extrabold text-base">{formatCLP(totalComisionConsolidada)}</TableCell>
                    <TableCell className="text-center text-slate-800">{totalCantidadVentasConsolidada}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* EXECUTIVE PERSONAL VIEW */}
      {!isAdmin && (
        <div className="space-y-6">
          {/* Executive Stats Card */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border border-border shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tus Ventas Netas</p>
                    <div className="text-2xl font-bold text-slate-800">{formatCLP(miTotalNeto)}</div>
                  </div>
                  <div className="h-10 w-10 bg-emerald-100 text-emerald-800 rounded-lg flex items-center justify-center">
                    <DollarSign className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Comisión a Liquidar</p>
                    <div className="text-2xl font-bold text-primary">{formatCLP(miTotalComision)}</div>
                  </div>
                  <div className="h-10 w-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                    <Percent className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cantidad Ventas</p>
                    <div className="text-2xl font-bold text-slate-800">{ventas.length}</div>
                  </div>
                  <div className="h-10 w-10 bg-amber-100 text-amber-800 rounded-lg flex items-center justify-center">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Details list of executive sales */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="bg-slate-50/50">
              <CardTitle className="text-base text-primary font-bold">Detalle de Ventas del Período</CardTitle>
              <CardDescription>Lista individual de pedidos cerrados y sus comisiones calculadas.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Cargando detalles…</div>
              ) : ventas.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No tienes ventas registradas en este período.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-center">Porcentaje Comisión</TableHead>
                      <TableHead className="text-right">Monto Neto</TableHead>
                      <TableHead className="text-right">Tu Comisión</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ventas.map((v) => (
                      <TableRow key={v.id} className="hover:bg-slate-50/50">
                        <TableCell className="text-xs text-slate-500">
                          {new Date(v.fecha).toLocaleDateString("es-ES")}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-800">{v.clientes?.nombre ?? "—"}</TableCell>
                        <TableCell className="text-center font-medium text-slate-500">{v.porcentaje_comision}%</TableCell>
                        <TableCell className="text-right font-medium text-slate-700">{formatCLP(v.total_neto)}</TableCell>
                        <TableCell className="text-right font-bold text-primary">{formatCLP(v.total_comision)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
