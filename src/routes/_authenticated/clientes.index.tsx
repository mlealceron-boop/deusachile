import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, Filter, Plus, Users, LayoutGrid, List, Phone } from "lucide-react";
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

  // Form state
  const [form, setForm] = useState({
    nombre: "",
    clinica: "",
    contacto: "",
    tipo: "recien_empieza" as TipoCliente,
    estado: "prospecto" as EstadoCliente,
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
      clinica: form.clinica || null,
      contacto: form.contacto || null,
      tipo: form.tipo,
      estado: form.estado,
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
      clinica: "",
      contacto: "",
      tipo: "recien_empieza",
      estado: "prospecto",
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
              <div className="space-y-2">
                <Label htmlFor="clinica">Nombre de la Clínica</Label>
                <Input id="clinica" value={form.clinica} onChange={(e) => setForm({ ...form, clinica: e.target.value })} placeholder="Ej: Clínica de Estética Bella" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contacto">Contacto (Teléfono o Email)</Label>
                <Input id="contacto" value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} placeholder="Ej: +56 9 1234 5678 o email@ejemplo.com" />
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

      {/* List Card */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="bg-slate-50/50">
          <CardTitle className="text-base text-primary">Cartera de Clientes ({clientesFiltrados.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Cargando clientes…</div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No se encontraron clientes con los filtros aplicados.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
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
                  <TableRow key={c.id} className="hover:bg-slate-50/50">
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
                      <Link 
                        to="/clientes/$id" 
                        params={{ id: c.id }} 
                        className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                      >
                        Ver Ficha
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
