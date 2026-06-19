import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Eye, Filter, Calendar, RefreshCw } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/auditoria")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if (!roles?.some((r) => r.role === "admin")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AuditoriaPage,
});

interface AuditLog {
  id: string;
  usuario_id: string | null;
  accion: string;
  tabla_afectada: string;
  registro_id: string | null;
  detalle: any;
  fecha: string;
  usuarios?: {
    nombre: string;
    email: string;
  } | null;
}

function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTable, setSelectedTable] = useState<string>("all");
  const [selectedUsuario, setSelectedUsuario] = useState<string>("all");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Selected log for JSON details modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Available users list for filter
  const [usersList, setUsersList] = useState<{ id: string; nombre: string }[]>([]);

  // Tables list for filter
  const tablesList = [
    { value: "clientes", label: "Clientes" },
    { value: "ventas", label: "Ventas" },
    { value: "tareas", label: "Tareas" },
    { value: "reuniones", label: "Reuniones" },
    { value: "usuarios", label: "Usuarios" },
    { value: "inventario", label: "Inventario" },
    { value: "movimientos_inventario", label: "Movimientos Stock" },
  ];

  async function fetchUsers() {
    const { data } = await supabase.from("usuarios").select("id, nombre").order("nombre");
    if (data) {
      setUsersList(data);
    }
  }

  async function fetchLogs() {
    setLoading(true);
    try {
      let query = supabase
        .from("auditoria")
        .select(`
          id,
          usuario_id,
          accion,
          tabla_afectada,
          registro_id,
          detalle,
          fecha,
          usuarios (
            nombre,
            email
          )
        `, { count: "exact" });

      // Apply Filters
      if (searchQuery.trim() !== "") {
        query = query.ilike("accion", `%${searchQuery.trim()}%`);
      }
      if (selectedTable !== "all") {
        query = query.eq("tabla_afectada", selectedTable);
      }
      if (selectedUsuario !== "all") {
        query = query.eq("usuario_id", selectedUsuario);
      }
      if (fechaInicio) {
        query = query.gte("fecha", new Date(fechaInicio).toISOString());
      }
      if (fechaFin) {
        // Add 23:59:59 to include the whole end day
        const endOfDay = new Date(fechaFin);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("fecha", endOfDay.toISOString());
      }

      // Order by fecha descending
      query = query.order("fecha", { ascending: false });

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      setLogs((data as any[]) || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      toast.error(error?.message || "Error al cargar la auditoría");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    setPage(1); // Reset page on filter changes
    fetchLogs();
  }, [searchQuery, selectedTable, selectedUsuario, fechaInicio, fechaFin]);

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedTable("all");
    setSelectedUsuario("all");
    setFechaInicio("");
    setFechaFin("");
    setPage(1);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Auditoría</h1>
          <p className="text-sm text-muted-foreground">
            Registro inmutable de actividades en el sistema (Solo Lectura - Administrador).
          </p>
        </div>
        <Button onClick={fetchLogs} variant="outline" size="sm" className="w-fit flex gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refrescar
        </Button>
      </div>

      {/* Filters Bar */}
      <Card className="border border-border">
        <CardContent className="p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search Input */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Buscar Acción</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ej: creó cliente"
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Table Select */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tabla Afectada</Label>
              <Select value={selectedTable} onValueChange={setSelectedTable}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {tablesList.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* User Select */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Usuario / Ejecutor</Label>
              <Select value={selectedUsuario} onValueChange={setSelectedUsuario}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {usersList.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Start */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Fecha Inicio</Label>
              <div className="relative">
                <Input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            {/* Date End */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Fecha Fin</Label>
              <div className="relative">
                <Input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            {(searchQuery || selectedTable !== "all" || selectedUsuario !== "all" || fechaInicio || fechaFin) && (
              <Button onClick={clearFilters} variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10">
                Limpiar Filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="border border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center p-12 text-sm text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Cargando logs de auditoría...
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No se encontraron registros de auditoría que coincidan con los filtros.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="w-[180px]">Fecha / Hora</TableHead>
                    <TableHead className="w-[200px]">Usuario / Ejecutor</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead className="w-[150px]">Tabla</TableHead>
                    <TableHead className="w-[150px]">ID Registro</TableHead>
                    <TableHead className="w-[100px] text-right">Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-slate-50/50">
                      <TableCell className="text-xs font-mono text-slate-600">
                        {format(new Date(log.fecha), "dd/MM/yyyy HH:mm:ss")}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-slate-800">
                        {log.usuarios ? (
                          <div>
                            <p>{log.usuarios.nombre}</p>
                            <p className="text-xs text-muted-foreground font-normal">{log.usuarios.email}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">Sistema / Desconocido</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-slate-900">
                        <span className="capitalize">{log.accion}</span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        <code className="bg-slate-100 px-1.5 py-0.5 rounded border text-slate-700">
                          {log.tabla_afectada}
                        </code>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {log.registro_id ? `${log.registro_id.substring(0, 8)}...` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          className="hover:bg-slate-100"
                        >
                          <Eye className="h-4 w-4 mr-1 text-slate-600" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between py-4">
          <div className="text-sm text-muted-foreground">
            Mostrando {logs.length} de {totalCount} registros
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Anterior
            </Button>
            <span className="flex items-center text-sm font-medium px-4">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalles del Registro de Auditoría</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 overflow-y-auto pr-2 py-2">
              <div className="grid grid-cols-2 gap-4 text-sm border-b pb-4">
                <div>
                  <span className="font-semibold text-muted-foreground block text-xs uppercase">Fecha</span>
                  <span>{format(new Date(selectedLog.fecha), "dd/MM/yyyy HH:mm:ss")}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block text-xs uppercase">Acción</span>
                  <span className="font-medium text-primary capitalize">{selectedLog.accion}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block text-xs uppercase">Tabla Afectada</span>
                  <code className="bg-slate-100 px-1 py-0.5 rounded text-xs border">{selectedLog.tabla_afectada}</code>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block text-xs uppercase">ID Registro</span>
                  <code className="font-mono text-xs break-all">{selectedLog.registro_id || "N/A"}</code>
                </div>
                <div className="col-span-2">
                  <span className="font-semibold text-muted-foreground block text-xs uppercase">Ejecutado por</span>
                  <span>
                    {selectedLog.usuarios
                      ? `${selectedLog.usuarios.nombre} (${selectedLog.usuarios.email})`
                      : "Sistema / Proceso automático"}
                  </span>
                </div>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground block text-xs uppercase mb-2">Datos Modificados (Detalle JSON)</span>
                <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-xs font-mono max-h-[400px]">
                  {JSON.stringify(selectedLog.detalle, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { toast } from "sonner";
