import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { Layers, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Can } from "@/components/auth/can";
import { shopApi } from "@/lib/storefront/shop.api";
import { ecommerceApi } from "@/lib/ecommerce/ecommerce.api";
import { useCollections, useDeleteCollection, useSaveCollection, useStoreSettings } from "@/hooks/ecommerce/use-store";
import type { CollectionDto } from "@/lib/ecommerce/store.api";
import { ConfirmDialog, Modal, PageHeader, Pill, TableState, useDebounced } from "../../shared/ui";
import { ImageField, SelectField, TextAreaField, TextField, ToggleField } from "./builder-fields";
import { SetupStore } from "./store-settings-view";

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

function CollectionDialog({ slug, collection, onClose }: { slug: string; collection: CollectionDto | null; onClose: () => void }) {
  const save = useSaveCollection();
  const [name, setName] = React.useState(collection?.name ?? "");
  const [cslug, setCslug] = React.useState(collection?.slug ?? "");
  const [touched, setTouched] = React.useState(!!collection);
  const [desc, setDesc] = React.useState(collection?.description ?? "");
  const [image, setImage] = React.useState<string | null>(collection?.imageAssetId ?? null);
  const [published, setPublished] = React.useState(collection?.isPublished ?? true);
  const [mode, setMode] = React.useState<"hand" | "category">(collection?.categoryName ? "category" : "hand");
  const [category, setCategory] = React.useState(collection?.categoryName ?? "");
  const [picked, setPicked] = React.useState<{ id: string; name: string }[]>([]);
  const [ids, setIds] = React.useState<string[]>(collection?.templateIds ?? []);
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search);

  const cats = useQuery({ queryKey: ["shop", slug, "categories"], queryFn: () => shopApi.categories(slug), retry: false, staleTime: 60_000 });
  const found = useQuery({ queryKey: ["ecommerce", "templates", q], queryFn: () => ecommerceApi.templates(q), enabled: mode === "hand" });
  // Names of products already in the collection (so they can be shown and removed).
  const existing = useQuery({ queryKey: ["ecommerce", "templates", ""], queryFn: () => ecommerceApi.templates(""), enabled: ids.length > 0 && mode === "hand" });
  const nameOf = (id: string) => picked.find(p => p.id === id)?.name ?? existing.data?.find(t => t.id === id)?.name ?? found.data?.find(t => t.id === id)?.name ?? id.slice(0, 8);

  return (
    <Modal title={collection ? "Edit collection" : "New collection"} subtitle="A group of products customers can browse together." onClose={onClose} size="lg"
      footer={<>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" className="gap-1.5" disabled={!name.trim() || !cslug || save.isPending || (mode === "category" && !category)}
          onClick={async () => {
            try {
              await save.mutateAsync({ id: collection?.id ?? null, body: { name: name.trim(), slug: cslug, description: desc.trim() || null, imageAssetId: image, templateIds: mode === "hand" ? ids : [], categoryName: mode === "category" ? category : null, isPublished: published, sortOrder: collection?.sortOrder ?? 0 } });
              onClose();
            } catch { /* toast shown */ }
          }}>{save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Save</Button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Name" value={name} onChange={v => { setName(v); if (!touched) setCslug(slugify(v)); }} />
        <TextField label="Web address" value={cslug} onChange={v => { setTouched(true); setCslug(slugify(v)); }} dir="ltr" hint={`/collections/${cslug || "…"}`} />
      </div>
      <TextAreaField label="Description" rows={2} value={desc} onChange={setDesc} />
      <ImageField label="Picture" slug={slug} value={image} onChange={setImage} />
      <ToggleField label="Visible to customers" checked={published} onChange={setPublished} />

      <SelectField label="Which products" value={mode} onChange={v => setMode(v as "hand" | "category")} options={[{ value: "hand", label: "Products I pick" }, { value: "category", label: "Everything in a category" }]} />
      {mode === "category" ? (
        <SelectField label="Category" value={category} onChange={setCategory} hint="New products in this category join automatically."
          options={[{ value: "", label: "Choose…" }, ...(cats.data ?? []).map(c => ({ value: c.name, label: `${c.name} (${c.count})` }))]} />
      ) : (
        <div className="space-y-3">
          {ids.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {ids.map(id => <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium">{nameOf(id)}<button type="button" onClick={() => setIds(p => p.filter(x => x !== id))} aria-label="Remove"><X className="h-3 w-3" /></button></span>)}
            </div>
          )}
          <div className="relative"><Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input className="h-9 w-full rounded-md border border-input bg-card ps-9 pe-3 text-sm" placeholder="Search your listings to add" value={search} onChange={e => setSearch(e.target.value)} /></div>
          <div className="max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-border">
            {(found.data ?? []).filter(t => t.publishedOnline && t.isActive).map(t => (
              <button key={t.id} type="button" disabled={ids.includes(t.id)} className="flex w-full items-center justify-between px-3 py-2 text-sm text-start hover:bg-muted/30 disabled:opacity-50"
                onClick={() => { setIds(p => [...p, t.id]); setPicked(p => [...p, { id: t.id, name: t.name }]); }}>
                <span className="truncate">{t.name}</span><span className="text-xs text-muted-foreground">{ids.includes(t.id) ? "Added" : "Add"}</span>
              </button>
            ))}
            {(found.data ?? []).filter(t => t.publishedOnline && t.isActive).length === 0 && <p className="p-4 text-xs text-muted-foreground text-center">No published listings found. Publish them in Inventory → Online Listings first.</p>}
          </div>
        </div>
      )}
    </Modal>
  );
}

export function CollectionsView() {
  const store = useStoreSettings();
  const q = useCollections();
  const del = useDeleteCollection();
  const [editing, setEditing] = React.useState<CollectionDto | "new" | null>(null);
  const [removing, setRemoving] = React.useState<CollectionDto | null>(null);

  if (store.isLoading) return <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!store.data) return <SetupStore />;
  const rows = q.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Collections" description="Group products — a season, a brand, a category — so customers can browse them together.">
        <Can permission="ecommerce.store.edit"><Button className="gap-1.5" onClick={() => setEditing("new")}><Plus className="h-4 w-4" />New collection</Button></Can>
      </PageHeader>
      <Card className="overflow-hidden">
        <TableState loading={q.isLoading} error={q.error as Error | null} empty={rows.length === 0} emptyText="No collections yet." icon={Layers} />
        <div className="divide-y divide-border">
          {rows.map(c => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm">{c.name} {!c.isPublished && <Pill meta={{ color: "text-slate-700", bg: "bg-slate-200" }}>Hidden</Pill>}</p>
                <p className="text-xs text-muted-foreground">/collections/{c.slug} · {c.categoryName ? `Category: ${c.categoryName}` : `${c.templateIds.length} product${c.templateIds.length === 1 ? "" : "s"}`}</p>
              </div>
              <Can permission="ecommerce.store.edit">
                <Button size="sm" variant="outline" onClick={() => setEditing(c)}>Edit</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRemoving(c)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
              </Can>
            </div>
          ))}
        </div>
      </Card>
      <AnimatePresence>
        {editing && <CollectionDialog slug={store.data.slug} collection={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
        {removing && <ConfirmDialog title={`Delete “${removing.name}”?`} body={<p>The products stay in your store; only the grouping is removed.</p>} confirmLabel="Delete" pending={del.isPending}
          onClose={() => setRemoving(null)} onConfirm={async () => { try { await del.mutateAsync(removing.id); setRemoving(null); } catch { /* toast shown */ } }} />}
      </AnimatePresence>
    </div>
  );
}
