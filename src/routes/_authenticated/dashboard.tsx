import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useCurrentUser();
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Hola{user?.nombre ? `, ${user.nombre}` : ""}. Bienvenido al sistema comercial DEUSA.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Próximamente</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Aquí verás métricas comerciales, ventas y tareas pendientes en próximas fases.
        </CardContent>
      </Card>
    </div>
  );
}
