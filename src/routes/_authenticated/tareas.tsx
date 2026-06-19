import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/tareas")({
  component: TareasStub,
});

function TareasStub() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tareas</h1>
        <p className="text-sm text-muted-foreground">Tareas Comerciales y Seguimiento.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Próximamente</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Esta sección estará disponible en la próxima fase del roadmap.
        </CardContent>
      </Card>
    </div>
  );
}
