import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Rol = "admin" | "ejecutivo";

export interface CurrentUser {
  id: string;
  email: string;
  nombre: string;
  rol: Rol | null;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      const [{ data: perfil }, { data: roles }] = await Promise.all([
        supabase.from("usuarios").select("nombre,email").eq("id", auth.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", auth.user.id),
      ]);
      if (!active) return;
      setUser({
        id: auth.user.id,
        email: perfil?.email ?? auth.user.email ?? "",
        nombre: perfil?.nombre ?? "",
        rol: (roles?.[0]?.role as Rol) ?? null,
      });
      setLoading(false);
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
