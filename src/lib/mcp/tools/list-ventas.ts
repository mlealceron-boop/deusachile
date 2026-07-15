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
  name: "list_ventas",
  title: "Listar ventas recientes",
  description:
    "Lista las ventas visibles para el usuario autenticado, ordenadas por fecha descendente. Incluye totales neto, bruto y comisión.",
  inputSchema: {
    limit: z.number().int().min(1).max(200).optional().describe("Máximo de filas (por defecto 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("ventas")
      .select("id, fecha, cliente_id, ejecutivo_id, total_neto, total_bruto, total_comision, porcentaje_comision")
      .order("fecha", { ascending: false })
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { ventas: data ?? [] },
    };
  },
});
