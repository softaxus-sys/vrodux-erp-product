import * as React from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import {
  Search, Building2, Plus, UploadCloud, Home, Tag, KeyRound,
  Camera, Megaphone, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pager } from "@/components/ui/pager";
import { Can } from "@/components/auth/can";
import { SpreadsheetImportModal } from "@/components/ui/spreadsheet-import-modal";
import { cn, formatCurrency, fitTextClass } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useListings, useListingsSummary, useImportRentalStock, useProperty } from "@/hooks/real-estate/use-re";
import type { ListingDto, PropertyDto, UnitStatus } from "@/lib/real-estate/re.api";
import { LISTING_IMPORT_FIELDS } from "./listing-import-fields";
import { ListingForm } from "./listing-form";
import { ListingDrawer } from "./listing-drawer";
import { RestrictedBadge } from "./confidential-field";
// The building behind a listing keeps its own screen: gallery, website publishing, unit schedule
// and printable profile are building-level, and folding the pages together must not lose them.
import { PropertiesDrawer } from "@/modules/real-estate/properties/components/properties-drawer";
import { AddPropertyForm } from "@/modules/real-estate/properties/components/add-property-form";

const PAGE_SIZE = 30;

const PURPOSE_FILTERS = [
  { label: "All",      value: "all" },
  { label: "For rent", value: "rent" },
  { label: "For sale", value: "sale" },
];

const STATUS_FILTERS = [
  { label: "Any status",  value: "all" },
  { label: "Vacant",      value: "vacant" },
  { label: "Rented",      value: "rented" },
  { label: "Sold",        value: "sold" },
  { label: "Maintenance", value: "maintenance" },
];

const STATUS_CONFIG: Record<UnitStatus, { label: string; className: string }> = {
  vacant:      { label: "Vacant",      className: "text-warning bg-warning/10" },
  rented:      { label: "Rented",      className: "text-success bg-success/10" },
  reserved:    { label: "Reserved",    className: "text-blue-600 bg-blue-500/10" },
  maintenance: { label: "Maintenance", className: "text-orange-600 bg-orange-500/10" },
  for_sale:    { label: "For sale",    className: "text-purple-600 bg-purple-500/10" },
  sold:        { label: "Sold",        className: "text-muted-foreground bg-muted" },
};

// Never indexed bare. A status the server adds later would otherwise read `.className` off
// undefined and take the whole page down — which is exactly how the properties drawer broke.
const STATUS_FALLBACK = { label: "Unknown", className: "text-muted-foreground bg-muted" };
const statusOf = (s: string) => STATUS_CONFIG[s as UnitStatus] ?? STATUS_FALLBACK;

/**
 * The agency's stock list: one row per unit being marketed, with the building it sits in.
 *
 * <p>Replaces the separate Properties and Units screens. Their source sheet is one line per
 * apartment, and splitting it in two meant two lookups to answer what that sheet answers at a
 * glance.</p>
 */
export function ListingsView() {
  const currency = useCurrency();

  const [search, setSearch]       = React.useState("");
  const [purpose, setPurpose]     = React.useState("all");
  const [status, setStatus]       = React.useState("all");
  const [page, setPage]           = React.useState(1);

  const [showForm, setShowForm]   = React.useState(false);
  const [editing, setEditing]     = React.useState<ListingDto | null>(null);
  const [selected, setSelected]   = React.useState<ListingDto | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [showImport, setShowImport] = React.useState(false);

  // The building drawer, opened from a listing.
  const [buildingId, setBuildingId] = React.useState<string | null>(null);
  const [editingBuilding, setEditingBuilding] = React.useState<PropertyDto | null>(null);
  const [showBuildingForm, setShowBuildingForm] = React.useState(false);
  const { data: building } = useProperty(buildingId ?? undefined);

  // "View all units" on a building lands here with its id, which is what carries that intent over
  // now that the Units page is gone.
  const [params, setParams] = useSearchParams();
  const propertyId = params.get("propertyId") ?? undefined;

  const importStock = useImportRentalStock();

  // Typing hits the server, so the request waits until they stop.
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  // Filtering narrows in SQL. Doing it in the browser cannot survive paging — it would filter
  // within one page and under-report everything.
  React.useEffect(() => { setPage(1); }, [debounced, purpose, status, propertyId]);

  const { data: paged, isFetching } = useListings({
    search: debounced || undefined,
    purpose, status, propertyId, page, pageSize: PAGE_SIZE,
  });
  const listings   = paged?.items ?? [];
  const totalCount = paged?.totalCount ?? 0;
  const totalPages = paged?.totalPages ?? 1;

  const { data: summary } = useListingsSummary();

  const STAT_CARDS = [
    { label: "Listings",   value: (summary?.total ?? 0).toLocaleString(),      icon: Home,      color: "text-primary bg-primary/10" },
    { label: "Buildings",  value: (summary?.buildings ?? 0).toLocaleString(),  icon: Building2, color: "text-blue-600 bg-blue-500/10" },
    { label: "For rent",   value: (summary?.forRent ?? 0).toLocaleString(),    icon: KeyRound,  color: "text-success bg-success/10" },
    { label: "For sale",   value: (summary?.forSale ?? 0).toLocaleString(),    icon: Tag,       color: "text-purple-600 bg-purple-500/10" },
    // Rent and sale totals are deliberately separate tiles. Added together they would describe
    // nothing — a rent roll and a book of asking prices are not the same kind of money.
    { label: "Annual rent", value: formatCurrency(summary?.totalAnnualRent ?? 0, currency),  icon: Wallet, color: "text-warning bg-warning/10" },
    { label: "Asking (sale)", value: formatCurrency(summary?.totalAskingPrice ?? 0, currency), icon: Wallet, color: "text-pink-600 bg-pink-500/10" },
  ];

  const openRow = (l: ListingDto) => { setSelected(l); setDrawerOpen(true); };

  /** The price to show: whichever column the purpose points at, falling back to the raw cell. */
  const priceOf = (l: ListingDto) => {
    const n = l.purpose === "sale" ? l.salePrice : l.rentPerYear;
    if (n > 0) return formatCurrency(n, currency);
    // A figure of zero with a price cell means the sheet wrote something a parser could not read.
    // Showing the words beats showing a confident "0".
    return l.priceLabel || "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Properties &amp; Units</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Your stock list — one row per unit, with the building it belongs to.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Can permission="real-estate.units.create">
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowImport(true)}>
              <UploadCloud className="h-4 w-4" /> Import
            </Button>
          </Can>
          <Can permission="real-estate.units.create">
            <Button size="sm" className="gap-2" onClick={() => { setEditing(null); setShowForm(true); }}>
              <Plus className="h-4 w-4" /> New Listing
            </Button>
          </Can>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAT_CARDS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2 min-w-0"
            >
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", s.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground truncate">{s.label}</p>
                <p className={cn("font-bold leading-tight truncate", fitTextClass(s.value, "lg"))} title={String(s.value)}>
                  {s.value}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* A building filter is easy to forget is on, so it says so and offers a way out. */}
      {propertyId && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <p className="text-sm text-foreground">
            Showing only units in <span className="font-semibold">{listings[0]?.propertyName ?? "one building"}</span>.
          </p>
          <Button variant="outline" size="sm" onClick={() => { params.delete("propertyId"); setParams(params, { replace: true }); }}>
            Show all
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search building, unit, location, owner, agent…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="ps-8 h-9 text-sm"
            />
          </div>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {STATUS_FILTERS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {PURPOSE_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setPurpose(f.value)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                purpose === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                {["Building / unit", "Location", "Type", "Beds", "Area", "Price", "Furnishing", "Owner", "Agent", "Status"].map(h => (
                  <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {listings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {debounced || purpose !== "all" || status !== "all"
                      ? "No listings match these filters."
                      : "No listings yet. Add one, or import your stock sheet."}
                  </td>
                </tr>
              ) : (
                listings.map((l, i) => (
                  <motion.tr
                    key={l.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i, 12) * 0.015 }}
                    onClick={() => openRow(l)}
                    className="hover:bg-muted/30 cursor-pointer"
                  >
                    <td className="px-4 py-3 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground truncate">{l.propertyName}</span>
                        {l.hasMedia && <Camera className="h-3 w-3 text-muted-foreground shrink-0" aria-label="Photos on file" />}
                        {l.isListed && <Megaphone className="h-3 w-3 text-primary shrink-0" aria-label="Advertised" />}
                      </div>
                      {l.hasConfidentialAccess ? (
                        <p className="text-[11px] text-muted-foreground">Unit {l.unitNumber}</p>
                      ) : (
                        <RestrictedBadge className="mt-0.5" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{l.city || l.emirate || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {l.propertyType}
                      </span>
                    </td>
                    {/* The layout as the sheet writes it, falling back to the parsed count. */}
                    <td className="px-4 py-3 whitespace-nowrap">{l.bedsLabel || (l.bedrooms != null ? `${l.bedrooms} BR` : "—")}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {l.areaLabel || (l.area > 0 ? `${l.area.toLocaleString()} sqft` : "—")}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-semibold">{priceOf(l)}</span>
                      <p className="text-[11px] text-muted-foreground">{l.purpose === "sale" ? "Sale" : l.purpose === "rent" ? "Rent" : ""}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground capitalize">
                      {l.furnishing ? l.furnishing.replace(/_/g, " ") : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {l.hasConfidentialAccess ? (
                        <>
                          <span className="truncate">{l.ownerName || "—"}</span>
                          {l.ownerPhone && <p className="text-[11px] text-muted-foreground">{l.ownerPhone}</p>}
                        </>
                      ) : (
                        <RestrictedBadge />
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{l.agentName || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", statusOf(l.status).className)}>
                        {statusOf(l.status).label}
                      </span>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalCount > 0 && (
          <div className="border-t border-border">
            <Pager page={page} totalPages={totalPages} totalCount={totalCount} pageSize={PAGE_SIZE} busy={isFetching} onPage={setPage} />
          </div>
        )}
      </div>

      <ListingDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        listing={selected}
        onEdit={l => { setEditing(l); setDrawerOpen(false); setShowForm(true); }}
        onOpenBuilding={id => { setDrawerOpen(false); setBuildingId(id); }}
      />

      <PropertiesDrawer
        open={!!buildingId && !!building}
        onClose={() => setBuildingId(null)}
        property={building ?? null}
        onEdit={p => { setEditingBuilding(p); setBuildingId(null); setShowBuildingForm(true); }}
      />

      <AddPropertyForm
        open={showBuildingForm}
        editing={editingBuilding}
        onClose={() => { setShowBuildingForm(false); setEditingBuilding(null); }}
      />

      <ListingForm
        open={showForm}
        editing={editing}
        // Cleared on close, or the next "New Listing" would open still in edit mode and overwrite
        // whichever listing was edited last.
        onClose={() => { setShowForm(false); setEditing(null); }}
      />

      <SpreadsheetImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Import stock sheet"
        description="One row per unit being marketed. Only the building is required — the buildings named are created as the file is read."
        fields={LISTING_IMPORT_FIELDS}
        noun="listings"
        onImport={rows => importStock.mutateAsync(rows)}
      />
    </div>
  );
}
