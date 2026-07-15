import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, User, Calendar, MessageSquare, Save, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  nivel: string | null;
  interes: string | null;
  notas: string | null;
  rut: string | null;
  email: string | null;
  telefono: string | null;
  region: string | null;
  ciudad: string | null;
  comuna: string | null;
  direccion: string | null;
  rss: string | null;
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
    
    // Build update object, only allowing admin to change ejecutivo_id
    const updates: any = {
      nombre: cliente.nombre,
      clinica: cliente.clinica,
      contacto: cliente.contacto,
      tipo: cliente.tipo,
      estado: cliente.estado,
      nivel: cliente.nivel,
      interes: cliente.interes,
      notas: cliente.notas,
      rut: cliente.rut,
      email: cliente.email,
      telefono: cliente.telefono,
      region: cliente.region,
      ciudad: cliente.ciudad,
      comuna: cliente.comuna,
      direccion: cliente.direccion,
      rss: cliente.rss,
    };
    if (isAdmin) {
      updates.ejecutivo_id = cliente.ejecutivo_id;
    }

    const { error } = await supabase
      .from("clientes")
      .update(updates)
      .eq("id", cliente.id);
      
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Ficha de cliente actualizada");
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
    toast.success("Nota agregada al historial");
    setNota("");
    cargar();
  }

  if (loading || !cliente) {
    return <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Cargando detalles del cliente…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/clientes" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Clientes
        </Link>
        <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-none font-semibold">
          Ficha Comercial
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Details Form */}
        <Card className="md:col-span-2 border border-border shadow-sm">
          <CardHeader className="bg-slate-50/50">
            <CardTitle className="text-xl text-primary font-bold">Datos del Cliente</CardTitle>
            <CardDescription>Edita la información de contacto y clasificación del cliente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre Completo</Label>
                <Input id="nombre" value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinica">Clínica</Label>
                <Input id="clinica" value={cliente.clinica ?? ""} onChange={(e) => setCliente({ ...cliente, clinica: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contacto">Contacto</Label>
                <Input id="contacto" value={cliente.contacto ?? ""} onChange={(e) => setCliente({ ...cliente, contacto: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo de Cliente</Label>
                <Select value={cliente.tipo} onValueChange={(v) => setCliente({ ...cliente, tipo: v as TipoCliente })}>
                  <SelectTrigger id="tipo"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clinica_propia">Clínica propia</SelectItem>
                    <SelectItem value="recien_empieza">Recién empieza</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="estado">Estado Actual</Label>
                <Select value={cliente.estado} onValueChange={(v) => setCliente({ ...cliente, estado: v as EstadoCliente })}>
                  <SelectTrigger id="estado"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospecto">Prospecto</SelectItem>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="inactivo">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isAdmin && (
                <div className="space-y-2">
                  <Label htmlFor="ejecutivo">Ejecutivo Asignado</Label>
                  <Select value={cliente.ejecutivo_id} onValueChange={(v) => setCliente({ ...cliente, ejecutivo_id: v })}>
                    <SelectTrigger id="ejecutivo"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ejecutivos.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="nivel">Nivel</Label>
                <Input id="nivel" value={cliente.nivel ?? ""} onChange={(e) => setCliente({ ...cliente, nivel: e.target.value })} placeholder="Ej. Alto, Medio, Bajo" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interes">Interés</Label>
                <Input id="interes" value={cliente.interes ?? ""} onChange={(e) => setCliente({ ...cliente, interes: e.target.value })} placeholder="Ej. Compra inmediata, Futuro" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notas">Notas</Label>
                <Textarea id="notas" value={cliente.notas ?? ""} onChange={(e) => setCliente({ ...cliente, notas: e.target.value })} placeholder="Observaciones generales del cliente..." rows={3} />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={guardar} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                <Save className="mr-2 h-4 w-4" /> {saving ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick info / Stats */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="bg-slate-50/50">
            <CardTitle className="text-base text-primary font-semibold">Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6 text-sm">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-muted-foreground">Estado:</span>
              <Badge className={
                cliente.estado === "activo" 
                  ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none" 
                  : cliente.estado === "inactivo" 
                    ? "bg-slate-100 text-slate-800 hover:bg-slate-100 border-none" 
                    : "bg-amber-100 text-amber-800 hover:bg-amber-100 border-none"
              }>
                {cliente.estado.toUpperCase()}
              </Badge>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-muted-foreground">Tipo:</span>
              <span className="font-semibold text-slate-700">{cliente.tipo === "clinica_propia" ? "Clínica Propia" : "Recién Empieza"}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-muted-foreground">Interacciones:</span>
              <span className="font-semibold text-slate-700">{interacciones.length}</span>
            </div>
            {cliente.nivel && (
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-muted-foreground">Nivel:</span>
                <span className="font-semibold text-slate-700">{cliente.nivel}</span>
              </div>
            )}
            {cliente.interes && (
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-muted-foreground">Interés:</span>
                <span className="font-semibold text-slate-700">{cliente.interes}</span>
              </div>
            )}
            {cliente.notas && (
              <div className="pt-2">
                <span className="text-muted-foreground block mb-1">Notas:</span>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{cliente.notas}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Interactions Feed */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="bg-slate-50/50">
          <CardTitle className="text-lg text-primary font-bold">Historial de Interacciones</CardTitle>
          <CardDescription>Resumen de todas las llamadas, reuniones, visitas y correos de acompañamiento comercial.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <form onSubmit={agregarNota} className="space-y-3">
            <Label htmlFor="nota" className="font-semibold text-slate-700">Nueva Bitácora Comercial</Label>
            <Textarea 
              id="nota"
              value={nota} 
              onChange={(e) => setNota(e.target.value)} 
              placeholder="Escribe el resumen de la llamada, reunión, propuesta comercial enviada..." 
              rows={3} 
              className="focus-visible:ring-primary"
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={!nota.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                <Plus className="mr-2 h-4 w-4" /> Registrar Nota
              </Button>
            </div>
          </form>

          <div className="relative border-l border-slate-200 ml-3 pl-6 space-y-6">
            {interacciones.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 pl-2">Aún no hay interacciones registradas para este cliente.</p>
            ) : (
              interacciones.map((i) => (
                <div key={i.id} className="relative group">
                  <div className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white border-2 border-primary">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  </div>
                  <div className="rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 font-semibold text-primary">
                        <User className="h-3 w-3" /> {i.usuarios?.nombre ?? "Usuario"}
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <Calendar className="h-3 w-3" /> {new Date(i.fecha).toLocaleString("es-ES")}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{i.nota}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
