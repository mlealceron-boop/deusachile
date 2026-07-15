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
  name: "list_mis_tareas",
  title: "Listar mis tareas",
  description: "Devuelve las tareas asignadas al usuario autenticado, opcionalmente filtradas por estado.",
  inputSchema: {
    estado: z
      .enum(["pendiente", "en_progreso", "completada"])
      .optional()
      .describe("Filtro opcional por estado de la tarea."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ estado }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("tareas")
      .select("id, titulo, descripcion, estado, fecha_limite, cliente_id, creado_en")
      .eq("ejecutivo_id", ctx.getUserId()!)
      .order("fecha_limite", { ascending: true, nullsFirst: false });
    if (estado) q = q.eq("estado", estado);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { tareas: data ?? [] },
    };
  },
});
