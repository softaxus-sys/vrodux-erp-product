import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, User, Phone, Grid3x3, Package, Calendar, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { WarehouseDto } from "@/lib/inventory/types";

interface WarehousesDrawerProps {
  warehouse: WarehouseDto | null;
  open: boolean;
  onClose: () => void;
}

export function WarehousesDrawer({ warehouse, open, onClose }: WarehousesDrawerProps) {
  if (!warehouse) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 h-full w-full max-w-[520px] bg-background border-l border-border shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Grid3x3 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{warehouse.name}</h2>
                    <span className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full",
                      warehouse.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                    )}>
                      {warehouse.isActive ? "Active" : "Inactive"}
                    </span>
                    {warehouse.isDefault && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                        <Star className="h-3 w-3" />Default
                      </span>
                    )}
                  </div>
                  {warehouse.code && (
                    <span className="text-xs text-muted-foreground font-mono mt-0.5 block">{warehouse.code}</span>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Stats Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Package className="h-4 w-4" />
                    <span className="text-xs">Total Movements</span>
                  </div>
                  <p className="text-xl font-bold">{warehouse.movementCount.toLocaleString()}</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Calendar className="h-4 w-4" />
                    <span className="text-xs">Created</span>
                  </div>
                  <p className="text-sm font-bold">{formatDate(warehouse.createdAt, "medium")}</p>
                </div>
              </div>

              {/* Location */}
              {warehouse.address && (
                <div>
                  <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Location</h3>
                  <div className="flex items-start gap-3 bg-muted/30 rounded-xl p-4 border border-border">
                    <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm">{warehouse.address}</p>
                  </div>
                </div>
              )}

              {/* Contact */}
              {(warehouse.contactPerson || warehouse.phone) && (
                <div>
                  <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Contact Person</h3>
                  <div className="flex items-center gap-4 bg-muted/30 rounded-xl p-4 border border-border">
                    {warehouse.contactPerson && (
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                          {getInitials(warehouse.contactPerson)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex-1">
                      {warehouse.contactPerson && (
                        <p className="text-sm font-semibold">{warehouse.contactPerson}</p>
                      )}
                      {warehouse.phone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <Phone className="h-3 w-3" />{warehouse.phone}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Timestamps */}
              {warehouse.updatedAt && (
                <div className="bg-muted/30 rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Calendar className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wide">Last Updated</span>
                  </div>
                  <p className="text-sm font-medium">{formatDate(warehouse.updatedAt, "medium")}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border shrink-0">
              <Button variant="outline" className="w-full" onClick={onClose}>
                Close
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
