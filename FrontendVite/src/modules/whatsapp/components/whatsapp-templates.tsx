import * as React from "react";
import { RefreshCw, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useCan } from "@/components/auth/can";
import { useWaCreateTemplate, useWaSyncTemplates, useWaTemplates } from "@/hooks/whatsapp/use-whatsapp";
import { cn, formatDate } from "@/lib/utils";

const STATUS: Record<string, string> = {
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export function WhatsAppTemplates() {
  const canView = useCan("messaging.templates.view");
  const canCreate = useCan("messaging.templates.create");
  const list = useWaTemplates(false, canView);
  const sync = useWaSyncTemplates();
  const [creating, setCreating] = React.useState(false);

  if (!canView) return <p className="p-6 text-sm text-muted-foreground">You don't have permission to view WhatsApp templates.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">WhatsApp Templates</h1>
          <p className="text-sm text-muted-foreground">
            WhatsApp only lets a business start a conversation with a template Meta has approved. Use {"{{1}}"}, {"{{2}}"} for values filled in when sending.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => sync.mutate(undefined)} disabled={sync.isPending}>
            <RefreshCw className={cn(sync.isPending && "animate-spin")} /> Sync from Meta
          </Button>
          {canCreate && <Button size="sm" onClick={() => setCreating(true)}><Plus /> New template</Button>}
        </div>
      </div>

      {list.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {list.isError && <p className="text-sm text-red-600">{(list.error as Error).message}</p>}
      {list.data?.length === 0 && <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">No templates yet. Create one, or press Sync if you made them in Meta.</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.data?.map((t) => (
          <div key={t.id} className="space-y-2 rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.language} · {t.category.toLowerCase()} · {t.variableCount} value(s)</p>
              </div>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS[t.status] ?? "bg-muted")}>{t.status}</span>
            </div>
            <div className="whitespace-pre-wrap rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-950/30">
              {t.headerText && <p className="mb-1 font-semibold">{t.headerText}</p>}
              {t.bodyText}
              {t.footerText && <p className="mt-1 text-xs text-muted-foreground">{t.footerText}</p>}
            </div>
            {t.rejectedReason && t.rejectedReason !== "NONE" && <p className="text-xs text-red-600">Rejected: {t.rejectedReason}</p>}
            <p className="text-[10px] text-muted-foreground">Synced {formatDate(t.syncedAt)}</p>
          </div>
        ))}
      </div>

      {creating && <CreateTemplateDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateTemplateDialog({ onClose }: { onClose: () => void }) {
  const create = useWaCreateTemplate();
  const [name, setName] = React.useState("");
  const [language, setLanguage] = React.useState("en");
  const [category, setCategory] = React.useState("UTILITY");
  const [header, setHeader] = React.useState("");
  const [body, setBody] = React.useState("Hello {{1}}, thank you for your interest in {{2}}. How can we help you?");
  const [footer, setFooter] = React.useState("");
  const count = Math.max(0, ...Array.from(body.matchAll(/\{\{(\d+)\}\}/g)).map((m) => Number(m[1])));
  const [examples, setExamples] = React.useState<string[]>([]);

  const submit = async () => {
    try {
      await create.mutateAsync({
        name: name.trim(), language, category, headerText: header.trim() || undefined, bodyText: body.trim(),
        footerText: footer.trim() || undefined, examples: Array.from({ length: count }, (_, i) => examples[i] ?? ""),
      });
      onClose();
    } catch { /* toast shown */ }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New WhatsApp template</DialogTitle>
          <DialogDescription>Sent to Meta for approval. It can be used once its status is Approved.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="mb-1 block font-medium">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} placeholder="lead_welcome" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block font-medium">Language</span>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="h-10 w-full rounded-md border bg-card px-2">
                <option value="en">English</option><option value="en_US">English (US)</option><option value="ar">Arabic</option><option value="ur">Urdu</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block font-medium">Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 w-full rounded-md border bg-card px-2">
                <option value="UTILITY">Utility (updates, follow-ups)</option><option value="MARKETING">Marketing (offers)</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block font-medium">Header (optional)</span>
            <Input value={header} onChange={(e) => setHeader(e.target.value)} maxLength={60} />
          </label>
          <label className="block">
            <span className="mb-1 block font-medium">Message</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={1024} className="w-full rounded-md border bg-card p-2" />
          </label>
          {count > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Meta needs a sample value for each placeholder.</p>
              {Array.from({ length: count }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-12 text-xs text-muted-foreground">{`{{${i + 1}}}`}</span>
                  <Input value={examples[i] ?? ""} onChange={(e) => setExamples((p) => { const n = [...p]; n[i] = e.target.value; return n; })} placeholder={i === 0 ? "Ahmed" : "Sample"} />
                </div>
              ))}
            </div>
          )}
          <label className="block">
            <span className="mb-1 block font-medium">Footer (optional)</span>
            <Input value={footer} onChange={(e) => setFooter(e.target.value)} maxLength={60} placeholder="Reply STOP to opt out" />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!name.trim() || !body.trim() || create.isPending}>
            {create.isPending && <Loader2 className="animate-spin" />} Submit to Meta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
