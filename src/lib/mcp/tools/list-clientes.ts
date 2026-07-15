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
  name: "list_clientes",
  title: "Listar clientes",
  description:
    "Lista los clientes de DEUSA visibles para el usuario autenticado. Filtra opcionalmente por estado (activo, prospecto, inactivo) y limita la cantidad de resultados.",
  inputSchema: {
    estado: z
      .enum(["activo", "prospecto", "inactivo"])
      .optional()
      .describe("Filtro opcional por estado del cliente."),
    limit: z.number().int().min(1).max(200).optional().describe("Máximo de filas (por defecto 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ estado, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("clientes")
      .select("id, nombre, clinica, contacto, tipo, estado, ejecutivo_id, creado_en")
      .order("creado_en", { ascending: false })
      .limit(limit ?? 50);
    if (estado) q = q.eq("estado", estado);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { clientes: data ?? [] },
    };
  },
});
