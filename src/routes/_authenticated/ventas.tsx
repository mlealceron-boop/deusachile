import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { 
  Plus, 
  Trash2, 
  Eye, 
  Calendar, 
  User, 
  FileText, 
  ShoppingCart, 
  DollarSign,
  TrendingUp,
  Percent,
  Search,
  Filter,
  ArrowLeft,
  X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { formatCLP, parseProductoNombre, obtenerPrecioPorVolumen } from "@/lib/products";
import { BulkUploadDialog } from "@/components/BulkUploadDialog";
import { descargarPlantillaVentas, importarVentas } from "@/lib/bulk-upload";

export const Route = createFileRoute("/_authenticated/ventas")({
  component: VentasPage,
});

interface Venta {
  id: string;
  cliente_id: string;
  ejecutivo_id: string;
  fecha: string;
  total_neto: number;
  total_bruto: number;
  total_comision: number;
  porcentaje_comision: number;
  es_muestra?: boolean;
  creado_por: string | null;
  creado_en: string;
  clientes?: { nombre: string; clinica: string | null } | null;
  usuarios?: { nombre: string } | null;
  venta_items?: { id: string }[];
}

interface VentaItem {
  id?: string;
  producto_id: string;
  cantidad: number;
  precio_neto_unit: number;
  subtotal_neto: number;
  subtotal_bruto: number;
  comision_item: number;
}

interface Producto {
  id: string;
  nombre: string;
  marca_id: string;
  precio_referencia: number;
  activo: boolean;
  marcas?: { nombre: string } | null;
}

interface Cliente {
  id: string;
  nombre: string;
  clinica: string | null;
  ejecutivo_id: string;
}

function VentasPage() {
  const { user } = useCurrentUser();
  const isAdmin = user?.rol === "admin";

  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [ejecutivos, setEjecutivos] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [inventario, setInventario] = useState<Record<string, { stock_actual: number; stock_minimo: number }>>({});

  // Commission Config
  const [porcentajeComisionVigente, setPorcentajeComisionVigente] = useState(8.0);

  // List filters
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("todos");
  const [filtroEjecutivo, setFiltroEjecutivo] = useState("todos");

  // Selected sale for detail view
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);
  const [selectedVentaItems, setSelectedVentaItems] = useState<any[]>([]);

  // Create Form State
  const [formCabecera, setFormCabecera] = useState({
    cliente_id: "",
    ejecutivo_id: "",
    fecha: new Date().toISOString().split("T")[0],
  });
  const [formItems, setFormItems] = useState<VentaItem[]>([]);
  const [guardando, setGuardando] = useState(false);

  async function cargarDatos() {
    setLoading(true);
    try {
      // 1. Fetch sales
      const { data: vData, error: vErr } = await supabase
        .from("ventas")
        .select("*, clientes:cliente_id(nombre, clinica), usuarios!ventas_ejecutivo_id_fkey(nombre), venta_items(id)")
        .order("fecha", { ascending: false });
      if (vErr) throw vErr;
      setVentas((vData as any) ?? []);

      // 2. Fetch active products
      const { data: pData, error: pErr } = await supabase
        .from("productos")
        .select("id,marca_id,nombre,precio_referencia,activo,creado_en, marcas:marca_id(nombre)")
        .eq("activo", true)
        .order("nombre");
      if (pErr) throw pErr;
      setProductos(pData ?? []);

      // 3. Fetch clients
      const { data: cData, error: cErr } = await supabase
        .from("clientes")
        .select("id, nombre, clinica, ejecutivo_id")
        .in("estado", ["activo", "prospecto"]); // Allow both active and prospect clients to buy
      if (cErr) throw cErr;
      setClientes(cData ?? []);

      // 4. Fetch executives
      const { data: uData, error: uErr } = await supabase
        .from("usuarios")
        .select("id, nombre")
        .eq("activo", true);
      if (uErr) throw uErr;
      setEjecutivos(uData ?? []);

      // 5. Fetch inventory
      const { data: invData, error: invErr } = await supabase
        .from("inventario")
        .select("producto_id, stock_actual, stock_minimo");
      if (invErr) throw invErr;
      const invMap: Record<string, { stock_actual: number; stock_minimo: number }> = {};
      if (invData) {
        invData.forEach((item) => {
          invMap[item.producto_id] = {
            stock_actual: Number(item.stock_actual || 0),
            stock_minimo: Number(item.stock_minimo || 0),
          };
        });
      }
      setInventario(invMap);

      // 6. Fetch current commission config
      const { data: comData } = await supabase
        .from("config_comision")
        .select("porcentaje")
        .order("vigente_desde", { ascending: false })
        .limit(1);
      if (comData && comData.length > 0) {
        setPorcentajeComisionVigente(Number(comData[0].porcentaje));
      }
    } catch (err: any) {
      toast.error("Error al cargar datos: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  // Update default form values when user logs in
  useEffect(() => {
    if (user) {
      setFormCabecera((prev) => ({
        ...prev,
        ejecutivo_id: prev.ejecutivo_id || user.id,
      }));
    }
  }, [user]);

  // --- CREATION HANDLERS ---
  function abrirCrearVenta() {
    // Select first customer as default
    const filteredClients = isAdmin 
      ? clientes 
      : clientes.filter(c => c.ejecutivo_id === user?.id);

    setFormCabecera({
      cliente_id: filteredClients[0]?.id || "",
      ejecutivo_id: isAdmin ? (ejecutivos[0]?.id || "") : (user?.id || ""),
      fecha: new Date().toISOString().split("T")[0],
    });
    setFormItems([]);
    setView("create");
  }

  function agregarLinea() {
    if (productos.length === 0) {
      toast.error("No hay productos activos disponibles");
      return;
    }
    const primerProd = productos[0];
    const { escalas } = parseProductoNombre(primerProd.nombre);
    const precioReferencia = primerProd.precio_referencia;
    
    // Auto-calculate scales for quantity = 1
    const precioNeto = obtenerPrecioPorVolumen(escalas, 1, precioReferencia);
    const subNeto = 1 * precioNeto;
    const subBruto = subNeto * 1.19;
    const comision = subNeto * (porcentajeComisionVigente / 100);

    setFormItems([
      ...formItems,
      {
        producto_id: primerProd.id,
        cantidad: 1,
        precio_neto_unit: precioNeto,
        subtotal_neto: subNeto,
        subtotal_bruto: subBruto,
        comision_item: comision,
      },
    ]);
  }

  function removerLinea(index: number) {
    setFormItems(formItems.filter((_, idx) => idx !== index));
  }

  function handleItemChange(index: number, field: keyof VentaItem, value: any) {
    const updated = [...formItems];
    const item = { ...updated[index] };

    if (field === "producto_id") {
      item.producto_id = value;
      // Pre-fill reference price and re-evaluate scales
      const prod = productos.find(p => p.id === value);
      if (prod) {
        const { escalas } = parseProductoNombre(prod.nombre);
        item.precio_neto_unit = obtenerPrecioPorVolumen(escalas, item.cantidad, prod.precio_referencia);
      }
    } else if (field === "cantidad") {
      item.cantidad = Math.max(1, parseInt(value, 10) || 1);
      // Re-evaluate scale prices based on new quantity
      const prod = productos.find(p => p.id === item.producto_id);
      if (prod) {
        const { escalas } = parseProductoNombre(prod.nombre);
        item.precio_neto_unit = obtenerPrecioPorVolumen(escalas, item.cantidad, prod.precio_referencia);
      }
    } else if (field === "precio_neto_unit") {
      item.precio_neto_unit = Math.max(0, parseFloat(value) || 0);
    }

    // Recalculate totals
    item.subtotal_neto = item.cantidad * item.precio_neto_unit;
    item.subtotal_bruto = Math.round(item.subtotal_neto * 1.19);
    item.comision_item = Math.round(item.subtotal_neto * (porcentajeComisionVigente / 100));

    updated[index] = item;
    setFormItems(updated);
  }

  // Calculate Running Totals for the Footer
  const totalNeto = formItems.reduce((acc, curr) => acc + curr.subtotal_neto, 0);
  const totalBruto = formItems.reduce((acc, curr) => acc + curr.subtotal_bruto, 0);
  const totalComision = formItems.reduce((acc, curr) => acc + curr.comision_item, 0);

  async function guardarVenta(e: React.FormEvent) {
    e.preventDefault();
    if (!formCabecera.cliente_id) {
      toast.error("Selecciona un cliente");
      return;
    }
    if (formItems.length === 0) {
      toast.error("Debes agregar al menos un producto a la venta");
      return;
    }

    // 0. Validate stock level locally before pushing changes
    for (const item of formItems) {
      const stockDisp = inventario[item.producto_id]?.stock_actual ?? 0;
      if (item.cantidad > stockDisp) {
        const prod = productos.find(p => p.id === item.producto_id);
        const { nombre: cleanNombre } = prod ? parseProductoNombre(prod.nombre) : { nombre: "Producto" };
        toast.error(`Stock insuficiente para ${cleanNombre}. Disponible: ${stockDisp} unidades.`);
        setGuardando(false);
        return;
      }
    }

    setGuardando(true);
    try {
      // 1. Insert header
      const { data: ventaData, error: ventaErr } = await supabase
        .from("ventas")
        .insert({
          cliente_id: formCabecera.cliente_id,
          ejecutivo_id: formCabecera.ejecutivo_id || user?.id || "",
          fecha: new Date(formCabecera.fecha).toISOString(),
          porcentaje_comision: porcentajeComisionVigente,
          total_neto: totalNeto,
          total_bruto: totalBruto,
          total_comision: totalComision,
          creado_por: user?.id || null,
        })
        .select("id")
        .single();

      if (ventaErr) throw ventaErr;
      const ventaId = ventaData.id;

      // 2. Insert items
      const itemsPayload = formItems.map((item) => ({
        venta_id: ventaId,
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        precio_neto_unit: item.precio_neto_unit,
        subtotal_neto: item.subtotal_neto,
        subtotal_bruto: item.subtotal_bruto,
        comision_item: item.comision_item,
      }));

      const { error: itemsErr } = await supabase.from("venta_items").insert(itemsPayload);
      if (itemsErr) throw itemsErr;

      // 3. Register stock outputs via RPC (takes care of updating inventario and logging movements)
      for (const item of formItems) {
        const { error: rpcStockErr } = await supabase.rpc("registrar_salida_venta", {
          p_producto_id: item.producto_id,
          p_cantidad: item.cantidad,
          p_venta_id: ventaId,
          p_usuario_id: user?.id || ""
        });
        if (rpcStockErr) throw rpcStockErr;
      }

      // 4. Trigger recalculate database function
      const { error: rpcErr } = await supabase.rpc("recalcular_venta", { p_venta_id: ventaId });
      if (rpcErr) throw rpcErr;

      toast.success("Venta registrada correctamente");
      setView("list");
      cargarDatos();
    } catch (err: any) {
      toast.error("Error al registrar venta: " + err.message);
    } finally {
      setGuardando(false);
    }
  }

  // --- DETAIL VIEW HANDLERS ---
  async function abrirDetalle(v: Venta) {
    setSelectedVenta(v);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("venta_items")
        .select("*, productos:producto_id(nombre, marcas:marca_id(nombre))")
        .eq("venta_id", v.id);
      if (error) throw error;
      setSelectedVentaItems(data ?? []);
      setView("detail");
    } catch (err: any) {
      toast.error("Error al cargar detalles de ítems: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function anularVenta(ventaId: string) {
    if (!confirm("¿Estás seguro de que deseas anular esta venta? Se devolverá el stock al inventario y se eliminará del historial.")) return;
    try {
      const { error } = await supabase.rpc("anular_venta", { p_venta_id: ventaId });
      if (error) throw error;
      toast.success("Venta anulada y stock devuelto al inventario");
      setView("list");
      cargarDatos();
    } catch (err: any) {
      toast.error("Error al anular venta: " + err.message);
    }
  }

  // --- FILTROS Y BÚSQUEDA ---
  const ventasFiltradas = ventas.filter((v) => {
    const matchesFechaDesde = !filtroFechaDesde || new Date(v.fecha) >= new Date(filtroFechaDesde);
    const matchesFechaHasta = !filtroFechaHasta || new Date(v.fecha) <= new Date(filtroFechaHasta + "T23:59:59");
    const matchesCliente = filtroCliente === "todos" || v.cliente_id === filtroCliente;
    const matchesEjecutivo = filtroEjecutivo === "todos" || v.ejecutivo_id === filtroEjecutivo;

    return matchesFechaDesde && matchesFechaHasta && matchesCliente && matchesEjecutivo;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* VISTA LISTADO DE VENTAS */}
      {view === "list" && (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-primary">Ventas</h1>
              <p className="text-sm text-muted-foreground">
                {isAdmin ? "Historial global de facturación y comisiones." : "Tu historial de ventas y comisiones registradas."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && user && (
                <BulkUploadDialog
                  title="Carga masiva de ventas"
                  description="Importa varias ventas desde un archivo Excel. Cada fila es un ítem; agrupa ítems de la misma venta con el mismo 'venta_ref'."
                  onDownloadTemplate={descargarPlantillaVentas}
                  onImport={(file) => importarVentas(file, user.id)}
                  onDone={cargarDatos}
                />
              )}
              <Button onClick={abrirCrearVenta} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md transition-all hover:scale-[1.01]">
                <Plus className="mr-2 h-4 w-4" /> Registrar Venta
              </Button>
            </div>

          </div>

          {/* Filters Card */}
          <Card className="border border-border">
            <CardContent className="pt-6">
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Desde</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      className="pl-9 h-9"
                      value={filtroFechaDesde}
                      onChange={(e) => setFiltroFechaDesde(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Hasta</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      className="pl-9 h-9"
                      value={filtroFechaHasta}
                      onChange={(e) => setFiltroFechaHasta(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Cliente</Label>
                  <Select value={filtroCliente} onValueChange={setFiltroCliente}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los Clientes</SelectItem>
                      {clientes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nombre} {c.clinica ? `(${c.clinica})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isAdmin && (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">Ejecutivo</Label>
                    <Select value={filtroEjecutivo} onValueChange={setFiltroEjecutivo}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los Ejecutivos</SelectItem>
                        {ejecutivos.map((e) => (
                          <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sales List Table */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="bg-slate-50/50">
              <CardTitle className="text-base text-primary">Historial de Ventas ({ventasFiltradas.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Cargando ventas…</div>
              ) : ventasFiltradas.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No se registraron ventas en este periodo.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cliente</TableHead>
                      {isAdmin && <TableHead>Ejecutivo</TableHead>}
                      <TableHead>Ítems</TableHead>
                      <TableHead>Total Neto</TableHead>
                      <TableHead>Total Bruto</TableHead>
                      <TableHead>Comisión ({porcentajeComisionVigente}%)</TableHead>
                      <TableHead className="text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ventasFiltradas.map((v) => (
                      <TableRow key={v.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium">
                          {new Date(v.fecha).toLocaleDateString("es-ES")}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-slate-800">{v.clientes?.nombre}</div>
                          {v.clientes?.clinica && <div className="text-xs text-muted-foreground">{v.clientes.clinica}</div>}
                        </TableCell>
                        {isAdmin && <TableCell className="text-slate-600 font-medium">{v.usuarios?.nombre ?? "—"}</TableCell>}
                        <TableCell className="text-slate-600 font-medium">{(v.venta_items?.length || 0)}</TableCell>
                        <TableCell className="font-semibold text-slate-800">{formatCLP(v.total_neto)}</TableCell>
                        <TableCell className="font-semibold text-primary">{formatCLP(v.total_bruto)}</TableCell>
                        <TableCell className="font-semibold text-secondary">{formatCLP(v.total_comision)}</TableCell>
                        <TableCell className="text-right pr-4">
                          <Button variant="ghost" size="sm" onClick={() => abrirDetalle(v)} className="hover:bg-slate-100">
                            <Eye className="h-4 w-4 mr-1 text-slate-600" /> Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* VISTA REGISTRO DE NUEVA VENTA */}
      {view === "create" && (
        <form onSubmit={guardarVenta} className="space-y-6">
          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={() => setView("list")} className="hover:bg-slate-100">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Volver al listado
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-primary">Registrar Nueva Venta</h1>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Header Data Card */}
            <Card className="md:col-span-2 border border-border shadow-sm">
              <CardHeader className="bg-slate-50/50">
                <CardTitle className="text-lg text-primary font-bold">Datos Generales</CardTitle>
                <CardDescription>Selecciona el cliente de tu cartera y la fecha del pedido.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cliente">Cliente de Cartera</Label>
                    <Select
                      value={formCabecera.cliente_id}
                      onValueChange={(v) => setFormCabecera({ ...formCabecera, cliente_id: v })}
                    >
                      <SelectTrigger id="cliente"><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger>
                      <SelectContent>
                        {clientes
                          .filter(c => isAdmin || c.ejecutivo_id === user?.id)
                          .map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nombre} {c.clinica ? `(${c.clinica})` : ""}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {isAdmin && (
                    <div className="space-y-2">
                      <Label htmlFor="ejecutivo">Ejecutivo de la Venta</Label>
                      <Select
                        value={formCabecera.ejecutivo_id}
                        onValueChange={(v) => setFormCabecera({ ...formCabecera, ejecutivo_id: v })}
                      >
                        <SelectTrigger id="ejecutivo"><SelectValue placeholder="Asignar ejecutivo" /></SelectTrigger>
                        <SelectContent>
                          {ejecutivos.map((e) => (
                            <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="fecha">Fecha del Pedido</Label>
                    <Input
                      id="fecha"
                      type="date"
                      required
                      value={formCabecera.fecha}
                      onChange={(e) => setFormCabecera({ ...formCabecera, fecha: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Metrics Card */}
            <Card className="border border-border shadow-sm">
              <CardHeader className="bg-slate-50/50">
                <CardTitle className="text-base text-primary font-semibold">Cálculo de Totales</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-3 text-sm">
                <div className="flex justify-between pb-2 border-b border-slate-100">
                  <span className="text-muted-foreground">Subtotal Neto:</span>
                  <span className="font-semibold text-slate-800">{formatCLP(totalNeto)}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-slate-100">
                  <span className="text-muted-foreground">IVA (19%):</span>
                  <span className="font-semibold text-slate-800">{formatCLP(totalBruto - totalNeto)}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-slate-100 bg-slate-50 p-2 rounded">
                  <span className="text-primary font-bold">Total Bruto:</span>
                  <span className="font-bold text-primary text-base">{formatCLP(totalBruto)}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-secondary font-semibold">Comisión Sugerida ({porcentajeComisionVigente}%):</span>
                  <span className="font-bold text-secondary">{formatCLP(totalComision)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* VENTA ITEMS EDITOR */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between bg-slate-50/50">
              <div>
                <CardTitle className="text-lg text-primary font-bold">Líneas de Detalle</CardTitle>
                <CardDescription>Agrega los productos y define cantidades.</CardDescription>
              </div>
              <Button type="button" onClick={agregarLinea} className="bg-secondary text-secondary-foreground font-semibold">
                <Plus className="mr-1.5 h-4 w-4" /> Agregar Producto
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {formItems.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Aún no has agregado productos a esta venta.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto (SKU)</TableHead>
                      <TableHead className="w-32">Cantidad</TableHead>
                      <TableHead className="w-44">P. Neto Unitario</TableHead>
                      <TableHead>Subtotal Neto</TableHead>
                      <TableHead>Subtotal Bruto</TableHead>
                      <TableHead>Comisión</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formItems.map((item, index) => {
                      const prodInfo = productos.find(p => p.id === item.producto_id);
                      const { escalas } = prodInfo ? parseProductoNombre(prodInfo.nombre) : { escalas: [] };
                      return (
                        <TableRow key={index} className="hover:bg-slate-50/10">
                          <TableCell>
                            <Select
                              value={item.producto_id}
                              onValueChange={(v) => handleItemChange(index, "producto_id", v)}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {productos.map((p) => {
                                  const { nombre: cleanNombre } = parseProductoNombre(p.nombre);
                                  return (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.marcas?.nombre} - {cleanNombre}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            {(() => {
                              const stockDisp = inventario[item.producto_id]?.stock_actual ?? 0;
                              const stockMin = inventario[item.producto_id]?.stock_minimo ?? 0;
                              let stockClass = "text-emerald-600 font-semibold";
                              let stockText = `Stock disponible: ${stockDisp} un.`;
                              if (stockDisp === 0) {
                                stockClass = "text-red-600 font-bold";
                                stockText = "Sin stock disponible";
                              } else if (stockDisp <= stockMin) {
                                stockClass = "text-amber-600 font-bold";
                                stockText = `Stock bajo: ${stockDisp} un. (Mín: ${stockMin})`;
                              }
                              return (
                                <div className={`text-[10px] ${stockClass} mt-0.5`}>
                                  {stockText}
                                </div>
                              );
                            })()}
                            {escalas.length > 0 && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                Escala: {escalas.map(e => `${e.cantidadMinima}+ un -> ${formatCLP(e.precioNeto)}`).join(" | ")}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              className="h-9"
                              value={item.cantidad}
                              onChange={(e) => handleItemChange(index, "cantidad", e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="relative">
                              <span className="absolute left-2.5 top-2 text-xs text-muted-foreground">$</span>
                              <Input
                                type="number"
                                className="pl-6 h-9"
                                value={item.precio_neto_unit}
                                onChange={(e) => handleItemChange(index, "precio_neto_unit", e.target.value)}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold text-slate-700">{formatCLP(item.subtotal_neto)}</TableCell>
                          <TableCell className="font-semibold text-primary">{formatCLP(item.subtotal_bruto)}</TableCell>
                          <TableCell className="font-semibold text-secondary">{formatCLP(item.comision_item)}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => removerLinea(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setView("list")} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" disabled={guardando}>
              {guardando ? "Registrando Venta..." : "Guardar Venta"}
            </Button>
          </div>
        </form>
      )}

      {/* VISTA DETALLE DE VENTA */}
      {view === "detail" && selectedVenta && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={() => setView("list")} className="hover:bg-slate-100">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Volver al listado
            </Button>
            {isAdmin && (
              <Button 
                type="button" 
                variant="destructive" 
                onClick={() => anularVenta(selectedVenta.id)}
                className="font-semibold"
              >
                Anular Venta
              </Button>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Header breakdown */}
            <Card className="md:col-span-2 border border-border shadow-sm">
              <CardHeader className="bg-slate-50/50">
                <CardTitle className="text-xl text-primary font-bold">Ficha de la Venta</CardTitle>
                <CardDescription>Resumen general y datos de facturación.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 text-sm">
                  <div>
                    <Label className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Cliente</Label>
                    <div className="font-semibold text-slate-800 text-base">{selectedVenta.clientes?.nombre}</div>
                    {selectedVenta.clientes?.clinica && <div className="text-slate-600 font-medium">{selectedVenta.clientes.clinica}</div>}
                  </div>
                  <div>
                    <Label className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Ejecutivo Comercial</Label>
                    <div className="font-semibold text-slate-800 text-base">{selectedVenta.usuarios?.nombre}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Fecha de Registro</Label>
                    <div className="font-semibold text-slate-800">{new Date(selectedVenta.fecha).toLocaleDateString("es-ES")}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Porcentaje Comisión</Label>
                    <div className="font-semibold text-slate-800">{selectedVenta.porcentaje_comision}%</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Details breakdown */}
            <Card className="border border-border shadow-sm">
              <CardHeader className="bg-slate-50/50">
                <CardTitle className="text-base text-primary font-semibold">Desglose Financiero</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-3 text-sm">
                <div className="flex justify-between pb-2 border-b border-slate-100">
                  <span className="text-muted-foreground">Total Neto:</span>
                  <span className="font-bold text-slate-800">{formatCLP(selectedVenta.total_neto)}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-slate-100">
                  <span className="text-muted-foreground">IVA (19%):</span>
                  <span className="font-bold text-slate-800">{formatCLP(selectedVenta.total_bruto - selectedVenta.total_neto)}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-slate-100 bg-slate-50 p-2 rounded">
                  <span className="text-primary font-bold">Total Bruto:</span>
                  <span className="font-extrabold text-primary text-base">{formatCLP(selectedVenta.total_bruto)}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-secondary font-semibold">Comisión del Ejecutivo:</span>
                  <span className="font-bold text-secondary">{formatCLP(selectedVenta.total_comision)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown items table */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="bg-slate-50/50">
              <CardTitle className="text-base text-primary">Detalle de Productos Facturados</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 text-sm text-muted-foreground animate-pulse">Cargando productos…</div>
              ) : selectedVentaItems.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">Esta venta no contiene ítems de productos.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marca</TableHead>
                      <TableHead>Producto (SKU)</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Precio Unitario Neto</TableHead>
                      <TableHead>Subtotal Neto</TableHead>
                      <TableHead>Subtotal Bruto (con IVA)</TableHead>
                      <TableHead>Comisión</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedVentaItems.map((item) => {
                      const { nombre: cleanNombre } = parseProductoNombre(item.productos?.nombre || "");
                      return (
                        <TableRow key={item.id} className="hover:bg-slate-50/50">
                          <TableCell className="font-semibold text-slate-800">{item.productos?.marcas?.nombre}</TableCell>
                          <TableCell className="font-medium text-slate-700">{cleanNombre}</TableCell>
                          <TableCell className="text-slate-600">{item.cantidad}</TableCell>
                          <TableCell>{formatCLP(item.precio_neto_unit)}</TableCell>
                          <TableCell className="font-semibold text-slate-700">{formatCLP(item.subtotal_neto)}</TableCell>
                          <TableCell className="font-semibold text-primary">{formatCLP(item.subtotal_bruto)}</TableCell>
                          <TableCell className="font-semibold text-secondary">{formatCLP(item.comision_item)}</TableCell>
                        </TableRow>
                      );
                    })}
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
