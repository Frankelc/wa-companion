import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Home,
  Heart,
  Eye,
  Trash2,
  Settings,
  Sparkles,
  Ghost,
} from "lucide-react";
import { cn } from "@/lib/utils";

import {
  List,
  Calendar,
  Sliders,
  MessageSquare,
  BarChart3,
  Crown,
  HelpCircle,
} from "lucide-react";

// Desktop menu items (all items)
const desktopMenuItems = [
  { title: "Accueil", url: "/dashboard", icon: Home },
  { title: "Gestion Status", url: "/dashboard/status", icon: Heart },
  { title: "Liste Status", url: "/dashboard/status/list", icon: List },
  { title: "Programmer Status", url: "/dashboard/status/schedule", icon: Calendar },
  { title: "Config Status", url: "/dashboard/status/config", icon: Sliders },
  { title: "View Once", url: "/dashboard/view-once", icon: Eye },
  { title: "Messages Supprimés", url: "/dashboard/deleted-messages", icon: Trash2 },
  { title: "Répondeur Auto", url: "/dashboard/autoresponder", icon: MessageSquare },
  { title: "Snap Captures", url: "/dashboard/snap-captures", icon: Ghost },
  { title: "Analytics", url: "/dashboard/analytics", icon: BarChart3, premium: true },
  { title: "Upgrade Premium", url: "/dashboard/upgrade", icon: Crown },
  { title: "Aide & Support", url: "/dashboard/help", icon: HelpCircle },
  { title: "Paramètres", url: "/dashboard/settings", icon: Settings },
];

// Bottom navigation items for mobile
const bottomNavItems = [
  { title: "Gestion Status", url: "/dashboard/status", icon: Heart },
  { title: "View Once", url: "/dashboard/view-once", icon: Eye },
  { title: "Accueil", url: "/dashboard", icon: Home },
  { title: "Messages Supprimés", url: "/dashboard/deleted-messages", icon: Trash2 },
  { title: "Paramètres", url: "/dashboard/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { isPremium } = useAuth();

  const isActive = (path: string) => location.pathname === path;
  const collapsed = state === "collapsed";

  return (
    <>
      {/* Desktop Sidebar */}
      <Sidebar className={cn(collapsed ? "w-14" : "w-64", "hidden md:flex")} collapsible="icon">
        <SidebarContent>
          <div className="px-4 py-6 border-b border-sidebar-border">
            <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
              <img
                src="/icon-192x192.png"
                alt="AMDA logo"
                className={cn(
                  "rounded-2xl object-contain shadow-md",
                  collapsed ? "w-8 h-8" : "w-10 h-10"
                )}
              />
              {!collapsed && (
                <span className="text-xl font-bold tracking-tight bg-gradient-primary bg-clip-text text-transparent">
                  AMDA
                </span>
              )}
            </div>
          </div>

          <SidebarGroup className="mt-4">
            {!collapsed && (
              <SidebarGroupLabel className="text-xs text-muted-foreground px-4 mb-2">
                MENU PRINCIPAL
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {desktopMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className="flex items-center gap-3 px-4 py-2 rounded-lg transition-colors hover:bg-sidebar-accent relative"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="flex-1">{item.title}</span>
                            {item.premium && (
                              <Crown className="w-4 h-4 text-premium" />
                            )}
                          </>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {!collapsed && !isPremium && (
            <div className="mt-auto p-4 mb-4">
              <div className="bg-gradient-premium rounded-lg p-4 text-premium-foreground">
                <Sparkles className="w-6 h-6 mb-2" />
                <h4 className="font-semibold mb-1 text-sm">Passez à Premium</h4>
                <p className="text-xs opacity-90 mb-3">
                  Débloquez toutes les fonctionnalités
                </p>
                <button 
                  onClick={() => navigate('/dashboard/upgrade')}
                  className="w-full bg-background text-foreground px-3 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Upgrade
                </button>
              </div>
            </div>
          )}

          <div className="p-2 border-t border-sidebar-border">
            <SidebarTrigger className="w-full" />
          </div>
        </SidebarContent>
      </Sidebar>

      {/* Mobile Bottom Navigation - iOS Style */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
        <div className="mx-2 sm:mx-3 mb-2 sm:mb-4 pb-safe-area-inset-bottom rounded-2xl sm:rounded-3xl bg-background/80 backdrop-blur-2xl border border-border/50 shadow-glass overflow-hidden">
          <div className="flex items-center justify-around h-16 sm:h-20 px-0.5 sm:px-1">
            {bottomNavItems.map((item) => (
              <NavLink
                key={item.title}
                to={item.url}
                end
                className={cn(
                  "flex flex-col items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 md:px-3 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl transition-all duration-300 relative group flex-1 min-w-0",
                  isActive(item.url)
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <div className={cn(
                  "w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-300 flex-shrink-0",
                  isActive(item.url)
                    ? "bg-primary/15 shadow-sm scale-105 sm:scale-110"
                    : "group-hover:bg-muted/50"
                )}>
                  {item.url === "/dashboard" ? (
                    <img
                      src="/icon-192x192.png"
                      alt="AMDA"
                      className={cn(
                        "rounded-xl sm:rounded-2xl object-contain transition-all duration-300",
                        isActive(item.url) 
                          ? "w-8 h-8 sm:w-10 sm:h-10 animate-pulse" 
                          : "w-6 h-6 sm:w-8 sm:h-8 group-hover:scale-110"
                      )}
                    />
                  ) : (
                    <item.icon className={cn(
                      "transition-all duration-300",
                      isActive(item.url) ? "w-5 h-5 sm:w-6 sm:h-6" : "w-4 h-4 sm:w-5 sm:h-5"
                    )} />
                  )}
                </div>
                <span className={cn(
                  "text-[9px] sm:text-[10px] font-semibold transition-all duration-300 text-center leading-tight px-0.5 truncate w-full",
                  isActive(item.url) ? "opacity-100" : "opacity-70"
                )}>
                  {item.title.split(" ")[0]}
                </span>
                {isActive(item.url) && (
                  <div className="absolute -bottom-0.5 sm:-bottom-1 left-1/2 -translate-x-1/2 w-0.5 h-0.5 sm:w-1 sm:h-1 rounded-full bg-primary" />
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
