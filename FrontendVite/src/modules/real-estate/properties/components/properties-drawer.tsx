import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Building2, MapPin, Calendar, Users, TrendingUp,
  DollarSign, Wrench, BarChart3, Edit, Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { formatCurrency, cn } from "@/lib/utils";
import { exportPdf } from "@/lib/pdf";
import { useCurrency } from "@/hooks/use-currency";
import type { PropertyDto as Property } from "@/lib/real-estate/re.api";

const TYPE_LABELS: Record<string, string> = {
  residential: "Residential",
  commercial: "Commercial",
  mixed_use: "Mixed Use",
  industrial: "Industrial",
  retail: "Retail",
};

// These are the values the API actually returns. They were previously "active" / "inactive" /
// "under_development" — none of which the server has ever sent — so the lookup below resolved to
// undefined for EVERY property and the drawer crashed on `.className` the moment it opened.
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  available:          { label: "Available",          className: "text-warning bg-warning/10" },
  partially_occupied: { label: "Partially Occupied", className: "text-primary bg-primary/10" },
  fully_occupied:     { label: "Fully Occupied",     className: "text-success bg-success/10" },
};

const STATUS_FALLBACK = { label: "Unknown", className: "text-muted-foreground bg-muted" };

/** Never index this map bare. An unrecognised status must degrade to a grey chip, not take the
 *  whole page down — the same failure the Finance journals view hit with "voided". */
const getStatus = (s: string) => STATUS_CONFIG[s] ?? STATUS_FALLBACK;

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

interface Props {
  open: boolean;
  onClose: () => void;
  property: Property | null;
  /** Opens the edit form. Owned by the parent, which already renders the form. */
  onEdit?: (property: Property) => void;
}

export function PropertiesDrawer({ open, onClose, property, onEdit }: Props) {
  const currency = useCurrency();
  const navigate = useNavigate();

  // A property has no rent of its own — the API returns its units, and the rent lives on those.
  // Deriving it here is honest; the previous `property.annualRent` simply did not exist and read
  // as NaN once it reached formatCurrency.
  const units          = property?.units ?? [];
  const vacantUnits    = Math.max(0, (property?.totalUnits ?? 0) - (property?.occupiedUnits ?? 0));
  const occupiedRent   = units.filter(u => u.status === "rented").reduce((s, u) => s + (u.rentPerYear ?? 0), 0);
  const potentialRent  = units.reduce((s, u) => s + (u.rentPerYear ?? 0), 0);
  const avgRentPerUnit = property && property.occupiedUnits > 0 ? occupiedRent / property.occupiedUnits : 0;
  const grossYield     = property && property.marketValue > 0 ? (occupiedRent / property.marketValue) * 100 : 0;

  /** The property profile — what you'd hand someone as a one-pager. */
  const printProfile = () => {
    if (!property) return;
    exportPdf({
      title: property.name,
      subtitle: `${property.propertyNumber} · ${property.location?.city ?? ""} ${property.location?.emirate ?? ""}`.trim(),
      columns: ["Detail", "Value"],
      rows: [
        ["Property number", property.propertyNumber],
        ["Type", TYPE_LABELS[property.propertyType] ?? property.propertyType],
        ["Status", getStatus(property.status).label],
        ["Address", property.location?.address || "—"],
        ["City", property.location?.city || "—"],
        ["Emirate", property.location?.emirate || "—"],
        ["Developer", property.developer || "—"],
        ["Total area", property.totalArea > 0 ? `${property.totalArea.toLocaleString()} sq ft` : "—"],
        ["Total units", property.totalUnits],
        ["Occupied units", property.occupiedUnits],
        ["Vacant units", vacantUnits],
        ["Occupancy", `${property.occupancyRate}%`],
        ["Market value", formatCurrency(property.marketValue, currency)],
        ["Annual rent (let)", units.length ? formatCurrency(occupiedRent, currency) : "—"],
        ["At full occupancy", units.length ? formatCurrency(potentialRent, currency) : "—"],
        ["Gross yield", grossYield > 0 ? `${grossYield.toFixed(2)}%` : "—"],
        ["Description", property.description || "—"],
      ],
    });
  };

  /** The unit-by-unit schedule — the thing you'd actually take to a meeting. */
  const generateReport = () => {
    if (!property) return;
    if (units.length === 0) {
      // Producing an empty table would look like a broken export rather than an empty property.
      toast.info("This property has no units yet, so there is nothing to report on.");
      return;
    }
    exportPdf({
      title: `${property.name} — Unit Schedule`,
      subtitle:
        `${property.propertyNumber} · ${units.length} unit(s) · ${property.occupiedUnits} let · ` +
        `${formatCurrency(occupiedRent, currency)} annual rent · ${property.occupancyRate}% occupancy`,
      landscape: true,
      columns: ["Unit", "Type", "Floor", "Area (sq ft)", "Status", "Tenant", "Rent / year", "Sale price"],
      rows: units.map(u => [
        u.unitNumber,
        u.unitType,
        u.floor || "—",
        u.area ? u.area.toLocaleString() : "—",
        u.status,
        u.currentTenantName ?? "—",
        formatCurrency(u.rentPerYear, currency),
        u.salePrice ? formatCurrency(u.salePrice, currency) : "—",
      ]),
    });
  };

  /** Units, pre-filtered to this property — the list view reads the propertyId param. */
  const viewAllUnits = () => {
    if (!property) return;
    onClose();
    navigate(`/real-estate/units?propertyId=${property.id}`);
  };

  return (
    <AnimatePresence>
      {open && property && (
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
                Property Details
              </p>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit property"
                  onClick={() => onEdit?.(property)}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Print property profile"
                  onClick={printProfile}>
                  <Printer className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Header */}
            <div className="px-5 py-5 border-b border-border bg-muted/20 shrink-0">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold leading-tight">{property.name}</h2>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {property.location.city}, {property.location.emirate}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0",
                        getStatus(property.status).className
                      )}
                    >
                      {getStatus(property.status).label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">
                      {property.propertyNumber}
                    </span>
                    <span>·</span>
                    <span>{TYPE_LABELS[property.propertyType] ?? property.propertyType}</span>
                    {property.totalArea > 0 && (
                      <>
                        <span>·</span>
                        <span>{property.totalArea.toLocaleString()} sq ft</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Occupancy visual */}
              <div className="bg-muted/30 rounded-xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    Occupancy
                  </h3>
                  <span className="text-lg font-bold text-primary">{property.occupancyRate}%</span>
                </div>
                <div className="h-2.5 bg-border rounded-full overflow-hidden mb-3">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${property.occupancyRate}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={cn(
                      "h-full rounded-full",
                      property.occupancyRate >= 90
                        ? "bg-success"
                        : property.occupancyRate >= 75
                          ? "bg-warning"
                          : "bg-destructive"
                    )}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-background rounded-lg p-2">
                    <p className="text-lg font-bold">{property.totalUnits}</p>
                    <p className="text-[11px] text-muted-foreground">Total Units</p>
                  </div>
                  <div className="bg-background rounded-lg p-2">
                    <p className="text-lg font-bold text-success">{property.occupiedUnits}</p>
                    <p className="text-[11px] text-muted-foreground">Rented</p>
                  </div>
                  <div className="bg-background rounded-lg p-2">
                    <p className="text-lg font-bold text-warning">{vacantUnits}</p>
                    <p className="text-[11px] text-muted-foreground">Vacant</p>
                  </div>
                </div>
              </div>

              {/* Financials */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                  Financial Summary
                </h3>
                <div className="bg-muted/30 rounded-xl p-4 space-y-0">
                  <InfoRow
                    icon={DollarSign}
                    label="Market Value"
                    value={
                      <span className="font-bold text-primary">
                        {formatCurrency(property.marketValue, currency)}
                      </span>
                    }
                  />
                  <InfoRow
                    icon={TrendingUp}
                    label="Annual Rent (let units)"
                    value={units.length === 0 ? "—" : formatCurrency(occupiedRent, currency)}
                  />
                  <InfoRow
                    icon={BarChart3}
                    label="At full occupancy"
                    value={units.length === 0 ? "—" : formatCurrency(potentialRent, currency)}
                  />
                  <InfoRow
                    icon={BarChart3}
                    label="Avg Rent / Let Unit"
                    // Guarded: dividing by zero let units produced Infinity, which formatCurrency
                    // rendered as a nonsense figure rather than failing visibly.
                    value={avgRentPerUnit > 0 ? formatCurrency(avgRentPerUnit, currency) : "—"}
                  />
                  <InfoRow
                    icon={TrendingUp}
                    label="Yield (Gross)"
                    value={grossYield > 0 ? `${grossYield.toFixed(2)}%` : "—"}
                  />
                </div>
              </div>

              {/* Property Details */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                  Property Information
                </h3>
                <div className="bg-muted/30 rounded-xl p-4 space-y-0">
                  <InfoRow icon={MapPin} label="Address" value={property.location.address || "—"} />
                  <InfoRow icon={MapPin} label="City" value={property.location.city || "—"} />
                  <InfoRow icon={Building2} label="Developer" value={property.developer || "—"} />
                  <InfoRow icon={BarChart3} label="Total Area"
                    value={property.totalArea > 0 ? `${property.totalArea.toLocaleString()} sq ft` : "—"} />
                  {property.description && (
                    <InfoRow icon={Wrench} label="Description" value={property.description} />
                  )}
                </div>
              </div>

              {/* Units. Replaces the old "Facilities & Amenities" list, which read
                  property.facilities — a field no endpoint has ever returned, so it crashed on
                  .map(). The units ARE returned, and are what someone opening a property wants. */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                  Units ({units.length})
                </h3>
                {units.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No units recorded on this property yet.</p>
                ) : (
                  <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                    {units.map((u) => (
                      <div key={u.id} className="flex items-center gap-3 px-3 py-2.5">
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">
                          {u.unitNumber}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{u.unitType}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {u.currentTenantName ?? "Vacant"}
                            {u.floor ? ` · Floor ${u.floor}` : ""}
                          </p>
                        </div>
                        <div className="text-end shrink-0">
                          <p className="text-sm font-semibold">{formatCurrency(u.rentPerYear, currency)}</p>
                          <p className="text-[11px] text-muted-foreground">{u.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-border shrink-0 flex items-center gap-2">
              <Button size="sm" className="flex-1" onClick={viewAllUnits}>
                View All Units
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={generateReport}>
                Generate Report
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

