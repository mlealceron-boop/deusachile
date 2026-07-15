import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "create_tarea",
  title: "Crear tarea",
  description:
    "Crea una nueva tarea asignada al usuario autenticado. Permite adjuntar descripción, cliente relacionado y fecha límite (ISO 8601).",
  inputSchema: {
    titulo: z.string().trim().min(1).describe("Título breve de la tarea."),
    descripcion: z.string().trim().optional().describe("Detalle opcional de la tarea."),
    cliente_id: z.string().uuid().optional().describe("UUID del cliente relacionado (opcional)."),
    fecha_limite: z
      .string()
      .datetime({ offset: true })
      .optional()
      .describe("Fecha límite ISO 8601 (opcional)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ titulo, descripcion, cliente_id, fecha_limite }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId()!;
    const { data, error } = await sb
      .from("tareas")
      .insert({
        titulo,
        descripcion: descripcion ?? null,
        cliente_id: cliente_id ?? null,
        fecha_limite: fecha_limite ?? null,
        ejecutivo_id: userId,
        creado_por: userId,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Tarea creada (${data.id})` }],
      structuredContent: { tarea: data },
    };
  },
});
