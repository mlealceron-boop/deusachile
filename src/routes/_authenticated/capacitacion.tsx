import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { 
  GraduationCap, 
  Plus, 
  Edit, 
  Link2, 
  Grid, 
  UserCheck, 
  Users, 
  BookOpen, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ExternalLink,
  Search,
  Filter
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

export const Route = createFileRoute("/_authenticated/capacitacion")({
  component: CapacitacionPage,
});

type DirigidoARol = "cliente" | "ejecutivo" | "ambos";
type EstadoProgreso = "no_iniciado" | "en_curso" | "completado";

interface ModuloCapacitacion {
  id: string;
  nombre: string;
  descripcion: string | null;
  link_externo: string;
  dirigido_a: DirigidoARol;
  activo: boolean;
  creado_en: string;
}

interface ProgresoCapacitacion {
  id: string;
  modulo_id: string;
  cliente_id: string | null;
  usuario_id: string | null;
  estado: EstadoProgreso;
  actualizado_en: string;
}

interface MatrixTarget {
  id: string;
  nombre: string;
  type: "cliente" | "ejecutivo";
  detail: string; // Clinica or Email
}

const ESTADO_COLORS: Record<EstadoProgreso, string> = {
  no_iniciado: "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300",
  en_curso: "bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300",
  completado: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300",
};

const ESTADO_LABELS: Record<EstadoProgreso, string> = {
  no_iniciado: "No Iniciado",
  en_curso: "En Curso",
  completado: "Completado",
};

function CapacitacionPage() {
  const { user } = useCurrentUser();
  const isAdmin = user?.rol === "admin";

  const [activeTab, setActiveTab] = useState(isAdmin ? "progreso" : "mis_capacitaciones");
  const [modulos, setModulos] = useState<ModuloCapacitacion[]>([]);
  const [progresos, setProgresos] = useState<ProgresoCapacitacion[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nombre: string; clinica: string | null; ejecutivo_id: string }[]>([]);
  const [ejecutivos, setEjecutivos] = useState<{ id: string; nombre: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Modales
  const [moduloOpen, setModuloOpen] = useState(false);
  const [editingModulo, setEditingModulo] = useState<ModuloCapacitacion | null>(null);
  
  // Form Modulo
  const [moduloForm, setModuloForm] = useState({
    nombre: "",
    descripcion: "",
    link_externo: "",
    dirigido_a: "ambos" as DirigidoARol,
    activo: true,
  });

  // Cell Action Modal (Admin)
  const [cellOpen, setCellOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    targetId: string;
    targetType: "cliente" | "ejecutivo";
    moduloId: string;
    moduloName: string;
    targetName: string;
    currentProgresoId?: string;
    currentEstado: EstadoProgreso;
  } | null>(null);
  const [newCellEstado, setNewCellEstado] = useState<EstadoProgreso>("no_iniciado");

  // Filtros Matriz
  const [filtroMatrizTipo, setFiltroMatrizTipo] = useState<"todos" | "clientes" | "ejecutivos">("todos");
  const [filtroMatrizModulo, setFiltroMatrizModulo] = useState("todos");
  const [busquedaMatriz, setBusquedaMatriz] = useState("");

  async function cargarDatos() {
    setLoading(true);
    try {
      // 1. Fetch modules
      const { data: mData, error: mErr } = await supabase
        .from("modulos_capacitacion")
        .select("*")
        .order("creado_en", { ascending: false });
      if (mErr) throw mErr;
      setModulos(mData as any ?? []);

      // 2. Fetch progress logs
      const { data: pData, error: pErr } = await supabase
        .from("progreso_capacitacion")
        .select("*");
      if (pErr) throw pErr;
      setProgresos(pData as any ?? []);

      // 3. Fetch active executives
      const { data: eData } = await supabase
        .from("usuarios")
        .select("id, nombre, email")
        .eq("activo", true)
        .order("nombre");
      setEjecutivos(eData ?? []);

      // 4. Fetch active clients
      const { data: cData } = await supabase
        .from("clientes")
        .select("id, nombre, clinica, ejecutivo_id")
        .eq("estado", "activo")
        .order("nombre");
      setClientes(cData ?? []);

    } catch (err: any) {
      toast.error("Error al cargar capacitaciones: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  // --- CRUD MODULOS ---
  function abrirNuevoModulo() {
    setEditingModulo(null);
    setModuloForm({
      nombre: "",
      descripcion: "",
      link_externo: "",
      dirigido_a: "ambos",
      activo: true,
    });
    setModuloOpen(true);
  }

  function abrirEditarModulo(m: ModuloCapacitacion) {
    setEditingModulo(m);
    setModuloForm({
      nombre: m.nombre,
      descripcion: m.descripcion || "",
      link_externo: m.link_externo,
      dirigido_a: m.dirigido_a,
      activo: m.activo,
    });
    setModuloOpen(true);
  }

  async function handleModuloSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!moduloForm.nombre.trim() || !moduloForm.link_externo.trim()) {
      toast.error("Nombre y enlace son requeridos");
      return;
    }

    try {
      const payload = {
        nombre: moduloForm.nombre.trim(),
        descripcion: moduloForm.descripcion.trim() || null,
        link_externo: moduloForm.link_externo.trim(),
        dirigido_a: moduloForm.dirigido_a,
        activo: moduloForm.activo,
      };

      if (editingModulo) {
        const { error } = await supabase
          .from("modulos_capacitacion")
          .update(payload)
          .eq("id", editingModulo.id);
        if (error) throw error;
        toast.success("Módulo de capacitación actualizado");
      } else {
        const { error } = await supabase
          .from("modulos_capacitacion")
          .insert(payload);
        if (error) throw error;
        toast.success("Módulo de capacitación creado");
      }

      setModuloOpen(false);
      cargarDatos();
    } catch (err: any) {
      toast.error("Error al guardar módulo: " + err.message);
    }
  }

  // --- PROGRESS ACTIONS ---
  async function handleUpdateProgreso(
    targetId: string,
    targetType: "cliente" | "ejecutivo",
    moduloId: string,
    estado: EstadoProgreso,
    progId?: string
  ) {
    try {
      if (progId) {
        // Update existing progress log
        const { error } = await supabase
          .from("progreso_capacitacion")
          .update({ estado, actualizado_en: new Date().toISOString() })
          .eq("id", progId);
        if (error) throw error;
      } else {
        // Insert new progress log
        const payload: any = {
          modulo_id: moduloId,
          estado,
          actualizado_en: new Date().toISOString(),
        };
        if (targetType === "cliente") {
          payload.cliente_id = targetId;
        } else {
          payload.usuario_id = targetId;
        }

        const { error } = await supabase
          .from("progreso_capacitacion")
          .insert(payload);
        if (error) throw error;
      }

      toast.success("Progreso actualizado correctamente");
      cargarDatos();
    } catch (err: any) {
      toast.error("Error al actualizar progreso: " + err.message);
    }
  }

  // Cell Click in Matrix (Admin)
  function handleCellClick(target: MatrixTarget, modulo: ModuloCapacitacion) {
    const existing = progresos.find(
      (p) => 
        p.modulo_id === modulo.id && 
        (target.type === "cliente" ? p.cliente_id === target.id : p.usuario_id === target.id)
    );

    setSelectedCell({
      targetId: target.id,
      targetType: target.type,
      moduloId: modulo.id,
      moduloName: modulo.nombre,
      targetName: target.nombre,
      currentProgresoId: existing?.id,
      currentEstado: existing?.estado ?? "no_iniciado",
    });
    setNewCellEstado(existing?.estado ?? "no_iniciado");
    setCellOpen(true);
  }

  async function handleCellSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCell) return;

    await handleUpdateProgreso(
      selectedCell.targetId,
      selectedCell.targetType,
      selectedCell.moduloId,
      newCellEstado,
      selectedCell.currentProgresoId
    );
    setCellOpen(false);
  }

  // --- FILTERED MATRIX DATA ---
  const filteredModules = modulos.filter((m) => m.activo);

  const matrixTargets: MatrixTarget[] = [];
  
  if (filtroMatrizTipo === "todos" || filtroMatrizTipo === "ejecutivos") {
    ejecutivos.forEach((e) => {
      matrixTargets.push({
        id: e.id,
        nombre: e.nombre,
        type: "ejecutivo",
        detail: e.email,
      });
    });
  }

  if (filtroMatrizTipo === "todos" || filtroMatrizTipo === "clientes") {
    clientes.forEach((c) => {
      matrixTargets.push({
        id: c.id,
        nombre: c.nombre,
        type: "cliente",
        detail: c.clinica ?? "Clínica general",
      });
    });
  }

  // Filter matrix targets by search query
  const filteredMatrixTargets = matrixTargets.filter((t) => {
    return t.nombre.toLowerCase().includes(busquedaMatriz.toLowerCase()) || 
      t.detail.toLowerCase().includes(busquedaMatriz.toLowerCase());
  });

  // --- EXECUTIVE PERSONAL VIEW DATA ---
  // My training modules (active modules directed to 'ejecutivo' or 'ambos')
  const misModulosAsignados = modulos.filter(
    (m) => m.activo && (m.dirigido_a === "ejecutivo" || m.dirigido_a === "ambos")
  );

  // My clients' training progress
  // Filter clients to only those assigned to current logged-in executive
  const misClientes = clientes.filter((c) => c.ejecutivo_id === user?.id);
  const misClientesModulos = modulos.filter(
    (m) => m.activo && (m.dirigido_a === "cliente" || m.dirigido_a === "ambos")
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            Capacitación <GraduationCap className="h-6 w-6 text-primary" />
          </h1>
          <p className="text-sm text-muted-foreground">
            Acompañamiento, capacitaciones técnicas y seguimiento de aprendizaje.
          </p>
        </div>
        
        {isAdmin && activeTab === "modulos" && (
          <Button onClick={abrirNuevoModulo} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md">
            <Plus className="mr-2 h-4 w-4" /> Nuevo Módulo
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-100 border border-slate-200">
          {isAdmin ? (
            <>
              <TabsTrigger value="progreso" className="flex items-center gap-1.5 font-semibold">
                <Grid className="h-4 w-4" /> Matriz de Progreso
              </TabsTrigger>
              <TabsTrigger value="modulos" className="flex items-center gap-1.5 font-semibold">
                <BookOpen className="h-4 w-4" /> Gestionar Módulos
              </TabsTrigger>
            </>
          ) : (
            <>
              <TabsTrigger value="mis_capacitaciones" className="flex items-center gap-1.5 font-semibold">
                <UserCheck className="h-4 w-4" /> Mi Capacitación
              </TabsTrigger>
              <TabsTrigger value="mis_clientes" className="flex items-center gap-1.5 font-semibold">
                <Users className="h-4 w-4" /> Capacitación de mis Clientes
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* ============================================================== */}
        {/* TAB: MATRIZ DE PROGRESO (ADMIN ONLY) */}
        {/* ============================================================== */}
        {isAdmin && (
          <TabsContent value="progreso" className="space-y-4">
            {/* Filter matrix */}
            <Card className="border border-border">
              <CardContent className="pt-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar persona o clínica..."
                      className="pl-9 focus-visible:ring-primary h-9 text-xs"
                      value={busquedaMatriz}
                      onChange={(e) => setBusquedaMatriz(e.target.value)}
                    />
                  </div>
                  <div>
                    <Select value={filtroMatrizTipo} onValueChange={(v: any) => setFiltroMatrizTipo(v)}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Filtrar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos (Clientes y Ejecutivos)</SelectItem>
                        <SelectItem value="clientes">Solo Clientes</SelectItem>
                        <SelectItem value="ejecutivos">Solo Ejecutivos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center justify-end font-semibold">
                    Mostrando {filteredMatrixTargets.length} perfiles comerciales.
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Matrix table */}
            <Card className="border border-border shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50">
                <CardTitle className="text-base text-primary">Matriz de Aprendizaje</CardTitle>
                <CardDescription>Seguimiento de módulos completados. Haz clic en las celdas para actualizar.</CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {loading ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Cargando matriz…</div>
                ) : filteredModules.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No hay módulos de capacitación activos creados.</div>
                ) : (
                  <Table className="min-w-[800px]">
                    <TableHeader>
                      <TableRow className="bg-slate-50/70">
                        <TableHead className="w-52">Nombre / Entidad</TableHead>
                        <TableHead className="w-28 text-center">Tipo</TableHead>
                        {filteredModules.map((m) => (
                          <TableHead key={m.id} className="text-center font-bold text-xs truncate max-w-[150px]" title={m.nombre}>
                            {m.nombre}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMatrixTargets.map((target) => (
                        <TableRow key={`${target.type}-${target.id}`} className="hover:bg-slate-50/30">
                          <TableCell className="font-semibold text-slate-800">
                            <div>{target.nombre}</div>
                            <div className="text-[10px] text-muted-foreground font-medium">{target.detail}</div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={target.type === "ejecutivo" ? "bg-primary/10 text-primary border-none" : "bg-secondary/15 text-secondary border-none"}>
                              {target.type === "ejecutivo" ? "Ejecutivo" : "Cliente"}
                            </Badge>
                          </TableCell>
                          
                          {/* Matrix cells */}
                          {filteredModules.map((modulo) => {
                            // Find progress log
                            const log = progresos.find(
                              (p) => 
                                p.modulo_id === modulo.id && 
                                (target.type === "cliente" ? p.cliente_id === target.id : p.usuario_id === target.id)
                            );

                            const estado: EstadoProgreso = log?.estado ?? "no_iniciado";

                            // Disable cell if module is not directed to this type
                            const isApplicable = 
                              modulo.dirigido_a === "ambos" ||
                              (target.type === "cliente" && modulo.dirigido_a === "cliente") ||
                              (target.type === "ejecutivo" && modulo.dirigido_a === "ejecutivo");

                            if (!isApplicable) {
                              return (
                                <TableCell key={modulo.id} className="text-center bg-slate-50/20 text-slate-300 text-xs italic">
                                  N/A
                                </TableCell>
                              );
                            }

                            return (
                              <TableCell key={modulo.id} className="text-center">
                                <button
                                  onClick={() => handleCellClick(target, modulo)}
                                  className={`inline-flex items-center justify-center px-3 py-1 text-xs font-semibold rounded-full shadow-sm transition-all hover:scale-[1.03] cursor-pointer ${ESTADO_COLORS[estado]}`}
                                >
                                  {ESTADO_LABELS[estado]}
                                </button>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ============================================================== */}
        {/* TAB: GESTIONAR MÓDULOS (ADMIN ONLY) */}
        {/* ============================================================== */}
        {isAdmin && (
          <TabsContent value="modulos" className="space-y-4">
            <Card className="border border-border shadow-sm">
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Cargando módulos…</div>
                ) : modulos.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No hay módulos de capacitación registrados.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Dirigido A</TableHead>
                        <TableHead>Enlace Externo</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                        <TableHead className="w-16 text-right"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modulos.map((m) => (
                        <TableRow key={m.id} className="hover:bg-slate-50/50">
                          <TableCell className="font-semibold text-slate-800">{m.nombre}</TableCell>
                          <TableCell className="text-xs text-slate-500 max-w-sm truncate">{m.descripcion || "Sin descripción"}</TableCell>
                          <TableCell className="font-medium text-xs">
                            <Badge className="bg-slate-100 text-slate-800 border-none uppercase text-[9px] tracking-wider font-bold">
                              {m.dirigido_a === "ambos" ? "Ambos" : m.dirigido_a === "cliente" ? "Clientes" : "Ejecutivos"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-primary font-medium">
                            <a href={m.link_externo} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline">
                              <Link2 className="h-3 w-3" /> Ver contenido
                            </a>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={m.activo ? "default" : "secondary"} className={m.activo ? "bg-emerald-100 text-emerald-800 border-none hover:bg-emerald-100 font-semibold" : ""}>
                              {m.activo ? "Activo" : "Inactivo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-4">
                            <Button variant="ghost" size="sm" onClick={() => abrirEditarModulo(m)} className="hover:bg-slate-100">
                              <Edit className="h-4 w-4 text-slate-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ============================================================== */}
        {/* TAB: MI CAPACITACIÓN (EJECUTIVO ONLY) */}
        {/* ============================================================== */}
        {!isAdmin && (
          <TabsContent value="mis_capacitaciones" className="space-y-4">
            <Card className="border border-border shadow-sm">
              <CardHeader className="bg-slate-50/50">
                <CardTitle className="text-base text-primary">Tus Módulos de Aprendizaje</CardTitle>
                <CardDescription>Completa tus capacitaciones asignadas para desbloquear ventas y metas.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Cargando módulos…</div>
                ) : misModulosAsignados.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No tienes módulos asignados.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Módulo</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Enlace</TableHead>
                        <TableHead className="w-44">Estado Actual</TableHead>
                        <TableHead className="w-52 text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {misModulosAsignados.map((m) => {
                        const log = progresos.find((p) => p.modulo_id === m.id && p.usuario_id === user?.id);
                        const estado = log?.estado ?? "no_iniciado";

                        return (
                          <TableRow key={m.id} className="hover:bg-slate-50/50">
                            <TableCell className="font-bold text-slate-800">{m.nombre}</TableCell>
                            <TableCell className="text-xs text-slate-500 max-w-sm truncate">{m.descripcion || "Sin descripción"}</TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm" asChild className="h-8 text-xs font-semibold">
                                <a href={m.link_externo} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3 w-3 mr-1.5" /> Abrir Enlace
                                </a>
                              </Button>
                            </TableCell>
                            <TableCell>
                              <Badge className={`font-semibold text-[10px] ${ESTADO_COLORS[estado]}`}>
                                {ESTADO_LABELS[estado]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right space-x-1.5 pr-4">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-xs font-medium"
                                disabled={estado === "en_curso"}
                                onClick={() => handleUpdateProgreso(user?.id || "", "ejecutivo", m.id, "en_curso", log?.id)}
                              >
                                En Curso
                              </Button>
                              <Button 
                                size="sm" 
                                className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                                disabled={estado === "completado"}
                                onClick={() => handleUpdateProgreso(user?.id || "", "ejecutivo", m.id, "completado", log?.id)}
                              >
                                Completado
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
          </TabsContent>
        )}

        {/* ============================================================== */}
        {/* TAB: CAPACITACIÓN DE CLIENTES (EJECUTIVO ONLY) */}
        {/* ============================================================== */}
        {!isAdmin && (
          <TabsContent value="mis_clientes" className="space-y-4">
            <Card className="border border-border shadow-sm">
              <CardHeader className="bg-slate-50/50">
                <CardTitle className="text-base text-primary">Capacitación de tus Clientes</CardTitle>
                <CardDescription>Seguimiento y control de los cursos asignados a tu cartera activa de clientes.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Cargando datos de clientes…</div>
                ) : misClientes.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No tienes clientes activos asignados en tu cartera.</div>
                ) : misClientesModulos.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No hay módulos de capacitación dirigidos a clientes.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Clínica</TableHead>
                        <TableHead>Módulo Capacitación</TableHead>
                        <TableHead className="w-44 text-center">Estado</TableHead>
                        <TableHead className="w-44 text-right">Cambiar Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {misClientes.map((cliente) => {
                        return misClientesModulos.map((modulo) => {
                          const log = progresos.find((p) => p.modulo_id === modulo.id && p.cliente_id === cliente.id);
                          const estado = log?.estado ?? "no_iniciado";

                          return (
                            <TableRow key={`${cliente.id}-${modulo.id}`} className="hover:bg-slate-50/50">
                              <TableCell className="font-semibold text-slate-800">{cliente.nombre}</TableCell>
                              <TableCell className="text-slate-600 font-medium">{cliente.clinica || "—"}</TableCell>
                              <TableCell className="text-xs font-bold text-slate-800">{modulo.nombre}</TableCell>
                              <TableCell className="text-center">
                                <Badge className={`font-semibold text-[10px] ${ESTADO_COLORS[estado]}`}>
                                  {ESTADO_LABELS[estado]}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right pr-4">
                                <Select
                                  value={estado}
                                  onValueChange={(v) => handleUpdateProgreso(cliente.id, "cliente", modulo.id, v as EstadoProgreso, log?.id)}
                                >
                                  <SelectTrigger className="w-36 h-8 text-xs font-semibold">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="no_iniciado">No Iniciado</SelectItem>
                                    <SelectItem value="en_curso">En Curso</SelectItem>
                                    <SelectItem value="completado">Completado</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* ============================================================== */}
      {/* MODAL: CREAR / EDITAR MÓDULO (ADMIN ONLY) */}
      {/* ============================================================== */}
      <Dialog open={moduloOpen} onOpenChange={setModuloOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingModulo ? "Editar Módulo de Capacitación" : "Nuevo Módulo de Capacitación"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleModuloSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mod-nombre">Nombre del Módulo</Label>
              <Input
                id="mod-nombre"
                required
                placeholder="Ej: Introducción a Hilos Tensores Regenovue"
                value={moduloForm.nombre}
                onChange={(e) => setModuloForm({ ...moduloForm, nombre: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="mod-desc">Descripción</Label>
              <Input
                id="mod-desc"
                placeholder="Detalles sobre el contenido del curso..."
                value={moduloForm.descripcion}
                onChange={(e) => setModuloForm({ ...moduloForm, descripcion: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mod-link">Enlace Externo (YouTube / Vimeo / Drive)</Label>
              <Input
                id="mod-link"
                required
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={moduloForm.link_externo}
                onChange={(e) => setModuloForm({ ...moduloForm, link_externo: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mod-rol">Dirigido A</Label>
                <Select
                  value={moduloForm.dirigido_a}
                  onValueChange={(v: any) => setModuloForm({ ...moduloForm, dirigido_a: v })}
                >
                  <SelectTrigger id="mod-rol">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ambos">Ambos</SelectItem>
                    <SelectItem value="cliente">Clientes</SelectItem>
                    <SelectItem value="ejecutivo">Ejecutivos Comerciales</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50 mt-4">
                <Label htmlFor="mod-activo" className="font-semibold text-xs text-slate-700">Módulo Activo</Label>
                <Switch
                  id="mod-activo"
                  checked={moduloForm.activo}
                  onCheckedChange={(checked) => setModuloForm({ ...moduloForm, activo: checked })}
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                {editingModulo ? "Guardar Cambios" : "Crear Módulo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* MODAL: CAMBIAR ESTADO DE CELDA EN MATRIZ (ADMIN ONLY) */}
      {/* ============================================================== */}
      <Dialog open={cellOpen} onOpenChange={setCellOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Actualizar Progreso</DialogTitle>
          </DialogHeader>
          {selectedCell && (
            <form onSubmit={handleCellSave} className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1.5 border">
                <div>
                  <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Asignado a:</span>{" "}
                  <span className="font-bold text-slate-800">{selectedCell.targetName}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Módulo:</span>{" "}
                  <span className="font-bold text-slate-800">{selectedCell.moduloName}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cell-estado">Estado del Progreso</Label>
                <Select
                  value={newCellEstado}
                  onValueChange={(v: any) => setNewCellEstado(v)}
                >
                  <SelectTrigger id="cell-estado">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_iniciado">No Iniciado</SelectItem>
                    <SelectItem value="en_curso">En Curso</SelectItem>
                    <SelectItem value="completado">Completado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-2">
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                  Guardar Progreso
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
