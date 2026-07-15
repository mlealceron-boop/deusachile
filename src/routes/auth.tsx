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

function isSafeNext(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//");
}

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    next: isSafeNext(s.next) ? s.next : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      if (search.next) throw redirect({ href: search.next });
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const { next } = Route.useSearch();
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

  function goPostAuth() {
    if (next) {
      window.location.href = next;
      return;
    }
    router.navigate({ to: "/dashboard", replace: true });
  }

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
    goPostAuth();
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    const redirectUri = next
      ? `${window.location.origin}/auth?next=${encodeURIComponent(next)}`
      : window.location.origin;
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: redirectUri,
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
    goPostAuth();
  }

  async function handleBootstrap(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await bootstrap({ data: { email, password, nombre } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Administrador creado");
      goPostAuth();
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo crear el administrador");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-radial from-slate-50 to-slate-200 p-4">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
      
      <Card className="w-full max-w-md border-t-4 border-t-primary shadow-xl backdrop-blur-sm bg-card/90 relative z-10">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <span className="text-xl font-bold text-primary">D</span>
          </div>
          <CardTitle className="text-3xl font-extrabold tracking-tight text-primary">DEUSA</CardTitle>
          <CardDescription className="text-sm font-medium text-secondary tracking-wider uppercase">
            Sistema Comercial
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {hayAdmin === null ? (
            <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">Cargando…</div>
          ) : hayAdmin ? (
            <div className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Email
                  </Label>
                  <Input 
                    id="email" 
                    type="email" 
                    required 
                    placeholder="ejemplo@deusa.cl"
                    className="focus-visible:ring-primary"
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Contraseña
                  </Label>
                  <Input 
                    id="password" 
                    type="password" 
                    required 
                    placeholder="••••••••"
                    className="focus-visible:ring-primary"
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                  />
                </div>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 transition-all hover:scale-[1.01]" disabled={loading}>
                  {loading ? "Ingresando…" : "Iniciar Sesión"}
                </Button>
              </form>
            </div>
          ) : (
            <Tabs defaultValue="setup">
              <TabsList className="mb-4 grid w-full grid-cols-1">
                <TabsTrigger value="setup" className="font-semibold">Configurar Cuenta Administrador</TabsTrigger>
              </TabsList>
              <TabsContent value="setup">
                <p className="mb-4 text-xs text-muted-foreground text-center">
                  No se detectó una cuenta de administrador en el sistema. Configura las credenciales principales del director para iniciar.
                </p>
                <form onSubmit={handleBootstrap} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Nombre completo
                    </Label>
                    <Input id="nombre" required placeholder="Director General" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="b-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Email
                    </Label>
                    <Input id="b-email" type="email" required placeholder="director@deusa.cl" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="b-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Contraseña (mín. 8 caracteres)
                    </Label>
                    <Input id="b-password" type="password" required minLength={8} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold shadow-lg transition-all hover:scale-[1.01]" disabled={loading}>
                    {loading ? "Creando…" : "Crear y Entrar"}
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
