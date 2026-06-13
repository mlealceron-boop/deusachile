import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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

  // form state
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
    if (isAdmin) cargarEjecutivos();
    else if (user) setForm((f) => ({ ...f, ejecutivo_id: user.id }));
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

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Todos los clientes de la empresa." : "Tus clientes asignados."}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Nuevo cliente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo cliente</DialogTitle>
            </DialogHeader>
            <form onSubmit={crearCliente} className="space-y-3">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Clínica</Label>
                <Input value={form.clinica} onChange={(e) => setForm({ ...form, clinica: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Contacto</Label>
                <Input value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} placeholder="Teléfono o email" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as TipoCliente })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clinica_propia">Clínica propia</SelectItem>
                      <SelectItem value="recien_empieza">Recién empieza</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
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
                  <Label>Ejecutivo asignado</Label>
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
              <DialogFooter>
                <Button type="submit">Crear</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Listado</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Cargando…</div>
          ) : clientes.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Aún no hay clientes.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Clínica</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  {isAdmin && <TableHead>Ejecutivo</TableHead>}
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nombre}</TableCell>
                    <TableCell>{c.clinica ?? "—"}</TableCell>
                    <TableCell>{TIPO_LABEL[c.tipo]}</TableCell>
                    <TableCell>
                      <Badge variant={c.estado === "activo" ? "default" : c.estado === "inactivo" ? "secondary" : "outline"}>
                        {ESTADO_LABEL[c.estado]}
                      </Badge>
                    </TableCell>
                    {isAdmin && <TableCell>{c.usuarios?.nombre ?? "—"}</TableCell>}
                    <TableCell className="text-right">
                      <Link to="/clientes/$id" params={{ id: c.id }} className="text-sm text-primary hover:underline">
                        Abrir
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
