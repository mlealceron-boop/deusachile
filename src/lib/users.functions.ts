import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RolEnum = z.enum(["admin", "ejecutivo"]);

async function asegurarAdmin(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (!roles?.some((r: any) => r.role === "admin")) {
    throw new Error("No autorizado");
  }
}

export const adminExiste = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  return { existe: (count ?? 0) > 0 };
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("Ya existe un administrador");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nombre: data.nombre },
    });
    if (error || !created.user) throw new Error(error?.message ?? "No se pudo crear el usuario");
    const uid = created.user.id;
    const { error: e1 } = await supabaseAdmin
      .from("usuarios")
      .insert({ id: uid, nombre: data.nombre, email: data.email });
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: "admin" });
    if (e2) throw new Error(e2.message);
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
    await asegurarAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nombre: data.nombre },
    });
    if (error || !created.user) throw new Error(error?.message ?? "No se pudo crear el usuario");
    const uid = created.user.id;
    const { error: e1 } = await supabaseAdmin
      .from("usuarios")
      .insert({ id: uid, nombre: data.nombre, email: data.email });
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: data.rol });
    if (e2) throw new Error(e2.message);
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
    await asegurarAdmin(context.supabase, context.userId);
    const patch: { nombre?: string; activo?: boolean } = {};
    if (data.nombre !== undefined) patch.nombre = data.nombre;
    if (data.activo !== undefined) patch.activo = data.activo;
    if (Object.keys(patch).length > 0) {
      const { error } = await context.supabase.from("usuarios").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
    }
    if (data.activo !== undefined) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.auth.admin.updateUserById(data.id, {
        ban_duration: data.activo ? "none" : "876000h",
  });

export const cambiarRol = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; rol: "admin" | "ejecutivo" }) =>
    z.object({ userId: z.string().uuid(), rol: RolEnum }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await asegurarAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && data.rol !== "admin") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1) {
        throw new Error("Debe existir al menos un administrador");
      }
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (delErr) throw new Error(delErr.message);
    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.rol });
    if (insErr) throw new Error(insErr.message);
    return { ok: true };
  });

    }
    return { ok: true };
  });
