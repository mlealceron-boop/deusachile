import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listClientesTool from "./tools/list-clientes";
import listVentasTool from "./tools/list-ventas";
import listMisTareasTool from "./tools/list-mis-tareas";
import createTareaTool from "./tools/create-tarea";

// OAuth issuer MUST be the direct Supabase host (published SUPABASE_URL is
// rewritten to a .lovable.cloud proxy that mcp-js rejects). VITE_SUPABASE_PROJECT_ID
// is inlined at build time by Vite; the fallback keeps the issuer well-formed
// during the manifest-extract eval where the literal may be unset.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "deusa-mcp",
  title: "DEUSA · Comercial",
  version: "0.1.0",
  instructions:
    "Herramientas para el sistema comercial DEUSA. Permite consultar clientes, ventas y tareas del usuario autenticado, y crear nuevas tareas. Todas las llamadas respetan los permisos (RLS) del usuario conectado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listClientesTool, listVentasTool, listMisTareasTool, createTareaTool],
});
