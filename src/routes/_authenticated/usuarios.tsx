import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { actualizarUsuario, cambiarRol, crearUsuario } from "@/lib/users.functions";

export const Route = createFileRoute("/_authenticated/usuarios")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if (!roles?.some((r) => r.role === "admin")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: UsuariosPage,
});

interface UsuarioRow {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  rol: "admin" | "ejecutivo" | null;
}

function UsuariosPage() {
  const crear = useServerFn(crearUsuario);
  const actualizar = useServerFn(actualizarUsuario);
  const cambiarRolFn = useServerFn(cambiarRol);
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    password: "",
    rol: "ejecutivo" as "admin" | "ejecutivo",
  });
  const [submitting, setSubmitting] = useState(false);

  async function cargar() {
    setLoading(true);
    const [{ data: us }, { data: rs }] = await Promise.all([
      supabase.from("usuarios").select("id, nombre, email, activo").order("creado_en"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const rolMap = new Map<string, "admin" | "ejecutivo">();
    (rs ?? []).forEach((r) => rolMap.set(r.user_id, r.role as any));
    setUsuarios(
      (us ?? []).map((u) => ({ ...u, rol: rolMap.get(u.id) ?? null })),
    );
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await crear({ data: form });
      toast.success("Usuario creado");
      setOpen(false);
      setForm({ nombre: "", email: "", password: "", rol: "ejecutivo" });
      cargar();
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo crear");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActivo(u: UsuarioRow) {
    try {
      await actualizar({ data: { id: u.id, activo: !u.activo } });
      toast.success(!u.activo ? "Usuario activado" : "Usuario desactivado");
      cargar();
    } catch (err: any) {
      toast.error(err?.message ?? "Error");
    }
  }

  async function handleCambiarRol(u: UsuarioRow, rol: "admin" | "ejecutivo") {
    if (u.rol === rol) return;
    try {
      await cambiarRolFn({ data: { userId: u.id, rol } });
      toast.success("Rol actualizado");
      cargar();
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo cambiar el rol");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground">Gestiona los ejecutivos del equipo.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Nuevo usuario</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo usuario</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCrear} className="space-y-3">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Contraseña (mín. 8)</Label>
                <Input type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={form.rol} onValueChange={(v) => setForm({ ...form, rol: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ejecutivo">Ejecutivo</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Creando…" : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Equipo</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Cargando…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Activo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuarios.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.nombre}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.rol === "admin" ? "default" : "secondary"}>
                        {u.rol === "admin" ? "Administrador" : "Ejecutivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch checked={u.activo} onCheckedChange={() => toggleActivo(u)} />
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
