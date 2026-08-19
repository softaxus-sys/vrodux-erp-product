import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Building2, Globe, Phone, Mail, Star,
  CreditCard, Calendar, Tag, User, Pencil, Trash2, Loader2,
  CheckCircle2, AlertCircle, Ban, ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatDate, getInitials } from "@/lib/utils";
import type { VendorDto } from "@/lib/pos/types";
import { useDeletePurchaseVendor } from "@/hooks/purchase/use-vendors";
import { AddVendorForm } from "./add-vendor-form";

interface Props { vendor: VendorDto | null; open: boolean; onClose: () => void; }

/** Styling only — labels via t(`vendors.status.${status}`). */
const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  active:   { color: "text-success",          bg: "bg-success/10",     icon: CheckCircle2 },
  inactive: { color: "text-muted-foreground", bg: "bg-muted",          icon: AlertCircle },
  blocked:  { color: "text-destructive",      bg: "bg-destructive/10", icon: Ban },
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={cn("h-3.5 w-3.5",
          i <= Math.floor(rating) ? "fill-warning text-warning" : "text-muted-foreground/30")} />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

export function VendorDrawer({ vendor, open, onClose }: Props) {
  const { t } = useTranslation("purchase");
  const [showEditForm, setShowEditForm] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => { if (!open) { setConfirmDelete(false); setShowEditForm(false); } }, [open]);

  const deleteMutation = useDeletePurchaseVendor();

  if (!vendor) return null;

  const sc = STATUS_CONFIG[vendor.status] ?? { color: "text-muted-foreground", bg: "bg-muted", icon: AlertCircle };
  const StatusIcon = sc.icon;

  function handleDelete() {
    deleteMutation.mutate(vendor!.id, { onSuccess: onClose });
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed top-0 right-0 h-full w-full max-w-[520px] bg-background border-l border-border shadow-2xl z-50 flex flex-col">

              {/* Header */}
              <div className="flex items-start justify-between px-6 py-5 border-b border-border">
                <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarFallback className="text-base font-bold bg-primary/10 text-primary">
                      {getInitials(vendor.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-bold text-base leading-tight">{vendor.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{vendor.category}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", sc.color, sc.bg)}>
                        <StatusIcon className="h-3 w-3" />{t(`vendors.status.${vendor.status}`, { defaultValue: vendor.status })}
                      </span>
                      {vendor.code && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground">
                          <Tag className="h-2.5 w-2.5" />{vendor.code}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}><X className="h-4 w-4" /></Button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Rating + POs */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/30 rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-2">{t("vendors.drawer.rating")}</p>
                    <StarRating rating={vendor.rating} />
                  </div>
                  <div className="bg-muted/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <ShoppingBag className="h-4 w-4 text-primary" />
                      <span className="text-xs text-muted-foreground">{t("vendors.drawer.purchaseOrders")}</span>
                    </div>
                    <p className="font-bold text-lg">{vendor.purchaseOrderCount}</p>
                  </div>
                </div>

                {/* Payment & Currency */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/30 rounded-xl p-3 border border-border">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1"><CreditCard className="h-3 w-3" />{t("vendors.drawer.paymentTerms")}</p>
                    <p className="text-xs font-semibold">{vendor.paymentTerms}</p>
                  </div>
                  <div className="bg-muted/30 rounded-xl p-3 border border-border">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1"><Globe className="h-3 w-3" />{t("vendors.form.currency")}</p>
                    <p className="text-xs font-semibold">{vendor.currency}</p>
                  </div>
                </div>

                {/* Contact Info */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("vendors.drawer.contactInfo")}</h4>
                  <div className="bg-muted/30 rounded-xl p-4 space-y-3 border border-border">
                    {vendor.contactPerson && (
                      <div className="flex items-center gap-3">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{vendor.contactPerson}</span>
                      </div>
                    )}
                    {vendor.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{vendor.phone}</span>
                      </div>
                    )}
                    {vendor.email && (
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{vendor.email}</span>
                      </div>
                    )}
                    {vendor.address && (
                      <div className="flex items-center gap-3">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{vendor.address}</span>
                      </div>
                    )}
                    {!vendor.contactPerson && !vendor.phone && !vendor.email && !vendor.address && (
                      <p className="text-sm text-muted-foreground">{t("vendors.drawer.noContact")}</p>
                    )}
                  </div>
                </div>

                {/* Tax & Meta */}
                <div className="grid grid-cols-2 gap-3">
                  {vendor.taxNumber && (
                    <div className="bg-muted/30 rounded-xl p-3 border border-border col-span-2">
                      <p className="text-[10px] text-muted-foreground mb-1">{t("vendors.drawer.taxNumber")}</p>
                      <p className="text-xs font-mono font-semibold">{vendor.taxNumber}</p>
                    </div>
                  )}
                  <div className="bg-muted/30 rounded-xl p-3 border border-border">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1"><Calendar className="h-3 w-3" />{t("vendors.drawer.added")}</p>
                    <p className="text-xs font-semibold">{formatDate(vendor.createdAt)}</p>
                  </div>
                  {vendor.updatedAt && (
                    <div className="bg-muted/30 rounded-xl p-3 border border-border">
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1"><Calendar className="h-3 w-3" />{t("vendors.drawer.updated")}</p>
                      <p className="text-xs font-semibold">{formatDate(vendor.updatedAt)}</p>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {vendor.notes && (
                  <div className="bg-muted/30 rounded-xl p-4 border border-border">
                    <p className="text-xs text-muted-foreground font-semibold mb-1">{t("vendors.drawer.notes")}</p>
                    <p className="text-sm text-muted-foreground">{vendor.notes}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-border flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5 h-9"
                  onClick={() => setShowEditForm(true)}>
                  <Pencil className="h-3.5 w-3.5" />{t("vendors.drawer.edit")}
                </Button>

                {confirmDelete ? (
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs text-destructive font-medium">{t("vendors.drawer.deleteConfirm")}</span>
                    <Button variant="destructive" size="sm" className="h-8 text-xs" disabled={deleteMutation.isPending}
                      onClick={handleDelete}>
                      {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm"}
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs"
                      onClick={() => setConfirmDelete(false)}>{t("vendors.drawer.cancel")}</Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" className="gap-1.5 h-9 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                    onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="h-3.5 w-3.5" />{t("vendors.drawer.delete")}
                  </Button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit form — opens on top of drawer */}
      <AddVendorForm
        open={showEditForm}
        onClose={() => setShowEditForm(false)}
        vendor={vendor}
      />
    </>
  );
}
