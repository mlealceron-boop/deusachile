import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RolEnum = z.enum(["admin", "ejecutivo"]);

function publicClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const adminExiste = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb.rpc("any_admin_exists");
  if (error) throw new Error(error.message);
  return { existe: !!data };
});

export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string; nombre: string }) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        nombre: z.string().min(1).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: exists, error: chkErr } = await sb.rpc("any_admin_exists");
    if (chkErr) throw new Error(chkErr.message);
    if (exists) throw new Error("Ya existe un administrador");

    const { data: signUp, error: signErr } = await sb.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { nombre: data.nombre } },
    });
    if (signErr) throw new Error(signErr.message);
    if (!signUp.session) {
      throw new Error(
        "Cuenta creada, pero requiere confirmación por email. Pide al equipo de Lovable habilitar auto-confirm o confirma desde el correo y vuelve a entrar.",
      );
    }
    // Use the new session to call bootstrap_admin as the just-created user.
    const { error: bootErr } = await sb.rpc("bootstrap_admin", {
      p_nombre: data.nombre,
      p_email: data.email,
    });
    if (bootErr) throw new Error(bootErr.message);
    return { ok: true };
  });

export const crearUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { email: string; password: string; nombre: string; rol: "admin" | "ejecutivo" }) =>
      z
        .object({
          email: z.string().email(),
          password: z.string().min(8),
          nombre: z.string().min(1).max(120),
          rol: RolEnum,
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("No autorizado");

    // Sign up the new user from an ephemeral client so the admin's session is untouched.
    const sb = publicClient();
    const { data: signUp, error: signErr } = await sb.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { nombre: data.nombre } },
    });
    if (signErr) throw new Error(signErr.message);
    const uid = signUp.user?.id;
    if (!uid) throw new Error("No se pudo crear el usuario");

    // Insert profile + role via SECURITY DEFINER RPC (runs as admin caller via context.supabase).
    const { error: rpcErr } = await context.supabase.rpc("crear_perfil_y_rol", {
      p_uid: uid,
      p_nombre: data.nombre,
      p_email: data.email,
      p_rol: data.rol,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    return { ok: true, id: uid };
  });

export const actualizarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; nombre?: string; activo?: boolean }) =>
    z
      .object({
        id: z.string().uuid(),
        nombre: z.string().min(1).max(120).optional(),
        activo: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("No autorizado");

    const patch: { nombre?: string; activo?: boolean } = {};
    if (data.nombre !== undefined) patch.nombre = data.nombre;
    if (data.activo !== undefined) patch.activo = data.activo;
    if (Object.keys(patch).length > 0) {
      const { error } = await context.supabase.from("usuarios").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const cambiarRol = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; rol: "admin" | "ejecutivo" }) =>
    z.object({ userId: z.string().uuid(), rol: RolEnum }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("cambiar_rol", {
      p_user: data.userId,
      p_rol: data.rol,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
