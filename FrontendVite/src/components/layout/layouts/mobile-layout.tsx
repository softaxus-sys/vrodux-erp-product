import * as React from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useUiStore } from "@/store/ui.store";
import { SidebarNav } from "@/components/layout/nav/sidebar-nav";
import { BrandLogo } from "@/components/brand/brand-logo";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/topbar";

/**
 * Phone / tablet shell (< lg). The sidebar becomes an off-canvas drawer opened from the
 * topbar's menu button; it closes on navigation, on backdrop tap and on Escape.
 * Used for every layout variant — a top-nav or mini-rail bar does not fit a phone either.
 */
export function MobileLayout({ children }: { children: React.ReactNode }) {
  const { sidebarMobileOpen, setSidebarMobileOpen } = useUiStore();
  const { pathname } = useLocation();

  React.useEffect(() => { setSidebarMobileOpen(false); }, [pathname, setSidebarMobileOpen]);

  React.useEffect(() => {
    if (!sidebarMobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSidebarMobileOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [sidebarMobileOpen, setSidebarMobileOpen]);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      <AnimatePresence>
        {sidebarMobileOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50"
              onClick={() => setSidebarMobileOpen(false)}
            />
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className="fixed inset-y-0 start-0 z-50 flex w-[min(288px,86vw)] flex-col overflow-hidden shadow-2xl"
              style={{ background: "hsl(var(--sidebar-background))" }}
              role="dialog" aria-modal="true"
            >
              <div
                className="flex h-[60px] shrink-0 items-center justify-between gap-3 border-b px-4"
                style={{ borderColor: "hsl(var(--sidebar-border))" }}
              >
                <div className="min-w-0"><BrandLogo height={32} /></div>
                <button
                  onClick={() => setSidebarMobileOpen(false)}
                  aria-label="Close menu"
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ color: "hsl(var(--sidebar-foreground)/0.7)" }}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarNav collapsed={false} />
              {/* Hidden from the topbar on phones, so they live here. */}
              <div
                className="flex shrink-0 items-center gap-2 border-t px-3 py-2 safe-bottom"
                style={{ borderColor: "hsl(var(--sidebar-border))" }}
              >
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
