import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-logo";
import { cn } from "@/lib/utils";
import { navigationConfig } from "@/config/navigation";
import type { NavItem } from "@/types";
import { NavIcon, NavBadge } from "@/components/layout/nav/nav-utils";

interface RailItemProps {
  item: NavItem;
}

function RailItem({ item }: RailItemProps) {
  const { pathname } = useLocation();
  const [flyoutOpen, setFlyoutOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const hasChildren = Boolean(item.children?.length);

  const isActive = item.children
    ? item.children.some((c) => c.href && pathname.startsWith(c.href))
    : item.href
      ? pathname === item.href || pathname.startsWith(item.href + "/")
      : false;

  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setFlyoutOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const railButton = (
    <button
      onClick={() => setFlyoutOpen((o) => !o)}
      className={cn(
        "w-12 h-12 flex flex-col items-center justify-center gap-1 rounded-xl transition-all",
        isActive
          ? "bg-sidebar-accent text-sidebar-primary"
          : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      )}
      title={item.label}
    >
      <NavIcon name={item.icon} className="h-5 w-5" />
      {item.badge && (
        <span className="text-[8px] font-bold text-warning leading-none">
          {typeof item.badge === "number" ? item.badge : "•"}
        </span>
      )}
    </button>
  );

  return (
    <div ref={ref} className="relative group">
      {item.href && !hasChildren
        ? <Link to={item.href}>{railButton}</Link>
        : railButton
      }

      {/* Flyout panel */}
      <AnimatePresence>
        {flyoutOpen && hasChildren && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute left-full top-0 ml-2 z-50 bg-popover border border-border rounded-xl shadow-enterprise-lg min-w-[220px] py-2"
          >
            <p className="px-4 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {item.label}
            </p>
            {item.children!.map((child) => {
              const active = child.href
                ? pathname === child.href || pathname.startsWith(child.href + "/")
                : false;
              return (
                <Link
                  key={child.id}
                  to={child.href ?? "#"}
                  onClick={() => setFlyoutOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 px-4 py-2 text-sm transition-colors",
                    active
                      ? "text-primary bg-primary/5 font-medium"
                      : "text-foreground/75 hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  <NavIcon name={child.icon} className="h-3.5 w-3.5 opacity-70" />
                  <span className="flex-1">{child.label}</span>
                  <NavBadge badge={child.badge} variant={child.badgeVariant} />
                </Link>
              );
            })}
          </motion.div>
        )}

        {/* Simple tooltip for leaf items */}
        {!hasChildren && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            className="hidden group-hover:block absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50
                       bg-popover border border-border rounded-lg shadow-enterprise px-3 py-1.5 text-sm font-medium whitespace-nowrap"
          >
            <div className="flex items-center gap-1.5">
              {item.label}
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MiniRailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mini Rail (64px) */}
      <aside className="w-16 flex flex-col bg-sidebar border-r border-sidebar-border h-screen shrink-0 py-3 items-center gap-1">
        {/* Logo */}
        <Link to="/dashboard" className="mb-2 shrink-0">
          <BrandMark className="h-10 w-10 rounded-xl" />
        </Link>

        {/* Nav items */}
        <div className="flex-1 flex flex-col gap-1 overflow-y-auto overflow-x-hidden w-full items-center py-1">
          {navigationConfig.flatMap((group) =>
            group.items.map((item) => (
              <RailItem key={item.id} item={item} />
            ))
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
