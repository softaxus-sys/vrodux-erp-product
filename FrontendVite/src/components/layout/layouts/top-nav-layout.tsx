import * as React from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { navigationConfig } from "@/config/navigation";
import { BrandLogo } from "@/components/brand/brand-logo";
import type { NavItem } from "@/types";
import { NavIcon } from "@/components/layout/nav/nav-utils";

interface TopNavGroupProps {
  item: NavItem;
}

function TopNavGroup({ item }: TopNavGroupProps) {
  const { pathname } = useLocation();
  const [open, setOpen]   = React.useState(false);
  const [coords, setCoords] = React.useState({ top: 0, left: 0 });
  const triggerRef = React.useRef<HTMLDivElement>(null);
  // Ref attached to the portaled dropdown div — clicks inside it must NOT close the menu
  const menuRef    = React.useRef<HTMLDivElement>(null);

  const hasChildren = Boolean(item.children?.length);
  const isActive = item.children
    ? item.children.some((c) => c.href && pathname.startsWith(c.href))
    : item.href
      ? pathname === item.href || pathname.startsWith(item.href + "/")
      : false;

  // Calculate fixed position from the trigger element's bounding rect
  const handleOpen = () => {
    if (!hasChildren) return;
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 6, left: rect.left });
    }
    setOpen((o) => !o);
  };

  // Close on outside click — but NOT when the click is inside the portaled menu itself
  React.useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      const inTrigger = triggerRef.current?.contains(e.target as Node);
      const inMenu    = menuRef.current?.contains(e.target as Node);
      if (!inTrigger && !inMenu) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // Close on route change
  React.useEffect(() => { setOpen(false); }, [pathname]);

  const buttonEl = (
    <button
      onClick={handleOpen}
      className={cn(
        "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
        isActive
          ? "text-primary bg-primary/10"
          : "text-foreground/70 hover:text-foreground hover:bg-muted/60"
      )}
    >
      <NavIcon name={item.icon} className="h-3.5 w-3.5" />
      <span>{item.label}</span>
      {hasChildren && (
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      )}
    </button>
  );

  return (
    <div ref={triggerRef} className="relative shrink-0">
      {/* For leaf items with href, wrap in Link; for groups use button only */}
      {item.href && !hasChildren
        ? <Link to={item.href} className="block">{buttonEl}</Link>
        : buttonEl}

      {/* Dropdown rendered into document.body via portal — escapes overflow-x-auto clipping */}
      {hasChildren && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              style={{ position: "fixed", top: coords.top, left: coords.left, zIndex: 9999 }}
              className="bg-popover border border-border rounded-xl shadow-lg min-w-[200px] py-1.5 overflow-hidden"
            >
              {item.children!.map((child) => {
                const childActive = child.href
                  ? pathname === child.href || pathname.startsWith(child.href + "/")
                  : false;
                return (
                  <Link
                    key={child.id}
                    to={child.href ?? "#"}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 px-4 py-2 text-sm transition-colors",
                      childActive
                        ? "text-primary bg-primary/5 font-medium"
                        : "text-foreground/80 hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    <NavIcon name={child.icon} className="h-3.5 w-3.5 text-current opacity-70" />
                    <span>{child.label}</span>
                    {child.isNew && (
                      <span className="ml-auto text-[9px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded uppercase">
                        New
                      </span>
                    )}
                    {child.badge && (
                      <span className="ml-auto text-[10px] font-semibold bg-warning/10 text-warning px-1.5 py-0.5 rounded-full">
                        {child.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

export function TopNavLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Top navigation bar */}
      <header className="h-14 border-b border-border bg-background/95 backdrop-blur-sm shrink-0 sticky top-0 z-40">
        <div className="flex items-center h-full px-4 gap-2">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center mr-4 shrink-0">
            <BrandLogo height={26} />
          </Link>

          {/* Nav groups — no overflow-x-auto to avoid clipping portaled dropdowns */}
          <nav className="flex items-center gap-0.5 flex-1 min-w-0">
            {navigationConfig.flatMap((group) =>
              group.items.map((item) => (
                <TopNavGroup key={item.id} item={item} />
              ))
            )}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
