import * as React from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui.store";
import { SidebarNav } from "@/components/layout/nav/sidebar-nav";
import { BrandLogo, BrandMark } from "@/components/brand/brand-logo";

export function SidebarLeftLayout({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 68 : 264 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="relative flex flex-col h-screen overflow-hidden shrink-0"
        style={{ background: "hsl(var(--sidebar-background))" }}
      >
        {/* Subtle top gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[hsl(var(--sidebar-primary))] to-transparent opacity-60 z-10" />

        {/* Logo */}
        <div
          className="flex items-center gap-3 px-4 h-[60px] shrink-0 border-b"
          style={{ borderColor: "hsl(var(--sidebar-border))" }}
        >
          {sidebarCollapsed ? (
            <BrandMark />
          ) : (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15, delay: 0.05 }}
              className="min-w-0"
            >
              <BrandLogo height={30} plate />
            </motion.div>
          )}
        </div>

        {/* Nav */}
        <SidebarNav collapsed={sidebarCollapsed} />

        {/* Collapse toggle */}
        <div
          className="p-2 border-t shrink-0"
          style={{ borderColor: "hsl(var(--sidebar-border))" }}
        >
          <button
            onClick={toggleSidebar}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-150",
            )}
            style={{ color: "hsl(var(--sidebar-foreground)/0.45)" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "hsl(var(--sidebar-accent)/0.6)";
              (e.currentTarget as HTMLElement).style.color = "hsl(var(--sidebar-foreground))";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "hsl(var(--sidebar-foreground)/0.45)";
            }}
          >
            {sidebarCollapsed
              ? <ChevronRight className="h-4 w-4 mx-auto" />
              : <><ChevronLeft className="h-4 w-4" /><span className="text-xs font-medium">Collapse</span></>
            }
          </button>
        </div>
      </motion.aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
