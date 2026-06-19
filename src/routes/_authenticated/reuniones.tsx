import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Edit3, Calendar, User, Search, Filter, BookOpen, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/_authenticated/reuniones")({
  component: ReunionesPage,
});

type EstadoReunion = "agendada" | "realizada" | "cancelada";

interface ReunionRow {
  id: string;
  cliente_id: string;
  ejecutivo_id: string;
  fecha_hora: string;
  objetivo: string;
  resultado: string | null;
  estado: EstadoReunion;
  creado_en: string;
  clientes?: { nombre: string; clinica: string | null } | null;
  usuarios?: { nombre: string } | null;
}

const ESTADO_LABEL: Record<EstadoReunion, string> = {
  agendada: "Agendada",
  realizada: "Realizada",
  cancelada: "Cancelada",
};

function ReunionesPage() {
  const { user } = useCurrentUser();
  const isAdmin = user?.rol === "admin";

  const [reuniones, setReuniones] = useState<ReunionRow[]>([]);
  const [ejecutivos, setEjecutivos] = useState<{ id: string; nombre: string }[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nombre: string; clinica: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroEjecutivo, setFiltroEjecutivo] = useState<string>("todos");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [busqueda, setBusqueda] = useState("");

  // Modales
  const [createOpen, setCreateOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);

  // Form State (New)
  const [form, setForm] = useState({
    cliente_id: "",
    ejecutivo_id: "",
    fecha_hora: "",
    objetivo: "",
  });

  // Form State (Post-meeting)
  const [selectedReunion, setSelectedReunion] = useState<ReunionRow | null>(null);
  const [resultForm, setResultForm] = useState({
    resultado: "",
    estado: "realizada" as EstadoReunion,
  });

  async function cargarDatos() {
    setLoading(true);
    try {
      const [{ data: rData, error: rErr }, { data: eData }, { data: cData }] = await Promise.all([
        supabase
          .from("reuniones")
          .select("*, clientes:cliente_id(nombre, clinica), usuarios:ejecutivo_id(nombre)")
          .order("fecha_hora", { ascending: false }),
        supabase.from("usuarios").select("id, nombre").eq("activo", true),
        supabase.from("clientes").select("id, nombre, clinica, ejecutivo_id").in("estado", ["activo", "prospecto"]),
      ]);

      if (rErr) throw rErr;
      setReuniones((rData as any) ?? []);
      setEjecutivos(eData ?? []);
      setClientes(cData ?? []);
    } catch (err: any) {
      toast.error("Error al cargar reuniones: " + err.message);
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

  // Set default client on list loaded
  useEffect(() => {
    const available = isAdmin 
      ? clientes 
      : clientes.filter(c => c.ejecutivo_id === user?.id);
    if (available.length > 0 && !form.cliente_id) {
      setForm(f => ({ ...f, cliente_id: available[0].id }));
    }
  }, [clientes, user, isAdmin]);

  // --- ACTIONS ---
  async function handleAgendar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente_id || !form.fecha_hora || !form.objetivo.trim()) {
      toast.error("Completa todos los campos obligatorios");
      return;
    }

    try {
      const payload = {
        cliente_id: form.cliente_id,
        ejecutivo_id: form.ejecutivo_id || user?.id || "",
        fecha_hora: new Date(form.fecha_hora).toISOString(),
        objetivo: form.objetivo.trim(),
        estado: "agendada" as EstadoReunion,
      };

      const { error } = await supabase.from("reuniones").insert(payload);
      if (error) throw error;

      toast.success("Reunión agendada correctamente");
      setCreateOpen(false);
      setForm({
        cliente_id: clientes[0]?.id || "",
        ejecutivo_id: user?.id || "",
        fecha_hora: "",
        objetivo: "",
      });
      cargarDatos();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  function abrirRegistrarResultado(r: ReunionRow) {
    setSelectedReunion(r);
    setResultForm({
      resultado: r.resultado || "",
      estado: r.estado === "agendada" ? "realizada" : r.estado,
    });
    setResultOpen(true);
  }

  async function handleGuardarResultado(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedReunion || !resultForm.resultado.trim()) {
      toast.error("Ingresa la minuta/resultado de la reunión");
      return;
    }

    try {
      const { error } = await supabase
        .from("reuniones")
        .update({
          resultado: resultForm.resultado.trim(),
          estado: resultForm.estado,
        })
        .eq("id", selectedReunion.id);
      if (error) throw error;

      toast.success("Minuta registrada");
      setResultOpen(false);
      cargarDatos();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  // Filtered List
  const reunionesFiltradas = reuniones.filter((r) => {
    const matchesBusqueda = r.objetivo.toLowerCase().includes(busqueda.toLowerCase()) ||
      (r.clientes?.nombre && r.clientes.nombre.toLowerCase().includes(busqueda.toLowerCase()));
    
    const matchesEstado = filtroEstado === "todos" || r.estado === filtroEstado;
    const matchesEjecutivo = filtroEjecutivo === "todos" || r.ejecutivo_id === filtroEjecutivo;

    const matchesFechaDesde = !filtroFechaDesde || new Date(r.fecha_hora) >= new Date(filtroFechaDesde);
    const matchesFechaHasta = !filtroFechaHasta || new Date(r.fecha_hora) <= new Date(filtroFechaHasta + "T23:59:59");

    return matchesBusqueda && matchesEstado && matchesEjecutivo && matchesFechaDesde && matchesFechaHasta;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Reuniones</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Agenda global de visitas comerciales." : "Planifica y documenta tus reuniones con clientes."}
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md transition-all hover:scale-[1.01]">
              <Plus className="mr-2 h-4 w-4" /> Agendar Reunión
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agendar Reunión</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAgendar} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cliente">Cliente de Cartera</Label>
                <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v })}>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fecha_hora">Fecha y Hora</Label>
                  <Input id="fecha_hora" type="datetime-local" required value={form.fecha_hora} onChange={(e) => setForm({ ...form, fecha_hora: e.target.value })} />
                </div>
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="objetivo">Objetivo de la Reunión</Label>
                <Textarea id="objetivo" required value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} placeholder="Ej: Presentar LactoExoColla y evaluar compra..." rows={3} />
              </div>

              <DialogFooter className="pt-2">
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">Agendar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters Card */}
      <Card className="border border-border">
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
            <div className="relative md:col-span-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                className="pl-9 h-9 text-xs focus-visible:ring-primary"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            
            <div className="space-y-1">
              <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los Estados</SelectItem>
                  <SelectItem value="agendada">Agendada</SelectItem>
                  <SelectItem value="realizada">Realizada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Input
                type="date"
                className="h-9 text-xs"
                value={filtroFechaDesde}
                onChange={(e) => setFiltroFechaDesde(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Input
                type="date"
                className="h-9 text-xs"
                value={filtroFechaHasta}
                onChange={(e) => setFiltroFechaHasta(e.target.value)}
              />
            </div>

            {isAdmin && (
              <div className="space-y-1">
                <Select value={filtroEjecutivo} onValueChange={setFiltroEjecutivo}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Ejecutivo" />
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

      {/* List Table */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="bg-slate-50/50">
          <CardTitle className="text-base text-primary">Reuniones Agendadas ({reunionesFiltradas.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Cargando agenda…</div>
          ) : reunionesFiltradas.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No hay reuniones registradas con estos filtros.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha y Hora</TableHead>
                  <TableHead>Cliente</TableHead>
                  {isAdmin && <TableHead>Ejecutivo</TableHead>}
                  <TableHead>Objetivo</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reunionesFiltradas.map((r) => (
                  <TableRow key={r.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-semibold text-xs text-slate-800">
                      {new Date(r.fecha_hora).toLocaleString("es-ES")}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-800">{r.clientes?.nombre}</div>
                      {r.clientes?.clinica && <div className="text-[10px] text-muted-foreground">{r.clientes.clinica}</div>}
                    </TableCell>
                    {isAdmin && <TableCell className="text-slate-600 font-semibold">{r.usuarios?.nombre ?? "—"}</TableCell>}
                    <TableCell className="text-slate-700 max-w-xs truncate font-medium">{r.objetivo}</TableCell>
                    <TableCell className="text-slate-500 max-w-xs truncate text-xs">
                      {r.resultado ? r.resultado : <span className="text-slate-400 italic">Pendiente de minuta</span>}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={r.estado === "realizada" ? "default" : r.estado === "cancelada" ? "destructive" : "outline"}
                        className={
                          r.estado === "realizada" 
                            ? "bg-emerald-100 text-emerald-800 border-none hover:bg-emerald-100" 
                            : r.estado === "cancelada"
                              ? "bg-red-100 text-red-800 border-none hover:bg-red-100"
                              : "bg-blue-100 text-blue-800 border-none hover:bg-blue-100"
                        }
                      >
                        {ESTADO_LABEL[r.estado]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <Button variant="ghost" size="sm" onClick={() => abrirRegistrarResultado(r)} className="hover:bg-slate-100">
                        <Edit3 className="h-4 w-4 mr-1 text-slate-600" /> Minuta
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* POST-MEETING RESULT DIALOG */}
      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Minuta de Reunión</DialogTitle>
          </DialogHeader>
          {selectedReunion && (
            <form onSubmit={handleGuardarResultado} className="space-y-4">
              <div className="space-y-1 text-sm bg-slate-50 p-3 rounded-lg">
                <div className="font-semibold text-primary">{selectedReunion.clientes?.nombre}</div>
                <div className="text-xs text-muted-foreground">Objetivo: {selectedReunion.objetivo}</div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="res-resultado">Minuta / Resultados / Acuerdos</Label>
                <Textarea id="res-resultado" required value={resultForm.resultado} onChange={(e) => setResultForm({ ...resultForm, resultado: e.target.value })} placeholder="Detalles de los acuerdos, marcas de interés, objeciones..." rows={4} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="res-estado">Estado Final</Label>
                <Select value={resultForm.estado} onValueChange={(v) => setResultForm({ ...resultForm, estado: v as EstadoReunion })}>
                  <SelectTrigger id="res-estado"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realizada">
                      <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Realizada</span>
                    </SelectItem>
                    <SelectItem value="cancelada">
                      <span className="flex items-center gap-1 text-red-600"><XCircle className="h-4 w-4" /> Cancelada</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-2">
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">Guardar Minuta</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
