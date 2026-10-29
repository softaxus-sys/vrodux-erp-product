import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { CheckCircle2, Copy, ExternalLink, Globe, Loader2, Plus, Rocket, Store, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Can } from "@/components/auth/can";
import { cn } from "@/lib/utils";
import { COUNTRIES } from "@/lib/onboarding/geo-data";
import { DEFAULT_THEME, parseJson, type MenuItem, type Section, type ShopTheme, type Social } from "@/lib/storefront/shop.api";
import { FONT_CHOICES, StoreProvider } from "@/modules/storefront/store-context";
import { SectionRenderer } from "@/modules/storefront/sections";
import { useCreateStore, useDeleteZone, useSaveZone, useShippingZones, useStoreSettings, useUpdateStore } from "@/hooks/ecommerce/use-store";
import type { ShippingZoneDto, StoreSettings, StoreSettingsUpdate } from "@/lib/ecommerce/store.api";
import { ConfirmDialog, Field, Modal, PageHeader, Pill } from "../../shared/ui";
import { ColorField, ImageField, NumberField, SelectField, TextAreaField, TextField, ToggleField } from "./builder-fields";

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

// ── First-time setup ─────────────────────────────────────────────────────────

export function SetupStore() {
  const create = useCreateStore();
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  return (
    <div className="max-w-xl mx-auto py-10">
      <Card className="p-8 space-y-5 text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center"><Store className="h-7 w-7 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">Open your online store</h1>
          <p className="text-sm text-muted-foreground mt-1">Your products come from Inventory. We will set up a home page, delivery and the usual pages — you can change all of it.</p>
        </div>
        <div className="space-y-4 text-start">
          <TextField label="Store name" value={name} onChange={v => { setName(v); if (!touched) setSlug(slugify(v)); }} placeholder="My Store" />
          <TextField label="Web address" value={slug} onChange={v => { setTouched(true); setSlug(slugify(v)); }} dir="ltr" hint={`Customers will find you at /shop/${slug || "your-store"}. You can add your own domain later.`} />
        </div>
        <Can permission="ecommerce.store.edit">
          <Button className="w-full gap-2" disabled={!name.trim() || !slug || create.isPending} onClick={() => create.mutate({ name: name.trim(), slug })}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}Create my store
          </Button>
        </Can>
      </Card>
    </div>
  );
}

// ── Form state ───────────────────────────────────────────────────────────────

interface Draft {
  s: StoreSettings; theme: ShopTheme; header: MenuItem[]; footer: MenuItem[]; social: Social;
  stripeSecret: string; stripeWebhook: string; paypalSecret: string;
}

function toDraft(s: StoreSettings): Draft {
  return {
    s, theme: { ...DEFAULT_THEME, ...parseJson<Partial<ShopTheme>>(s.themeJson, {}) },
    header: parseJson<MenuItem[]>(s.headerMenuJson, []), footer: parseJson<MenuItem[]>(s.footerMenuJson, []), social: parseJson<Social>(s.socialJson, {}),
    stripeSecret: "", stripeWebhook: "", paypalSecret: "",
  };
}

function toUpdate(d: Draft): StoreSettingsUpdate {
  const { id: _id, hasStripeSecret: _a, hasStripeWebhookSecret: _b, hasPayPalSecret: _c, publicUrl: _d, stripeWebhookUrl: _e, ...rest } = d.s;
  return {
    ...rest,
    themeJson: JSON.stringify(d.theme), headerMenuJson: JSON.stringify(d.header.filter(m => m.label.trim() && m.url.trim())),
    footerMenuJson: JSON.stringify(d.footer.filter(m => m.label.trim() && m.url.trim())),
    socialJson: JSON.stringify(Object.fromEntries(Object.entries(d.social).filter(([, v]) => v && String(v).trim()))),
    // Left blank = keep what is stored (the server never sends a secret back).
    stripeSecretKey: d.stripeSecret.trim() ? d.stripeSecret.trim() : null,
    stripeWebhookSecret: d.stripeWebhook.trim() ? d.stripeWebhook.trim() : null,
    payPalSecret: d.paypalSecret.trim() ? d.paypalSecret.trim() : null,
  };
}

const PRESETS: { id: string; label: string; theme: Partial<ShopTheme> }[] = [
  { id: "classic", label: "Classic", theme: { primary: "#111827", accent: "#2563eb", background: "#ffffff", surface: "#f9fafb", text: "#111827", muted: "#6b7280", headingFont: "inter", bodyFont: "inter", radius: "md", cardStyle: "plain" } },
  { id: "boutique", label: "Boutique", theme: { primary: "#3b2f2f", accent: "#b45f3c", background: "#fffaf5", surface: "#f6ede4", text: "#2b2118", muted: "#7a6a5c", headingFont: "playfair", bodyFont: "lora", radius: "sm", cardStyle: "bordered" } },
  { id: "fresh", label: "Fresh", theme: { primary: "#064e3b", accent: "#059669", background: "#ffffff", surface: "#ecfdf5", text: "#14301f", muted: "#5b7a6b", headingFont: "poppins", bodyFont: "poppins", radius: "lg", cardStyle: "shadow" } },
  { id: "midnight", label: "Midnight", theme: { primary: "#0f172a", accent: "#f59e0b", background: "#0b1220", surface: "#111a2e", text: "#e5e7eb", muted: "#94a3b8", headingFont: "montserrat", bodyFont: "inter", radius: "md", cardStyle: "bordered" } },
  { id: "bold", label: "Bold", theme: { primary: "#be123c", accent: "#e11d48", background: "#ffffff", surface: "#fff1f2", text: "#1f1f1f", muted: "#6b6b6b", headingFont: "montserrat", bodyFont: "poppins", radius: "full", cardStyle: "plain" } },
  { id: "souq", label: "Souq (Arabic)", theme: { primary: "#1e3a5f", accent: "#c2410c", background: "#ffffff", surface: "#f8f5f0", text: "#1f2937", muted: "#6b7280", headingFont: "cairo", bodyFont: "tajawal", radius: "md", cardStyle: "bordered" } },
];

const SAMPLE: Section[] = [
  { id: "a", type: "hero", settings: { heading: "Your store name", subheading: "This is how your colours and fonts look.", buttonLabel: "Shop now", buttonUrl: "/products", align: "center", height: "sm", overlay: 0 } },
  { id: "b", type: "features", settings: { heading: "", items: [{ icon: "truck", title: "Fast delivery", text: "Quick and tracked." }, { icon: "shield", title: "Secure", text: "Safe checkout." }, { icon: "star", title: "Quality", text: "Made to last." }] } },
];

// ── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = "details" | "look" | "payments" | "delivery" | "launch";

function MenuEditor({ label, items, onChange }: { label: string; items: MenuItem[]; onChange: (m: MenuItem[]) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      {items.map((m, i) => (
        <div key={i} className="flex gap-2">
          <input className="h-9 flex-1 rounded-md border border-input bg-card px-3 text-sm" placeholder="Name" value={m.label} onChange={e => onChange(items.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
          <input className="h-9 flex-1 rounded-md border border-input bg-card px-3 text-sm font-mono" dir="ltr" placeholder="/products" value={m.url} onChange={e => onChange(items.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} />
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      {items.length < 8 && <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => onChange([...items, { label: "", url: "" }])}><Plus className="h-3.5 w-3.5" />Add link</Button>}
    </div>
  );
}

function CopyBox({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 min-w-0 truncate rounded-md border border-border bg-muted/30 px-3 py-2 text-xs" dir="ltr">{value}</code>
      <Button type="button" size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => { navigator.clipboard?.writeText(value); toast.success("Copied."); }}><Copy className="h-3.5 w-3.5" />Copy</Button>
    </div>
  );
}

function ZoneDialog({ zone, currency, onClose }: { zone: ShippingZoneDto | null; currency: string; onClose: () => void }) {
  const save = useSaveZone();
  const [name, setName] = React.useState(zone?.name ?? "");
  const [all, setAll] = React.useState(zone ? zone.countries.includes("*") : true);
  const [countries, setCountries] = React.useState<string[]>(zone?.countries.filter(c => c !== "*") ?? []);
  const [search, setSearch] = React.useState("");
  const [rate, setRate] = React.useState<number | null>(zone?.flatRate ?? 0);
  const [freeOver, setFreeOver] = React.useState<number | null>(zone?.freeOver ?? null);
  const [minOrder, setMinOrder] = React.useState<number | null>(zone?.minOrder ?? null);
  const [days, setDays] = React.useState(zone?.estimatedDays ?? "");
  const [active, setActive] = React.useState(zone?.isActive ?? true);
  const shown = COUNTRIES.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <Modal title={zone ? "Edit delivery option" : "New delivery option"} subtitle="Where you deliver and what it costs." onClose={onClose} size="lg"
      footer={<>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" className="gap-1.5" disabled={!name.trim() || (!all && countries.length === 0) || save.isPending}
          onClick={async () => {
            try { await save.mutateAsync({ id: zone?.id ?? null, body: { name: name.trim(), countries: all ? ["*"] : countries, flatRate: rate ?? 0, freeOver, minOrder, estimatedDays: days.trim() || null, isActive: active, sortOrder: zone?.sortOrder ?? 0 } }); onClose(); }
            catch { /* toast shown */ }
          }}>{save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Save</Button>
      </>}>
      <TextField label="Name" value={name} onChange={setName} placeholder="Standard delivery" />
      <div className="grid grid-cols-2 gap-3">
        <NumberField label={`Price (${currency})`} value={rate} onChange={setRate} min={0} step={0.01} />
        <TextField label="Delivery time" value={days} onChange={setDays} placeholder="3–5 days" />
        <NumberField label={`Free above (${currency})`} value={freeOver} onChange={setFreeOver} min={0} step={0.01} hint="Leave empty for never free." />
        <NumberField label={`Smallest order (${currency})`} value={minOrder} onChange={setMinOrder} min={0} step={0.01} hint="Leave empty for no minimum." />
      </div>
      <ToggleField label="Offer this option" checked={active} onChange={setActive} />
      <div className="space-y-2">
        <ToggleField label="Deliver everywhere" checked={all} onChange={setAll} />
        {!all && (
          <>
            <input className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm" placeholder="Search countries" value={search} onChange={e => setSearch(e.target.value)} />
            <div className="max-h-52 overflow-y-auto rounded-md border border-border divide-y divide-border">
              {shown.map(c => (
                <label key={c.code} className="flex items-center gap-3 px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/30">
                  <input type="checkbox" checked={countries.includes(c.code)} onChange={e => setCountries(p => e.target.checked ? [...p, c.code] : p.filter(x => x !== c.code))} />{c.name}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{countries.length} selected</p>
          </>
        )}
      </div>
    </Modal>
  );
}

function DeliveryTab({ currency }: { currency: string }) {
  const zones = useShippingZones();
  const del = useDeleteZone();
  const [editing, setEditing] = React.useState<ShippingZoneDto | "new" | null>(null);
  const [removing, setRemoving] = React.useState<ShippingZoneDto | null>(null);
  const names = React.useMemo(() => Object.fromEntries(COUNTRIES.map(c => [c.code, c.name])), []);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Each option is offered to customers whose country it lists. Add several to give a choice (standard, express).</p>
        <Can permission="ecommerce.store.edit"><Button size="sm" className="gap-1.5" onClick={() => setEditing("new")}><Plus className="h-4 w-4" />Add option</Button></Can>
      </div>
      <Card className="divide-y divide-border">
        {(zones.data ?? []).length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No delivery options yet. Customers cannot check out until you add one.</p>}
        {(zones.data ?? []).map(z => (
          <div key={z.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm">{z.name} {!z.isActive && <Pill meta={{ color: "text-slate-700", bg: "bg-slate-200" }}>Off</Pill>}</p>
              <p className="text-xs text-muted-foreground truncate">{z.countries.includes("*") ? "Everywhere" : z.countries.map(c => names[c] ?? c).join(", ")}{z.estimatedDays ? ` · ${z.estimatedDays}` : ""}</p>
            </div>
            <p className="text-sm font-semibold">{z.flatRate === 0 ? "Free" : `${z.flatRate.toFixed(2)} ${currency}`}{z.freeOver != null && <span className="text-xs font-normal text-muted-foreground"> · free over {z.freeOver}</span>}</p>
            <Can permission="ecommerce.store.edit">
              <Button size="sm" variant="outline" onClick={() => setEditing(z)}>Edit</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRemoving(z)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
            </Can>
          </div>
        ))}
      </Card>
      <AnimatePresence>
        {editing && <ZoneDialog zone={editing === "new" ? null : editing} currency={currency} onClose={() => setEditing(null)} />}
        {removing && <ConfirmDialog title={`Delete “${removing.name}”?`} body={<p>Customers will no longer be offered it.</p>} confirmLabel="Delete" pending={del.isPending}
          onClose={() => setRemoving(null)} onConfirm={async () => { try { await del.mutateAsync(removing.id); setRemoving(null); } catch { /* toast shown */ } }} />}
      </AnimatePresence>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function StoreSettingsView() {
  const q = useStoreSettings();
  const zones = useShippingZones();
  const update = useUpdateStore();
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [tab, setTab] = React.useState<Tab>("details");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => { if (q.data && (!draft || !dirty)) setDraft(toDraft(q.data)); }, [q.data]);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const currencies = React.useMemo(() => [...new Set(COUNTRIES.map(c => c.currencyCode))].sort(), []);

  if (q.isLoading) return <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!q.data) return <SetupStore />;
  if (!draft) return null;

  const s = draft.s;
  const set = <K extends keyof StoreSettings>(k: K, v: StoreSettings[K]) => { setDraft(d => d && ({ ...d, s: { ...d.s, [k]: v } })); setDirty(true); };
  const patch = (p: Partial<Draft>) => { setDraft(d => d && ({ ...d, ...p })); setDirty(true); };
  const theme = (p: Partial<ShopTheme>) => patch({ theme: { ...draft.theme, ...p } });

  const save = async () => {
    setErrors({});
    try { const r = await update.mutateAsync(toUpdate(draft)); setDraft(toDraft(r)); setDirty(false); }
    catch (e) {
      const fe = (e as { fieldErrors?: Record<string, string[]> }).fieldErrors;
      if (fe) { setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k.toLowerCase(), v[0]]))); toast.error("Please check the highlighted fields."); }
    }
  };

  const hasPayment = s.codEnabled || s.bankEnabled || (s.stripeEnabled) || (s.payPalEnabled);
  const hasZone = (zones.data ?? []).some(z => z.isActive);
  const checklist = [
    { ok: hasPayment, text: "At least one payment method is on" }, { ok: hasZone, text: "You deliver somewhere (Delivery tab)" },
    { ok: !!s.contactEmail || !!s.contactPhone, text: "Customers can contact you (Details tab)" },
  ];
  const tabs: { id: Tab; label: string }[] = [{ id: "details", label: "Details" }, { id: "look", label: "Look & menus" }, { id: "payments", label: "Payments & checkout" }, { id: "delivery", label: "Delivery" }, { id: "launch", label: "Address & launch" }];

  return (
    <div className="space-y-6">
      <PageHeader title="Online store" description="Your own store, selling the products you publish from Inventory.">
        <a href={`/shop/${s.slug}?preview=1`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-input text-sm hover:bg-muted/40"><ExternalLink className="h-4 w-4" />View store</a>
        <Can permission="ecommerce.store.edit">
          <Button className="gap-1.5" disabled={!dirty || update.isPending} onClick={save}>{update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Save changes</Button>
        </Can>
      </PageHeader>

      {dirty && <p className="text-xs font-medium text-amber-600 -mt-3">You have unsaved changes.</p>}

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn("px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap", tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{t.label}</button>
        ))}
      </div>

      {tab === "details" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5 space-y-4">
            <h2 className="font-semibold">Store details</h2>
            <TextField label="Store name" value={s.name} onChange={v => set("name", v)} />
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Currency" value={s.currencyCode} onChange={v => set("currencyCode", v)} options={currencies.map(c => ({ value: c, label: c }))} hint="Prices in Inventory are shown in this currency." />
              <SelectField label="Store language" value={s.language} onChange={v => set("language", v as "en" | "ar")} options={[{ value: "en", label: "English" }, { value: "ar", label: "العربية (right-to-left)" }]} />
            </div>
            <TextField label="Announcement bar" value={s.announcementText ?? ""} onChange={v => set("announcementText", v)} placeholder="Free delivery on orders over 200" maxLength={300} hint="Shown at the very top of every page. Leave empty for none." />
          </Card>
          <Card className="p-5 space-y-4">
            <h2 className="font-semibold">Contact</h2>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Email" value={s.contactEmail ?? ""} onChange={v => set("contactEmail", v)} type="email" dir="ltr" />
              <TextField label="Phone / WhatsApp" value={s.contactPhone ?? ""} onChange={v => set("contactPhone", v)} dir="ltr" />
            </div>
            <TextAreaField label="Address" rows={2} value={s.address ?? ""} onChange={v => set("address", v)} />
            <TextField label="Send new-order emails to" value={s.orderNotifyEmail ?? ""} onChange={v => set("orderNotifyEmail", v)} type="email" dir="ltr" hint="Leave empty to use the contact email." />
            {errors.contactemail && <p className="text-xs text-destructive">{errors.contactemail}</p>}
          </Card>
          <Card className="p-5 space-y-4">
            <h2 className="font-semibold">Logo & icon</h2>
            <ImageField label="Logo" slug={s.slug} value={s.logoAssetId} onChange={v => set("logoAssetId", v)} hint="Shown in the header. Without one, your store name is used." />
            <ImageField label="Browser icon (favicon)" slug={s.slug} value={s.faviconAssetId} onChange={v => set("faviconAssetId", v)} hint="A small square picture." />
          </Card>
          <Card className="p-5 space-y-4">
            <h2 className="font-semibold">Search engines</h2>
            <TextField label="Home page title" value={s.seoTitle ?? ""} onChange={v => set("seoTitle", v)} maxLength={120} />
            <TextAreaField label="Home page description" rows={3} value={s.metaDescription ?? ""} onChange={v => set("metaDescription", v)} hint="What Google shows under your store's name." />
            <p className="text-xs text-muted-foreground">Each product uses the search title and description set on its listing in Inventory.</p>
          </Card>
        </div>
      )}

      {tab === "look" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            <Card className="p-5 space-y-4">
              <h2 className="font-semibold">Style</h2>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map(p => (
                  <button key={p.id} type="button" onClick={() => theme({ ...p.theme, preset: p.id })}
                    className={cn("rounded-lg border px-3 py-2 text-sm flex items-center gap-2", draft.theme.preset === p.id ? "border-primary ring-1 ring-primary" : "border-border hover:bg-muted/40")}>
                    <span className="flex">{[p.theme.primary, p.theme.accent, p.theme.surface].map((c, i) => <span key={i} className="h-4 w-4 rounded-full border border-black/10 -ms-1 first:ms-0" style={{ background: c }} />)}</span>{p.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <ColorField label="Main colour" value={draft.theme.primary} onChange={v => theme({ primary: v })} />
                <ColorField label="Accent (buttons, links)" value={draft.theme.accent} onChange={v => theme({ accent: v })} />
                <ColorField label="Background" value={draft.theme.background} onChange={v => theme({ background: v })} />
                <ColorField label="Panels" value={draft.theme.surface} onChange={v => theme({ surface: v })} />
                <ColorField label="Text" value={draft.theme.text} onChange={v => theme({ text: v })} />
                <ColorField label="Soft text" value={draft.theme.muted} onChange={v => theme({ muted: v })} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <SelectField label="Headings font" value={draft.theme.headingFont} onChange={v => theme({ headingFont: v })} options={FONT_CHOICES.map(f => ({ value: f, label: f[0].toUpperCase() + f.slice(1) }))} />
                <SelectField label="Text font" value={draft.theme.bodyFont} onChange={v => theme({ bodyFont: v })} options={FONT_CHOICES.map(f => ({ value: f, label: f[0].toUpperCase() + f.slice(1) }))} />
                <SelectField label="Corners" value={draft.theme.radius} onChange={v => theme({ radius: v as ShopTheme["radius"] })} options={[{ value: "none", label: "Square" }, { value: "sm", label: "Slight" }, { value: "md", label: "Rounded" }, { value: "lg", label: "Very rounded" }, { value: "full", label: "Pill" }]} />
                <SelectField label="Product cards" value={draft.theme.cardStyle} onChange={v => theme({ cardStyle: v as ShopTheme["cardStyle"] })} options={[{ value: "plain", label: "Plain" }, { value: "bordered", label: "Outlined" }, { value: "shadow", label: "Shadow" }]} />
                <SelectField label="Products per row" value={String(draft.theme.productColumns)} onChange={v => theme({ productColumns: Number(v) })} options={[2, 3, 4, 5].map(n => ({ value: String(n), label: String(n) }))} />
                <SelectField label="Header" value={draft.theme.headerStyle} onChange={v => theme({ headerStyle: v as ShopTheme["headerStyle"] })} options={[{ value: "left", label: "Logo on the left" }, { value: "center", label: "Logo centred" }]} />
              </div>
            </Card>
            <Card className="p-5 space-y-5">
              <h2 className="font-semibold">Menus</h2>
              <MenuEditor label="Top menu" items={draft.header} onChange={m => patch({ header: m })} />
              <MenuEditor label="Footer links" items={draft.footer} onChange={m => patch({ footer: m })} />
              <p className="text-xs text-muted-foreground">Use a path inside your store (/products, /collections/summer, /pages/about) or a full web address.</p>
            </Card>
            <Card className="p-5 space-y-3">
              <h2 className="font-semibold">Social links</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {(["instagram", "facebook", "youtube", "tiktok", "x"] as const).map(k => (
                  <TextField key={k} label={k === "x" ? "X (Twitter)" : k[0].toUpperCase() + k.slice(1)} value={draft.social[k] ?? ""} dir="ltr" placeholder="https://…" onChange={v => patch({ social: { ...draft.social, [k]: v } })} />
                ))}
                <TextField label="WhatsApp number" value={draft.social.whatsapp ?? ""} dir="ltr" placeholder="9715xxxxxxxx" onChange={v => patch({ social: { ...draft.social, whatsapp: v } })} />
              </div>
            </Card>
          </div>
          <div className="xl:sticky xl:top-4 xl:self-start rounded-xl border border-border overflow-hidden">
            <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border bg-card">Preview</p>
            <div className="max-h-[80vh] overflow-auto">
              <StoreProvider slug={s.slug} basePath="" embedded infoOverride={{ themeJson: JSON.stringify(draft.theme), name: s.name, language: s.language, logoAssetId: s.logoAssetId }}>
                <SectionRenderer sections={SAMPLE} />
              </StoreProvider>
            </div>
          </div>
        </div>
      )}

      {tab === "payments" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5 space-y-5">
            <h2 className="font-semibold">Ways customers can pay</h2>

            <div className="space-y-3">
              <ToggleField label="Cash on delivery" checked={s.codEnabled} onChange={v => set("codEnabled", v)} hint="Customer pays when the order arrives." />
              {s.codEnabled && <TextAreaField label="Message to the customer" rows={2} value={s.codInstructions ?? ""} onChange={v => set("codInstructions", v)} />}
            </div>
            <div className="space-y-3 border-t border-border pt-4">
              <ToggleField label="Bank transfer" checked={s.bankEnabled} onChange={v => set("bankEnabled", v)} hint="The order waits until you mark it paid." />
              {s.bankEnabled && <TextAreaField label="Your bank details" rows={4} value={s.bankDetails ?? ""} onChange={v => set("bankDetails", v)} hint="Account name, IBAN, bank — shown to the customer after they order." />}
              {errors.bankdetails && <p className="text-xs text-destructive">{errors.bankdetails}</p>}
            </div>
            <div className="space-y-3 border-t border-border pt-4">
              <ToggleField label="Credit / debit card (Stripe)" checked={s.stripeEnabled} onChange={v => set("stripeEnabled", v)} hint="Customers pay on Stripe's secure page; the money goes to your Stripe account." />
              {s.stripeEnabled && (
                <div className="space-y-3 rounded-lg bg-muted/20 p-3">
                  <TextField label={s.hasStripeSecret ? "Stripe secret key (saved — type to replace)" : "Stripe secret key"} type="password" value={draft.stripeSecret} onChange={v => patch({ stripeSecret: v })} placeholder={s.hasStripeSecret ? "••••••••" : "sk_live_…"} dir="ltr" hint="From Stripe → Developers → API keys. Use a restricted key with Checkout Sessions, Coupons and Refunds if you prefer." />
                  <TextField label={s.hasStripeWebhookSecret ? "Webhook signing secret (saved — type to replace)" : "Webhook signing secret"} type="password" value={draft.stripeWebhook} onChange={v => patch({ stripeWebhook: v })} placeholder={s.hasStripeWebhookSecret ? "••••••••" : "whsec_…"} dir="ltr" />
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Webhook address</p>
                    <CopyBox value={s.stripeWebhookUrl} />
                    <p className="text-xs text-muted-foreground">In Stripe → Developers → Webhooks, add this address and select <b>checkout.session.completed</b>, <b>checkout.session.expired</b> and <b>checkout.session.async_payment_succeeded</b> / <b>_failed</b>. Then paste its signing secret above. Without it, orders are still marked paid when the customer returns, but the webhook is the reliable way.</p>
                  </div>
                  {errors.stripesecretkey && <p className="text-xs text-destructive">{errors.stripesecretkey}</p>}
                </div>
              )}
            </div>
            <div className="space-y-3 border-t border-border pt-4">
              <ToggleField label="PayPal" checked={s.payPalEnabled} onChange={v => set("payPalEnabled", v)} />
              {s.payPalEnabled && (
                <div className="space-y-3 rounded-lg bg-muted/20 p-3">
                  <TextField label="Client ID" value={s.payPalClientId ?? ""} onChange={v => set("payPalClientId", v)} dir="ltr" />
                  <TextField label={s.hasPayPalSecret ? "Secret (saved — type to replace)" : "Secret"} type="password" value={draft.paypalSecret} onChange={v => patch({ paypalSecret: v })} placeholder={s.hasPayPalSecret ? "••••••••" : ""} dir="ltr" />
                  <ToggleField label="Test mode (sandbox)" checked={s.payPalSandbox} onChange={v => set("payPalSandbox", v)} hint="Turn off to take real payments, using your live credentials." />
                </div>
              )}
            </div>
          </Card>

          <Card className="p-5 space-y-4 h-fit">
            <h2 className="font-semibold">Tax & checkout</h2>
            <NumberField label="Tax rate (%)" value={s.taxPercent} onChange={v => set("taxPercent", v ?? 0)} min={0} max={100} step={0.01} hint="For example 5 for UAE VAT. 0 for no tax." />
            <ToggleField label="Prices already include tax" checked={s.pricesIncludeTax} onChange={v => set("pricesIncludeTax", v)} hint="On: the price on the product page is what the customer pays. Off: tax is added at checkout." />
            <ToggleField label="Allow checkout without an account" checked={s.allowGuestCheckout} onChange={v => set("allowGuestCheckout", v)} />
            <ToggleField label="Ask for a phone number" checked={s.requirePhone} onChange={v => set("requirePhone", v)} hint="Recommended for delivery." />
          </Card>
        </div>
      )}

      {tab === "delivery" && <DeliveryTab currency={s.currencyCode} />}

      {tab === "launch" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><Rocket className="h-4 w-4" />Open to the public</h2>
            <ul className="space-y-2">
              {checklist.map(c => (
                <li key={c.text} className="flex items-center gap-2 text-sm">{c.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <TriangleAlert className="h-4 w-4 text-amber-600" />}<span className={c.ok ? "" : "text-muted-foreground"}>{c.text}</span></li>
              ))}
            </ul>
            <ToggleField label={s.isPublished ? "Your store is open" : "Your store is closed"} checked={s.isPublished} onChange={v => set("isPublished", v)}
              hint={s.isPublished ? "Anyone with the link can shop." : "Only you can see it (use View store, which opens a private preview)."} />
            <p className="text-xs text-muted-foreground">Products appear once their listing is published online in Inventory → Online Listings.</p>
          </Card>
          <Card className="p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><Globe className="h-4 w-4" />Web address</h2>
            <TextField label="Store address" value={s.slug} onChange={v => set("slug", slugify(v))} dir="ltr" hint="Lower-case letters, numbers and hyphens." />
            {errors.slug && <p className="text-xs text-destructive">{errors.slug}</p>}
            <Field label="Your link"><CopyBox value={`${window.location.origin}/shop/${s.slug}`} /></Field>
            <div className="border-t border-border pt-4 space-y-3">
              <TextField label="Your own domain (optional)" value={s.customDomain ?? ""} onChange={v => set("customDomain", v.trim().toLowerCase() || null)} placeholder="shop.yourbrand.com" dir="ltr" />
              {errors.customdomain && <p className="text-xs text-destructive">{errors.customdomain}</p>}
              {s.customDomain && (
                <div className="rounded-lg bg-muted/30 p-3 text-xs space-y-1.5">
                  <p className="font-semibold">To use {s.customDomain}</p>
                  <ol className="list-decimal ms-4 space-y-1 text-muted-foreground">
                    <li>At your domain provider, add a <b>CNAME</b> record for <code>{s.customDomain}</code> pointing to <code>{window.location.hostname}</code> (or an <b>A</b> record to our server's address).</li>
                    <li>Tell support the domain so a secure certificate can be issued for it.</li>
                    <li>Once it opens your store, you are done.</li>
                  </ol>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
