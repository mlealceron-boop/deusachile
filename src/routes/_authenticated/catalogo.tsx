import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Edit, Package, Layers, Image as ImageIcon, Check, X, Search, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { 
  parseProductoNombre, 
  encodeProductoNombre, 
  formatCLP, 
  EscalaPrecio 
} from "@/lib/products";

export const Route = createFileRoute("/_authenticated/catalogo")({
  component: CatalogoPage,
});

interface Marca {
  id: string;
  nombre: string;
  activo: boolean;
  creado_en: string;
}

interface Producto {
  id: string;
  marca_id: string;
  nombre: string;
  precio_referencia: number;
  costo_referencia: number;
  activo: boolean;
  creado_en: string;
  marcas?: { nombre: string } | null;
}

function CatalogoPage() {
  const { user } = useCurrentUser();
  const isAdmin = user?.rol === "admin";

  const [activeTab, setActiveTab] = useState("productos");
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [filtroMarca, setFiltroMarca] = useState("todas");
  const [busqueda, setBusqueda] = useState("");

  // Modales
  const [marcaModalOpen, setMarcaModalOpen] = useState(false);
  const [productoModalOpen, setProductoModalOpen] = useState(false);
  
  // Forms States
  const [editingMarca, setEditingMarca] = useState<Marca | null>(null);
  const [marcaForm, setMarcaForm] = useState({ nombre: "", activo: true });

  const [editingProducto, setEditingProducto] = useState<Producto | null>(null);
  const [productoForm, setProductoForm] = useState({
    marca_id: "",
    nombre: "",
    precio_referencia: 0,
    costo_referencia: 0,
    activo: true,
  });
  
  // Volume Pricing Scales
  const [escalas, setEscalas] = useState<EscalaPrecio[]>([]);
  const [nuevaEscalaQty, setNuevaEscalaQty] = useState("");
  const [nuevaEscalaPrice, setNuevaEscalaPrice] = useState("");

  // Image upload
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [productoImages, setProductoImages] = useState<Record<string, string>>({});

  async function cargarDatos() {
    setLoading(true);
    try {
      const [{ data: mData, error: mErr }, { data: pData, error: pErr }] = await Promise.all([
        supabase.from("marcas").select("*").order("nombre"),
        supabase.from("productos").select("*, marcas:marca_id(nombre)").order("nombre"),
      ]);

      if (mErr) throw mErr;
      if (pErr) throw pErr;

      setMarcas(mData ?? []);
      setProductos(pData ?? []);

      // Load image URLs dynamically
      const urls: Record<string, string> = {};
      if (pData) {
        for (const prod of pData) {
          const { data } = supabase.storage.from("productos").getPublicUrl(`${prod.id}.png`);
          if (data?.publicUrl) {
            // Check cache buster to refresh
            urls[prod.id] = `${data.publicUrl}?t=${new Date(prod.creado_en).getTime()}`;
          }
        }
      }
      setProductoImages(urls);
    } catch (err: any) {
      toast.error("Error al cargar catálogo: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  // --- MARCAS HANDLERS ---
  function abrirNuevaMarca() {
    setEditingMarca(null);
    setMarcaForm({ nombre: "", activo: true });
    setMarcaModalOpen(true);
  }

  function abrirEditarMarca(m: Marca) {
    setEditingMarca(m);
    setMarcaForm({ nombre: m.nombre, activo: m.activo });
    setMarcaModalOpen(true);
  }

  async function handleMarcaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!marcaForm.nombre.trim()) return;

    try {
      if (editingMarca) {
        const { error } = await supabase
          .from("marcas")
          .update({ nombre: marcaForm.nombre.trim(), activo: marcaForm.activo })
          .eq("id", editingMarca.id);
        if (error) throw error;
        toast.success("Marca actualizada");
      } else {
        const { error } = await supabase
          .from("marcas")
          .insert({ nombre: marcaForm.nombre.trim(), activo: marcaForm.activo });
        if (error) throw error;
        toast.success("Marca creada");
      }
      setMarcaModalOpen(false);
      cargarDatos();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function toggleMarcaActivo(m: Marca) {
    try {
      const { error } = await supabase
        .from("marcas")
        .update({ activo: !m.activo })
        .eq("id", m.id);
      if (error) throw error;
      toast.success(m.activo ? "Marca desactivada" : "Marca activada");
      cargarDatos();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  // --- PRODUCTOS HANDLERS ---
  function abrirNuevoProducto() {
    setEditingProducto(null);
    setProductoForm({
      marca_id: marcas.filter(m => m.activo)[0]?.id || "",
      nombre: "",
      precio_referencia: 0,
      costo_referencia: 0,
      activo: true,
    });
    setEscalas([]);
    setImageFile(null);
    setImagePreviewUrl(null);
    setProductoModalOpen(true);
  }

  function abrirEditarProducto(p: Producto) {
    setEditingProducto(p);
    const { nombre, escalas: parsedEscalas } = parseProductoNombre(p.nombre);
    setProductoForm({
      marca_id: p.marca_id,
      nombre,
      precio_referencia: p.precio_referencia,
      costo_referencia: p.costo_referencia,
      activo: p.activo,
    });
    setEscalas(parsedEscalas);
    setImageFile(null);
    setImagePreviewUrl(productoImages[p.id] || null);
    setProductoModalOpen(true);
  }

  function agregarEscala() {
    const qty = parseInt(nuevaEscalaQty, 10);
    const price = parseFloat(nuevaEscalaPrice);
    if (isNaN(qty) || qty <= 1 || isNaN(price) || price < 0) {
      toast.error("Ingresa valores válidos (Cantidad mínima > 1, Precio >= 0)");
      return;
    }
    // Remove if already exists
    const filtered = escalas.filter(e => e.cantidadMinima !== qty);
    const updated = [...filtered, { cantidadMinima: qty, precioNeto: price }].sort(
      (a, b) => a.cantidadMinima - b.cantidadMinima
    );
    setEscalas(updated);
    setNuevaEscalaQty("");
    setNuevaEscalaPrice("");
  }

  function eliminarEscala(qty: number) {
    setEscalas(escalas.filter(e => e.cantidadMinima !== qty));
  }

  async function handleProductoSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productoForm.nombre.trim() || !productoForm.marca_id) {
      toast.error("Nombre y marca son requeridos");
      return;
    }

    const nombreCodificado = encodeProductoNombre(productoForm.nombre, escalas);

    try {
      let productId = "";
      if (editingProducto) {
        productId = editingProducto.id;
        const { error } = await supabase
          .from("productos")
          .update({
            marca_id: productoForm.marca_id,
            nombre: nombreCodificado,
            precio_referencia: productoForm.precio_referencia,
            costo_referencia: productoForm.costo_referencia,
            activo: productoForm.activo,
          })
          .eq("id", editingProducto.id);
        if (error) throw error;
        toast.success("Producto actualizado");
      } else {
        const { data, error } = await supabase
          .from("productos")
          .insert({
            marca_id: productoForm.marca_id,
            nombre: nombreCodificado,
            precio_referencia: productoForm.precio_referencia,
            costo_referencia: productoForm.costo_referencia,
            activo: productoForm.activo,
          })
          .select("id")
          .single();
        if (error) throw error;
        productId = data.id;
        toast.success("Producto creado");
      }

      // Handle Image Upload if any
      if (imageFile && productId) {
        setSubiendoImagen(true);
        // Create bucket if it doesn't exist (fails silently or handled gracefully)
        await supabase.storage.createBucket("productos", { public: true }).catch(() => {});
        
        const fileExt = imageFile.name.split(".").pop();
        const filename = `${productId}.png`; // uniform png filenames

        const { error: uploadErr } = await supabase.storage
          .from("productos")
          .upload(filename, imageFile, { upsert: true });

        if (uploadErr) {
          console.error("Storage upload error:", uploadErr);
          toast.warning("El producto se guardó, pero no se pudo cargar la imagen. Asegúrate de tener el bucket 'productos' configurado como público en Supabase.");
        }
      }

      setProductoModalOpen(false);
      cargarDatos();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubiendoImagen(false);
    }
  }

  async function toggleProductoActivo(p: Producto) {
    try {
      const { error } = await supabase
        .from("productos")
        .update({ activo: !p.activo })
        .eq("id", p.id);
      if (error) throw error;
      toast.success(p.activo ? "Producto desactivado" : "Producto activado");
      cargarDatos();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
    }
  };

  // Filtered Lists
  const productosFiltrados = productos.filter((p) => {
    const parsed = parseProductoNombre(p.nombre);
    const matchesBusqueda = 
      parsed.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.marcas?.nombre && p.marcas.nombre.toLowerCase().includes(busqueda.toLowerCase()));
    
    const matchesMarca = filtroMarca === "todas" || p.marca_id === filtroMarca;
    
    return matchesBusqueda && matchesMarca;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Catálogo</h1>
          <p className="text-sm text-muted-foreground">Gestiona marcas, líneas y productos médicos.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-100 border border-slate-200">
          <TabsTrigger value="productos" className="flex items-center gap-1.5 font-semibold">
            <Package className="h-4 w-4" /> Productos (SKUs)
          </TabsTrigger>
          <TabsTrigger value="marcas" className="flex items-center gap-1.5 font-semibold">
            <Layers className="h-4 w-4" /> Marcas
          </TabsTrigger>
        </TabsList>

        {/* TAB PRODUCTOS */}
        <TabsContent value="productos" className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar productos..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-9 focus-visible:ring-primary"
                />
              </div>
              <div className="w-full sm:w-52">
                <Select value={filtroMarca} onValueChange={setFiltroMarca}>
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                      <SelectValue placeholder="Filtrar por marca" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas las marcas</SelectItem>
                    {marcas.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {isAdmin && (
              <Button onClick={abrirNuevoProducto} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                <Plus className="mr-1.5 h-4 w-4" /> Nuevo Producto
              </Button>
            )}
          </div>

          <Card className="border border-border shadow-sm">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Cargando productos…</div>
              ) : productosFiltrados.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No hay productos registrados.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16"></TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>Precio de Referencia</TableHead>
                      {isAdmin && <TableHead>Costo de Referencia</TableHead>}
                      <TableHead>Precios por Volumen</TableHead>
                      <TableHead>Estado</TableHead>
                      {isAdmin && <TableHead className="text-right"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productosFiltrados.map((p) => {
                      const { nombre, escalas: pEscalas } = parseProductoNombre(p.nombre);
                      return (
                        <TableRow key={p.id} className="hover:bg-slate-50/50">
                          <TableCell className="p-2">
                            {productoImages[p.id] ? (
                              <img 
                                src={productoImages[p.id]} 
                                alt={nombre}
                                onError={(e) => {
                                  // Hide broken image
                                  (e.target as HTMLElement).style.display = "none";
                                }}
                                className="h-10 w-10 rounded border object-cover bg-slate-50"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded border bg-slate-50 flex items-center justify-center text-muted-foreground">
                                <ImageIcon className="h-4 w-4" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold text-slate-800">{nombre}</TableCell>
                          <TableCell className="text-slate-600 font-medium">{p.marcas?.nombre ?? "—"}</TableCell>
                          <TableCell className="font-semibold text-primary">{formatCLP(p.precio_referencia)}</TableCell>
                          {isAdmin && <TableCell className="text-slate-600">{formatCLP(p.costo_referencia)}</TableCell>}
                          <TableCell>
                            {pEscalas.length === 0 ? (
                              <span className="text-xs text-muted-foreground">Sin escala</span>
                            ) : (
                              <div className="flex flex-col gap-0.5 text-xs">
                                {pEscalas.map((e) => (
                                  <div key={e.cantidadMinima} className="text-slate-600">
                                    {e.cantidadMinima}+ un: <span className="font-semibold text-slate-800">{formatCLP(e.precioNeto)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={p.activo ? "default" : "secondary"}
                              className={p.activo ? "bg-emerald-100 text-emerald-800 border-none hover:bg-emerald-100" : "bg-slate-100 text-slate-700 border-none hover:bg-slate-100"}
                            >
                              {p.activo ? "Activo" : "Inactivo"}
                            </Badge>
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right pr-4">
                              <div className="flex items-center justify-end gap-2">
                                <Switch checked={p.activo} onCheckedChange={() => toggleProductoActivo(p)} />
                                <Button variant="ghost" size="sm" onClick={() => abrirEditarProducto(p)} className="hover:bg-slate-100">
                                  <Edit className="h-4 w-4 text-slate-600" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB MARCAS */}
        <TabsContent value="marcas" className="space-y-4">
          <div className="flex justify-end">
            {isAdmin && (
              <Button onClick={abrirNuevaMarca} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                <Plus className="mr-1.5 h-4 w-4" /> Nueva Marca
              </Button>
            )}
          </div>

          <Card className="border border-border shadow-sm">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Cargando marcas…</div>
              ) : marcas.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No hay marcas registradas.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre de la Marca</TableHead>
                      <TableHead>Estado</TableHead>
                      {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {marcas.map((m) => (
                      <TableRow key={m.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-semibold text-slate-800">{m.nombre}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={m.activo ? "default" : "secondary"}
                            className={m.activo ? "bg-emerald-100 text-emerald-800 border-none hover:bg-emerald-100" : "bg-slate-100 text-slate-700 border-none hover:bg-slate-100"}
                          >
                            {m.activo ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right pr-4">
                            <div className="flex items-center justify-end gap-2">
                              <Switch checked={m.activo} onCheckedChange={() => toggleMarcaActivo(m)} />
                              <Button variant="ghost" size="sm" onClick={() => abrirEditarMarca(m)} className="hover:bg-slate-100">
                                <Edit className="h-4 w-4 text-slate-600" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL MARCA */}
      <Dialog open={marcaModalOpen} onOpenChange={setMarcaModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMarca ? "Editar Marca" : "Nueva Marca"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleMarcaSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="marca-nombre">Nombre de la Marca</Label>
              <Input
                id="marca-nombre"
                required
                value={marcaForm.nombre}
                onChange={(e) => setMarcaForm({ ...marcaForm, nombre: e.target.value })}
                placeholder="Ej: Regenovue"
              />
            </div>
            <div className="flex items-center justify-between py-2 border-t border-b border-slate-100">
              <Label htmlFor="marca-activo">Estado Activa</Label>
              <Switch
                id="marca-activo"
                checked={marcaForm.activo}
                onCheckedChange={(c) => setMarcaForm({ ...marcaForm, activo: c })}
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {editingMarca ? "Guardar cambios" : "Crear Marca"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL PRODUCTO */}
      <Dialog open={productoModalOpen} onOpenChange={setProductoModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProducto ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleProductoSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="prod-marca">Marca</Label>
                <Select
                  value={productoForm.marca_id}
                  onValueChange={(v) => setProductoForm({ ...productoForm, marca_id: v })}
                >
                  <SelectTrigger id="prod-marca"><SelectValue placeholder="Selecciona marca" /></SelectTrigger>
                  <SelectContent>
                    {marcas.filter(m => m.activo || m.id === productoForm.marca_id).map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prod-nombre">Nombre de SKU / Modelo</Label>
                <Input
                  id="prod-nombre"
                  required
                  value={productoForm.nombre}
                  onChange={(e) => setProductoForm({ ...productoForm, nombre: e.target.value })}
                  placeholder="Ej: Fine Plus"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prod-precio">Precio de Referencia (Neto CLP)</Label>
                <Input
                  id="prod-precio"
                  type="number"
                  required
                  value={productoForm.precio_referencia}
                  onChange={(e) => setProductoForm({ ...productoForm, precio_referencia: Number(e.target.value) })}
                  placeholder="150000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prod-costo">Costo de Referencia (Neto CLP)</Label>
                <Input
                  id="prod-costo"
                  type="number"
                  required
                  value={productoForm.costo_referencia}
                  onChange={(e) => setProductoForm({ ...productoForm, costo_referencia: Number(e.target.value) })}
                  placeholder="50000"
                />
              </div>
            </div>

            {/* Image Upload Selection */}
            <div className="border border-dashed border-slate-300 rounded-lg p-4 bg-slate-50/50">
              <Label className="text-sm font-semibold text-slate-800 block mb-2">Imagen del Producto (PNG o JPG)</Label>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded border bg-white flex items-center justify-center text-muted-foreground overflow-hidden">
                  {imagePreviewUrl ? (
                    <img src={imagePreviewUrl} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-6 w-6" />
                  )}
                </div>
                <div className="flex-1">
                  <Input type="file" accept="image/png, image/jpeg" onChange={handleImageChange} className="max-w-xs cursor-pointer text-xs" />
                  <span className="text-[10px] text-muted-foreground block mt-1">Sube archivos livianos en formato JPG o PNG.</span>
                </div>
              </div>
            </div>

            {/* Volume Pricing Editor */}
            <div className="border border-slate-100 rounded-lg p-4 bg-slate-50/50 space-y-3">
              <h3 className="text-sm font-bold text-primary flex items-center gap-1.5">
                <Layers className="h-4 w-4" /> Escalas de Precios por Volumen
              </h3>
              <div className="flex items-end gap-2">
                <div className="space-y-1 flex-1">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Cant. Mínima</Label>
                  <Input
                    type="number"
                    value={nuevaEscalaQty}
                    onChange={(e) => setNuevaEscalaQty(e.target.value)}
                    placeholder="Ej: 5"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1 flex-1">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Precio Unitario Neto</Label>
                  <Input
                    type="number"
                    value={nuevaEscalaPrice}
                    onChange={(e) => setNuevaEscalaPrice(e.target.value)}
                    placeholder="Ej: 140000"
                    className="h-8 text-xs"
                  />
                </div>
                <Button type="button" size="sm" onClick={agregarEscala} className="bg-secondary text-secondary-foreground h-8 font-semibold">
                  Añadir
                </Button>
              </div>

              {/* Scales Table */}
              {escalas.length > 0 && (
                <div className="rounded-md border bg-white">
                  <Table className="text-xs">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="py-1.5">Cantidad</TableHead>
                        <TableHead className="py-1.5">Precio Unitario Neto</TableHead>
                        <TableHead className="py-1.5 text-right"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {escalas.map((e) => (
                        <TableRow key={e.cantidadMinima} className="h-8">
                          <TableCell className="py-1">{e.cantidadMinima} o más unidades</TableCell>
                          <TableCell className="py-1 font-semibold text-primary">{formatCLP(e.precioNeto)}</TableCell>
                          <TableCell className="py-1 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                              onClick={() => eliminarEscala(e.cantidadMinima)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between py-2 border-t border-b border-slate-100">
              <Label htmlFor="prod-activo">Estado Activo</Label>
              <Switch
                id="prod-activo"
                checked={productoForm.activo}
                onCheckedChange={(c) => setProductoForm({ ...productoForm, activo: c })}
              />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={subiendoImagen} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                {subiendoImagen ? "Subiendo imagen..." : editingProducto ? "Guardar cambios" : "Crear Producto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
