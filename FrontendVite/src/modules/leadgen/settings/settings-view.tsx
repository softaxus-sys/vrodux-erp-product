import * as React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Loader2, Plus, ShieldOff, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { cn } from "@/lib/utils";
import type { ProfileInput } from "@/lib/leadgen/leadgen.api";
import {
  useAddSuppression, useImportSuppressions, useMeta, useProfile, useRemoveSuppression, useSuppressions, useUpdateProfile,
} from "@/hooks/leadgen/use-leadgen";
import { Banner, EmptyState, ErrorBlock, Field, LeadGenFrame, LoadingBlock, Modal, NoAccess, Pager, SearchBox, SELECT, TEXTAREA, TH, formatDateTime, useCanAny, useDebounced } from "../shared/ui";

export function SettingsView() {
  const { t } = useTranslation("leadgen");
  const canView = useCanAny(["leadgen.settings.view"]);
  if (!canView) return <LeadGenFrame title={t("settings.title")}><NoAccess permission="leadgen.settings.view" /></LeadGenFrame>;
  return (
    <LeadGenFrame title={t("settings.title")} description={t("settings.description")}>
      <ProfileForm />
      <Suppressions />
    </LeadGenFrame>
  );
}

function ProfileForm() {
  const { t, i18n } = useTranslation("leadgen");
  const profile = useProfile();
  const meta = useMeta();
  const save = useUpdateProfile();
  const ar = i18n.language.startsWith("ar");
  const [f, setF] = React.useState<ProfileInput | null>(null);

  React.useEffect(() => {
    if (profile.data && !f) setF({ ...profile.data, preferredRegions: profile.data.preferredRegions ?? [], preferredCategories: profile.data.preferredCategories ?? [] });
  }, [profile.data]);  // eslint-disable-line react-hooks/exhaustive-deps

  if (profile.isLoading || !f) return profile.error ? <ErrorBlock error={profile.error as Error} onRetry={() => profile.refetch()} /> : <LoadingBlock />;

  const countries = (meta.data?.countries ?? []).filter(c => c.live && c.allowed);
  const country = countries.find(c => c.code === f.countryCode);
  const regions = country?.regions ?? [];
  const toggle = (key: "preferredRegions" | "preferredCategories", v: string) => {
    const cur = new Set(f[key] ?? []); cur.has(v) ? cur.delete(v) : cur.add(v);
    setF({ ...f, [key]: [...cur] });
  };
  const groups = new Map<string, { key: string; label: string }[]>();
  for (const c of meta.data?.categories ?? []) {
    const arr = groups.get(c.group) ?? []; arr.push({ key: c.key, label: ar ? c.labelAr : c.label }); groups.set(c.group, arr);
  }
  const set = (k: keyof ProfileInput, v: string) => setF({ ...f, [k]: v });
  const identityMissing = !f.senderBusinessName?.trim() || !f.senderAddress?.trim();

  return (
    <form onSubmit={e => { e.preventDefault(); save.mutate(f); }} className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div><h2 className="text-sm font-bold">{t("settings.targetTitle")}</h2><p className="text-xs text-muted-foreground mt-0.5">{t("settings.targetBody")}</p></div>
        <Field label={t("settings.offer")} hint={t("settings.offerHint")}><textarea className={TEXTAREA} maxLength={600} value={f.offerSummary ?? ""} onChange={e => set("offerSummary", e.target.value)} /></Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={t("settings.customers")} hint={t("settings.customersHint")}><Input maxLength={300} value={f.targetCustomers ?? ""} onChange={e => set("targetCustomers", e.target.value)} /></Field>
          <Field label={t("settings.dealSize")}><Input maxLength={100} value={f.dealSize ?? ""} onChange={e => set("dealSize", e.target.value)} /></Field>
          <Field label={t("settings.country")}>
            <select className={SELECT} value={f.countryCode} onChange={e => setF({ ...f, countryCode: e.target.value, preferredRegions: [] })}>
              {countries.map(c => <option key={c.code} value={c.code}>{ar ? c.nameAr : c.name}</option>)}
            </select>
          </Field>
          <Field label={t("settings.exclude")} hint={t("settings.excludeHint")}><Input maxLength={300} value={f.excludeKeywords ?? ""} onChange={e => set("excludeKeywords", e.target.value)} /></Field>
        </div>
        {regions.length > 0 && (
          <Field label={t("settings.regions")}>
            <div className="flex flex-wrap gap-1.5">
              {regions.map(r => {
                const on = (f.preferredRegions ?? []).includes(r.name);
                return <button key={r.name} type="button" aria-pressed={on} onClick={() => toggle("preferredRegions", r.name)}
                  className={cn("px-2.5 py-1 rounded-md border text-xs font-medium", on ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border")}>{ar ? r.nameAr : r.name}</button>;
              })}
            </div>
          </Field>
        )}
        <Field label={t("settings.categories")} hint={t("settings.categoriesHint")}>
          <div className="space-y-3 max-h-72 overflow-y-auto rounded-lg border border-border p-3">
            {[...groups.entries()].map(([g, items]) => (
              <div key={g}>
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">{g}</p>
                <div className="flex flex-wrap gap-1.5">
                  {items.map(c => {
                    const on = (f.preferredCategories ?? []).includes(c.key);
                    return <button key={c.key} type="button" aria-pressed={on} onClick={() => toggle("preferredCategories", c.key)}
                      className={cn("px-2 py-0.5 rounded-md border text-xs", on ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border")}>{c.label}</button>;
                  })}
                </div>
              </div>
            ))}
          </div>
        </Field>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div><h2 className="text-sm font-bold">{t("settings.senderTitle")}</h2><p className="text-xs text-muted-foreground mt-0.5">{t("settings.senderBody")}</p></div>
        {identityMissing && meta.data?.canSend === false && <Banner tone="warn">{t("settings.senderRequired")}</Banner>}
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={t("settings.senderName")}><Input maxLength={160} value={f.senderBusinessName ?? ""} onChange={e => set("senderBusinessName", e.target.value)} /></Field>
          <Field label={t("settings.senderWebsite")}><Input maxLength={200} value={f.senderWebsite ?? ""} onChange={e => set("senderWebsite", e.target.value)} placeholder="https://" /></Field>
        </div>
        <Field label={t("settings.senderAddress")} hint={t("settings.senderAddressHint")}><textarea className={cn(TEXTAREA, "min-h-[64px]")} maxLength={300} value={f.senderAddress ?? ""} onChange={e => set("senderAddress", e.target.value)} /></Field>
      </section>

      <Can permission="leadgen.settings.edit">
        <div className="flex justify-end"><Button type="submit" className="gap-2" disabled={save.isPending}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{t("action.save")}</Button></div>
      </Can>
    </form>
  );
}

function Suppressions() {
  const { t, i18n } = useTranslation("leadgen");
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search);
  const [page, setPage] = React.useState(1);
  const list = useSuppressions({ search: q, page, pageSize: 20 });
  const remove = useRemoveSuppression();
  const [adding, setAdding] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  React.useEffect(() => setPage(1), [q]);

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-sm font-bold">{t("settings.dncTitle")}</h2><p className="text-xs text-muted-foreground mt-0.5">{t("settings.dncBody")}</p></div>
        <div className="flex gap-2">
          <SearchBox value={search} onChange={setSearch} placeholder={t("settings.dncSearch")} className="w-48" />
          <Can permission="leadgen.settings.edit">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setImporting(true)}><Upload className="h-3.5 w-3.5" />{t("settings.dncImport")}</Button>
            <Button size="sm" className="gap-1.5" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" />{t("settings.dncAdd")}</Button>
          </Can>
        </div>
      </div>
      {list.isLoading ? <LoadingBlock /> : list.error ? <ErrorBlock error={list.error as Error} onRetry={() => list.refetch()} /> : (list.data?.items.length ?? 0) === 0 ? (
        <EmptyState icon={ShieldOff} title={t("settings.dncEmpty")} body={t("settings.dncEmptyBody")} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className={TH}>{t("settings.col.value")}</th><th className={TH}>{t("settings.col.kind")}</th><th className={TH}>{t("settings.col.reason")}</th><th className={TH}>{t("settings.col.added")}</th><th className={TH} /></tr></thead>
              <tbody>
                {list.data!.items.map(s => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium break-all">{s.value}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{t(`settings.kind.${s.kind}`, { defaultValue: s.kind })}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{t(`settings.reason.${s.reason}`, { defaultValue: s.reason })}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(s.createdAt, i18n.language)}</td>
                    <td className="px-4 py-2.5 text-end"><Can permission="leadgen.settings.edit"><Button size="sm" variant="ghost" className="text-destructive" aria-label={t("action.delete")} disabled={remove.isPending} onClick={() => remove.mutate(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button></Can></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} pageSize={20} total={list.data!.total} onPage={setPage} />
        </>
      )}
      <AnimatePresence>
        {adding && <AddModal onClose={() => setAdding(false)} />}
        {importing && <ImportModal onClose={() => setImporting(false)} />}
      </AnimatePresence>
    </section>
  );
}

function AddModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("leadgen");
  const add = useAddSuppression();
  const [kind, setKind] = React.useState("email");
  const [value, setValue] = React.useState("");
  const [reason, setReason] = React.useState("");
  return (
    <Modal onClose={onClose} size="sm" title={t("settings.dncAdd")}
      footer={<><Button variant="outline" onClick={onClose}>{t("action.cancel")}</Button>
        <Button disabled={!value.trim() || add.isPending} onClick={() => add.mutate({ kind, value: value.trim(), reason: reason || undefined }, { onSuccess: onClose })}>{t("settings.dncAdd")}</Button></>}>
      <Field label={t("settings.col.kind")}>
        <select className={SELECT} value={kind} onChange={e => setKind(e.target.value)}>
          <option value="email">{t("settings.kind.email")}</option><option value="domain">{t("settings.kind.domain")}</option><option value="phone">{t("settings.kind.phone")}</option>
        </select>
      </Field>
      <Field label={t("settings.col.value")} hint={t(`settings.valueHint.${kind}`)}><Input autoFocus value={value} onChange={e => setValue(e.target.value)} /></Field>
      <Field label={t("settings.col.reason")}><Input maxLength={200} value={reason} onChange={e => setReason(e.target.value)} /></Field>
    </Modal>
  );
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("leadgen");
  const imp = useImportSuppressions();
  const [text, setText] = React.useState("");
  const values = text.split(/[\s,;]+/).map(v => v.trim()).filter(Boolean);
  return (
    <Modal onClose={onClose} size="md" title={t("settings.dncImport")} subtitle={t("settings.importHint")}
      footer={<><Button variant="outline" onClick={onClose}>{t("action.cancel")}</Button>
        <Button disabled={values.length === 0 || imp.isPending} className="gap-2"
          onClick={() => imp.mutate(values, { onSuccess: r => { toast.success(t("settings.imported", { added: r.added, skipped: r.skipped })); onClose(); } })}>
          {imp.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{t("settings.importN", { count: values.length })}</Button></>}>
      <textarea className={cn(TEXTAREA, "min-h-[200px] font-mono text-xs")} value={text} onChange={e => setText(e.target.value)} placeholder={"john@example.com\nexample.org\n+971501234567"} />
    </Modal>
  );
}
