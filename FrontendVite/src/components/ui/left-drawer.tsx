import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LeftDrawerProps {
  onClose: () => void;
  /** Tailwind max-width class for the panel, e.g. "max-w-sm" | "max-w-md" | "max-w-lg". */
  widthClassName?: string;
  /** Tailwind z-index class — bump for a drawer that must stack above another (e.g. a reason
   * prompt opened from within the main order drawer). */
  zIndexClassName?: string;
  children: React.ReactNode;
}

/** Replaces the old center "popup" pattern app-wide in the restaurant module — slides in from the
 * left instead of appearing as a centered modal box. Backdrop click closes it, same as before. */
export function LeftDrawer({ onClose, widthClassName = "max-w-md", zIndexClassName = "z-50", children }: LeftDrawerProps) {
  return (
    <div className={cn("fixed inset-0 bg-black/40 backdrop-blur-sm", zIndexClassName)} onClick={onClose}>
      <motion.div
        initial={{ x: "-100%" }} animate={{ x: 0 }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className={cn("fixed left-0 top-0 h-full w-full bg-card border-r border-border flex flex-col shadow-2xl", widthClassName)}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-1 overflow-auto p-5 space-y-3">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
