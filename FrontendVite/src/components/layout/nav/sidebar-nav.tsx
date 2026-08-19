import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/hooks/use-navigation";
import type { NavItem, NavGroup, ModuleKey } from "@/types";
import { useAuthStore } from "@/store/auth.store";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NavIcon, NavBadge } from "./nav-utils";

// ─── Nav item ─────────────────────────────────────────────────────────────────

interface SidebarNavItemProps {
  item:      NavItem;
  collapsed: boolean;
  depth?:    number;
}

function SidebarNavItem({ item, collapsed, depth = 0 }: SidebarNavItemProps) {
  const { pathname } = useLocation();
  const hasChildren  = Boolean(item.children?.length);

  const isActive = item.href
    ? pathname === item.href || pathname.startsWith(item.href + "/")
    : false;

  const isParentActive = hasChildren
    ? item.children!.some((c) => c.href && (pathname === c.href || pathname.startsWith(c.href + "/")))
    : false;

  const [expanded, setExpanded] = React.useState(isParentActive);
  React.useEffect(() => { if (isParentActive) setExpanded(true); }, [isParentActive]);

  // ── Child item (depth > 0) ─────────────────────────────────────────────────
  if (depth > 0) {
    const active = item.href
      ? pathname === item.href || pathname.startsWith(item.href + "/")
      : false;

    const inner = (
      <Link
        to={item.href ?? "#"}
        className="group flex items-center gap-2.5 px-3 py-1.5 rounded-lg mx-1 text-sm transition-all duration-150 relative"
        style={active
          ? { background: "hsl(var(--sidebar-primary)/0.12)", color: "hsl(var(--sidebar-primary))" }
          : { color: "hsl(var(--sidebar-foreground)/0.6)" }
        }
        onMouseEnter={e => {
          if (!active) {
            (e.currentTarget as HTMLElement).style.background = "hsl(var(--sidebar-accent)/0.5)";
            (e.currentTarget as HTMLElement).style.color = "hsl(var(--sidebar-foreground))";
          }
        }}
        onMouseLeave={e => {
          if (!active) {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "hsl(var(--sidebar-foreground)/0.6)";
          }
        }}
      >
        {/* Active indicator dot */}
        <span
          className="h-1.5 w-1.5 rounded-full shrink-0 transition-all duration-150"
          style={active
            ? { background: "hsl(var(--sidebar-primary))", boxShadow: "0 0 6px hsl(var(--sidebar-primary)/0.6)" }
            : { background: "hsl(var(--sidebar-foreground)/0.2)" }
          }
        />
        <span className={cn("flex-1 truncate text-[13px]", active && "font-medium")}>
          {item.label}
        </span>
        <NavBadge badge={item.badge} variant={item.badgeVariant} />
      </Link>
    );

    return <div>{inner}</div>;
  }

  // ── Parent item (depth 0) ──────────────────────────────────────────────────
  const highlighted = isActive || isParentActive;

  const itemInner = (
    <div
      role={hasChildren ? "button" : undefined}
      tabIndex={hasChildren ? 0 : undefined}
      onClick={hasChildren ? () => setExpanded((e) => !e) : undefined}
      onKeyDown={hasChildren ? (e) => e.key === "Enter" && setExpanded((p) => !p) : undefined}
      className="group flex items-center gap-2.5 px-3 py-2 rounded-xl mx-1 text-sm cursor-pointer select-none transition-all duration-150 relative"
      style={highlighted
        ? {
            background: "hsl(var(--sidebar-accent))",
            color: "hsl(var(--sidebar-primary))",
          }
        : { color: "hsl(var(--sidebar-foreground)/0.7)" }
      }
      onMouseEnter={e => {
        if (!highlighted) {
          (e.currentTarget as HTMLElement).style.background = "hsl(var(--sidebar-accent)/0.5)";
          (e.currentTarget as HTMLElement).style.color = "hsl(var(--sidebar-foreground))";
        }
      }}
      onMouseLeave={e => {
        if (!highlighted) {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = "hsl(var(--sidebar-foreground)/0.7)";
        }
      }}
    >
      {/* Left accent bar */}
      {highlighted && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full"
          style={{ background: "hsl(var(--sidebar-primary))" }}
        />
      )}

      {/* Icon box */}
      <div
        className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-150"
        style={highlighted
          ? { background: "hsl(var(--sidebar-primary)/0.18)" }
          : { background: "hsl(var(--sidebar-foreground)/0.06)" }
        }
      >
        <NavIcon
          name={item.icon}
          className={cn(
            "h-3.5 w-3.5 transition-colors",
            highlighted ? "text-sidebar-primary" : "text-sidebar-foreground/55"
          )}
        />
      </div>

      {!collapsed && (
        <>
          <span className={cn("flex-1 truncate text-[13px]", highlighted && "font-semibold")}>
            {item.label}
          </span>

          {/* Badges */}
          {item.isNew && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
              style={{ background: "hsl(var(--sidebar-primary)/0.2)", color: "hsl(var(--sidebar-primary))" }}
            >
              New
            </span>
          )}
          {item.isBeta && (
            <span className="text-[9px] font-bold bg-warning/20 text-warning px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              Beta
            </span>
          )}
          <NavBadge badge={item.badge} variant={item.badgeVariant} />

          {hasChildren && (
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-200",
              )}
              style={{ color: "hsl(var(--sidebar-foreground)/0.3)", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          )}
        </>
      )}
    </div>
  );

  const wrapped = item.href && !hasChildren
    ? <Link to={item.href}>{itemInner}</Link>
    : itemInner;

  // Tooltip when collapsed
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild><div>{wrapped}</div></TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {item.label}
          {item.badge && <span className="ml-2 text-xs opacity-70">{item.badge}</span>}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div>
      {wrapped}
      {hasChildren && !collapsed && (
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="mt-0.5 space-y-0.5 pb-1">
                {item.children!.map((child) => (
                  <SidebarNavItem key={child.id} item={child} collapsed={false} depth={depth + 1} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

// ─── Sidebar nav ──────────────────────────────────────────────────────────────

export function SidebarNav({ collapsed = false }: { collapsed?: boolean }) {
  const { hasModuleAccess, user, tenant } = useAuthStore();
  const impersonation = useAuthStore((s) => s.impersonation);
  const navigationConfig = useNavigation();

  // A platform super-admin who is NOT impersonating a tenant sees ONLY the super-admin
  // console (Tenant Management) — never operational modules with pooled cross-tenant data.
  // To see a tenant's records they "Open" that tenant (impersonation), which flips their
  // role to tenant_admin so normal per-tenant module access applies.
  const superAdminMode = user?.role === "super_admin" && !impersonation;

  // Filter navigation based on the current user's module access.
  // Items with no `module` field are always shown (they are child items
  // whose visibility is governed by their parent).
  // Groups with no visible items are hidden entirely.
  const visibleConfig = React.useMemo((): NavGroup[] => {
    const itemVisible = (mod?: string) =>
      superAdminMode ? mod === "super-admin" : (!mod || hasModuleAccess(mod as ModuleKey));
    return navigationConfig
      .map((group) => ({
        ...group,
        items: group.items
          // filter parent nav items by their module
          .filter((item) => itemVisible(item.module))
          .map((item) => ({
            ...item,
            // filter children that carry their own module requirement
            children: item.children?.filter((child) => itemVisible(child.module)),
          })),
      }))
      .filter((group) => group.items.length > 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tenant, impersonation, navigationConfig]);

  return (
    <TooltipProvider delayDuration={0}>
      <ScrollArea className="flex-1 py-2">
        <nav className="space-y-3 px-1">
          {visibleConfig.map((group, gi) => (
            <div key={group.id}>
              {/* Group label */}
              {!collapsed ? (
                <p
                  className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] select-none"
                  style={{ color: "hsl(var(--sidebar-foreground)/0.28)" }}
                >
                  {group.label}
                </p>
              ) : gi > 0 ? (
                <div
                  className="h-px mx-3 mb-2"
                  style={{ background: "hsl(var(--sidebar-border))" }}
                />
              ) : null}

              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <SidebarNavItem key={item.id} item={item} collapsed={collapsed} />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </TooltipProvider>
  );
}
