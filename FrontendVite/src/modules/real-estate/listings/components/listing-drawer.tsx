import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Pencil, Trash2, Phone, Camera, Megaphone, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/auth/can";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useDeleteListing } from "@/hooks/real-estate/use-re";
import { reApi, type ListingDto } from "@/lib/real-estate/re.api";

interface Props {
  open: boolean;
  onClose: () => void;
  listing: ListingDto | null;
  onEdit: (l: ListingDto) => void;
  /**
   * Opens the building behind this listing — its photo gallery, website publishing, unit
   * schedule and printable profile. Building-level work that does not belong on one unit's row,
   * but would be unreachable if the listing were the only way in.
   */
  onOpenBuilding: (propertyId: string) => void;
}

/** Everything the sheet carries for one unit, in the order someone actually reads it. */
export function ListingDrawer({ open, onClose, listing, onEdit, onOpenBuilding }: Props) {
  const currency = useCurrency();
  const del = useDeleteListing();
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  // Reset on close, or reopening another listing would show the confirmation still armed.
  React.useEffect(() => { if (!open) setConfirmDelete(false); }, [open]);

  if (!listing) return null;
  const l = listing;

  const price = l.purpose === "sale" ? l.salePrice : l.rentPerYear;
  const priceHeading = l.purpose === "sale" ? "Asking price" : "Annual rent";

  const handleDelete = async () => {
    try {
      await del.mutateAsync(l.id);
      onClose();
    } catch { /* the hook toasts the reason */ }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            <div className="flex items-start justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-foreground truncate">{l.propertyName}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Unit {l.unitNumber} · {l.propertyType}
                  {l.city ? ` · ${l.city}` : ""}
                </p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Cover photo, when the building has one. */}
              {l.primaryImageId && (
                <img
                  src={reApi.propertyImageUrl(l.propertyId, l.primaryImageId)}
                  alt={l.propertyName}
                  className="w-full h-44 object-cover rounded-xl border border-border"
                />
              )}

              {/* Headline */}
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs text-muted-foreground">{priceHeading}</p>
                <p className="text-2xl font-bold text-foreground mt-0.5">
                  {price > 0 ? formatCurrency(price, currency) : (l.priceLabel || "Not stated")}
                </p>
                {/* The raw cell, whenever it says more than the figure does — which on these
                    sheets is most of the time. */}
                {l.priceLabel && price > 0 && l.priceLabel !== String(price) && (
                  <p className="text-xs text-muted-foreground mt-1">As written: {l.priceLabel}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {l.purpose && (
                    <Chip className="bg-primary/10 text-primary">
                      {l.purpose === "sale" ? "For sale" : "For rent"}
                    </Chip>
                  )}
                  <Chip className="bg-muted text-muted-foreground capitalize">{l.status.replace(/_/g, " ")}</Chip>
                  {l.hasMedia && <Chip className="bg-muted text-muted-foreground"><Camera className="w-3 h-3 me-1" />Photos</Chip>}
                  {l.isListed && <Chip className="bg-success/10 text-success"><Megaphone className="w-3 h-3 me-1" />Advertised</Chip>}
                </div>
              </div>

              <Group title="Unit">
                <Row label="Layout" value={l.bedsLabel || (l.bedrooms != null ? `${l.bedrooms} bedrooms` : null)} />
                <Row label="Bedrooms" value={l.bedrooms != null ? String(l.bedrooms) : null} />
                <Row label="Bathrooms" value={l.bathrooms != null ? String(l.bathrooms) : null} />
                <Row label="Area" value={l.areaLabel || (l.area > 0 ? `${l.area.toLocaleString()} sqft` : null)} />
                <Row label="Floor" value={l.floor ? String(l.floor) : null} />
                <Row label="Parking" value={l.parking ? String(l.parking) : null} />
                <Row label="Furnishing" value={l.furnishing?.replace(/_/g, " ")} />
                <Row label="View" value={l.view} />
                <Row label="Service charge" value={l.serviceCharge > 0 ? formatCurrency(l.serviceCharge, currency) : null} />
                <Row label="Tenant" value={l.currentTenantName} />
              </Group>

              <Group title="Building">
                <Row label="Name" value={l.propertyName} />
                <Row label="Reference" value={l.propertyNumber} />
                <Row label="Type" value={l.propertyType} />
                <Row label="Category" value={l.category} />
                <Row label="Location" value={l.city} />
                <Row label="Emirate" value={l.emirate} />
                <Row label="Address" value={l.address} />
                <Row label="On website" value={l.listOnWebsite ? "Published" : "Not published"} />
              </Group>

              <Group title="Listing">
                <Row label="Date listed" value={l.listedOn ? formatDate(l.listedOn) : null} />
                <Row label="Listed by / permit" value={l.listedBy} />
                <Row label="Agent" value={l.agentName} />
              </Group>

              <Group title="Owner">
                <Row label="Name" value={l.ownerName} />
                <PhoneRow label="Contact" value={l.ownerPhone} />
                <PhoneRow label="Second number" value={l.ownerPhoneAlt} />
              </Group>

              {l.notes && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notes</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{l.notes}</p>
                </div>
              )}

              <Button variant="outline" size="sm" className="w-full gap-1.5"
                onClick={() => onOpenBuilding(l.propertyId)}>
                <Building2 className="w-3.5 h-3.5" />
                Open building — photos, website, reports
              </Button>

              {l.imageCount > 1 && (
                <p className="text-xs text-muted-foreground text-center">
                  {l.imageCount} photos on this building.
                </p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Can permission="real-estate.units.delete">
                <Button variant="outline" size="sm" className="text-destructive gap-1.5"
                  onClick={() => setConfirmDelete(true)} disabled={del.isPending}>
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </Button>
              </Can>
              <Can permission="real-estate.units.edit">
                <Button size="sm" className="gap-1.5 ms-auto" onClick={() => onEdit(l)}>
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Button>
              </Can>
            </div>

            {/* State-based confirmation, never window.confirm. */}
            <AnimatePresence>
              {confirmDelete && (
                <motion.div
                  className="absolute inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-center justify-center p-6"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                >
                  <div className="bg-card border border-border rounded-xl p-5 w-full max-w-sm shadow-xl">
                    <h3 className="font-semibold text-foreground">Delete this listing?</h3>
                    <p className="text-sm text-muted-foreground mt-1.5">
                      {l.propertyName} unit {l.unitNumber} will be removed. The building stays, along
                      with any other units in it.
                    </p>
                    <div className="flex gap-2 justify-end mt-4">
                      <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                      <Button variant="destructive" size="sm" onClick={handleDelete} disabled={del.isPending}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full", className)}>
      {children}
    </span>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
      <dl className="divide-y divide-border rounded-lg border border-border">{children}</dl>
    </div>
  );
}

/** Rows with nothing in them are dropped — an empty field is noise, not information. */
function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 px-3 py-2">
      <dt className="text-xs text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-sm text-foreground text-end capitalize-first">{value}</dd>
    </div>
  );
}

function PhoneRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 px-3 py-2">
      <dt className="text-xs text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-sm text-end">
        {/* Click-to-call: on a phone this is how an agent actually uses the number. */}
        <a href={`tel:${value.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
          <Phone className="w-3 h-3" /> {value}
        </a>
      </dd>
    </div>
  );
}
