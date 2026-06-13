import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  component: ClienteDetalle,
});

type TipoCliente = "clinica_propia" | "recien_empieza";
type EstadoCliente = "prospecto" | "activo" | "inactivo";

interface Cliente {
  id: string;
  nombre: string;
  clinica: string | null;
  contacto: string | null;
  tipo: TipoCliente;
  estado: EstadoCliente;
  ejecutivo_id: string;
}

interface Interaccion {
  id: string;
  nota: string;
  fecha: string;
  usuario_id: string;
  usuarios?: { nombre: string } | null;
}

function ClienteDetalle() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const isAdmin = user?.rol === "admin";

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [ejecutivos, setEjecutivos] = useState<{ id: string; nombre: string }[]>([]);
  const [interacciones, setInteracciones] = useState<Interaccion[]>([]);
  const [nota, setNota] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function cargar() {
    setLoading(true);
    const { data, error } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
    if (error) toast.error(error.message);
    if (!data) {
      toast.error("Cliente no encontrado o sin acceso");
      navigate({ to: "/clientes" });
      return;
    }
    setCliente(data as Cliente);
    const { data: ints } = await supabase
      .from("interacciones")
      .select("*, usuarios:usuario_id(nombre)")
      .eq("cliente_id", id)
      .order("fecha", { ascending: false });
    setInteracciones((ints as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, [id]);

  useEffect(() => {
    if (isAdmin) {
      supabase.from("usuarios").select("id, nombre").eq("activo", true).then(({ data }) => setEjecutivos(data ?? []));
    }
  }, [isAdmin]);

  async function guardar() {
    if (!cliente) return;
    setSaving(true);
    const { error } = await supabase
      .from("clientes")
      .update({
        nombre: cliente.nombre,
        clinica: cliente.clinica,
        contacto: cliente.contacto,
        tipo: cliente.tipo,
        estado: cliente.estado,
        ejecutivo_id: cliente.ejecutivo_id,
      })
      .eq("id", cliente.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Cliente actualizado");
  }

  async function agregarNota(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !cliente || !nota.trim()) return;
    const { error } = await supabase.from("interacciones").insert({
      cliente_id: cliente.id,
      usuario_id: user.id,
      nota: nota.trim(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNota("");
    cargar();
  }

  if (loading || !cliente) {
    return <div className="text-sm text-muted-foreground">Cargando…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link to="/clientes" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Volver
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Ficha del cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Clínica</Label>
              <Input value={cliente.clinica ?? ""} onChange={(e) => setCliente({ ...cliente, clinica: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Contacto</Label>
              <Input value={cliente.contacto ?? ""} onChange={(e) => setCliente({ ...cliente, contacto: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={cliente.tipo} onValueChange={(v) => setCliente({ ...cliente, tipo: v as TipoCliente })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="clinica_propia">Clínica propia</SelectItem>
                  <SelectItem value="recien_empieza">Recién empieza</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={cliente.estado} onValueChange={(v) => setCliente({ ...cliente, estado: v as EstadoCliente })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospecto">Prospecto</SelectItem>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isAdmin && (
              <div className="space-y-2">
                <Label>Ejecutivo</Label>
                <Select value={cliente.ejecutivo_id} onValueChange={(v) => setCliente({ ...cliente, ejecutivo_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ejecutivos.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de interacciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={agregarNota} className="space-y-2">
            <Label>Nueva nota</Label>
            <Textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Resumen de la llamada, reunión, mensaje…" rows={3} />
            <div className="flex justify-end">
              <Button type="submit" disabled={!nota.trim()}>Agregar nota</Button>
            </div>
          </form>

          <div className="space-y-2">
            {interacciones.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay interacciones registradas.</p>
            ) : (
              interacciones.map((i) => (
                <div key={i.id} className="rounded-md border bg-card p-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{i.usuarios?.nombre ?? "Usuario"}</span>
                    <span>{new Date(i.fecha).toLocaleString("es-ES")}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{i.nota}</p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
