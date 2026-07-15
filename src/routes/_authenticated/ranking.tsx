import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { 
  Trophy, 
  Search, 
  Calendar, 
  Award, 
  TrendingUp, 
  Percent, 
  UserCheck, 
  Zap, 
  Medal
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
import { formatCLP } from "@/lib/products";

export const Route = createFileRoute("/_authenticated/ranking")({
  component: RankingPage,
});

type PeriodType = "hoy" | "semana" | "mes" | "anio" | "personalizado";

interface VentaSimple {
  total_neto: number;
  total_comision: number;
  ejecutivo_id: string;
}

interface EjecutivoRanking {
  id: string;
  nombre: string;
  email: string;
  ventasNetas: number;
  totalComision: number;
  cantidadVentas: number;
}

function RankingPage() {
  const { user } = useCurrentUser();
  
  const [periodo, setPeriodo] = useState<PeriodType>("mes");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  
  const [ranking, setRanking] = useState<EjecutivoRanking[]>([]);
  const [loading, setLoading] = useState(true);

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
        const day = from.getDay();
        const diff = from.getDate() - day + (day === 0 ? -6 : 1);
        from.setDate(diff);
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        break;
      case "mes":
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to.setHours(23, 59, 59, 999);
        break;
      case "anio":
        from = new Date(now.getFullYear(), 0, 1);
        to.setHours(23, 59, 59, 999);
        break;
      case "personalizado":
        from = desde ? new Date(desde + "T00:00:00") : new Date(now.getFullYear(), now.getMonth(), 1);
        to = hasta ? new Date(hasta + "T23:59:59") : new Date();
        break;
    }
    return { from, to };
  }

  async function cargarRanking() {
    setLoading(true);
    try {
      const { from, to } = getDatesRange(periodo);

      // 1. Fetch all active users (executives / admins)
      const { data: usersData, error: uErr } = await supabase
        .from("usuarios")
        .select("id, nombre, email, activo")
        .eq("activo", true);
      
      if (uErr) throw uErr;

      // 2. Fetch all sales within period
      const { data: salesData, error: sErr } = await supabase
        .from("ventas")
        .select("total_neto, total_comision, ejecutivo_id")
        .eq("es_muestra", false)
        .gte("fecha", from.toISOString())
        .lte("fecha", to.toISOString());
      
      if (sErr) throw sErr;

      // 3. Process rankings in Javascript
      const sales = (salesData as VentaSimple[]) ?? [];
      const users = (usersData as any[]) ?? [];

      const rankMap: Record<string, { net: number; com: number; count: number }> = {};
      sales.forEach((v) => {
        if (!rankMap[v.ejecutivo_id]) {
          rankMap[v.ejecutivo_id] = { net: 0, com: 0, count: 0 };
        }
        rankMap[v.ejecutivo_id].net += Number(v.total_neto || 0);
        rankMap[v.ejecutivo_id].com += Number(v.total_comision || 0);
        rankMap[v.ejecutivo_id].count += 1;
      });

      const list: EjecutivoRanking[] = users.map((u) => {
        const stats = rankMap[u.id] || { net: 0, com: 0, count: 0 };
        return {
          id: u.id,
          nombre: u.nombre || u.email,
          email: u.email,
          ventasNetas: stats.net,
          totalComision: stats.com,
          cantidadVentas: stats.count,
        };
      });

      // Sort descending by net sales
      list.sort((a, b) => b.ventasNetas - a.ventasNetas);
      setRanking(list);

    } catch (err: any) {
      toast.error("Error al cargar ranking: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarRanking();
  }, [periodo, desde, hasta]);

  // Podium positions helper
  function getPositionBadge(index: number) {
    if (index === 0) {
      return (
        <span className="flex items-center justify-center h-7 w-7 rounded-full bg-yellow-100 text-yellow-700 font-bold border border-yellow-300 shadow-sm animate-bounce mt-1">
          <Trophy className="h-4 w-4" />
        </span>
      );
    }
    if (index === 1) {
      return (
        <span className="flex items-center justify-center h-7 w-7 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-300 shadow-sm">
          <Medal className="h-4 w-4" />
        </span>
      );
    }
    if (index === 2) {
      return (
        <span className="flex items-center justify-center h-7 w-7 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-300 shadow-sm">
          <Award className="h-4 w-4" />
        </span>
      );
    }
    return (
      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-50 text-slate-500 text-xs font-semibold">
        {index + 1}°
      </span>
    );
  }

  const topPerformer = ranking[0];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            Ranking de Ejecutivos <Trophy className="h-6 w-6 text-yellow-500" />
          </h1>
          <p className="text-sm text-muted-foreground">
            Clasificación de rendimiento competitivo basada en ventas netas totales.
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
            onClick={() => setPeriodo("anio")} 
            variant={periodo === "anio" ? "default" : "outline"} 
            className="text-xs h-8"
          >
            Este año
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

      {/* LEADERS PODIUM PREVIEW (IF DATA EXISTS) */}
      {topPerformer && topPerformer.ventasNetas > 0 && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-3 border-2 border-yellow-300 bg-yellow-50/20 shadow-md">
            <CardContent className="pt-6 pb-6 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 border-2 border-yellow-400 shadow-sm">
                  <Trophy className="h-8 w-8 animate-pulse" />
                </div>
                <div>
                  <Badge className="bg-yellow-200 text-yellow-800 border-none font-bold text-[10px] uppercase tracking-wider mb-1">
                    Líder del Período
                  </Badge>
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-1.5">
                    {topPerformer.nombre}
                    {topPerformer.id === user?.id && (
                      <span className="text-xs font-semibold bg-primary text-primary-foreground py-0.5 px-2 rounded-full">¡Tú!</span>
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground">{topPerformer.email}</p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <div className="text-center bg-white px-4 py-2 rounded-lg border shadow-sm">
                  <span className="block text-[10px] font-semibold text-muted-foreground uppercase">Ventas Cerradas</span>
                  <span className="text-lg font-bold text-slate-800">{topPerformer.cantidadVentas}</span>
                </div>
                <div className="text-center bg-white px-4 py-2 rounded-lg border shadow-sm">
                  <span className="block text-[10px] font-semibold text-muted-foreground uppercase">Comisión Estimada</span>
                  <span className="text-lg font-bold text-slate-800">{formatCLP(topPerformer.totalComision)}</span>
                </div>
                <div className="text-center bg-yellow-100 px-6 py-2.5 rounded-lg border border-yellow-300 shadow-sm">
                  <span className="block text-[10px] font-bold text-yellow-800 uppercase flex items-center gap-1">
                    <Zap className="h-3 w-3 text-yellow-600" /> Facturación Neta
                  </span>
                  <span className="text-xl font-extrabold text-primary">{formatCLP(topPerformer.ventasNetas)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* RANKING LIST TABLE */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="bg-slate-50/50">
          <CardTitle className="text-base text-primary font-bold">Clasificación General</CardTitle>
          <CardDescription>Rendimiento comercial por ejecutivo ordenado de mayor a menor.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Cargando clasificación…</div>
          ) : ranking.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Sin datos en el período.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-center">Puesto</TableHead>
                  <TableHead>Ejecutivo</TableHead>
                  <TableHead className="text-right">Total Ventas Netas</TableHead>
                  <TableHead className="text-right">Comisión Generada</TableHead>
                  <TableHead className="text-center">Ventas Realizadas</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranking.map((row, index) => {
                  const isCurrentUser = row.id === user?.id;
                  
                  return (
                    <TableRow 
                      key={row.id} 
                      className={`hover:bg-slate-50/50 transition-colors ${
                        isCurrentUser ? "bg-primary/5 hover:bg-primary/10 border-l-4 border-l-primary" : ""
                      }`}
                    >
                      <TableCell className="text-center font-bold">
                        <div className="flex justify-center">
                          {getPositionBadge(index)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          {row.nombre}
                          {isCurrentUser && (
                            <Badge className="bg-primary text-primary-foreground text-[9px] h-4 py-0 flex items-center gap-0.5">
                              <UserCheck className="h-2.5 w-2.5" /> Tú
                            </Badge>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-medium">{row.email}</div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-800">{formatCLP(row.ventasNetas)}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">{formatCLP(row.totalComision)}</TableCell>
                      <TableCell className="text-center font-bold text-slate-600">{row.cantidadVentas}</TableCell>
                      <TableCell className="text-center">
                        {row.ventasNetas > 0 ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-none hover:bg-emerald-100 font-bold text-[9px]">
                            Activo
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-500 border-none hover:bg-slate-100 font-bold text-[9px]">
                            Inactivo
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
