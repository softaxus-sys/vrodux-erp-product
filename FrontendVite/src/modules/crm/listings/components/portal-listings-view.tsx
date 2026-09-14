import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Home, Plus, Search, Loader2, Pencil, Trash2, ExternalLink, X, CheckCircle2, Info, UploadCloud,
} from "lucide-react";
import { ImportListingsModal } from "./import-listings-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useLazyList } from "@/hooks/use-lazy-list";
import {
  useAssignableByTeam, encodeAssignee, decodeAssignee, useDefaultAssignee,
} from "@/hooks/identity/use-assignable-by-team";
import {
  usePortalListings, useCreatePortalListing, useUpdatePortalListing, useDeletePortalListing,
} from "@/hooks/crm/use-portal-listings";
import {
  LISTING_PORTALS, portalLabel, listingIdFromUrl,
} from "@/lib/crm/portal-listings.api";
import type { ListingPortal, PortalListingDto } from "@/lib/crm/portal-listings.api";

/**
 * My Listings — every agent registers the portal listings they publish.
 *
 * A Bayut WhatsApp lead carries the listing (reference + URL) and nothing about the agent. Registering
 * the listing here is what lets that lead land with the agent who published it, instead of in a
 * shared pool. Agents see their own listings; team leads their team's; full CRM access everyone's.
 */
export function PortalListingsView() {
  const hasRawPermission = useAuthStore(s => s.hasRawPermission);
  const canSeeOthers = hasRawPermission("crm.leads.view") || hasRawPermission("crm.leads-team.view");
  const canManage = ["crm.leads.create", "crm.leads.edit", "crm.leads-team.edit", "crm.leads-assigned.edit"]
    .some(k => hasRawPermission(k));

  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [portal, setPortal] = React.useState("");
  const [mine, setMine] = React.useState(false);
  const [editing, setEditing] = React.useState<PortalListingDto | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<PortalListingDto | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);

  React.useEffect(() => {
    const h = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(h);
  }, [search]);

  const { data: listings = [], isLoading } = usePortalListings({
    search: debounced || undefined, portal: portal || undefined, mine,
  });
  const remove = useDeletePortalListing();
  const { visible, hasMore, loadMore, sentinelRef, shown, total } = useLazyList(listings, 30);

  const active = listings.filter(l => l.isActive).length;
  const enquiries = listings.reduce((s, l) => s + l.enquiryCount, 0);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (l: PortalListingDto) => { setEditing(l); setFormOpen(true); };

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Home className="h-5 w-5 text-primary" />
            {canSeeOthers ? "Portal Listings" : "My Listings"}
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Register every listing you publish on Bayut, Property Finder or Dubizzle. Portal leads
            only say which listing the enquiry is about — this is how they reach you.
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-1.5">
              <UploadCloud className="h-4 w-4" /> Import
            </Button>
            <Button onClick={openCreate} className="gap-1.5">
              <Plus className="h-4 w-4" /> Add Listing
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-xl">
        <Stat label="Listings" value={listings.length} />
        <Stat label="Active" value={active} />
        <Stat label="Enquiries routed" value={enquiries} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search reference, listing id, title or agent…" className="ps-9 h-9 text-sm" />
        </div>
        <select value={portal} onChange={e => setPortal(e.target.value)}
          className="h-9 text-sm rounded-md border border-border bg-card px-2">
          <option value="">All portals</option>
          {LISTING_PORTALS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        {canSeeOthers && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} />
            Only mine
          </label>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : listings.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-14 text-center space-y-3">
          <Home className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            {debounced || portal ? "No listings match those filters." : "No listings registered yet."}
          </p>
          {canManage && !debounced && !portal && (
            <Button size="sm" variant="outline" onClick={openCreate} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Register your first listing
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-start font-semibold">Listing</th>
                  <th className="px-4 py-2.5 text-start font-semibold">Portal</th>
                  {canSeeOthers && <th className="px-4 py-2.5 text-start font-semibold">Agent</th>}
                  <th className="px-4 py-2.5 text-start font-semibold">Enquiries</th>
                  <th className="px-4 py-2.5 text-start font-semibold">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {visible.map(l => (
                  <tr key={l.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-semibold text-foreground">{l.reference ?? `ID ${l.listingId}`}</p>
                      {l.reference && l.listingId && (
                        <p className="text-[11px] text-muted-foreground">Listing ID {l.listingId}</p>
                      )}
                      {l.title && <p className="text-xs text-muted-foreground truncate max-w-xs">{l.title}</p>}
                      {l.url && (
                        <a href={l.url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                          Open listing <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">{portalLabel(l.portal)}</td>
                    {canSeeOthers && <td className="px-4 py-3 text-xs">{l.agentName}</td>}
                    <td className="px-4 py-3 text-xs">
                      <span className="font-semibold text-foreground">{l.enquiryCount}</span>
                      {l.lastEnquiryAt && (
                        <span className="block text-[11px] text-muted-foreground">last {formatDate(l.lastEnquiryAt)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium",
                        l.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                        {l.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end whitespace-nowrap">
                      {canManage && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(l)} aria-label="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label="Remove"
                            onClick={() => setPendingDelete(l)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-2 border-t border-border text-[11px] text-muted-foreground">
            <span>{shown} of {total}</span>
            {hasMore && <Button variant="ghost" size="sm" onClick={loadMore}>Load more</Button>}
          </div>
          <div ref={sentinelRef} />
        </div>
      )}

      <AnimatePresence>
        {formOpen && (
          <ListingForm key={editing?.id ?? "new"} editing={editing} canAssignOthers={canSeeOthers}
            onClose={() => { setFormOpen(false); setEditing(null); }} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {importOpen && <ImportListingsModal canAssignOthers={canSeeOthers} onClose={() => setImportOpen(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {pendingDelete && (
          <Modal onClose={() => setPendingDelete(null)} title="Remove listing?">
            <p className="text-sm text-muted-foreground">
              New enquiries on <span className="font-mono font-semibold text-foreground">
                {pendingDelete.reference ?? pendingDelete.listingId}</span> will no longer be routed
              to {pendingDelete.agentName}. Leads already received are not affected. If the listing was
              only taken down for now, edit it and mark it inactive instead.
            </p>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" size="sm" onClick={() => setPendingDelete(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" disabled={remove.isPending}
                onClick={async () => {
                  try { await remove.mutateAsync(pendingDelete.id); setPendingDelete(null); } catch { /* toast shown */ }
                }}>
                {remove.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin me-1" />} Remove
              </Button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3">
      <p className="text-lg font-bold text-foreground leading-none">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
        className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto pointer-events-auto shadow-xl">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h3 className="text-base font-bold text-foreground">{title}</h3>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></Button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </motion.div>
    </>
  );
}

function ListingForm({ editing, canAssignOthers, onClose }: {
  editing: PortalListingDto | null;
  canAssignOthers: boolean;
  onClose: () => void;
}) {
  const create = useCreatePortalListing();
  const update = useUpdatePortalListing();
  const { groups } = useAssignableByTeam(canAssignOthers);
  const defaultAssignee = useDefaultAssignee(canAssignOthers);

  const [portal, setPortal] = React.useState<ListingPortal>(editing?.portal ?? "bayut");
  const [reference, setReference] = React.useState(editing?.reference ?? (editing?.url ? "" : editing?.listingId ?? ""));
  const [url, setUrl] = React.useState(editing?.url ?? "");
  const [title, setTitle] = React.useState(editing?.title ?? "");
  const [isActive, setIsActive] = React.useState(editing?.isActive ?? true);
  const [assignee, setAssignee] = React.useState(
    editing ? encodeAssignee(editing.agentUserId, editing.teamId) : "");

  // New listing: start on "me" (under my team when unambiguous) once the picker has loaded.
  React.useEffect(() => {
    if (!editing && !assignee && defaultAssignee.value) setAssignee(defaultAssignee.value);
  }, [editing, assignee, defaultAssignee.value]);

  // Show exactly what enquiries will be matched on, before saving.
  const cleanRef = reference.trim().replace(/^ref(?:erence)?(?:\s*(?:no\.?|number|#))?\s*[:#]?\s*/i, "");
  const refIsUrl = /^https?:\/\//i.test(cleanRef);
  const effectiveUrl = refIsUrl ? cleanRef : url.trim();
  const idFromUrl = effectiveUrl ? listingIdFromUrl(effectiveUrl) : null;
  const matchKeys = [
    !refIsUrl && cleanRef && !/^\d{4,12}$/.test(cleanRef) ? `Reference ${cleanRef}` : null,
    idFromUrl ? `Listing ID ${idFromUrl}` : (!refIsUrl && /^\d{4,12}$/.test(cleanRef) ? `Listing ID ${cleanRef}` : null),
  ].filter(Boolean) as string[];

  const pending = create.isPending || update.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { userId, teamId } = decodeAssignee(assignee);
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          body: {
            reference: reference.trim() || undefined, url: url.trim() || undefined, title: title.trim() || undefined,
            agentUserId: userId ?? editing.agentUserId, teamId, isActive,
          },
        });
      } else {
        await create.mutateAsync({
          portal, reference: reference.trim() || undefined, url: url.trim() || undefined,
          title: title.trim() || undefined,
          agentUserId: canAssignOthers ? userId ?? undefined : undefined,
          teamId: canAssignOthers ? teamId ?? undefined : undefined,
        });
      }
      onClose();
    } catch { /* the hook shows the server's message; the form stays open to fix it */ }
  };

  return (
    <Modal title={editing ? "Edit listing" : "Register a listing"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Portal</label>
          <select value={portal} disabled={!!editing} onChange={e => setPortal(e.target.value as ListingPortal)}
            className="mt-1 h-9 w-full text-sm rounded-md border border-border bg-card px-2 disabled:opacity-60">
            {LISTING_PORTALS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Listing reference</label>
          <Input value={reference} onChange={e => setReference(e.target.value)} className="mt-1 font-mono"
            placeholder="100104-SI9UFU" autoFocus />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Listing URL</label>
          <Input value={url} onChange={e => setUrl(e.target.value)} className="mt-1"
            placeholder="https://www.bayut.com/pm/15476575/…" />
          <p className="text-[11px] text-muted-foreground mt-1">
            Enter both if you can — a lead may carry either one.
          </p>
        </div>

        <div className={cn("rounded-lg border p-3 text-xs flex gap-2",
          matchKeys.length ? "border-success/30 bg-success/5 text-success" : "border-border bg-muted/30 text-muted-foreground")}>
          {matchKeys.length ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Info className="h-4 w-4 shrink-0" />}
          <span>
            {matchKeys.length
              ? <>Leads will be matched on <b>{matchKeys.join(" and ")}</b>.</>
              : "Paste the reference and/or URL from the Bayut listing or the lead message."}
          </span>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Title (optional)</label>
          <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1"
            placeholder="2BR in Dubai Marina, sea view" />
        </div>

        {canAssignOthers && (
          <div>
            <label className="text-xs font-medium text-muted-foreground">Agent</label>
            <select value={assignee} onChange={e => setAssignee(e.target.value)}
              className="mt-1 h-9 w-full text-sm rounded-md border border-border bg-card px-2">
              <option value="" disabled>Select agent…</option>
              {groups.map(g => (
                <optgroup key={g.team} label={g.team}>
                  {g.members.map(m => (
                    <option key={`${g.team}-${m.id}`} value={encodeAssignee(m.id, m.teamId)}>{m.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}

        {editing && (
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
            Active — route new enquiries on this listing
          </label>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" disabled={pending || matchKeys.length === 0 || (canAssignOthers && !assignee)}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin me-1" />}
            {editing ? "Save" : "Register listing"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
