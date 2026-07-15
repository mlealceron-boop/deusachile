import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, Filter, Plus, Users, LayoutGrid, List, Phone, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { BulkUploadDialog } from "@/components/BulkUploadDialog";
import { descargarPlantillaClientes, importarClientes } from "@/lib/bulk-upload";

export const Route = createFileRoute("/_authenticated/clientes/")({
  component: ClientesPage,
});

type TipoCliente = "clinica_propia" | "recien_empieza";
type EstadoCliente = "prospecto" | "activo" | "inactivo";

interface ClienteRow {
  id: string;
  nombre: string;
  clinica: string | null;
  contacto: string | null;
  tipo: TipoCliente;
  estado: EstadoCliente;
  ejecutivo_id: string;
  creado_en: string;
  usuarios?: { nombre: string } | null;
}

const ESTADO_LABEL: Record<EstadoCliente, string> = {
  prospecto: "Prospecto",
  activo: "Activo",
  inactivo: "Inactivo",
};
const TIPO_LABEL: Record<TipoCliente, string> = {
  clinica_propia: "Clínica propia",
  recien_empieza: "Recién empieza",
};

const REGIONES_CHILE = [
  "Arica y Parinacota",
  "Tarapacá",
  "Antofagasta",
  "Atacama",
  "Coquimbo",
  "Valparaíso",
  "Metropolitana de Santiago",
  "Libertador General Bernardo O'Higgins",
  "Maule",
  "Ñuble",
  "Biobío",
  "La Araucanía",
  "Los Ríos",
  "Los Lagos",
  "Aysén del General Carlos Ibáñez del Campo",
  "Magallanes y de la Antártica Chilena",
] as const;

const CIUDADES_POR_REGION: Record<string, string[]> = {
  "Arica y Parinacota": ["Arica", "Putre", "General Lagos", "Camarones"],
  "Tarapacá": ["Iquique", "Alto Hospicio", "Pozo Almonte", "Pica", "Huara", "Camiña", "Colchane"],
  "Antofagasta": ["Antofagasta", "Calama", "Tocopilla", "Mejillones", "Taltal", "María Elena", "San Pedro de Atacama"],
  "Atacama": ["Copiapó", "Vallenar", "Caldera", "Chañaral", "Diego de Almagro", "Huasco", "Freirina", "Tierra Amarilla"],
  "Coquimbo": ["La Serena", "Coquimbo", "Ovalle", "Illapel", "Vicuña", "Salamanca", "Andacollo", "Monte Patria", "Los Vilos", "Combarbalá"],
  "Valparaíso": ["Valparaíso", "Viña del Mar", "Quilpué", "Villa Alemana", "San Antonio", "Quillota", "Los Andes", "San Felipe", "La Ligua", "La Calera", "Limache", "Concón", "Cartagena", "Casablanca"],
  "Metropolitana de Santiago": ["Santiago", "Puente Alto", "Maipú", "La Florida", "San Bernardo", "Las Condes", "Providencia", "Ñuñoa", "Peñalolén", "Vitacura", "Lo Barnechea", "La Reina", "Macul", "Quilicura", "Colina", "Melipilla", "Talagante", "Buin", "Padre Hurtado", "Peñaflor"],
  "Libertador General Bernardo O'Higgins": ["Rancagua", "San Fernando", "Rengo", "Machalí", "Graneros", "Santa Cruz", "Pichilemu", "San Vicente", "Peumo", "Doñihue"],
  "Maule": ["Talca", "Curicó", "Linares", "Constitución", "Cauquenes", "Molina", "San Javier", "Parral", "Longaví", "Villa Alegre"],
  "Ñuble": ["Chillán", "Chillán Viejo", "Bulnes", "San Carlos", "Quirihue", "Coihueco", "San Nicolás", "Yungay"],
  "Biobío": ["Concepción", "Talcahuano", "Chiguayante", "San Pedro de la Paz", "Hualpén", "Coronel", "Lota", "Los Ángeles", "Cañete", "Arauco", "Tomé", "Penco", "Lebu"],
  "La Araucanía": ["Temuco", "Padre Las Casas", "Villarrica", "Pucón", "Angol", "Victoria", "Lautaro", "Nueva Imperial", "Carahue", "Loncoche"],
  "Los Ríos": ["Valdivia", "La Unión", "Río Bueno", "Panguipulli", "Los Lagos", "Paillaco", "Lanco", "Máfil", "Corral", "Futrono"],
  "Los Lagos": ["Puerto Montt", "Osorno", "Castro", "Ancud", "Puerto Varas", "Ancud", "Quellón", "Frutillar", "Llanquihue", "Purranque", "Río Negro"],
  "Aysén del General Carlos Ibáñez del Campo": ["Coyhaique", "Puerto Aysén", "Chile Chico", "Cochrane", "Puerto Cisnes", "Villa O'Higgins"],
  "Magallanes y de la Antártica Chilena": ["Punta Arenas", "Puerto Natales", "Porvenir", "Puerto Williams", "Cabo de Hornos"],
};

// Comunas para ciudades que agrupan más de una comuna (principalmente conurbaciones).
// Las ciudades no listadas se consideran ciudad = comuna (dropdown deshabilitado).
const COMUNAS_POR_CIUDAD: Record<string, string[]> = {
  "Santiago": [
    "Santiago Centro", "Estación Central", "Independencia", "Recoleta", "Quinta Normal",
    "Pedro Aguirre Cerda", "San Miguel", "San Joaquín", "San Ramón", "La Cisterna",
    "Lo Espejo", "Cerrillos", "Renca", "Cerro Navia", "Lo Prado", "Pudahuel",
    "Huechuraba", "Conchalí",
  ],
  "Valparaíso": ["Valparaíso", "Playa Ancha", "Cerro Alegre", "Cerro Concepción", "Placilla"],
  "Viña del Mar": ["Viña del Mar", "Reñaca", "Forestal", "Miraflores", "Recreo", "Chorrillos"],
  "Concepción": ["Concepción", "Barrio Universitario", "Pedro de Valdivia", "Lorenzo Arenas"],
  "Temuco": ["Temuco Centro", "Amanecer", "Labranza", "Pueblo Nuevo"],
  "La Serena": ["La Serena Centro", "Las Compañías", "La Pampa"],
  "Antofagasta": ["Antofagasta Centro", "Coviefi", "La Chimba", "Huáscar"],
  "Iquique": ["Iquique Centro", "Cavancha", "Playa Brava"],
  "Puerto Montt": ["Puerto Montt Centro", "Alerce", "Mirasol", "Puerto Chico"],
  "Rancagua": ["Rancagua Centro", "Rancagua Norte", "Rancagua Sur"],
  "Talca": ["Talca Centro", "Talca Oriente", "Talca Poniente"],
  "Chillán": ["Chillán Centro", "Chillán Oriente", "Chillán Poniente"],
  "Osorno": ["Osorno Centro", "Rahue Alto", "Rahue Bajo", "Ovejería"],
  "Valdivia": ["Valdivia Centro", "Isla Teja", "Las Ánimas", "Collico"],
  "Copiapó": ["Copiapó Centro", "Paipote", "San Fernando"],
  "Punta Arenas": ["Punta Arenas Centro", "Barrio Sur", "Barrio Prat"],
  "Arica": ["Arica Centro", "Chinchorro", "San Miguel de Azapa"],
  "Coyhaique": ["Coyhaique Centro", "Coyhaique Alto"],
};


function ClientesPage() {
  const { user } = useCurrentUser();
  const isAdmin = user?.rol === "admin";
  
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [ejecutivos, setEjecutivos] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  // Filter states
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroEjecutivo, setFiltroEjecutivo] = useState<string>("todos");
  const [vista, setVista] = useState<"tabla" | "cards">("tabla");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  function toggleSeleccion(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function eliminarClientes(ids: string[]) {
    if (ids.length === 0) return;
    const msg = ids.length === 1
      ? "¿Eliminar esta ficha de cliente? Esta acción no se puede deshacer."
      : `¿Eliminar ${ids.length} fichas de clientes? Esta acción no se puede deshacer.`;
    if (!window.confirm(msg)) return;
    const { error } = await supabase.from("clientes").delete().in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(ids.length === 1 ? "Cliente eliminado" : `${ids.length} clientes eliminados`);
    setSeleccionados(new Set());
    cargar();
  }

  // Form state
  const [form, setForm] = useState({
    nombre: "",
    rut: "",
    clinica: "",
    telefono: "",
    email: "",
    direccion: "",
    rss: "",
    tipo: "recien_empieza" as TipoCliente,
    estado: "prospecto" as EstadoCliente,
    region: "",
    ciudad: "",
    comuna: "",
    nivel: "",
    interes: "",
    notas: "",
    ejecutivo_id: "",
  });



  async function cargar() {
    setLoading(true);
    const { data, error } = await supabase
      .from("clientes")
      .select("*, usuarios:ejecutivo_id(nombre)")
      .order("creado_en", { ascending: false });
    if (error) toast.error(error.message);
    setClientes((data as any) ?? []);
    setLoading(false);
  }

  async function cargarEjecutivos() {
    const { data } = await supabase.from("usuarios").select("id, nombre").eq("activo", true);
    setEjecutivos(data ?? []);
  }

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      cargarEjecutivos();
    } else if (user) {
      setForm((f) => ({ ...f, ejecutivo_id: user.id }));
    }
  }, [isAdmin, user]);

  async function crearCliente(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const ejecutivo_id = isAdmin ? form.ejecutivo_id : user.id;
    if (!ejecutivo_id) {
      toast.error("Selecciona un ejecutivo");
      return;
    }
    const { error } = await supabase.from("clientes").insert({
      nombre: form.nombre,
      rut: form.rut || null,
      clinica: form.clinica || null,
      contacto: form.telefono || form.email || null,
      telefono: form.telefono || null,
      email: form.email || null,
      direccion: form.direccion || null,
      rss: form.rss || null,
      tipo: form.tipo,
      estado: form.estado,
      region: form.region || null,
      ciudad: form.ciudad || null,
      comuna: form.comuna || form.ciudad || null,
      nivel: form.nivel || null,
      interes: form.interes || null,
      notas: form.notas || null,
      ejecutivo_id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Cliente creado");
    setOpen(false);
    setForm({
      nombre: "",
      rut: "",
      clinica: "",
      telefono: "",
      email: "",
      direccion: "",
      rss: "",
      tipo: "recien_empieza",
      estado: "prospecto",
      region: "",
      ciudad: "",
      comuna: "",
      nivel: "",
      interes: "",
      notas: "",
      ejecutivo_id: isAdmin ? "" : user.id,
    });


    cargar();
  }

  // Filter items reactively in frontend
  const clientesFiltrados = clientes.filter((c) => {
    const matchesBusqueda =
      c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (c.clinica && c.clinica.toLowerCase().includes(busqueda.toLowerCase())) ||
      (c.contacto && c.contacto.toLowerCase().includes(busqueda.toLowerCase()));

    const matchesEstado = filtroEstado === "todos" || c.estado === filtroEstado;
    const matchesEjecutivo = filtroEjecutivo === "todos" || c.ejecutivo_id === filtroEjecutivo;

    return matchesBusqueda && matchesEstado && matchesEjecutivo;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Todos los clientes registrados en la empresa." : "Tu cartera de clientes asignados."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && user && (
            <BulkUploadDialog
              title="Carga masiva de clientes"
              description="Importa varios clientes desde un archivo Excel. Descarga la plantilla, complétala y súbela."
              onDownloadTemplate={descargarPlantillaClientes}
              onImport={(file) => importarClientes(file, user.id)}
              onDone={cargar}
            />
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all hover:scale-[1.01]">
                <Plus className="mr-2 h-4 w-4" /> Nuevo cliente
              </Button>
            </DialogTrigger>

          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Nuevo cliente</DialogTitle>
            </DialogHeader>
            <form onSubmit={crearCliente} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre Completo / Razón Social</Label>
                <Input id="nombre" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Dr. Juan Pérez" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rut">RUT</Label>
                  <Input id="rut" value={form.rut} onChange={(e) => setForm({ ...form, rut: e.target.value })} placeholder="Ej: 12.345.678-9" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinica">Nombre de la Clínica</Label>
                  <Input id="clinica" value={form.clinica} onChange={(e) => setForm({ ...form, clinica: e.target.value })} placeholder="Ej: Clínica de Estética Bella" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input id="telefono" type="tel" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="Ej: +56 9 1234 5678" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Ej: email@ejemplo.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="direccion">Dirección</Label>
                <Input id="direccion" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Ej: Av. Providencia 1234, Of. 501" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rss">Redes Sociales (RSS)</Label>
                <Input id="rss" value={form.rss} onChange={(e) => setForm({ ...form, rss: e.target.value })} placeholder="Ej: @clinica_ig, facebook.com/clinica" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as TipoCliente })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clinica_propia">Clínica propia</SelectItem>
                      <SelectItem value="recien_empieza">Recién empieza</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estado">Estado</Label>
                  <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v as EstadoCliente })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prospecto">Prospecto</SelectItem>
                      <SelectItem value="activo">Activo</SelectItem>
                      <SelectItem value="inactivo">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="region">Región</Label>
                  <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v, ciudad: "", comuna: "" })}>
                    <SelectTrigger><SelectValue placeholder="Selecciona una región" /></SelectTrigger>
                    <SelectContent>
                      {REGIONES_CHILE.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ciudad">Ciudad</Label>
                  <Select
                    value={form.ciudad}
                    onValueChange={(v) => setForm({ ...form, ciudad: v, comuna: "" })}
                    disabled={!form.region}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={form.region ? "Selecciona ciudad" : "Región primero"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(CIUDADES_POR_REGION[form.region] ?? []).map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comuna">Comuna</Label>
                  <Select
                    value={form.comuna}
                    onValueChange={(v) => setForm({ ...form, comuna: v })}
                    disabled={!form.ciudad || !COMUNAS_POR_CIUDAD[form.ciudad]}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          !form.ciudad
                            ? "Ciudad primero"
                            : COMUNAS_POR_CIUDAD[form.ciudad]
                              ? "Selecciona comuna"
                              : "No aplica"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(COMUNAS_POR_CIUDAD[form.ciudad] ?? []).map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isAdmin && (
                <div className="space-y-2">
                  <Label htmlFor="ejecutivo">Ejecutivo Asignado</Label>
                  <Select value={form.ejecutivo_id} onValueChange={(v) => setForm({ ...form, ejecutivo_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecciona un ejecutivo" /></SelectTrigger>
                    <SelectContent>
                      {ejecutivos.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <DialogFooter className="pt-2">
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">Crear Cliente</Button>
              </DialogFooter>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>


      {/* Filters card */}
      <Card className="border border-border">
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, clínica, contacto..."
                className="pl-9 focus-visible:ring-primary"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            
            <div className="space-y-1">
              <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                <SelectTrigger className="w-full">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder="Filtrar por estado" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los Estados</SelectItem>
                  <SelectItem value="prospecto">Prospecto</SelectItem>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isAdmin && (
              <div className="space-y-1">
                <Select value={filtroEjecutivo} onValueChange={setFiltroEjecutivo}>
                  <SelectTrigger className="w-full">
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <SelectValue placeholder="Filtrar por ejecutivo" />
                    </div>
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

      {/* Quick filters + view toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: "todos", label: "Todos", count: clientes.length },
            { key: "activo", label: "Activo", count: clientes.filter((c) => c.estado === "activo").length },
            { key: "prospecto", label: "Prospecto", count: clientes.filter((c) => c.estado === "prospecto").length },
            { key: "inactivo", label: "Inactivo", count: clientes.filter((c) => c.estado === "inactivo").length },
          ].map((q) => {
            const active = filtroEstado === q.key;
            const tone =
              q.key === "activo"
                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                : q.key === "prospecto"
                  ? "bg-amber-100 text-amber-800 border-amber-200"
                  : q.key === "inactivo"
                    ? "bg-slate-100 text-slate-700 border-slate-200"
                    : "bg-primary/10 text-primary border-primary/20";
            return (
              <button
                key={q.key}
                onClick={() => setFiltroEstado(q.key)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  active ? `${tone} shadow-sm scale-[1.02]` : "bg-white text-slate-600 border-border hover:bg-slate-50"
                }`}
              >
                {q.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white/60" : "bg-slate-100"}`}>{q.count}</span>
              </button>
            );
          })}
        </div>
        <div className="inline-flex rounded-md border border-border bg-white p-0.5">
          <button
            onClick={() => setVista("tabla")}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${vista === "tabla" ? "bg-primary text-primary-foreground" : "text-slate-600 hover:bg-slate-50"}`}
          >
            <List className="h-3.5 w-3.5" /> Tabla
          </button>
          <button
            onClick={() => setVista("cards")}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${vista === "cards" ? "bg-primary text-primary-foreground" : "text-slate-600 hover:bg-slate-50"}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Cards
          </button>
        </div>
      </div>

      {/* Bulk actions bar (admin, table view) */}
      {isAdmin && vista === "tabla" && seleccionados.size > 0 && (
        <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2">
          <span className="text-sm font-medium text-destructive">
            {seleccionados.size} cliente{seleccionados.size === 1 ? "" : "s"} seleccionado{seleccionados.size === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSeleccionados(new Set())}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => eliminarClientes(Array.from(seleccionados))}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Eliminar seleccionados
            </Button>
          </div>
        </div>
      )}

      {/* List Card */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="bg-slate-50/50">
          <CardTitle className="text-base text-primary">Cartera de Clientes ({clientesFiltrados.length})</CardTitle>
        </CardHeader>
        <CardContent className={vista === "cards" ? "p-4" : "p-0"}>
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Cargando clientes…</div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No se encontraron clientes con los filtros aplicados.</div>
          ) : vista === "tabla" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  {isAdmin && (
                    <TableHead className="w-10 pl-4">
                      <Checkbox
                        checked={
                          clientesFiltrados.length > 0 &&
                          clientesFiltrados.every((c) => seleccionados.has(c.id))
                        }
                        onCheckedChange={(v) => {
                          if (v) setSeleccionados(new Set(clientesFiltrados.map((c) => c.id)));
                          else setSeleccionados(new Set());
                        }}
                        aria-label="Seleccionar todos"
                      />
                    </TableHead>
                  )}
                  <TableHead>Nombre</TableHead>
                  <TableHead>Clínica</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  {isAdmin && <TableHead>Ejecutivo Asignado</TableHead>}
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientesFiltrados.map((c) => (
                  <TableRow key={c.id} className="hover:bg-slate-50/50" data-state={seleccionados.has(c.id) ? "selected" : undefined}>
                    {isAdmin && (
                      <TableCell className="pl-4">
                        <Checkbox
                          checked={seleccionados.has(c.id)}
                          onCheckedChange={() => toggleSeleccion(c.id)}
                          aria-label={`Seleccionar ${c.nombre}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-semibold text-slate-800">{c.nombre}</TableCell>
                    <TableCell className="text-slate-600">{c.clinica ?? "—"}</TableCell>
                    <TableCell className="text-xs text-slate-500">{TIPO_LABEL[c.tipo]}</TableCell>
                    <TableCell>
                      <Badge
                        variant={c.estado === "activo" ? "default" : c.estado === "inactivo" ? "secondary" : "outline"}
                        className={
                          c.estado === "activo"
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none"
                            : c.estado === "inactivo"
                              ? "bg-slate-100 text-slate-800 hover:bg-slate-100 border-none"
                              : "bg-amber-100 text-amber-800 hover:bg-amber-100 border-none"
                        }
                      >
                        {ESTADO_LABEL[c.estado]}
                      </Badge>
                    </TableCell>
                    {isAdmin && <TableCell className="text-slate-600 font-medium">{c.usuarios?.nombre ?? "—"}</TableCell>}
                    <TableCell className="text-right pr-4">
                      <div className="inline-flex items-center gap-3">
                        <Link
                          to="/clientes/$id"
                          params={{ id: c.id }}
                          className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                        >
                          Ver Ficha
                        </Link>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => eliminarClientes([c.id])}
                            aria-label={`Eliminar ${c.nombre}`}
                            title="Eliminar cliente"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {clientesFiltrados.map((c) => (
                <div
                  key={c.id}
                  className="group flex flex-col gap-3 rounded-lg border border-border bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">{c.nombre}</p>
                      <p className="truncate text-xs text-slate-500">{c.clinica ?? "—"}</p>
                    </div>
                    <Badge
                      className={
                        c.estado === "activo"
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none"
                          : c.estado === "inactivo"
                            ? "bg-slate-100 text-slate-800 hover:bg-slate-100 border-none"
                            : "bg-amber-100 text-amber-800 hover:bg-amber-100 border-none"
                      }
                    >
                      {ESTADO_LABEL[c.estado]}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Filter className="h-3 w-3 text-slate-400" />
                      <span>{TIPO_LABEL[c.tipo]}</span>
                    </div>
                    {c.contacto && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-slate-400" />
                        <span className="truncate">{c.contacto}</span>
                      </div>
                    )}
                    {isAdmin && (
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3 w-3 text-slate-400" />
                        <span className="truncate">{c.usuarios?.nombre ?? "—"}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-auto flex justify-end border-t border-border pt-2">
                    <Link
                      to="/clientes/$id"
                      params={{ id: c.id }}
                      className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      Ver Ficha →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
