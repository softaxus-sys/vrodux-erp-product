/**
 * CashDrawerGuard — blocks the entire POS screen while the cash drawer is open.
 *
 * Renders a full-screen overlay with:
 *   - Pulsing warning icon
 *   - Clear "CASH DRAWER OPEN" message
 *   - "Mark as Closed" button for printers that don't support hardware status query
 *
 * The overlay is automatically cleared when:
 *   a) Hardware polling detects the drawer is closed (500ms poll via DLE EOT).
 *   b) The user clicks "Mark as Closed" (manual fallback).
 *
 * No new transactions can be processed while this guard is visible.
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHardware } from "@/contexts/hardware-context";

export function CashDrawerGuard() {
  const { drawerIsOpen, markDrawerClosed, printerStatus } = useHardware();

  // True if we're polling hardware status; the user may not need to click manually
  const isPolling = drawerIsOpen && printerStatus === "ready";

  return (
    <AnimatePresence>
      {drawerIsOpen && (
        <motion.div
          key="drawer-guard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.88, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 16 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="w-full max-w-sm mx-4 bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Warning stripe */}
            <div className="h-2 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 animate-pulse" />

            <div className="p-8 text-center space-y-4">
              {/* Animated icon */}
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-amber-100 dark:bg-amber-900/30 border-4 border-amber-400 mx-auto"
              >
                <AlertTriangle className="w-12 h-12 text-amber-500" />
              </motion.div>

              <div className="space-y-1">
                <h2 className="text-2xl font-black text-foreground tracking-tight">
                  CASH DRAWER OPEN
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Close the cash drawer to continue processing transactions.
                  No new sales can be started while the drawer is open.
                </p>
              </div>

              {/* Status indicator */}
              {isPolling ? (
                <div className="flex items-center justify-center gap-2 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-4 py-2.5 border border-emerald-200 dark:border-emerald-800">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="font-medium">Monitoring drawer status automatically…</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-2.5 border border-amber-200 dark:border-amber-800">
                  <LockKeyhole className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-medium">POS locked until drawer is closed</span>
                </div>
              )}

              {/* Manual close button */}
              <Button
                size="lg"
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                onClick={markDrawerClosed}
              >
                <CheckCircle2 className="h-5 w-5" />
                I Closed the Drawer
              </Button>

              <p className="text-[11px] text-muted-foreground/60">
                {isPolling
                  ? "This screen will close automatically when the drawer is detected as closed."
                  : "Click above after physically closing the cash drawer."}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
