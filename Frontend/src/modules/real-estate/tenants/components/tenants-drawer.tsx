"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, User, Mail, Phone, Building2, FileText,
  DollarSign, AlertTriangle, Calendar, Shield,
  CheckCircle2, Clock, Edit, Printer, Home,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, getInitials, cn } from "@/lib/utils";
import type { TenantDto as Tenant, TenantStatus } from "@/lib/real-estate/real-estate.api";
import { useUnits } from "@/hooks/real-estate/use-real-estate";

type Tab = "overview" | "units";

const STATUS_CONFIG: Record<TenantStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "text-success bg-success/10" },
  inactive: { label: "Inactive", className: "text-muted-foreground bg-muted" },
  blacklisted: { label: "Blacklisted", className: "text-destructive bg-destructive/10" },
};

const PAYMENT_BADGE: Record<string, string> = {
  excellent: "text-success bg-success/10",
  good: "text-primary bg-primary/10",
  fair: "text-warning bg-warning/10",
  poor: "text-destructive bg-destructive/10",
};

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 flex justify-between gap-4">
        <span className="text-xs text-muted-foreground shrink-0">{label}</span>
        <span className="text-sm font-medium text-right">{value}</span>
      </div>
    </div>
  );
}

function OverviewTab({ tenant }: { tenant: Tenant }) {
  return (
    <div className="space-y-6">
      {tenant.outstandingBalance > 0 && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl border border-destructive/30 bg-destructive/5">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">Outstanding Balance</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatCurrency(tenant.outstandingBalance, "AED")} is overdue. Follow-up required.
            </p>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Contact Information
        </h3>
        <div className="bg-muted/30 rounded-xl p-4 space-y-0">
          <InfoRow
            icon={Mail}
            label="Email"
            value={
              <a href={`mailto:${tenant.email}`} className="text-primary hover:underline">
                {tenant.email}
              </a>
            }
          />
          <InfoRow icon={Phone} label="Phone" value={tenant.phone} />
          <InfoRow icon={User} label="Contact Person" value={tenant.contactPerson} />
          <InfoRow icon={Shield} label="Nationality" value={tenant.nationality} />
          {tenant.emiratesId && (
            <InfoRow
              icon={FileText}
              label="Emirates ID"
              value={<span className="font-mono text-xs">{tenant.emiratesId}</span>}
            />
          )}
          {tenant.trn && (
            <InfoRow
              icon={FileText}
              label="TRN"
              value={<span className="font-mono text-xs">{tenant.trn}</span>}
            />
          )}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Financial Summary
        </h3>
        <div className="bg-muted/30 rounded-xl p-4 space-y-0">
          <InfoRow
            icon={DollarSign}
            label="Monthly Rent"
            value={
              <span className="font-bold text-primary">
                {formatCurrency(tenant.monthlyRent, "AED")}
              </span>
            }
          />
          <InfoRow
            icon={DollarSign}
            label="Annual Rent"
            value={formatCurrency(tenant.monthlyRent * 12, "AED")}
          />
          <InfoRow
            icon={DollarSign}
            label="Outstanding Balance"
            value={
              <span
                className={cn(
                  "font-bold",
                  tenant.outstandingBalance > 0 ? "text-destructive" : "text-success"
                )}
              >
                {tenant.outstandingBalance > 0
                  ? formatCurrency(tenant.outstandingBalance, "AED")
                  : "AED 0"}
              </span>
            }
          />
          <InfoRow
            icon={CheckCircle2}
            label="Payment History"
            value={
              <span
                className={cn(
                  "text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize",
                  PAYMENT_BADGE[tenant.paymentHistory]
                )}
              >
                {tenant.paymentHistory}
              </span>
            }
          />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Account Details
        </h3>
        <div className="bg-muted/30 rounded-xl p-4 space-y-0">
          <InfoRow icon={Building2} label="Tenant Type" value={<span className="capitalize">{tenant.type}</span>} />
          <InfoRow icon={Calendar} label="Join Date" value={formatDate(tenant.joinDate, "medium")} />
          <InfoRow icon={Home} label="Active Units" value={tenant.totalUnits.toString()} />
          {tenant.activeContractId && (
            <InfoRow
              icon={FileText}
              label="Active Contract"
              value={
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                  {tenant.activeContractId.toUpperCase()}
                </span>
              }
            />
          )}
        </div>
      </div>

      {tenant.notes && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
            Notes
          </h3>
          <p className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-3">{tenant.notes}</p>
        </div>
      )}
    </div>
  );
}

function UnitsTab({ tenant }: { tenant: Tenant }) {
  const { data: allUnits = [] } = useUnits();
  const tenantUnits = allUnits.filter((u) => u.tenantId === tenant.id);

  if (tenantUnits.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        No units currently rented by this tenant.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tenantUnits.map((unit, i) => {
        const expiring =
          unit.contractExpiry
            ? new Date(unit.contractExpiry).getTime() - Date.now() < 60 * 24 * 60 * 60 * 1000 &&
            new Date(unit.contractExpiry).getTime() > Date.now()
            : false;
        return (
          <motion.div
            key={unit.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="p-4 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Home className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{unit.unitNumber}</p>
                  <p className="text-xs text-muted-foreground">{unit.propertyName}</p>
                </div>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-success bg-success/10">
                Rented
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Annual Rent</p>
                <p className="font-semibold">{formatCurrency(unit.rentPricePA, "AED")}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Contract Expiry</p>
                <p className={cn("font-semibold", expiring ? "text-warning" : "text-foreground")}>
                  {expiring && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                  {unit.contractExpiry ? formatDate(unit.contractExpiry, "medium") : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Floor</p>
                <p className="font-semibold">{unit.floor}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Area</p>
                <p className="font-semibold">{unit.area} sqm</p>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  tenant: Tenant | null;
}

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Overview", icon: User },
  { id: "units", label: "Units", icon: Home },
];

export function TenantsDrawer({ open, onClose, tenant }: Props) {
  const [tab, setTab] = React.useState<Tab>("overview");

  React.useEffect(() => {
    if (tenant) setTab("overview");
  }, [tenant]);

  return (
    <AnimatePresence>
      {open && tenant && (
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
            className="fixed top-0 right-0 h-full w-full max-w-[580px] bg-background border-l border-border shadow-2xl z-50 flex flex-col"
          >
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Tenant Profile
              </p>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Printer className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Profile Header */}
            <div className="px-5 py-5 border-b border-border bg-muted/20 shrink-0">
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14 shrink-0">
                  <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">
                    {getInitials(tenant.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold leading-tight">{tenant.name}</h2>
                      <p className="text-sm text-muted-foreground capitalize">
                        {tenant.type === "corporate" ? "Corporate Tenant" : "Individual Tenant"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0",
                        STATUS_CONFIG[tenant.status].className
                      )}
                    >
                      {STATUS_CONFIG[tenant.status].label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">
                      {tenant.tenantCode}
                    </span>
                    <span>·</span>
                    <span>{tenant.totalUnits} unit{tenant.totalUnits !== 1 ? "s" : ""}</span>
                    <span>·</span>
                    <span
                      className={cn(
                        "font-semibold capitalize",
                        PAYMENT_BADGE[tenant.paymentHistory].split(" ")[0]
                      )}
                    >
                      {tenant.paymentHistory} payer
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-0 border-b border-border px-5 shrink-0">
              {TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors",
                      tab === t.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                    {t.id === "units" && tenant.totalUnits > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                        {tenant.totalUnits}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  {tab === "overview" && <OverviewTab tenant={tenant} />}
                  {tab === "units" && <UnitsTab tenant={tenant} />}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-border shrink-0 flex items-center gap-2">
              <Button size="sm" className="flex-1">
                <FileText className="h-4 w-4 mr-2" /> View Contracts
              </Button>
              {tenant.outstandingBalance > 0 && (
                <Button variant="destructive" size="sm" className="flex-1">
                  <DollarSign className="h-4 w-4 mr-2" /> Send Reminder
                </Button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
