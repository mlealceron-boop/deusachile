import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { adminExiste, bootstrapAdmin } from "@/lib/users.functions";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const checkAdmin = useServerFn(adminExiste);
  const bootstrap = useServerFn(bootstrapAdmin);

  const [hayAdmin, setHayAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");

  useEffect(() => {
    checkAdmin().then((r) => setHayAdmin(r.existe)).catch(() => setHayAdmin(true));
  }, [checkAdmin]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Sesión iniciada");
    router.navigate({ to: "/dashboard", replace: true });
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    setLoading(false);
    if (result.error) {
      toast.error(result.error.message ?? "Error al iniciar sesión con Google");
      return;
    }
    if (result.redirected) {
      // Browser will redirect to Google
      return;
    }
    toast.success("Sesión iniciada");
    router.navigate({ to: "/dashboard", replace: true });
  }

  async function handleBootstrap(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await bootstrap({ data: { email, password, nombre } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Administrador creado");
      router.navigate({ to: "/dashboard", replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo crear el administrador");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">DEUSA</CardTitle>
          <CardDescription>Sistema comercial interno</CardDescription>
        </CardHeader>
        <CardContent>
          {hayAdmin === null ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Cargando…</div>
          ) : hayAdmin ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Ingresando…" : "Iniciar sesión"}
              </Button>
            </form>
          ) : (
            <Tabs defaultValue="setup">
              <TabsList className="mb-4 grid w-full grid-cols-1">
                <TabsTrigger value="setup">Crear administrador</TabsTrigger>
              </TabsList>
              <TabsContent value="setup">
                <p className="mb-3 text-sm text-muted-foreground">
                  No hay administrador configurado. Crea la cuenta principal del director.
                </p>
                <form onSubmit={handleBootstrap} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre completo</Label>
                    <Input id="nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="b-email">Email</Label>
                    <Input id="b-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="b-password">Contraseña (mín. 8)</Label>
                    <Input id="b-password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creando…" : "Crear y entrar"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
      <Toaster richColors position="top-right" />
    </div>
  );
}
