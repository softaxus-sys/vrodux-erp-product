import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, Globe, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can, useCan } from "@/components/auth/can";
import { cn } from "@/lib/utils";
import { useTaxOptions } from "@/hooks/use-tax-options";
import { useInventoryCategories } from "@/hooks/inventory/use-inventory-categories";
import { useBrands } from "@/hooks/inventory/use-brands";
import {
  useAddListingVariants, useCreateListing, useDeleteListing, useListing, usePublishCheck,
  useRemoveListingVariant, useSetListingPublished, useUpdateListing, useUpdateListingVariant, useAddListingPhotos,
} from "@/hooks/inventory/use-listings";
import type { ListingContent, NewListingPhoto, ProductOption } from "@/lib/inventory/listings.api";
import { ListingPhotosEditor } from "./listing-photos";
import {
  ExistingProductPicker, ExistingVariantsTable, GenerateButton, MAX_VARIANTS, NewVariantsTable, OptionsEditor,
  blankRow, comboKey, missingCombos, toVariantInput, type NewVariantRow,
} from "./listing-variants";

const label = "text-xs font-semibold text-muted-foreground uppercase tracking-wide";
const select = "w-full h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";
const textarea = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";

const slugify = (s: string) =>
  s.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 120);

/** Options that are filled in. A half-filled one (a name with no values) is reported, not silently dropped. */
const usableOptions = (o: ProductOption[]) => o.filter(x => x.name.trim() && x.values.length > 0);

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div>
        <h3 className="text-sm font-bold">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function ListingEditor({ open, listingId, onClose }: {
  open: boolean; listingId: string | null; onClose: () => void;
}) {
  const { t } = useTranslation("inventory");
  const isEdit = !!listingId;
  const canCreate = useCan("inventory.stock.create");
  const canEditPerm = useCan("inventory.stock.edit");
  const canEdit = isEdit ? canEditPerm : canCreate;

  const { data: listing, isLoading } = useListing(open ? listingId : null);
  const { data: categories = [] } = useInventoryCategories({ isActive: true });
  const { data: brands = [] } = useBrands({ isActive: true });
  const tax = useTaxOptions();

  const create = useCreateListing();
  const update = useUpdateListing();
  const addVariants = useAddListingVariants();
  const updateVariant = useUpdateListingVariant();
  const removeVariant = useRemoveListingVariant();
  const setPublished = useSetListingPublished();
  const remove = useDeleteListing();
  const addPhotos = useAddListingPhotos();
  const { data: check } = usePublishCheck(open && isEdit ? listingId : null);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [name, setName] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [brandId, setBrandId] = React.useState("");
  const [shortDescription, setShort] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const slugTouched = React.useRef(false);
  const [seoTitle, setSeoTitle] = React.useState("");
  const [metaDescription, setMeta] = React.useState("");
  const [options, setOptions] = React.useState<ProductOption[]>([]);
  const [rows, setRows] = React.useState<NewVariantRow[]>([]);
  const [choices, setChoices] = React.useState<Record<string, Record<string, string>>>({});
  const [queued, setQueued] = React.useState<NewListingPhoto[]>([]);
  const [picking, setPicking] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  // Fresh form for a new listing; the saved values for an existing one.
  const loadedKey = React.useRef<string>("");
  React.useEffect(() => {
    if (!open) { loadedKey.current = ""; return; }
    if (!isEdit) {
      if (loadedKey.current === "new") return;
      loadedKey.current = "new";
      setName(""); setCategoryId(""); setBrandId(""); setShort(""); setDescription(""); setTags("");
      setSlug(""); slugTouched.current = false; setSeoTitle(""); setMeta("");
      setOptions([]); setRows([blankRow({})]); setChoices({}); setQueued([]); setPicking(false); setConfirmDelete(false);
      return;
    }
    if (!listing) return;
    const key = `${listing.id}:${listing.updatedAt ?? listing.createdAt}`;
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    setName(listing.name); setCategoryId(listing.categoryId); setBrandId(listing.brandId ?? "");
    setShort(listing.shortDescription ?? ""); setDescription(listing.description ?? ""); setTags(listing.tags ?? "");
    setSlug(listing.slug); slugTouched.current = true;
    setSeoTitle(listing.seoTitle ?? ""); setMeta(listing.metaDescription ?? "");
    setOptions(listing.options.map(o => ({ name: o.name, values: [...o.values] })));
    setRows([]); setChoices({}); setPicking(false); setConfirmDelete(false);
  }, [open, isEdit, listing]);

  React.useEffect(() => { if (!slugTouched.current) setSlug(slugify(name)); }, [name]);

  // ── Options / variants ─────────────────────────────────────────────────────
  const usable = usableOptions(options);
  const takenKeys = React.useMemo(
    () => new Set((listing?.variants ?? []).map(v => comboKey(choices[v.productId] ?? v.options))),
    [listing, choices]);

  /** Keep the new rows consistent with the options: drop rows whose choice was removed, snap spelling. */
  const changeOptions = (next: ProductOption[]) => {
    setOptions(next);
    const u = usableOptions(next);
    setRows(prev => {
      if (u.length === 0) return isEdit ? [] : [prev[0] ? { ...prev[0], options: {} } : blankRow({})];
      return prev
        .filter(r => u.every(o => o.values.some(v => v.toLowerCase() === (r.options[o.name.trim()] ?? "").toLowerCase())))
        .map(r => ({
          ...r, options: Object.fromEntries(u.map(o => [o.name.trim(),
            o.values.find(v => v.toLowerCase() === (r.options[o.name.trim()] ?? "").toLowerCase())!])),
        }));
    });
  };

  const pending = missingCombos(usable, takenKeys, rows);
  const totalVariants = (listing?.variants.length ?? 0) + rows.length;
  const generate = () => {
    if (rows.length + (listing?.variants.length ?? 0) + pending.length > MAX_VARIANTS) {
      toast.error(t("listings.variants.tooMany", { max: MAX_VARIANTS })); return;
    }
    // A fresh listing starts with one blank row; the generated combinations replace it.
    setRows(prev => [...(usable.length > 0 ? prev.filter(r => Object.keys(r.options).length > 0) : prev), ...pending]);
  };

  const pickExisting = (p: { id: string; name: string; salePrice: number; stockQuantity: number }) => {
    const first = Object.fromEntries(usable.map(o => [o.name.trim(), o.values[0]]));
    const row: NewVariantRow = {
      ...blankRow(first), existingProductId: p.id, existingName: p.name, existingPrice: p.salePrice, existingStock: p.stockQuantity,
    };
    // Without options the listing has one variant, so the product replaces the blank starter row.
    setRows(prev => usable.length === 0 ? [row] : [...prev, row]);
    setPicking(false);
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const problems = (): string | null => {
    if (!name.trim()) return t("listings.errors.name");
    if (!categoryId) return t("listings.errors.category");
    const half = options.find(o => (o.name.trim() && o.values.length === 0) || (!o.name.trim() && o.values.length > 0));
    if (half) return half.name.trim() ? t("listings.errors.optionValues", { name: half.name }) : t("listings.errors.optionName");
    if (!isEdit && rows.length === 0) return t("listings.errors.noVariants");
    if (usable.length === 0 && rows.length + (listing?.variants.length ?? 0) > 1) return t("listings.errors.singleVariant");
    if (isEdit) {
      const missing = listing!.variants.find(v => usable.some(o => !(choices[v.productId]?.[o.name.trim()] ?? v.options[o.name.trim()])));
      if (missing) return t("listings.errors.pickChoice", { name: missing.name });
    }
    return null;
  };

  const content = (): ListingContent => ({
    name: name.trim(), description: description.trim() || null, shortDescription: shortDescription.trim() || null,
    categoryId, brandId: brandId || null,
    slug: slug.trim() || null,
    seoTitle: seoTitle.trim() || null, metaDescription: metaDescription.trim() || null, tags: tags.trim() || null,
  });
  const cleanOptions = () => usable.map(o => ({ name: o.name.trim(), values: o.values }));

  const save = async () => {
    const bad = problems();
    if (bad) { toast.error(bad); return; }
    try {
      if (!isEdit) {
        const made = await create.mutateAsync({
          content: content(), options: cleanOptions(), variants: rows.map(r => toVariantInput(r, Number(tax.standard) || 0)),
        });
        if (queued.length > 0) {
          try { await addPhotos.mutateAsync({ id: made.id, images: queued }); }
          catch { toast.error(t("listings.photos.savedWithoutPhotos")); }
        }
        onClose();
        return;
      }
      const l = listing!;
      await update.mutateAsync({
        id: l.id, content: content(), options: cleanOptions(),
        variantChoices: l.variants.map(v => ({
          productId: v.productId,
          options: Object.fromEntries(usable.map(o => [o.name.trim(), choices[v.productId]?.[o.name.trim()] ?? v.options[o.name.trim()] ?? ""])),
        })),
      });
      if (rows.length > 0) await addVariants.mutateAsync({ id: l.id, variants: rows.map(r => toVariantInput(r, Number(tax.standard) || 0)) });
      setRows([]); setChoices({});
    } catch { /* the mutation hooks already toasted the server's message */ }
  };

  const saving = create.isPending || update.isPending || addVariants.isPending || addPhotos.isPending;
  const isPublished = !!listing?.publishedOnline;
  const busy = updateVariant.isPending || removeVariant.isPending;

  const catOptions = categories.filter(c => !c.parentId).flatMap(c => [
    { id: c.id, label: c.name },
    ...categories.filter(s => s.parentId === c.id).map(s => ({ id: s.id, label: `↳ ${s.name}` })),
  ]);

  const seoPreviewTitle = seoTitle.trim() || name.trim() || t("listings.seo.untitled");
  const seoPreviewDesc = metaDescription.trim() || shortDescription.trim() || description.trim().slice(0, 160) || t("listings.seo.noDescription");

  if (!open) return null;
  return createPortal(
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[70] flex" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <motion.aside
          initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
          className="relative ms-auto h-full w-full max-w-4xl bg-background shadow-2xl flex flex-col">
          {/* Header */}
          <header className="flex items-center gap-3 px-5 py-4 border-b border-border">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold truncate">{isEdit ? (listing?.name ?? t("listings.loading")) : t("listings.newTitle")}</h2>
              <p className="text-xs text-muted-foreground">{isEdit ? `/products/${listing?.slug ?? ""}` : t("listings.newHint")}</p>
            </div>
            {isEdit && listing && (
              <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold",
                isPublished ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                {isPublished ? t("listings.status.published") : t("listings.status.draft")}
              </span>
            )}
            <button type="button" onClick={onClose} aria-label={t("listings.close")}
              className="h-9 w-9 rounded-lg hover:bg-muted flex items-center justify-center"><X className="h-5 w-5" /></button>
          </header>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {isEdit && isLoading && <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}

            {(!isEdit || listing) && (
              <>
                {/* Basics */}
                <Section title={t("listings.basics.title")}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className={label}>{t("listings.basics.name")}</label>
                      <Input value={name} onChange={e => setName(e.target.value)} maxLength={200} disabled={!canEdit}
                        placeholder={t("listings.basics.namePlaceholder")} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className={label}>{t("listings.basics.category")}</label>
                      <select value={categoryId} onChange={e => setCategoryId(e.target.value)} disabled={!canEdit} className={select}>
                        <option value="">{t("listings.basics.selectCategory")}</option>
                        {catOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className={label}>{t("listings.basics.brand")}</label>
                      <select value={brandId} onChange={e => setBrandId(e.target.value)} disabled={!canEdit} className={select}>
                        <option value="">{t("listings.basics.none")}</option>
                        {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className={label}>{t("listings.basics.short")}</label>
                      <Input value={shortDescription} onChange={e => setShort(e.target.value)} maxLength={500} disabled={!canEdit}
                        placeholder={t("listings.basics.shortPlaceholder")} className="h-9 text-sm" />
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className={label}>{t("listings.basics.description")}</label>
                      <textarea value={description} onChange={e => setDescription(e.target.value)} rows={5} disabled={!canEdit}
                        placeholder={t("listings.basics.descriptionPlaceholder")} className={cn(textarea, "resize-y")} />
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className={label}>{t("listings.basics.tags")}</label>
                      <Input value={tags} onChange={e => setTags(e.target.value)} maxLength={500} disabled={!canEdit}
                        placeholder={t("listings.basics.tagsPlaceholder")} className="h-9 text-sm" />
                    </div>
                  </div>
                </Section>

                {/* Photos */}
                <Section title={t("listings.photos.title")}>
                  <ListingPhotosEditor listingId={listingId} images={listing?.images ?? []} variants={listing?.variants ?? []}
                    queued={queued} onQueuedChange={setQueued} canEdit={canEdit} />
                </Section>

                {/* Options */}
                <Section title={t("listings.options.title")} hint={t("listings.options.hint")}>
                  <OptionsEditor options={options} onChange={changeOptions} disabled={!canEdit} />
                </Section>

                {/* Variants */}
                <Section title={t("listings.variants.title")}
                  hint={usable.length === 0 ? t("listings.variants.hintSingle") : t("listings.variants.hintMany")}>
                  {isEdit && listing && listing.variants.length > 0 && (
                    <ExistingVariantsTable variants={listing.variants} options={usable} choices={choices} busy={busy} canEdit={canEdit}
                      onChoice={(pid, opt, val) => setChoices(c => ({ ...c, [pid]: { ...(c[pid] ?? {}), [opt]: val } }))}
                      onSave={(v, p) => updateVariant.mutate({ id: listing.id, productId: v.productId, options: v.options, ...p,
                        lengthCm: v.lengthCm, widthCm: v.widthCm, heightCm: v.heightCm })}
                      onRemove={v => removeVariant.mutate({ id: listing.id, productId: v.productId })} />
                  )}

                  {canEdit && (
                    <>
                      <NewVariantsTable rows={rows} options={usable} onChange={setRows} minimal={usable.length === 0} />
                      <div className="flex flex-wrap items-center gap-2">
                        {usable.length > 0 && <GenerateButton count={pending.length} onClick={generate} />}
                        {(usable.length > 0 || totalVariants === 0) && (
                          <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8"
                            onClick={() => setRows(r => [...r, blankRow(Object.fromEntries(usable.map(o => [o.name.trim(), o.values[0]])))])}>
                            <Plus className="h-3.5 w-3.5" />{t("listings.variants.addNew")}
                          </Button>
                        )}
                        {(usable.length > 0 || totalVariants === 0 || (!isEdit && totalVariants === 1 && !rows[0]?.existingProductId)) && (
                          <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => setPicking(p => !p)}>
                            <Plus className="h-3.5 w-3.5" />{t("listings.variants.addExisting")}
                          </Button>
                        )}
                      </div>
                      {picking && (
                        <ExistingProductPicker onPick={pickExisting} onClose={() => setPicking(false)}
                          excludeIds={new Set([...(listing?.variants ?? []).map(v => v.productId), ...rows.flatMap(r => r.existingProductId ? [r.existingProductId] : [])])} />
                      )}
                    </>
                  )}
                </Section>

                {/* SEO */}
                <Section title={t("listings.seo.title")} hint={t("listings.seo.hint")}>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1.5">
                      <label className={label}>{t("listings.seo.slug")}</label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground shrink-0" dir="ltr">/products/</span>
                        <Input value={slug} disabled={!canEdit} dir="ltr"
                          onChange={e => { slugTouched.current = true; setSlug(slugify(e.target.value)); }}
                          className="h-9 text-sm font-mono" />
                      </div>
                      {isEdit && <p className="text-[11px] text-muted-foreground">{t("listings.seo.slugNote")}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className={label}>{t("listings.seo.seoTitle")} <span className="normal-case font-normal">({seoTitle.length}/60)</span></label>
                      <Input value={seoTitle} onChange={e => setSeoTitle(e.target.value)} maxLength={200} disabled={!canEdit} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className={label}>{t("listings.seo.meta")} <span className="normal-case font-normal">({metaDescription.length}/160)</span></label>
                      <textarea value={metaDescription} onChange={e => setMeta(e.target.value)} maxLength={320} rows={2} disabled={!canEdit}
                        className={cn(textarea, "resize-none")} />
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3" dir="ltr">
                      <p className="text-[11px] text-muted-foreground mb-1">{t("listings.seo.preview")}</p>
                      <p className="text-base text-blue-700 dark:text-blue-400 truncate">{seoPreviewTitle}</p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 truncate">yourstore.com › products › {slug || "…"}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{seoPreviewDesc}</p>
                    </div>
                  </div>
                </Section>

                {/* Publishing */}
                {isEdit && listing && (
                  <Section title={t("listings.publish.title")} hint={t("listings.publish.hint")}>
                    {check && !check.ready && !isPublished && (
                      <ul className="space-y-1">
                        {check.problems.map(p => (
                          <li key={p} className="flex items-start gap-2 text-xs text-warning"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{p}</li>
                        ))}
                      </ul>
                    )}
                    {check?.ready && !isPublished && (
                      <p className="flex items-center gap-2 text-xs text-success"><CheckCircle2 className="h-3.5 w-3.5" />{t("listings.publish.ready")}</p>
                    )}
                    {isPublished && (
                      <p className="flex items-center gap-2 text-xs text-success"><Globe className="h-3.5 w-3.5" />{t("listings.publish.live")}</p>
                    )}
                    <Can permission="inventory.stock.edit">
                      <Button type="button" variant={isPublished ? "outline" : "default"} size="sm" className="gap-1.5"
                        disabled={setPublished.isPending || (!isPublished && !check?.ready)}
                        onClick={() => setPublished.mutate({ id: listing.id, published: !isPublished }, {
                          onSuccess: () => toast.success(isPublished ? t("listings.publish.unpublished") : t("listings.publish.published")),
                        })}>
                        {setPublished.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                        {isPublished ? t("listings.publish.unpublish") : t("listings.publish.publish")}
                      </Button>
                    </Can>
                    <p className="text-[11px] text-muted-foreground">{t("listings.publish.channelsNote")}</p>
                  </Section>
                )}

                {/* Danger */}
                {isEdit && listing && (
                  <Can permission="inventory.stock.delete">
                    <div className="rounded-xl border border-destructive/30 p-4">
                      {!confirmDelete ? (
                        <button type="button" onClick={() => setConfirmDelete(true)}
                          className="text-sm font-semibold text-destructive flex items-center gap-2"><Trash2 className="h-4 w-4" />{t("listings.delete.action")}</button>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm">{t("listings.delete.confirm")}</p>
                          <div className="flex gap-2">
                            <Button type="button" variant="destructive" size="sm" disabled={remove.isPending}
                              onClick={() => remove.mutate(listing.id, { onSuccess: onClose })}>
                              {remove.isPending && <Loader2 className="h-4 w-4 animate-spin me-1" />}{t("listings.delete.yes")}
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>{t("listings.cancel")}</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </Can>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {canEdit && (!isEdit || listing) && (
            <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
              <Button type="button" variant="outline" onClick={onClose}>{t("listings.cancel")}</Button>
              <Button type="button" onClick={save} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isEdit ? t("listings.save") : t("listings.create")}
              </Button>
            </footer>
          )}
        </motion.aside>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
