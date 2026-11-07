import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { AlertTriangle, EyeOff, ExternalLink, Loader2, PackageOpen, RefreshCw, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Can } from "@/components/auth/can";
import { cn } from "@/lib/utils";
import {
  useChannels, useListings, usePublishListing, useRemoveListing, useSyncListing, useTemplateLookup, useUnpublishListing,
} from "@/hooks/ecommerce/use-ecommerce";
import { LISTING_STATUS_META, meta, type ListingDto } from "@/lib/ecommerce/ecommerce.api";
import { ConfirmDialog, Modal, PageHeader, Pill, SELECT, SearchBox, TableState, TH, useDebounced, useTimeAgo } from "../../shared/ui";

// ── Publish ──────────────────────────────────────────────────────────────────

function PublishDialog({ channelId, onClose }: { channelId?: string; onClose: () => void }) {
  const { t } = useTranslation("ecommerce");
  const channels = useChannels();
  const publish = usePublishListing();
  const [channel, setChannel] = React.useState(channelId ?? "");
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search);
  const templates = useTemplateLookup(q, true);
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!channel && channels.data?.length === 1) setChannel(channels.data[0].id);
  }, [channels.data, channel]);

  const go = async (templateId: string) => {
    setBusy(templateId);
    try {
      const r = await publish.mutateAsync({ channelId: channel, templateId });
      if (r.status === "error") toast.error(r.lastError ?? t("listings.refused"));
      else toast.success(t("listings.published", { name: r.templateName }));
      onClose();
    } catch { /* toast shown */ }
    finally { setBusy(null); }
  };

  return (
    <Modal title={t("listings.publishTitle")} subtitle={t("listings.publishSubtitle")} onClose={onClose} size="lg">
      <div className="grid gap-3 sm:grid-cols-2">
        <select className={SELECT} value={channel} onChange={e => setChannel(e.target.value)} aria-label={t("listings.store")}>
          <option value="">{t("listings.chooseStore")}</option>
          {(channels.data ?? []).filter(c => c.status !== "paused").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <SearchBox value={search} onChange={setSearch} placeholder={t("listings.searchTemplates")} />
      </div>

      <div className="rounded-lg border border-border divide-y divide-border max-h-[50vh] overflow-y-auto">
        <TableState loading={templates.isLoading} error={templates.error as Error | null} empty={(templates.data ?? []).length === 0}
          emptyText={t("listings.noTemplates")} icon={PackageOpen} />
        {(templates.data ?? []).map(tpl => {
          const ready = tpl.publishedOnline && tpl.isActive;
          return (
            <div key={tpl.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{tpl.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t("listings.variants", { count: tpl.variantCount })} · {t("listings.inStock", { count: Math.round(tpl.totalStock) })}
                </p>
              </div>
              {ready ? (
                <Button size="sm" disabled={!channel || publish.isPending} onClick={() => go(tpl.id)} className="gap-1.5">
                  {busy === tpl.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}{t("listings.publish")}
                </Button>
              ) : (
                <span className="text-xs text-amber-700 dark:text-amber-300 text-end">{t("listings.notPublishedInventory")}</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {t("listings.manageIn")} <Link to="/inventory/listings" className="underline text-primary" onClick={onClose}>{t("listings.inventoryLink")}</Link>
      </p>
    </Modal>
  );
}

// ── Remove ───────────────────────────────────────────────────────────────────

function RemoveDialog({ listing, onClose }: { listing: ListingDto; onClose: () => void }) {
  const { t } = useTranslation("ecommerce");
  const remove = useRemoveListing();
  const [alsoInStore, setAlsoInStore] = React.useState(false);

  return (
    <ConfirmDialog
      title={t("listings.removeTitle", { name: listing.templateName })}
      confirmLabel={t("listings.remove")}
      pending={remove.isPending}
      body={<>
        <p>{t("listings.removeBody", { store: listing.channelName })}</p>
        <label className="flex items-start gap-2 cursor-pointer text-foreground">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-destructive" checked={alsoInStore} onChange={e => setAlsoInStore(e.target.checked)} />
          <span className="text-sm">{t("listings.alsoInStore")}</span>
        </label>
      </>}
      onConfirm={async () => {
        try { await remove.mutateAsync({ id: listing.id, deleteInStore: alsoInStore }); toast.success(t("listings.removed")); onClose(); }
        catch { /* toast shown */ }
      }}
      onClose={onClose} />
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function ChannelListingsView() {
  const { t } = useTranslation("ecommerce");
  const ago = useTimeAgo();
  const channels = useChannels();
  const [channelId, setChannelId] = React.useState("");
  const listings = useListings_(channelId);
  const sync = useSyncListing();
  const unpublish = useUnpublishListing();
  const [publishing, setPublishing] = React.useState(false);
  const [removing, setRemoving] = React.useState<ListingDto | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const rows = listings.data ?? [];
  const hasStores = (channels.data ?? []).length > 0;

  const run = async (id: string, fn: () => Promise<unknown>, done: string) => {
    setBusyId(id);
    try { await fn(); toast.success(done); } catch { /* toast shown */ } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("listings.title")} description={t("listings.subtitle")}>
        <Can permission="ecommerce.listings.create">
          <Button onClick={() => setPublishing(true)} disabled={!hasStores} className="gap-1.5"><Send className="h-4 w-4" />{t("listings.publishNew")}</Button>
        </Can>
      </PageHeader>

      {(channels.data ?? []).length > 1 && (
        <div className="max-w-xs">
          <select className={SELECT} value={channelId} onChange={e => setChannelId(e.target.value)} aria-label={t("listings.store")}>
            <option value="">{t("listings.allStores")}</option>
            {(channels.data ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      <Card className="overflow-hidden">
        <TableState loading={listings.isLoading} error={listings.error as Error | null} empty={rows.length === 0}
          emptyText={hasStores ? t("listings.empty") : t("listings.noStores")} icon={PackageOpen} />
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className={TH}>{t("listings.listing")}</th>
                  <th className={TH}>{t("listings.store")}</th>
                  <th className={TH}>{t("listings.status")}</th>
                  <th className={TH}>{t("listings.lastSynced")}</th>
                  <th className={cn(TH, "text-end")} />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(l => {
                  const busy = busyId === l.id;
                  return (
                    <tr key={l.id} className="align-top hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <p className="font-medium">{l.templateName}</p>
                        <p className="text-xs text-muted-foreground">{t("listings.variants", { count: l.variantCount })}</p>
                        {l.lastError && (
                          <p className="mt-1 flex items-start gap-1.5 text-xs text-destructive max-w-md">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /><span className="break-words">{l.lastError}</span>
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{l.channelName}</td>
                      <td className="px-4 py-3"><Pill meta={meta(LISTING_STATUS_META, l.status)}>{t(`listingStatus.${l.status}`)}</Pill></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{ago(l.lastSyncedAt) ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {l.adminUrl && (
                            <a href={l.adminUrl} target="_blank" rel="noreferrer" aria-label={t("listings.openInStore")}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted text-muted-foreground"><ExternalLink className="h-4 w-4" /></a>
                          )}
                          <Can permission="ecommerce.listings.edit">
                            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy} title={t("listings.sync")} aria-label={t("listings.sync")}
                              onClick={() => run(l.id, () => sync.mutateAsync(l.id), t("listings.synced"))}>
                              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            </Button>
                            {l.externalProductId && l.status === "live" && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy} title={t("listings.hide")} aria-label={t("listings.hide")}
                                onClick={() => run(l.id, () => unpublish.mutateAsync(l.id), t("listings.hidden"))}><EyeOff className="h-4 w-4" /></Button>
                            )}
                          </Can>
                          <Can permission="ecommerce.listings.delete">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title={t("listings.remove")} aria-label={t("listings.remove")}
                              onClick={() => setRemoving(l)}><Trash2 className="h-4 w-4" /></Button>
                          </Can>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AnimatePresence>
        {publishing && <PublishDialog channelId={channelId || undefined} onClose={() => setPublishing(false)} />}
        {removing && <RemoveDialog listing={removing} onClose={() => setRemoving(null)} />}
      </AnimatePresence>
    </div>
  );
}

// The hook takes an optional id; an empty select value means "every store".
function useListings_(channelId: string) {
  return useListings(channelId || undefined);
}
