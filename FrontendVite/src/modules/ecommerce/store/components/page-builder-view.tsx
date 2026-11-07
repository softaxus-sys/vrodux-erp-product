import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Copy, ExternalLink, FileText, Home, Loader2, Monitor, Plus, ScrollText, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/auth/can";
import { cn } from "@/lib/utils";
import { StoreProvider } from "@/modules/storefront/store-context";
import { SectionRenderer } from "@/modules/storefront/sections";
import { parseJson, type Section } from "@/lib/storefront/shop.api";
import { useDeletePage, usePage, usePages, useSavePage, useStoreSettings } from "@/hooks/ecommerce/use-store";
import type { PageSummary } from "@/lib/ecommerce/store.api";
import { ConfirmDialog, Field, Modal, PageHeader, Pill } from "../../shared/ui";
import { SECTION_BY_TYPE, SECTION_DEFS } from "./section-defs";
import { TextAreaField, TextField, ToggleField } from "./builder-fields";
import { SetupStore } from "./store-settings-view";

const newId = () => Math.random().toString(36).slice(2, 12);
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const KIND_ICON = { home: Home, page: FileText, policy: ScrollText } as const;

// ── Add a section ────────────────────────────────────────────────────────────

function AddSection({ onAdd, onClose }: { onAdd: (type: string) => void; onClose: () => void }) {
  return (
    <Modal title="Add a section" subtitle="Pick a building block for your page." onClose={onClose} size="lg">
      <div className="grid gap-2 sm:grid-cols-2">
        {SECTION_DEFS.map(d => (
          <button key={d.type} type="button" onClick={() => onAdd(d.type)} className="flex items-start gap-3 rounded-lg border border-border p-3 text-start hover:border-primary hover:bg-primary/5 transition-colors">
            <d.icon className="h-5 w-5 mt-0.5 text-primary shrink-0" />
            <span><span className="block text-sm font-semibold">{d.label}</span><span className="block text-xs text-muted-foreground">{d.description}</span></span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function NewPageDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const save = useSavePage();
  const [title, setTitle] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [kind, setKind] = React.useState<"page" | "policy">("page");
  return (
    <Modal title="New page" subtitle="Pages like About, Delivery or a promotion." onClose={onClose} size="sm"
      footer={<>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" disabled={!title.trim() || !slug || save.isPending} className="gap-1.5"
          onClick={async () => {
            try {
              const p = await save.mutateAsync({ id: null, body: { slug, title: title.trim(), kind, isPublished: true, sectionsJson: JSON.stringify([{ id: newId(), type: "rich_text", settings: { heading: title.trim(), body: "Write something here.", align: "start" } }]), seoTitle: null, metaDescription: null } });
              onCreated(p.id);
            } catch { /* toast shown */ }
          }}>{save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Create</Button>
      </>}>
      <TextField label="Page title" value={title} onChange={v => { setTitle(v); if (!touched) setSlug(slugify(v)); }} />
      <TextField label="Web address" value={slug} onChange={v => { setTouched(true); setSlug(slugify(v)); }} dir="ltr" hint={`Shown as /pages/${slug || "…"}`} />
      <Field label="Type">
        <select className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm" value={kind} onChange={e => setKind(e.target.value as "page" | "policy")}>
          <option value="page">Page</option><option value="policy">Policy (delivery, returns, privacy…)</option>
        </select>
      </Field>
    </Modal>
  );
}

// ── The builder for one page ─────────────────────────────────────────────────

function Builder({ pageId, slug, onDeleted }: { pageId: string; slug: string; onDeleted: () => void }) {
  const q = usePage(pageId);
  const save = useSavePage();
  const del = useDeletePage();
  const [title, setTitle] = React.useState("");
  const [pageSlug, setPageSlug] = React.useState("");
  const [published, setPublished] = React.useState(true);
  const [seoTitle, setSeoTitle] = React.useState("");
  const [meta, setMeta] = React.useState("");
  const [sections, setSections] = React.useState<Section[]>([]);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [device, setDevice] = React.useState<"desktop" | "mobile">("desktop");

  const loaded = q.data;
  React.useEffect(() => {
    if (!loaded) return;
    setTitle(loaded.title); setPageSlug(loaded.slug); setPublished(loaded.isPublished); setSeoTitle(loaded.seoTitle ?? ""); setMeta(loaded.metaDescription ?? "");
    const parsed = parseJson<Section[]>(loaded.sectionsJson, []);
    setSections(parsed); setSelected(parsed[0]?.id ?? null); setDirty(false);
  }, [loaded?.id, loaded?.sectionsJson]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving with unsaved edits is the easiest way to lose an hour's work.
  React.useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  if (q.isLoading || !loaded) return <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>;
  const isHome = loaded.kind === "home";
  const touch = () => setDirty(true);
  const update = (id: string, fn: (s: Section) => Section) => { setSections(p => p.map(s => (s.id === id ? fn(s) : s))); touch(); };
  const move = (i: number, d: -1 | 1) => { setSections(p => { const n = [...p]; const j = i + d; if (j < 0 || j >= n.length) return p; [n[i], n[j]] = [n[j], n[i]]; return n; }); touch(); };
  const current = sections.find(s => s.id === selected) ?? null;
  const def = current ? SECTION_BY_TYPE[current.type] : null;

  const doSave = async () => {
    try {
      await save.mutateAsync({ id: pageId, body: { slug: pageSlug, title: title.trim(), kind: loaded.kind, isPublished: isHome || published, sectionsJson: JSON.stringify(sections), seoTitle: seoTitle.trim() || null, metaDescription: meta.trim() || null } });
      setDirty(false);
    } catch { /* toast shown */ }
  };

  const previewUrl = `/shop/${slug}/${isHome ? "" : `pages/${pageSlug}`}?preview=1`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold mr-auto truncate">{title || "Untitled"}{dirty && <span className="ms-2 text-xs font-medium text-amber-600">Unsaved changes</span>}</h2>
        <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-input text-sm hover:bg-muted/40"><ExternalLink className="h-4 w-4" />Open page</a>
        <Can permission="ecommerce.store.edit">
          {!isHome && <Button variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" />Delete</Button>}
          <Button size="sm" disabled={!dirty || save.isPending} onClick={doSave} className="gap-1.5">{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Save page</Button>
        </Can>
      </div>

      <div className="grid gap-4 xl:grid-cols-[400px_1fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <TextField label="Page title" value={title} onChange={v => { setTitle(v); touch(); }} />
            {!isHome && <TextField label="Web address" value={pageSlug} onChange={v => { setPageSlug(slugify(v)); touch(); }} dir="ltr" hint={`/pages/${pageSlug}`} />}
            {!isHome && <ToggleField label="Visible to customers" checked={published} onChange={v => { setPublished(v); touch(); }} />}
            <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Search engine details</summary>
              <div className="mt-3 space-y-3">
                <TextField label="Title for Google" value={seoTitle} onChange={v => { setSeoTitle(v); touch(); }} maxLength={120} />
                <TextAreaField label="Description for Google" rows={3} value={meta} onChange={v => { setMeta(v); touch(); }} />
              </div>
            </details>
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold">Sections</p>
              <Can permission="ecommerce.store.edit"><Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" />Add</Button></Can>
            </div>
            {sections.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">This page is empty. Add a section to start.</p>}
            <ul className="divide-y divide-border">
              {sections.map((s, i) => {
                const d = SECTION_BY_TYPE[s.type];
                const label = String((s.settings?.heading as string) || (s.settings?.text as string) || d?.label || s.type);
                return (
                  <li key={s.id} className={cn("flex items-center gap-2 px-3 py-2", selected === s.id && "bg-primary/5")}>
                    <button className="flex items-center gap-2 min-w-0 flex-1 text-start" onClick={() => setSelected(s.id)}>
                      {d && <d.icon className="h-4 w-4 text-primary shrink-0" />}
                      <span className="min-w-0"><span className="block text-sm font-medium truncate">{label}</span><span className="block text-[11px] text-muted-foreground">{d?.label ?? s.type}</span></span>
                    </button>
                    <Can permission="ecommerce.store.edit">
                      <div className="flex shrink-0">
                        <button className="p-1.5 rounded hover:bg-muted disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button className="p-1.5 rounded hover:bg-muted disabled:opacity-30" disabled={i === sections.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                        <button className="p-1.5 rounded hover:bg-muted" aria-label="Duplicate" onClick={() => { const c = { ...s, id: newId(), settings: JSON.parse(JSON.stringify(s.settings)) }; setSections(p => [...p.slice(0, i + 1), c, ...p.slice(i + 1)]); setSelected(c.id); touch(); }}><Copy className="h-3.5 w-3.5" /></button>
                        <button className="p-1.5 rounded hover:bg-muted text-destructive" aria-label="Remove" onClick={() => { setSections(p => p.filter(x => x.id !== s.id)); if (selected === s.id) setSelected(null); touch(); }}><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </Can>
                  </li>
                );
              })}
            </ul>
          </div>

          {current && def && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2"><def.icon className="h-4 w-4 text-primary" />{def.label}</p>
              <def.Editor s={current.settings ?? {}} slug={slug} set={(k, v) => update(current.id, s => ({ ...s, settings: { ...s.settings, [k]: v } }))} />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-muted/20 overflow-hidden xl:sticky xl:top-4 xl:self-start">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Live preview</p>
            <div className="flex gap-1">
              <button className={cn("p-1.5 rounded", device === "desktop" && "bg-muted")} onClick={() => setDevice("desktop")} aria-label="Desktop"><Monitor className="h-4 w-4" /></button>
              <button className={cn("p-1.5 rounded", device === "mobile" && "bg-muted")} onClick={() => setDevice("mobile")} aria-label="Phone"><Smartphone className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="overflow-auto max-h-[75vh] p-3">
            <div className={cn("mx-auto bg-white shadow-sm overflow-hidden", device === "mobile" ? "w-[375px]" : "w-full")}>
              <StoreProvider slug={slug} basePath="" embedded>
                {sections.length === 0 ? <p className="p-10 text-center text-sm text-slate-400">Nothing here yet.</p> : <SectionRenderer sections={sections} />}
              </StoreProvider>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {adding && <AddSection onClose={() => setAdding(false)} onAdd={type => {
          const d = SECTION_BY_TYPE[type];
          const sec: Section = { id: newId(), type, settings: d.defaults() };
          setSections(p => [...p, sec]); setSelected(sec.id); setAdding(false); touch();
        }} />}
        {confirmDelete && <ConfirmDialog title={`Delete “${title}”?`} body={<p>The page is removed from your store. This cannot be undone.</p>} confirmLabel="Delete" pending={del.isPending}
          onClose={() => setConfirmDelete(false)} onConfirm={async () => { try { await del.mutateAsync(pageId); setConfirmDelete(false); onDeleted(); } catch { /* toast shown */ } }} />}
      </AnimatePresence>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function PageBuilderView() {
  const store = useStoreSettings();
  const pages = usePages();
  const [selected, setSelected] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => { if (!selected && pages.data?.length) setSelected(pages.data[0].id); }, [pages.data, selected]);

  if (store.isLoading) return <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!store.data) return <SetupStore />;

  const list: PageSummary[] = pages.data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader title="Pages & design" description="Build your home page and other pages from simple sections. What you see on the right is what customers see.">
        <Can permission="ecommerce.store.edit"><Button className="gap-1.5" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New page</Button></Can>
      </PageHeader>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {list.map(p => {
          const Icon = KIND_ICON[p.kind] ?? FileText;
          return (
            <button key={p.id} onClick={() => setSelected(p.id)} className={cn("inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm whitespace-nowrap", selected === p.id ? "border-primary bg-primary/10 font-semibold" : "border-border hover:bg-muted/40")}>
              <Icon className="h-3.5 w-3.5" />{p.title}{!p.isPublished && <Pill meta={{ color: "text-amber-800", bg: "bg-amber-100" }}>Hidden</Pill>}
            </button>
          );
        })}
      </div>

      {selected ? <Builder key={selected} pageId={selected} slug={store.data.slug} onDeleted={() => setSelected(null)} />
        : <p className="p-12 text-center text-sm text-muted-foreground">Choose a page.</p>}

      <AnimatePresence>
        {creating && <NewPageDialog onClose={() => setCreating(false)} onCreated={id => { setCreating(false); setSelected(id); toast.success("Page created."); }} />}
      </AnimatePresence>
    </div>
  );
}
