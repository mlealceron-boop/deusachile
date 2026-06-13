import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, UserCog, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { CurrentUser } from "@/hooks/use-current-user";

interface Props {
  user: CurrentUser | null;
}

export function AppSidebar({ user }: Props) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = user?.rol === "admin";

  const items = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, show: true },
    { title: "Clientes", url: "/clientes", icon: Users, show: true },
    { title: "Usuarios", url: "/usuarios", icon: UserCog, show: isAdmin },
  ].filter((i) => i.show);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-3">
        <div className="font-semibold tracking-tight">DEUSA</div>
        <div className="text-xs text-muted-foreground">Sistema comercial</div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menú</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(item.url)}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-3 py-3">
        {user && (
          <div className="mb-2 px-1 text-xs">
            <div className="truncate font-medium">{user.nombre || user.email}</div>
            <div className="truncate text-muted-foreground capitalize">{user.rol ?? "—"}</div>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={handleLogout} className="w-full justify-start">
          <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
