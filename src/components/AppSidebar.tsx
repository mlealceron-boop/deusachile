import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { 
  LayoutDashboard, 
  Users, 
  UserCog, 
  LogOut, 
  FolderTree, 
  ShoppingCart, 
  ClipboardList, 
  Calendar, 
  Package, 
  TrendingUp, 
  GraduationCap, 
  History 
} from "lucide-react";
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
    { title: "Catálogo", url: "/catalogo", icon: FolderTree, show: isAdmin },
    { title: "Ventas", url: "/ventas", icon: ShoppingCart, show: true },
    { title: "Tareas", url: "/tareas", icon: ClipboardList, show: true },
    { title: "Reuniones", url: "/reuniones", icon: Calendar, show: true },
    { title: "Inventario", url: "/inventario", icon: Package, show: isAdmin },
    { title: "Comisiones", url: "/comisiones", icon: TrendingUp, show: isAdmin },
    { title: "Capacitación", url: "/capacitacion", icon: GraduationCap, show: true },
    { title: "Usuarios", url: "/usuarios", icon: UserCog, show: isAdmin },
    { title: "Auditoría", url: "/auditoria", icon: History, show: isAdmin },
  ].filter((i) => i.show);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-card">
      <SidebarHeader className="px-4 py-4 border-b border-border bg-primary text-primary-foreground overflow-hidden group-data-[collapsible=icon]:px-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground font-bold">
            D
          </div>
          <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="font-bold leading-none tracking-tight">DEUSA</span>
            <span className="text-[10px] text-secondary font-medium tracking-widest uppercase mt-0.5">
              Comercial
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold tracking-wider text-muted-foreground uppercase px-2 mb-2">
            Navegación
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = pathname === item.url || pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive}
                      className={`transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
                        isActive 
                          ? "bg-primary/10 text-primary font-semibold border-l-2 border-primary" 
                          : "text-muted-foreground"
                      }`}
                    >
                      <Link to={item.url}>
                        <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-border bg-slate-50/50 dark:bg-slate-900/10">
        {user && (
          <div className="mb-3 px-1 text-xs">
            <div className="truncate font-semibold text-primary">{user.nombre || user.email}</div>
            <div className="truncate text-secondary font-medium uppercase tracking-wider text-[10px] mt-0.5">
              {user.rol === "admin" ? "Director / Administrador" : "Ejecutivo Comercial"}
            </div>
          </div>
        )}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleLogout} 
          className="w-full justify-start text-xs font-medium border-slate-200 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors duration-200"
        >
          <LogOut className="mr-2 h-3.5 w-3.5" /> Cerrar sesión
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
