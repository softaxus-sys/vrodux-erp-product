import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Check, Plus, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/hooks/use-currency";
import {
  useProperties,
  useProperty,
  usePropertyTypes,
  useCreateListing,
  useUpdateListing,
  useAddPropertyImages,
} from "@/hooks/real-estate/use-re";
import { PropertyPhotos, type StagedImage } from "@/modules/real-estate/properties/components/property-photos";
import type { ListingDto } from "@/lib/real-estate/re.api";

/** Dynamic — a hardcoded date stops being today the moment it is written. */
const today = () => new Date().toISOString().slice(0, 10);

const EMIRATES   = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"];
const FURNISHING = [
  { value: "",               label: "Not stated" },
  { value: "unfurnished",    label: "Unfurnished" },
  { value: "semi_furnished", label: "Semi-furnished" },
  { value: "furnished",      label: "Furnished" },
];
const STATUSES = [
  { value: "vacant",      label: "Vacant" },
  { value: "rented",      label: "Rented / tenanted" },
  { value: "sold",        label: "Sold" },
  { value: "maintenance", label: "Maintenance" },
];
const VIEWS = ["Sea View", "City View", "Marina View", "Garden View", "Pool View", "Golf View", "Street View", "Internal"];

/** The option that turns the type picker into a free-text box. */
const ADD_NEW = "__add_new__";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Present for an edit; absent creates a new listing. */
  editing?: ListingDto | null;
}

/**
 * Creates or edits a listing: the building and the unit in one form.
 *
 * <p>There used to be two — a property form and, on a different page, a unit form that could only
 * run once a building already existed. An agency takes on one apartment at a time, so that meant
 * two screens for one piece of work, and half the fields on their sheet had nowhere to go.</p>
 */
export function ListingForm({ open, onClose, editing }: Props) {
  const currency = useCurrency();
  const isEdit = !!editing;

  // ── the building ──
  const [propertyId, setPropertyId]     = React.useState<string | null>(null);
  const [propertyName, setPropertyName] = React.useState("");
  const [buildingOpen, setBuildingOpen] = React.useState(false);
  const [propertyType, setPropertyType] = React.useState("Apartment");
  const [newType, setNewType]           = React.useState<string | null>(null);
  const [category, setCategory]         = React.useState("residential");
  const [emirate, setEmirate]           = React.useState("Dubai");
  const [city, setCity]                 = React.useState("");
  const [address, setAddress]           = React.useState("");

  // ── the unit ──
  const [unitNumber, setUnitNumber]   = React.useState("");
  const [floor, setFloor]             = React.useState("");
  const [bedsLabel, setBedsLabel]     = React.useState("");
  const [bedrooms, setBedrooms]       = React.useState("");
  const [bathrooms, setBathrooms]     = React.useState("");
  const [parking, setParking]         = React.useState("");
  const [areaLabel, setAreaLabel]     = React.useState("");
  const [area, setArea]               = React.useState("");
  const [furnishing, setFurnishing]   = React.useState("");
  const [view, setView]               = React.useState("");
  const [status, setStatus]           = React.useState("vacant");
  const [serviceCharge, setServiceCharge] = React.useState("");
  const [notes, setNotes]             = React.useState("");

  // ── the listing ──
  const [purpose, setPurpose]         = React.useState<"rent" | "sale">("rent");
  const [listedOn, setListedOn]       = React.useState(today());
  const [priceLabel, setPriceLabel]   = React.useState("");
  const [price, setPrice]             = React.useState("");
  const [hasMedia, setHasMedia]       = React.useState(false);
  const [isListed, setIsListed]       = React.useState(false);
  const [listedBy, setListedBy]       = React.useState("");
  const [agentName, setAgentName]     = React.useState("");
  const [ownerName, setOwnerName]     = React.useState("");
  const [ownerPhone, setOwnerPhone]   = React.useState("");
  const [ownerPhoneAlt, setOwnerPhoneAlt] = React.useState("");

  const [staged, setStaged] = React.useState<StagedImage[]>([]);

  const { data: typeOptions } = usePropertyTypes();
  const { data: buildingPage } = useProperties({ pageSize: 200 });
  const buildings = buildingPage?.items ?? [];

  // Only on edit, and only for the gallery: the listing DTO carries a cover image id and a count,
  // not the photographs themselves, so the form fetches the building to show and manage them.
  const { data: building } = useProperty(open && isEdit ? editing?.propertyId : undefined);

  const createMut = useCreateListing();
  const updateMut = useUpdateListing();
  const addImages = useAddPropertyImages();
  const saving = createMut.isPending || updateMut.isPending || addImages.isPending;

  const reset = React.useCallback(() => {
    setPropertyId(null); setPropertyName(""); setBuildingOpen(false);
    setPropertyType("Apartment"); setNewType(null); setCategory("residential");
    setEmirate("Dubai"); setCity(""); setAddress("");
    setUnitNumber(""); setFloor(""); setBedsLabel(""); setBedrooms(""); setBathrooms("");
    setParking(""); setAreaLabel(""); setArea(""); setFurnishing(""); setView("");
    setStatus("vacant"); setServiceCharge(""); setNotes("");
    setPurpose("rent"); setListedOn(today()); setPriceLabel(""); setPrice("");
    setHasMedia(false); setIsListed(false); setListedBy(""); setAgentName("");
    setOwnerName(""); setOwnerPhone(""); setOwnerPhoneAlt("");
    setStaged([]);
  }, []);

  // Prefill on edit / clear on close.
  //
  // Every field the payload sends is prefilled. The update is a full replace, so one left blank
  // here is not "unchanged" — it is written back as empty. That is exactly how editing a property
  // used to wipe its valuation and address.
  React.useEffect(() => {
    if (!open) { reset(); return; }
    if (!editing) return;

    setPropertyId(editing.propertyId);
    setPropertyName(editing.propertyName);
    setPropertyType(editing.propertyType || "Apartment");
    setNewType(null);
    setCategory(editing.category || "residential");
    setEmirate(editing.emirate || "Dubai");
    setCity(editing.city ?? "");
    setAddress(editing.address ?? "");

    setUnitNumber(editing.unitNumber ?? "");
    setFloor(editing.floor ? String(editing.floor) : "");
    setBedsLabel(editing.bedsLabel ?? "");
    setBedrooms(editing.bedrooms != null ? String(editing.bedrooms) : "");
    setBathrooms(editing.bathrooms != null ? String(editing.bathrooms) : "");
    setParking(editing.parking ? String(editing.parking) : "");
    setAreaLabel(editing.areaLabel ?? "");
    setArea(editing.area ? String(editing.area) : "");
    setFurnishing(editing.furnishing ?? "");
    setView(editing.view ?? "");
    setStatus(editing.status ?? "vacant");
    setServiceCharge(editing.serviceCharge ? String(editing.serviceCharge) : "");
    setNotes(editing.notes ?? "");

    const p = editing.purpose ?? "rent";
    setPurpose(p);
    setListedOn(editing.listedOn ?? "");
    setPriceLabel(editing.priceLabel ?? "");
    setPrice(String((p === "sale" ? editing.salePrice : editing.rentPerYear) || ""));
    setHasMedia(editing.hasMedia);
    setIsListed(editing.isListed);
    setListedBy(editing.listedBy ?? "");
    setAgentName(editing.agentName ?? "");
    setOwnerName(editing.ownerName ?? "");
    setOwnerPhone(editing.ownerPhone ?? "");
    setOwnerPhoneAlt(editing.ownerPhoneAlt ?? "");
    setStaged([]);
  }, [open, editing, reset]);

  // Buildings whose name contains what has been typed. Hidden once one is picked, so the list
  // does not sit open over the rest of the form.
  const buildingMatches = React.useMemo(() => {
    const q = propertyName.trim().toLowerCase();
    if (!q) return buildings.slice(0, 8);
    return buildings.filter(b => b.name.toLowerCase().includes(q)).slice(0, 8);
  }, [buildings, propertyName]);

  const pickBuilding = (b: { id: string; name: string; propertyType: string; category: string; location: { city: string; emirate: string; address: string } }) => {
    setPropertyId(b.id);
    setPropertyName(b.name);
    // Carried over so the rest of the form is not retyped for a building already on file.
    setPropertyType(b.propertyType || "Apartment");
    setCategory(b.category || "residential");
    setEmirate(b.location?.emirate || "Dubai");
    setCity(b.location?.city ?? "");
    setAddress(b.location?.address ?? "");
    setBuildingOpen(false);
  };

  const effectiveType = (newType ?? propertyType).trim();
  const isValid = propertyName.trim() && effectiveType;

  const handleSave = async () => {
    if (!isValid) return;

    const numeric = Number(price) || 0;
    const payload = {
      propertyName: propertyName.trim(),
      propertyType: effectiveType,
      category,
      address: address.trim() || null,
      city: city.trim() || null,
      emirate,
      developer: null,
      propertyDescription: null,
      propertyMarketValue: 0,

      unitNumber: unitNumber.trim() || null,
      unitType: effectiveType,
      area: Number(area) || 0,
      floor: Number(floor) || 0,
      // The purpose decides which column the figure belongs in. Writing an asking price into
      // annual rent is what made every imported sale row read as a huge tenancy.
      rentPerYear: purpose === "rent" ? numeric : 0,
      salePrice:   purpose === "sale" ? numeric : 0,
      status,
      furnishing: furnishing || null,
      view: view || null,
      bedrooms:  bedrooms  === "" ? null : Number(bedrooms),
      bathrooms: bathrooms === "" ? null : Number(bathrooms),
      parking: Number(parking) || 0,
      serviceCharge: Number(serviceCharge) || 0,
      notes: notes.trim() || null,

      purpose,
      listedOn: listedOn || null,
      bedsLabel: bedsLabel.trim() || null,
      priceLabel: priceLabel.trim() || null,
      areaLabel: areaLabel.trim() || null,
      hasMedia,
      isListed,
      listedBy: listedBy.trim() || null,
      agentName: agentName.trim() || null,
      ownerName: ownerName.trim() || null,
      ownerPhone: ownerPhone.trim() || null,
      ownerPhoneAlt: ownerPhoneAlt.trim() || null,
    };

    try {
      if (editing) {
        await updateMut.mutateAsync({
          id: editing.id,
          data: { ...payload, unitNumber: unitNumber.trim() || editing.unitNumber },
        });
        toast.success("Listing updated");
      } else {
        const created = await createMut.mutateAsync({ ...payload, propertyId });

        // Photos second: they need the building id that create just returned.
        if (staged.length > 0) {
          try {
            await addImages.mutateAsync({ propertyId: created.propertyId, images: staged });
          } catch {
            // The hook has already reported it. The listing itself saved, so say what actually
            // happened rather than implying the whole save failed.
            toast.error("Listing saved, but the photos did not upload. Add them from Edit.");
            onClose();
            return;
          }
        }
        toast.success(`Listing saved — ${created.propertyName} ${created.unitNumber}`);
      }
      onClose();
    } catch {
      /* the hooks toast the reason */
    }
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
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {isEdit ? "Edit Listing" : "New Listing"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isEdit ? "The building and the unit, together" : "One building and one unit, in one step"}
                </p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* ── Purpose ── */}
              <div className="space-y-1.5">
                <Label>Purpose</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["rent", "sale"] as const).map(p => (
                    <button key={p} type="button" onClick={() => setPurpose(p)}
                      className={`py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                        purpose === p ? "border-primary bg-primary/5 text-primary"
                                      : "border-border text-muted-foreground hover:border-primary/30"
                      }`}>
                      {p === "rent" ? "For Rent" : "For Sale"}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Building ── */}
              <Section title="Building">
                <div className="col-span-2 space-y-1.5 relative">
                  <Label>Building / project *</Label>
                  <div className="relative">
                    <Input
                      value={propertyName}
                      onChange={e => {
                        setPropertyName(e.target.value);
                        // Typing over a picked building unlinks it — the name no longer refers to
                        // the record that was chosen, and saving against it would rename that one.
                        setPropertyId(null);
                        setBuildingOpen(true);
                      }}
                      onFocus={() => !isEdit && setBuildingOpen(true)}
                      placeholder="Cayan Tower"
                      className="h-9 text-sm pe-24"
                    />
                    {propertyId ? (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                        <Check className="w-3 h-3" /> On file
                      </span>
                    ) : propertyName.trim() && !isEdit ? (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        <Plus className="w-3 h-3" /> New
                      </span>
                    ) : null}
                  </div>

                  {buildingOpen && !isEdit && buildingMatches.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                      {buildingMatches.map(b => (
                        <button key={b.id} type="button" onClick={() => pickBuilding(b)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm text-foreground truncate">{b.name}</span>
                          <span className="ms-auto text-[11px] text-muted-foreground truncate">
                            {b.location?.city || b.location?.emirate}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {isEdit
                      ? "Renaming this renames it for every unit in the building."
                      : propertyId
                        ? "This unit will be added to the building already on file."
                        : "Not on file yet — it will be created with this listing."}
                  </p>
                </div>

                {/* Creatable type picker */}
                <div className="space-y-1.5">
                  <Label>Property type *</Label>
                  {newType === null ? (
                    <select
                      value={propertyType}
                      onChange={e => {
                        if (e.target.value === ADD_NEW) { setNewType(""); return; }
                        setPropertyType(e.target.value);
                      }}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {/* The stored value first, so an edit never silently changes the type just
                          because the list has not loaded yet. */}
                      {!(typeOptions ?? []).some(t => t.toLowerCase() === propertyType.toLowerCase()) && propertyType && (
                        <option value={propertyType}>{propertyType}</option>
                      )}
                      {(typeOptions ?? []).map(t => <option key={t} value={t}>{t}</option>)}
                      <option value={ADD_NEW}>+ Add a new type…</option>
                    </select>
                  ) : (
                    <div className="flex gap-1.5">
                      <Input autoFocus value={newType} onChange={e => setNewType(e.target.value)}
                        placeholder="e.g. Labour Camp" className="h-9 text-sm" />
                      <Button variant="outline" size="sm" className="h-9 shrink-0"
                        onClick={() => setNewType(null)}>Cancel</Button>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                    <option value="mixed">Mixed use</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>Emirate</Label>
                  <select value={emirate} onChange={e => setEmirate(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {EMIRATES.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>Location / community</Label>
                  <Input value={city} onChange={e => setCity(e.target.value)}
                    placeholder="Dubai Marina" className="h-9 text-sm" />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <Label>Address</Label>
                  <Input value={address} onChange={e => setAddress(e.target.value)}
                    placeholder="Street, landmark…" className="h-9 text-sm" />
                </div>
              </Section>

              {/* ── Unit ── */}
              <Section title="Unit">
                <div className="space-y-1.5">
                  <Label>Unit number</Label>
                  <Input value={unitNumber} onChange={e => setUnitNumber(e.target.value)}
                    placeholder="1206" className="h-9 text-sm" />
                  {!isEdit && !unitNumber.trim() && (
                    <p className="text-[11px] text-muted-foreground">
                      Left blank, a placeholder is generated so the listing is not lost.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Floor</Label>
                  <Input type="number" value={floor} onChange={e => setFloor(e.target.value)}
                    placeholder="12" className="h-9 text-sm text-right" />
                </div>

                <div className="space-y-1.5">
                  <Label>Layout (as written)</Label>
                  <Input value={bedsLabel} onChange={e => setBedsLabel(e.target.value)}
                    placeholder="2bhk+maid" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label>Bedrooms</Label>
                  <Input type="number" min={0} value={bedrooms} onChange={e => setBedrooms(e.target.value)}
                    placeholder="2" className="h-9 text-sm text-right" />
                </div>

                <div className="space-y-1.5">
                  <Label>Bathrooms</Label>
                  <Input type="number" min={0} value={bathrooms} onChange={e => setBathrooms(e.target.value)}
                    placeholder="2" className="h-9 text-sm text-right" />
                </div>
                <div className="space-y-1.5">
                  <Label>Parking</Label>
                  <Input type="number" min={0} value={parking} onChange={e => setParking(e.target.value)}
                    placeholder="1" className="h-9 text-sm text-right" />
                </div>

                <div className="space-y-1.5">
                  <Label>Area (as written)</Label>
                  <Input value={areaLabel} onChange={e => setAreaLabel(e.target.value)}
                    placeholder="713.54sqft" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label>Area (sqft)</Label>
                  <Input type="number" min={0} value={area} onChange={e => setArea(e.target.value)}
                    placeholder="713.54" className="h-9 text-sm text-right" />
                </div>

                <div className="space-y-1.5">
                  <Label>Furnishing</Label>
                  <select value={furnishing} onChange={e => setFurnishing(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {FURNISHING.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>View</Label>
                  <select value={view} onChange={e => setView(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">Not stated</option>
                    {VIEWS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <select value={status} onChange={e => setStatus(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Service charge ({currency})</Label>
                  <Input type="number" min={0} value={serviceCharge} onChange={e => setServiceCharge(e.target.value)}
                    placeholder="0" className="h-9 text-sm text-right" />
                </div>
              </Section>

              {/* ── Price ── */}
              <Section title={purpose === "rent" ? "Rent" : "Asking price"}>
                <div className="space-y-1.5">
                  <Label>{purpose === "rent" ? `Annual rent (${currency})` : `Asking price (${currency})`}</Label>
                  <Input type="number" min={0} value={price} onChange={e => setPrice(e.target.value)}
                    placeholder="0" className="h-9 text-sm text-right" />
                </div>
                <div className="space-y-1.5">
                  <Label>Date listed</Label>
                  <Input type="date" value={listedOn} onChange={e => setListedOn(e.target.value)}
                    className="h-9 text-sm" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Price as written</Label>
                  <Input value={priceLabel} onChange={e => setPriceLabel(e.target.value)}
                    placeholder="700k (rented till 29 Feb 2026 in 55k)" className="h-9 text-sm" />
                  <p className="text-[11px] text-muted-foreground">
                    Kept word for word alongside the figure — the condition a deal is agreed on
                    rarely fits in a number.
                  </p>
                </div>
              </Section>

              {/* ── Marketing ── */}
              <Section title="Marketing">
                <label className="col-span-1 flex items-start gap-2.5 rounded-lg border border-border p-2.5 cursor-pointer hover:bg-muted/40">
                  <input type="checkbox" checked={hasMedia} onChange={e => setHasMedia(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border accent-primary" />
                  <span className="text-xs">
                    <span className="font-medium text-foreground">Photos / video on file</span>
                  </span>
                </label>
                <label className="col-span-1 flex items-start gap-2.5 rounded-lg border border-border p-2.5 cursor-pointer hover:bg-muted/40">
                  <input type="checkbox" checked={isListed} onChange={e => setIsListed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border accent-primary" />
                  <span className="text-xs">
                    <span className="font-medium text-foreground">Advertised on a portal</span>
                  </span>
                </label>

                <div className="col-span-2 space-y-1.5">
                  <Label>Listed by / permit no.</Label>
                  <Input value={listedBy} onChange={e => setListedBy(e.target.value)}
                    placeholder="zaryab / 7126390600" className="h-9 text-sm" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Agent (contact with)</Label>
                  <Input value={agentName} onChange={e => setAgentName(e.target.value)}
                    placeholder="Nida" className="h-9 text-sm" />
                </div>
              </Section>

              {/* ── Owner ── */}
              <Section title="Owner">
                <div className="col-span-2 space-y-1.5">
                  <Label>Owner name</Label>
                  <Input value={ownerName} onChange={e => setOwnerName(e.target.value)}
                    placeholder="Majid" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact number</Label>
                  <Input value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)}
                    placeholder="0545556075" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label>Second number</Label>
                  <Input value={ownerPhoneAlt} onChange={e => setOwnerPhoneAlt(e.target.value)}
                    placeholder="0509040075" className="h-9 text-sm" />
                </div>
              </Section>

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  placeholder="Cheque count, handover status, anything else…"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>

              {/* Photographs belong to the building, so on a new listing they can only be uploaded
                  once it has been created — hence staging. */}
              <PropertyPhotos
                propertyId={editing?.propertyId}
                images={building?.images}
                staged={staged}
                onStagedChange={setStaged}
              />
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-2 justify-between shrink-0">
              <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} disabled={!isValid || saving}>
                {saving && <Loader2 className="w-4 h-4 me-1.5 animate-spin" />}
                {isEdit ? "Save Changes" : "Save Listing"}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{title}</p>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}
