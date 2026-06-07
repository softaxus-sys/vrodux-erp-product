import * as React from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui.store";
import { SidebarNav } from "@/components/layout/nav/sidebar-nav";
import { BrandLogo, BrandMark } from "@/components/brand/brand-logo";

export function SidebarRightLayout({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Main content first (left) */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {children}
      </div>

      {/* Sidebar (right) */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 64 : 260 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="relative flex flex-col bg-sidebar border-l border-sidebar-border h-screen overflow-hidden shrink-0"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border h-16 shrink-0">
          {sidebarCollapsed ? <BrandMark /> : <BrandLogo height={32} />}
        </div>

        <SidebarNav collapsed={sidebarCollapsed} />

        {/* Collapse toggle */}
        <div className="p-2 border-t border-sidebar-border shrink-0">
          <button
            onClick={toggleSidebar}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sidebar-foreground/60",
              "hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors text-sm"
            )}
          >
            {sidebarCollapsed
              ? <ChevronLeft className="h-4 w-4" />
              : <><ChevronRight className="h-4 w-4" /><span className="text-xs">Collapse</span></>
            }
          </button>
        </div>
      </motion.aside>
    </div>
  );
}
