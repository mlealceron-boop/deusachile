import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { 
  Package, 
  Plus, 
  Sliders, 
  History, 
  Search, 
  Filter, 
  AlertTriangle, 
  TrendingUp, 
  ShieldAlert, 
  Coins,
  ArrowDownRight,
  ArrowUpRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export const Route = createFileRoute("/_authenticated/inventario")({
  component: InventarioPage,
});

interface InventarioRow {
  id: string;
  producto_id: string;
  stock_actual: number;
  costo_promedio: number;
  stock_minimo: number;
  actualizado_en: string;
  productos: {
    nombre: string;
    marca_id: string;
    marcas?: { nombre: string } | null;
  } | null;
}

interface MovimientoRow {
  id: string;
  producto_id: string;
  tipo: "entrada" | "salida_venta" | "ajuste_positivo" | "ajuste_negativo";
  cantidad: number;
  costo_unitario: number;
  costo_promedio_resultante: number;
  referencia_id: string | null;
  usuario_id: string | null;
  nota: string | null;
  fecha: string;
  productos?: { nombre: string } | null;
  usuarios?: { nombre: string } | null;
}

const TIPO_MOV_LABEL: Record<string, string> = {
  entrada: "Compra / Entrada",
  salida_venta: "Venta / Salida",
  ajuste_positivo: "Ajuste (+)",
  ajuste_negativo: "Ajuste (-)",
};

function InventarioPage() {
  const { user } = useCurrentUser();
  const isAdmin = user?.rol === "admin";

  const [activeTab, setActiveTab] = useState("resumen");
  const [inventarios, setInventarios] = useState<InventarioRow[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoRow[]>([]);
  const [productosActivos, setProductosActivos] = useState<{ id: string; nombre: string; marcaNombre: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Modales
  const [entradaOpen, setEntradaOpen] = useState(false);
  const [ajusteOpen, setAjusteOpen] = useState(false);

  // Form Entrada
  const [entradaForm, setEntradaForm] = useState({
    producto_id: "",
    cantidad: "",
    costo_unitario: "",
    nota: "",
  });

  // Form Ajuste
  const [ajusteForm, setAjusteForm] = useState({
    producto_id: "",
    tipo: "ajuste_positivo" as "ajuste_positivo" | "ajuste_negativo",
    cantidad: "",
    nota: "",
  });

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroAlerta, setFiltroAlerta] = useState("todos");
  
  // Filtros Historial (Admin)
  const [historialProdFilter, setHistorialProdFilter] = useState("todos");
  const [historialTipoFilter, setHistorialTipoFilter] = useState("todos");
  const [historialDesde, setHistorialDesde] = useState("");
  const [historialHasta, setHistorialHasta] = useState("");

  async function cargarDatos() {
    setLoading(true);
    try {
      // 1. Fetch Inventory & joined products
      const { data: invData, error: invErr } = await supabase
        .from("inventario")
        .select("*, productos:producto_id(nombre, marca_id, marcas:marca_id(nombre))")
        .order("actualizado_en", { ascending: false });
      if (invErr) throw invErr;

      // 2. Fetch Active Products for Select input
      const { data: prodData } = await supabase
        .from("productos")
        .select("id, nombre, marcas:marca_id(nombre)")
        .eq("activo", true)
        .order("nombre");
      
      const mappedProds = (prodData ?? []).map((p) => {
        const { nombre } = parseProductoNombre(p.nombre);
        return {
          id: p.id,
          nombre,
          marcaNombre: p.marcas?.nombre ?? "Sin marca",
        };
      });

      setInventarios((invData as any) ?? []);
      setProductosActivos(mappedProds);

      // Pre-fill forms default option
      if (mappedProds.length > 0) {
        setEntradaForm((prev) => ({ ...prev, producto_id: prev.producto_id || mappedProds[0].id }));
        setAjusteForm((prev) => ({ ...prev, producto_id: prev.producto_id || mappedProds[0].id }));
      }

      // 3. Fetch movements if Admin
      if (isAdmin) {
        const { data: movData, error: movErr } = await supabase
          .from("movimientos_inventario")
          .select("*, productos:producto_id(nombre), usuarios:usuario_id(nombre)")
          .order("fecha", { ascending: false });
        if (movErr) throw movErr;
        setMovimientos((movData as any) ?? []);
      }
    } catch (err: any) {
      toast.error("Error al cargar inventario: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, [isAdmin]);

  // --- HANDLERS ---
  async function handleEntradaSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseFloat(entradaForm.cantidad);
    const cost = parseFloat(entradaForm.costo_unitario);

    if (isNaN(qty) || qty <= 0 || isNaN(cost) || cost < 0) {
      toast.error("Por favor ingresa cantidad > 0 y costo unitario >= 0");
      return;
    }

    try {
      const { error } = await supabase.rpc("registrar_entrada_stock", {
        p_producto_id: entradaForm.producto_id,
        p_cantidad: qty,
        p_costo_unitario: cost,
        p_usuario_id: user?.id ?? "",
        p_nota: entradaForm.nota.trim() || "",
      });

      if (error) throw error;

      toast.success("Entrada de stock registrada correctamente");
      setEntradaOpen(false);
      setEntradaForm({
        producto_id: productosActivos[0]?.id || "",
        cantidad: "",
        costo_unitario: "",
        nota: "",
      });
      cargarDatos();
    } catch (err: any) {
      toast.error("Error al guardar: " + err.message);
    }
  }

  async function handleAjusteSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseFloat(ajusteForm.cantidad);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Por favor ingresa una cantidad de ajuste válida (> 0)");
      return;
    }
    if (!ajusteForm.nota.trim()) {
      toast.error("La justificación o nota del ajuste es obligatoria");
      return;
    }

    try {
      const { error } = await supabase.rpc("registrar_ajuste_stock", {
        p_producto_id: ajusteForm.producto_id,
        p_tipo: ajusteForm.tipo,
        p_cantidad: qty,
        p_usuario_id: user?.id ?? "",
        p_nota: ajusteForm.nota.trim(),
      });

      if (error) throw error;

      toast.success("Ajuste de stock registrado");
      setAjusteOpen(false);
      setAjusteForm({
        producto_id: productosActivos[0]?.id || "",
        tipo: "ajuste_positivo",
        cantidad: "",
        nota: "",
      });
      cargarDatos();
    } catch (err: any) {
      toast.error("Error al guardar ajuste: " + err.message);
    }
  }

  // Pre-calculations for Entrada Modal PPM preview
  const previewPpm = (() => {
    if (!entradaForm.producto_id) return null;
    const inv = inventarios.find(i => i.producto_id === entradaForm.producto_id);
    const currentStock = Number(inv?.stock_actual || 0);
    const currentPpm = Number(inv?.costo_promedio || 0);

    const inputQty = parseFloat(entradaForm.cantidad) || 0;
    const inputCost = parseFloat(entradaForm.costo_unitario) || 0;

    const totalQty = currentStock + inputQty;
    if (totalQty <= 0) return { ppm: 0, stock: 0 };

    const estimatedPpm = ((currentStock * currentPpm) + (inputQty * inputCost)) / totalQty;
    return {
      stockAntes: currentStock,
      ppmAntes: currentPpm,
      stockResultante: totalQty,
      ppmResultante: Math.round(estimatedPpm * 100) / 100,
    };
  })();

  // Filtered Inventory
  const inventariosFiltrados = inventarios.filter((i) => {
    const { nombre } = parseProductoNombre(i.productos?.nombre || "");
    const matchesBusqueda = nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
      (i.productos?.marcas?.nombre && i.productos.marcas.nombre.toLowerCase().includes(busqueda.toLowerCase()));
    
    const stockActual = Number(i.stock_actual);
    const stockMinimo = Number(i.stock_minimo);

    if (filtroAlerta === "critico") {
      return matchesBusqueda && stockActual === 0;
    }
    if (filtroAlerta === "bajo") {
      return matchesBusqueda && stockActual > 0 && stockActual <= stockMinimo;
    }
    return matchesBusqueda;
  });

  // Total inventory valuation
  const totalValorizacion = inventariosFiltrados.reduce((acc, curr) => {
    return acc + (Number(curr.stock_actual) * Number(curr.costo_promedio));
  }, 0);

  // Filtered History
  const movimientosFiltrados = movimientos.filter((m) => {
    const matchesProd = historialProdFilter === "todos" || m.producto_id === historialProdFilter;
    const matchesTipo = historialTipoFilter === "todos" || m.tipo === historialTipoFilter;

    const matchesDesde = !historialDesde || new Date(m.fecha) >= new Date(historialDesde);
    const matchesHasta = !historialHasta || new Date(m.fecha) <= new Date(historialHasta + "T23:59:59");

    return matchesProd && matchesTipo && matchesDesde && matchesHasta;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Inventario</h1>
          <p className="text-sm text-muted-foreground">
            Control de stock comercial valorizado bajo el modelo de Precio Promedio Ponderado (PPM).
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button onClick={() => setAjusteOpen(true)} variant="outline" className="border-secondary text-secondary hover:bg-secondary/10 font-semibold shadow-sm">
              <Sliders className="mr-2 h-4 w-4" /> Ajuste de Stock
            </Button>
            <Button onClick={() => setEntradaOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md">
              <Plus className="mr-2 h-4 w-4" /> Registrar Entrada
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-100 border border-slate-200">
          <TabsTrigger value="resumen" className="flex items-center gap-1.5 font-semibold">
            <Package className="h-4 w-4" /> Resumen de Stock
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="historial" className="flex items-center gap-1.5 font-semibold">
              <History className="h-4 w-4" /> Historial de Movimientos
            </TabsTrigger>
          )}
        </TabsList>

        {/* RESUMEN DE STOCK */}
        <TabsContent value="resumen" className="space-y-4">
          <Card className="border border-border">
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar productos..."
                    className="pl-9 focus-visible:ring-primary"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                </div>
                
                <div>
                  <Select value={filtroAlerta} onValueChange={setFiltroAlerta}>
                    <SelectTrigger>
                      <div className="flex items-center gap-2">
                        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                        <SelectValue placeholder="Filtro de stock" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los niveles</SelectItem>
                      <SelectItem value="bajo">Stock Bajo Mínimo</SelectItem>
                      <SelectItem value="critico">Sin Stock (Cero)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-sm">
            <CardHeader className="bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base text-primary">Saldo Actual de Productos</CardTitle>
                <CardDescription>Detalle valorizado con costos PPP y umbrales mínimos.</CardDescription>
              </div>
              <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-lg border border-slate-200">
                <Coins className="h-4 w-4 text-primary" />
                <div className="text-xs font-semibold text-slate-600">
                  Valorización Almacén:{" "}
                  <span className="text-sm font-bold text-primary">{formatCLP(totalValorizacion)}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Cargando inventario…</div>
              ) : inventariosFiltrados.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No se encontraron saldos registrados.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto (SKU)</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead className="text-right">Stock Actual</TableHead>
                      <TableHead className="text-right">Costo Promedio (PPM)</TableHead>
                      <TableHead className="text-right">Valorización Total</TableHead>
                      <TableHead className="text-right">Stock Mínimo</TableHead>
                      <TableHead className="w-24 text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventariosFiltrados.map((row) => {
                      const { nombre: cleanNombre } = parseProductoNombre(row.productos?.nombre || "");
                      const stock = Number(row.stock_actual);
                      const min = Number(row.stock_minimo);
                      const ppm = Number(row.costo_promedio);
                      const totalVal = stock * ppm;

                      const isZero = stock === 0;
                      const isLow = stock > 0 && stock <= min;

                      return (
                        <TableRow 
                          key={row.id} 
                          className={`hover:bg-slate-50/50 transition-colors ${
                            isZero ? "bg-red-50/50 hover:bg-red-50/80" : isLow ? "bg-amber-50/50 hover:bg-amber-50/80" : ""
                          }`}
                        >
                          <TableCell className="font-semibold text-slate-800">{cleanNombre}</TableCell>
                          <TableCell className="font-medium text-slate-600">
                            {row.productos?.marcas?.nombre ?? "—"}
                          </TableCell>
                          <TableCell className="text-right font-bold text-slate-800">{stock}</TableCell>
                          <TableCell className="text-right text-slate-700 font-semibold">{formatCLP(ppm)}</TableCell>
                          <TableCell className="text-right text-primary font-bold">{formatCLP(totalVal)}</TableCell>
                          <TableCell className="text-right text-slate-500 font-medium">{min}</TableCell>
                          <TableCell className="text-center">
                            {isZero ? (
                              <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive font-bold text-[10px] py-0 h-5">
                                Sin Stock
                              </Badge>
                            ) : isLow ? (
                              <Badge className="bg-amber-100 text-amber-800 border-none hover:bg-amber-100 font-bold text-[10px] py-0 h-5">
                                Bajo Mínimo
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-800 border-none hover:bg-emerald-100 font-bold text-[10px] py-0 h-5">
                                Óptimo
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
        </TabsContent>

        {/* HISTORIAL DE MOVIMIENTOS (ADMIN ONLY) */}
        {isAdmin && (
          <TabsContent value="historial" className="space-y-4">
            <Card className="border border-border">
              <CardContent className="pt-6">
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Filtrar por SKU</Label>
                    <Select value={historialProdFilter} onValueChange={setHistorialProdFilter}>
                      <SelectTrigger className="h-9 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los productos</SelectItem>
                        {productosActivos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Tipo de Movimiento</Label>
                    <Select value={historialTipoFilter} onValueChange={setHistorialTipoFilter}>
                      <SelectTrigger className="h-9 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los tipos</SelectItem>
                        <SelectItem value="entrada">Entradas (Compras)</SelectItem>
                        <SelectItem value="salida_venta">Salidas (Ventas)</SelectItem>
                        <SelectItem value="ajuste_positivo">Ajustes (+)</SelectItem>
                        <SelectItem value="ajuste_negativo">Ajustes (-)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Desde</Label>
                    <Input
                      type="date"
                      className="h-9 text-xs mt-1"
                      value={historialDesde}
                      onChange={(e) => setHistorialDesde(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Hasta</Label>
                    <Input
                      type="date"
                      className="h-9 text-xs mt-1"
                      value={historialHasta}
                      onChange={(e) => setHistorialHasta(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm">
              <CardHeader className="bg-slate-50/50">
                <CardTitle className="text-base text-primary">Libro Mayor de Stock</CardTitle>
                <CardDescription>Auditoría completa de entradas, salidas y ajustes de stock comercial.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Cargando historial…</div>
                ) : movimientosFiltrados.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No se encontraron movimientos.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Producto (SKU)</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Costo Movimiento</TableHead>
                        <TableHead className="text-right">PPM Resultante</TableHead>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Nota / Referencia</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movimientosFiltrados.map((mov) => {
                        const { nombre: cleanNombre } = parseProductoNombre(mov.productos?.nombre || "");
                        const isPositive = mov.tipo === "entrada" || mov.tipo === "ajuste_positivo";
                        
                        return (
                          <TableRow key={mov.id} className="hover:bg-slate-50/50">
                            <TableCell className="text-xs text-slate-500">
                              {new Date(mov.fecha).toLocaleString("es-ES")}
                            </TableCell>
                            <TableCell className="font-semibold text-slate-800">{cleanNombre}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {isPositive ? (
                                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <ArrowDownRight className="h-3.5 w-3.5 text-red-600" />
                                )}
                                <span className={`text-xs font-semibold ${isPositive ? "text-emerald-700" : "text-red-700"}`}>
                                  {TIPO_MOV_LABEL[mov.tipo] || mov.tipo}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {isPositive ? "+" : "-"}{mov.cantidad}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-slate-700">
                              {formatCLP(mov.costo_unitario)}
                            </TableCell>
                            <TableCell className="text-right font-bold text-primary">
                              {formatCLP(mov.costo_promedio_resultante)}
                            </TableCell>
                            <TableCell className="text-xs font-semibold text-slate-600">
                              {mov.usuarios?.nombre ?? "Sistema"}
                            </TableCell>
                            <TableCell className="text-xs text-slate-500 max-w-xs truncate">
                              {mov.nota || "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* DIALOG: REGISTRAR ENTRADA */}
      <Dialog open={entradaOpen} onOpenChange={setEntradaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Entrada de Stock (Compra)</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEntradaSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ent-producto">Producto (SKU)</Label>
              <Select
                value={entradaForm.producto_id}
                onValueChange={(v) => setEntradaForm({ ...entradaForm, producto_id: v })}
              >
                <SelectTrigger id="ent-producto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {productosActivos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.marcaNombre} - {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ent-cantidad">Cantidad a Ingresar</Label>
                <Input
                  id="ent-cantidad"
                  type="number"
                  required
                  min="1"
                  placeholder="Ej: 50"
                  value={entradaForm.cantidad}
                  onChange={(e) => setEntradaForm({ ...entradaForm, cantidad: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ent-costo">Costo Unitario de Compra (Neto)</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs text-muted-foreground">$</span>
                  <Input
                    id="ent-costo"
                    type="number"
                    required
                    min="0"
                    placeholder="Ej: 12000"
                    className="pl-6"
                    value={entradaForm.costo_unitario}
                    onChange={(e) => setEntradaForm({ ...entradaForm, costo_unitario: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* PREVIEW PPM */}
            {previewPpm && (
              <div className="bg-slate-50 border rounded-lg p-3 text-xs space-y-2">
                <div className="font-semibold text-primary">Simulación Precio Promedio Ponderado (PPM)</div>
                <div className="grid grid-cols-2 gap-2 text-slate-600 font-medium">
                  <div>Stock actual: {previewPpm.stockAntes} un.</div>
                  <div>PPM actual: {formatCLP(previewPpm.ppmAntes ?? 0)}</div>
                  <div className="font-semibold text-slate-800">Stock Resultante: {previewPpm.stockResultante} un.</div>
                  <div className="font-semibold text-primary">PPM Resultante: {formatCLP(previewPpm.ppmResultante ?? 0)}</div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="ent-nota">Nota / Comentarios</Label>
              <Input
                id="ent-nota"
                placeholder="Ej: Factura de compra N° 458"
                value={entradaForm.nota}
                onChange={(e) => setEntradaForm({ ...entradaForm, nota: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                Guardar Entrada de Stock
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: AJUSTE DE STOCK */}
      <Dialog open={ajusteOpen} onOpenChange={setAjusteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Ajuste de Stock</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAjusteSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="aj-producto">Producto (SKU)</Label>
              <Select
                value={ajusteForm.producto_id}
                onValueChange={(v) => setAjusteForm({ ...ajusteForm, producto_id: v })}
              >
                <SelectTrigger id="aj-producto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {productosActivos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.marcaNombre} - {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="aj-tipo">Tipo de Ajuste</Label>
                <Select
                  value={ajusteForm.tipo}
                  onValueChange={(v) => setAjusteForm({ ...ajusteForm, tipo: v as any })}
                >
                  <SelectTrigger id="aj-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ajuste_positivo">Incrementar (+)</SelectItem>
                    <SelectItem value="ajuste_negativo">Reducir (-)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="aj-cantidad">Cantidad</Label>
                <Input
                  id="aj-cantidad"
                  type="number"
                  required
                  min="1"
                  placeholder="Ej: 5"
                  value={ajusteForm.cantidad}
                  onChange={(e) => setAjusteForm({ ...ajusteForm, cantidad: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="aj-nota">Justificación / Motivo del Ajuste (Obligatorio)</Label>
              <Input
                id="aj-nota"
                required
                placeholder="Ej: Corrección por inventario físico, producto dañado..."
                value={ajusteForm.nota}
                onChange={(e) => setAjusteForm({ ...ajusteForm, nota: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold">
                Aplicar Ajuste de Stock
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
