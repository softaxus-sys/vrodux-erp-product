"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, X, Check, CheckCheck, Info, AlertTriangle, AlertCircle, Sparkles, AtSign } from "lucide-react";
import { useUiStore } from "@/store/ui.store";
import { useNotificationsStore } from "@/store/notifications.store";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const typeConfig = {
  info: { icon: Info, className: "text-info bg-info/10" },
  success: { icon: Check, className: "text-success bg-success/10" },
  warning: { icon: AlertTriangle, className: "text-warning bg-warning/10" },
  error: { icon: AlertCircle, className: "text-destructive bg-destructive/10" },
  mention: { icon: AtSign, className: "text-primary bg-primary/10" },
};

export function NotificationPanel() {
  const { notificationPanelOpen, setNotificationPanelOpen } = useUiStore();
  const { notifications, markAllAsRead, markAsRead, unreadCount } = useNotificationsStore();

  return (
    <AnimatePresence>
      {notificationPanelOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={() => setNotificationPanelOpen(false)}
          />
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed right-4 top-20 z-50 w-96 rounded-xl border border-border bg-card shadow-enterprise-lg"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span className="font-semibold text-sm">Notifications</span>
                {unreadCount > 0 && (
                  <span className="h-5 min-w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1.5">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllAsRead}>
                    <CheckCheck className="h-3 w-3 mr-1" /> Mark all read
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setNotificationPanelOpen(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[420px]">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <Bell className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {notifications.map((notif) => {
                    const config = typeConfig[notif.type];
                    const Icon = config.icon;
                    return (
                      <div
                        key={notif.id}
                        className={cn(
                          "p-4 hover:bg-muted/30 transition-colors cursor-pointer",
                          !notif.read && "bg-primary/[0.02]"
                        )}
                        onClick={() => markAsRead(notif.id)}
                      >
                        <div className="flex gap-3">
                          <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", config.className)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={cn("text-sm leading-tight", !notif.read && "font-semibold")}>
                                {notif.title}
                              </p>
                              {!notif.read && (
                                <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                              {formatDate(notif.timestamp, "relative")}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
