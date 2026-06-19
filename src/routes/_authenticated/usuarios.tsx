import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Edit } from "lucide-react";
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
  const [editOpen, setEditOpen] = useState(false);
  
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    password: "",
    rol: "ejecutivo" as "admin" | "ejecutivo",
  });
  
  const [editForm, setEditForm] = useState({
    id: "",
    nombre: "",
    rol: "ejecutivo" as "admin" | "ejecutivo",
    activo: true,
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

  function abrirEdicion(u: UsuarioRow) {
    setEditForm({
      id: u.id,
      nombre: u.nombre,
      rol: (u.rol ?? "ejecutivo") as "admin" | "ejecutivo",
      activo: u.activo,
    });
    setEditOpen(true);
  }

  async function handleEditar(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      // 1. Update basic info & status
      await actualizar({ 
        data: { 
          id: editForm.id, 
          nombre: editForm.nombre, 
          activo: editForm.activo 
        } 
      });

      // 2. Update role if changed
      const originalUser = usuarios.find(u => u.id === editForm.id);
      if (originalUser && originalUser.rol !== editForm.rol) {
        await cambiarRolFn({ data: { userId: editForm.id, rol: editForm.rol } });
      }

      toast.success("Usuario actualizado");
      setEditOpen(false);
      cargar();
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo actualizar");
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

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Usuarios</h1>
          <p className="text-sm text-muted-foreground">Gestiona los ejecutivos del equipo.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Nuevo usuario</Button>
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
                <Button type="submit" disabled={submitting} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  {submitting ? "Creando…" : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditar} className="space-y-3">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input required value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={editForm.rol} onValueChange={(v) => setEditForm({ ...editForm, rol: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ejecutivo">Ejecutivo</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-b border-slate-100">
              <Label htmlFor="edit-activo">Estado Activo</Label>
              <Switch 
                id="edit-activo" 
                checked={editForm.activo} 
                onCheckedChange={(checked) => setEditForm({ ...editForm, activo: checked })} 
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {submitting ? "Guardando…" : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card className="border border-border">
        <CardHeader className="bg-slate-50/50">
          <CardTitle className="text-base text-primary">Equipo</CardTitle>
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
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuarios.map((u) => (
                  <TableRow key={u.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-medium text-slate-800">{u.nombre}</TableCell>
                    <TableCell className="text-slate-600">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.rol === "admin" ? "default" : "secondary"} className={u.rol === "admin" ? "bg-primary text-primary-foreground" : "bg-slate-100 text-slate-700"}>
                        {u.rol === "admin" ? "Administrador" : "Ejecutivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch checked={u.activo} onCheckedChange={() => toggleActivo(u)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => abrirEdicion(u)} className="hover:bg-slate-100">
                        <Edit className="h-4 w-4 mr-1 text-slate-600" />
                        Editar
                      </Button>
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
