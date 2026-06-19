import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Edit, Calendar, User, Search, Filter, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

export const Route = createFileRoute("/_authenticated/tareas")({
  component: TareasPage,
});

type EstadoTarea = "pendiente" | "en_curso" | "completada";

interface TareaRow {
  id: string;
  titulo: string;
  descripcion: string | null;
  ejecutivo_id: string;
  cliente_id: string | null;
  estado: EstadoTarea;
  fecha_limite: string | null;
  creado_por: string | null;
  creado_en: string;
  clientes?: { nombre: string; clinica: string | null } | null;
  usuarios?: { nombre: string } | null;
}

const ESTADO_LABEL: Record<EstadoTarea, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  completada: "Completada",
};

function TareasPage() {
  const { user } = useCurrentUser();
  const isAdmin = user?.rol === "admin";

  const [tareas, setTareas] = useState<TareaRow[]>([]);
  const [ejecutivos, setEjecutivos] = useState<{ id: string; nombre: string }[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nombre: string; clinica: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroEjecutivo, setFiltroEjecutivo] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState("");

  // Modales
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Form State
  const [form, setForm] = useState({
    titulo: "",
    descripcion: "",
    ejecutivo_id: "",
    cliente_id: "ninguno",
    estado: "pendiente" as EstadoTarea,
    fecha_limite: "",
  });

  const [editingTarea, setEditingTarea] = useState<TareaRow | null>(null);

  async function cargarDatos() {
    setLoading(true);
    try {
      const [{ data: tData, error: tErr }, { data: eData }, { data: cData }] = await Promise.all([
        supabase
          .from("tareas")
          .select("*, clientes:cliente_id(nombre, clinica), usuarios:ejecutivo_id(nombre)")
          .order("creado_en", { ascending: false }),
        supabase.from("usuarios").select("id, nombre").eq("activo", true),
        supabase.from("clientes").select("id, nombre, clinica, ejecutivo_id").in("estado", ["activo", "prospecto"]),
      ]);

      if (tErr) throw tErr;
      setTareas((tData as any) ?? []);
      setEjecutivos(eData ?? []);
      setClientes(cData ?? []);
    } catch (err: any) {
      toast.error("Error al cargar tareas: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  // Update default form values on load
  useEffect(() => {
    if (user && !form.ejecutivo_id) {
      setForm((f) => ({ ...f, ejecutivo_id: user.id }));
    }
  }, [user]);

  // --- ACTIONS ---
  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim()) return;

    try {
      const payload: any = {
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim() || null,
        ejecutivo_id: form.ejecutivo_id || user?.id || "",
        cliente_id: form.cliente_id === "ninguno" ? null : form.cliente_id,
        estado: form.estado,
        fecha_limite: form.fecha_limite ? new Date(form.fecha_limite).toISOString() : null,
        creado_por: user?.id || null,
      };

      const { error } = await supabase.from("tareas").insert(payload);
      if (error) throw error;

      toast.success("Tarea creada correctamente");
      setCreateOpen(false);
      setForm({
        titulo: "",
        descripcion: "",
        ejecutivo_id: user?.id || "",
        cliente_id: "ninguno",
        estado: "pendiente",
        fecha_limite: "",
      });
      cargarDatos();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  function abrirEdicion(t: TareaRow) {
    setEditingTarea(t);
    setForm({
      titulo: t.titulo,
      descripcion: t.descripcion || "",
      ejecutivo_id: t.ejecutivo_id,
      cliente_id: t.cliente_id || "ninguno",
      estado: t.estado,
      fecha_limite: t.fecha_limite ? t.fecha_limite.split("T")[0] : "",
    });
    setEditOpen(true);
  }

  async function handleEditar(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTarea || !form.titulo.trim()) return;

    try {
      const payload: any = {
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim() || null,
        ejecutivo_id: form.ejecutivo_id,
        cliente_id: form.cliente_id === "ninguno" ? null : form.cliente_id,
        estado: form.estado,
        fecha_limite: form.fecha_limite ? new Date(form.fecha_limite).toISOString() : null,
      };

      const { error } = await supabase.from("tareas").update(payload).eq("id", editingTarea.id);
      if (error) throw error;

      toast.success("Tarea actualizada");
      setEditOpen(false);
      cargarDatos();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function cambiarEstadoRapido(t: TareaRow, nuevoEstado: EstadoTarea) {
    try {
      const { error } = await supabase
        .from("tareas")
        .update({ estado: nuevoEstado })
        .eq("id", t.id);
      if (error) throw error;
      toast.success(`Tarea marcada como ${ESTADO_LABEL[nuevoEstado]}`);
      cargarDatos();
    } catch (err: any) {
      toast.error("Error al actualizar estado: " + err.message);
    }
  }

  // Overdue check helper
  function esTareaVencida(t: TareaRow) {
    if (t.estado === "completada" || !t.fecha_limite) return false;
    return new Date(t.fecha_limite) < new Date();
  }

  // Filtered List
  const tareasFiltradas = tareas.filter((t) => {
    const matchesBusqueda = t.titulo.toLowerCase().includes(busqueda.toLowerCase()) || 
      (t.descripcion && t.descripcion.toLowerCase().includes(busqueda.toLowerCase())) ||
      (t.clientes?.nombre && t.clientes.nombre.toLowerCase().includes(busqueda.toLowerCase()));
    
    const matchesEstado = filtroEstado === "todos" || t.estado === filtroEstado;
    const matchesEjecutivo = filtroEjecutivo === "todos" || t.ejecutivo_id === filtroEjecutivo;

    return matchesBusqueda && matchesEstado && matchesEjecutivo;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Tareas</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Control global de asignaciones y tareas comerciales." : "Organiza tu agenda y pendientes del día."}
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md transition-all hover:scale-[1.01]">
              <Plus className="mr-2 h-4 w-4" /> Nueva Tarea
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva Tarea</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCrear} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="titulo">Título de la Tarea</Label>
                <Input id="titulo" required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej: Enviar cotización de Atlantis Hair" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Descripción</Label>
                <Input id="desc" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Detalles de la tarea..." />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cliente">Cliente Vinculado (Opcional)</Label>
                  <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v })}>
                    <SelectTrigger id="cliente"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ninguno">Ningún cliente</SelectItem>
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
                <div className="space-y-2">
                  <Label htmlFor="fecha_limite">Fecha Límite</Label>
                  <Input id="fecha_limite" type="date" value={form.fecha_limite} onChange={(e) => setForm({ ...form, fecha_limite: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {isAdmin && (
                  <div className="space-y-2">
                    <Label htmlFor="ejecutivo">Ejecutivo Asignado</Label>
                    <Select value={form.ejecutivo_id} onValueChange={(v) => setForm({ ...form, ejecutivo_id: v })}>
                      <SelectTrigger id="ejecutivo"><SelectValue placeholder="Selecciona un ejecutivo" /></SelectTrigger>
                      <SelectContent>
                        {ejecutivos.map((e) => (
                          <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="estado">Estado</Label>
                  <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v as EstadoTarea })}>
                    <SelectTrigger id="estado"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="en_curso">En curso</SelectItem>
                      <SelectItem value="completada">Completada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">Crear Tarea</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters Card */}
      <Card className="border border-border">
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar tareas..."
                className="pl-9 focus-visible:ring-primary"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            
            <div className="space-y-1">
              <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder="Filtrar por estado" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los Estados</SelectItem>
                  <SelectItem value="pendiente">Pendientes</SelectItem>
                  <SelectItem value="en_curso">En Curso</SelectItem>
                  <SelectItem value="completada">Completadas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isAdmin && (
              <div className="space-y-1">
                <Select value={filtroEjecutivo} onValueChange={setFiltroEjecutivo}>
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
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
          <CardTitle className="text-base text-primary">Tareas Pendientes ({tareasFiltradas.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Cargando tareas…</div>
          ) : tareasFiltradas.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No tienes tareas asignadas con estos filtros.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarea</TableHead>
                  <TableHead>Cliente</TableHead>
                  {isAdmin && <TableHead>Ejecutivo Asignado</TableHead>}
                  <TableHead>Fecha Límite</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tareasFiltradas.map((t) => {
                  const vencida = esTareaVencida(t);
                  return (
                    <TableRow key={t.id} className={`hover:bg-slate-50/50 transition-colors ${vencida ? "bg-red-50/70 hover:bg-red-100/50" : ""}`}>
                      <TableCell>
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          {t.titulo}
                          {vencida && (
                            <Badge className="bg-destructive text-destructive-foreground border-none hover:bg-destructive text-[9px] h-4 py-0 flex items-center gap-0.5">
                              <AlertTriangle className="h-2.5 w-2.5" /> Vencida
                            </Badge>
                          )}
                        </div>
                        {t.descripcion && <div className="text-xs text-muted-foreground font-medium mt-0.5">{t.descripcion}</div>}
                      </TableCell>
                      <TableCell className="text-slate-600 font-medium">
                        {t.clientes ? (
                          <div>
                            {t.clientes.nombre}
                            {t.clientes.clinica && <div className="text-[10px] text-muted-foreground">{t.clientes.clinica}</div>}
                          </div>
                        ) : "—"}
                      </TableCell>
                      {isAdmin && <TableCell className="text-slate-600 font-semibold">{t.usuarios?.nombre ?? "—"}</TableCell>}
                      <TableCell className={`font-semibold text-xs ${vencida ? "text-red-600" : "text-slate-600"}`}>
                        {t.fecha_limite ? new Date(t.fecha_limite).toLocaleDateString("es-ES") : "Sin fecha"}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={t.estado}
                          onValueChange={(v) => cambiarEstadoRapido(t, v as EstadoTarea)}
                        >
                          <SelectTrigger className="w-36 h-8 text-xs font-semibold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendiente">
                              <span className="flex items-center gap-1 text-slate-600"><Clock className="h-3 w-3" /> Pendiente</span>
                            </SelectItem>
                            <SelectItem value="en_curso">
                              <span className="flex items-center gap-1 text-amber-600"><Clock className="h-3 w-3" /> En curso</span>
                            </SelectItem>
                            <SelectItem value="completada">
                              <span className="flex items-center gap-1 text-emerald-600"><CheckCircle className="h-3 w-3" /> Completada</span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <Button variant="ghost" size="sm" onClick={() => abrirEdicion(t)} className="hover:bg-slate-100">
                          <Edit className="h-4 w-4 text-slate-600" />
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

      {/* EDIT MODAL */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Tarea</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-titulo">Título de la Tarea</Label>
              <Input id="edit-titulo" required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Descripción</Label>
              <Input id="edit-desc" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-cliente">Cliente Vinculado</Label>
                <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v })}>
                  <SelectTrigger id="edit-cliente"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguno">Ningún cliente</SelectItem>
                    {clientes
                      .filter(c => isAdmin || c.ejecutivo_id === editingTarea?.ejecutivo_id)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-fecha_limite">Fecha Límite</Label>
                <Input id="edit-fecha_limite" type="date" value={form.fecha_limite} onChange={(e) => setForm({ ...form, fecha_limite: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {isAdmin && (
                <div className="space-y-2">
                  <Label htmlFor="edit-ejecutivo">Ejecutivo Asignado</Label>
                  <Select value={form.ejecutivo_id} onValueChange={(v) => setForm({ ...form, ejecutivo_id: v })}>
                    <SelectTrigger id="edit-ejecutivo"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ejecutivos.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="edit-estado">Estado</Label>
                <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v as EstadoTarea })}>
                  <SelectTrigger id="edit-estado"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="en_curso">En curso</SelectItem>
                    <SelectItem value="completada">Completada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">Guardar Cambios</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
