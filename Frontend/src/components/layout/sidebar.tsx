"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Sparkles, BarChart3, FolderOpen,
  DollarSign, BookOpen, Layers, FileText, Receipt,
  CreditCard, PieChart, Percent, Landmark,
  Users, UserCheck, Clock, Banknote, CalendarOff, UserPlus, TrendingUp,
  Handshake, UserSearch, Workflow, Building2,
  ShoppingBag, FileSearch, ClipboardList, RotateCcw,
  ShoppingCart, Truck, ClipboardCheck, CheckCircle2,
  Package, Warehouse, Boxes, ArrowLeftRight,
  Building, Home, DoorOpen, FileSignature,
  HardHat, FolderKanban, ListChecks, Hammer, MapPin,
  Hotel, CalendarCheck, BedDouble, SprayCan,
  Monitor, UtensilsCrossed, ChefHat,
  Settings2, SlidersHorizontal, ShieldCheck, GitBranch, Plug, ScrollText,
  ChevronRight, ChevronLeft, ChevronDown,
  Zap, Bell, FolderTree, Tag, Ruler,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui.store";
import { navigationConfig } from "@/config/navigation";
import type { NavItem } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";

// Icon map — avoids dynamic lookups while keeping types clean
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Sparkles, BarChart3, FolderOpen,
  DollarSign, BookOpen, Layers, FileText, Receipt,
  CreditCard, PieChart, Percent, Landmark,
  Users, UserCheck, Clock, Banknote, CalendarOff, UserPlus, TrendingUp,
  Handshake, UserSearch, Workflow, Building2,
  ShoppingBag, FileSearch, ClipboardList, RotateCcw,
  ShoppingCart, Truck, ClipboardCheck, CheckCircle2,
  Package, Warehouse, Boxes, ArrowLeftRight,
  Building, Home, DoorOpen, FileSignature,
  HardHat, FolderKanban, ListChecks, Hammer, MapPin,
  Hotel, CalendarCheck, BedDouble, SprayCan,
  Monitor, UtensilsCrossed, ChefHat,
  Settings2, SlidersHorizontal, ShieldCheck, GitBranch, Plug, ScrollText,
  Zap, Bell, FolderTree, Tag, Ruler,
};

function NavIcon({ name, className }: { name?: string; className?: string }) {
  if (!name) return null;
  const Icon = iconMap[name];
  if (!Icon) return null;
  return <Icon className={className} />;
}

function NavBadge({ badge, variant }: { badge?: string | number; variant?: string }) {
  if (!badge && badge !== 0) return null;
  const variantClass = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  }[variant ?? "default"] ?? "bg-primary/10 text-primary";

  return (
    <span className={cn("ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none", variantClass)}>
      {badge}
    </span>
  );
}

interface SidebarNavItemProps {
  item: NavItem;
  collapsed: boolean;
  depth?: number;
}

function SidebarNavItem({ item, collapsed, depth = 0 }: SidebarNavItemProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = React.useState(false);
  const hasChildren = item.children && item.children.length > 0;

  const isActive = item.href ? pathname === item.href || pathname.startsWith(item.href + "/") : false;
  const isParentActive = hasChildren && item.children!.some(
    (child) => child.href && (pathname === child.href || pathname.startsWith(child.href + "/"))
  );

  React.useEffect(() => {
    if (isParentActive) setExpanded(true);
  }, [isParentActive]);

  const content = (
    <div
      role={hasChildren ? "button" : undefined}
      onClick={hasChildren ? () => setExpanded((e) => !e) : undefined}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150 cursor-pointer select-none",
        depth === 0
          ? "font-medium"
          : "font-normal text-sidebar-foreground/75 pl-8",
        isActive || isParentActive
          ? "bg-sidebar-accent text-sidebar-primary font-semibold"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      )}
    >
      {depth === 0 && (
        <NavIcon
          name={item.icon}
          className={cn(
            "h-4 w-4 shrink-0 transition-colors",
            isActive || isParentActive ? "text-sidebar-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground"
          )}
        />
      )}
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.isNew && (
            <span className="text-[9px] font-bold bg-sidebar-primary text-sidebar-primary-foreground px-1.5 py-0.5 rounded uppercase tracking-wide">
              New
            </span>
          )}
          {item.isBeta && (
            <span className="text-[9px] font-bold bg-warning/20 text-warning px-1.5 py-0.5 rounded uppercase tracking-wide">
              Beta
            </span>
          )}
          <NavBadge badge={item.badge} variant={item.badgeVariant} />
          {hasChildren && (
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-200 text-sidebar-foreground/40",
                expanded ? "rotate-180" : ""
              )}
            />
          )}
        </>
      )}
    </div>
  );

  const wrappedContent = item.href && !hasChildren ? (
    <Link href={item.href}>{content}</Link>
  ) : content;

  if (collapsed && depth === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div>{wrappedContent}</div>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {item.label}
          {item.badge && <span className="ml-2 text-xs opacity-70">{item.badge}</span>}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div>
      {wrappedContent}
      {hasChildren && !collapsed && (
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="mt-0.5 space-y-0.5 pb-1">
                {item.children!.map((child) => (
                  <SidebarNavItem key={child.id} item={child} collapsed={collapsed} depth={depth + 1} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 64 : 260 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className={cn(
          "relative flex flex-col bg-sidebar border-r border-sidebar-border h-screen overflow-hidden shrink-0"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border h-16 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
            <Zap className="h-4 w-4 text-white" />
          </div>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col min-w-0"
            >
              <span className="font-bold text-sidebar-foreground text-sm leading-tight truncate">
                Softaxis ERP
              </span>
              <span className="text-sidebar-foreground/50 text-[11px] truncate">
                Enterprise Platform
              </span>
            </motion.div>
          )}
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-3">
          <nav className="space-y-4 px-2">
            {navigationConfig.map((group) => (
              <div key={group.id}>
                {!sidebarCollapsed && (
                  <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
                    {group.label}
                  </p>
                )}
                {sidebarCollapsed && (
                  <div className="h-px bg-sidebar-border mx-2 mb-2" />
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <SidebarNavItem
                      key={item.id}
                      item={item}
                      collapsed={sidebarCollapsed}
                    />
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* Collapse toggle */}
        <div className="p-2 border-t border-sidebar-border shrink-0">
          <button
            onClick={toggleSidebar}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sidebar-foreground/60",
              "hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors text-sm"
            )}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </button>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}
