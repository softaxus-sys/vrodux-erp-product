import * as React from "react";
import { useTranslation } from "react-i18next";
import { Check, ExternalLink, Globe, Loader2, Lock, Mail, MapPin, MessageCircle, Phone, Send, Star, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { cn, formatDate } from "@/lib/utils";
import { MANUAL_STATUSES, type ProspectDto } from "@/lib/leadgen/leadgen.api";
import { useAddContact, useDeleteContact, useMeta, useProspect, useUpdateProspect } from "@/hooks/leadgen/use-leadgen";
import { WhatsAppHistory } from "@/modules/whatsapp/components/send-whatsapp";
import { Banner, ErrorBlock, Field, LoadingBlock, Modal, SELECT, ScoreChip, StatusPill, TEXTAREA } from "../shared/ui";

const EMAIL_TONE: Record<string, string> = {
  valid: "text-success bg-success/10", likely: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
  risky: "text-amber-600 bg-amber-50 dark:bg-amber-900/20", invalid: "text-destructive bg-destructive/10",
  disposable: "text-destructive bg-destructive/10", unknown: "text-muted-foreground bg-muted",
};

export function EmailStatusPill({ status }: { status: string }) {
  const { t } = useTranslation("leadgen");
  return (
    <span className={cn("inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold", EMAIL_TONE[status] ?? EMAIL_TONE.unknown)}>
      {t(`emailStatus.${status}`, { defaultValue: status })}
    </span>
  );
}

export function ProspectDrawer({ id, onClose, onReveal, onAddToCampaign, onImportToCrm, onAssign, onDelete }: {
  id: string; onClose: () => void;
  onReveal: (ids: string[]) => void; onAddToCampaign: (ids: string[]) => void; onImportToCrm: (ids: string[]) => void;
  onAssign: (ids: string[]) => void; onDelete: (p: ProspectDto) => void;
}) {
  const { t } = useTranslation("leadgen");
  const q = useProspect(id);
  const meta = useMeta();
  const update = useUpdateProspect();
  const addContact = useAddContact();
  const delContact = useDeleteContact();
  const p = q.data;

  const [notes, setNotes] = React.useState("");
  const [showContact, setShowContact] = React.useState(false);
  const [c, setC] = React.useState({ fullName: "", title: "", email: "", phone: "" });
  React.useEffect(() => { if (p) setNotes(p.notes ?? ""); }, [p?.id, p?.notes]);  // eslint-disable-line react-hooks/exhaustive-deps

  const cost = meta.data?.limits.revealCost ?? 1;
  const bonus = meta.data?.limits.verifiedEmailBonus ?? 0;

  return (
    <Modal side size="lg" onClose={onClose}
      title={p?.name ?? t("prospects.drawerLoading")}
      subtitle={p ? [p.categoryLabel, p.area ?? p.city ?? p.region].filter(Boolean).join(" · ") : undefined}>
      {q.isLoading && <LoadingBlock />}
      {q.error && <ErrorBlock error={q.error as Error} onRetry={() => q.refetch()} />}
      {p && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={p.status} />
            <ScoreChip value={p.fitScore} label={t("prospects.fit")} title={t("prospects.fitHint")} />
            <ScoreChip value={p.qualityScore} label={t("prospects.quality")} title={t("prospects.qualityHint")} />
            {p.rating != null && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{p.rating}{p.reviewCount != null && ` (${p.reviewCount})`}</span>}
            {p.crmLeadId && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-success/10 text-success">{t("prospects.inCrm")}</span>}
          </div>

          {p.suppressed && <Banner tone="bad">{t("prospects.suppressedBanner")}</Banner>}
          {p.businessStatus && p.businessStatus !== "OPERATIONAL" && <Banner tone="warn">{t("prospects.notOperational")}</Banner>}

          {/* ── Contact details ── */}
          <section className="rounded-xl border border-border p-4 space-y-3">
            <h3 className="text-sm font-bold">{t("prospects.contact")}</h3>
            {!p.isRevealed ? (
              <div className="text-center py-4">
                <Lock className="h-7 w-7 mx-auto text-muted-foreground/60" />
                <p className="text-sm font-semibold mt-2">{t("prospects.locked")}</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  {t("prospects.lockedBody", { phone: p.hasPhone ? t("common.yes") : t("common.no"), site: p.hasWebsite ? t("common.yes") : t("common.no") })}
                </p>
                <Can permission="leadgen.prospects.reveal">
                  <Button className="mt-4 gap-2" onClick={() => onReveal([p.id])}>
                    <Lock className="h-4 w-4" />{t("prospects.revealFor", { cost })}
                  </Button>
                  <p className="text-[11px] text-muted-foreground mt-2">{t("prospects.revealPolicy", { bonus })}</p>
                </Can>
              </div>
            ) : (
              <dl className="space-y-2.5 text-sm">
                <Row icon={Phone} label={t("prospects.phone")}>
                  {p.phone ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <a className="text-primary hover:underline" href={`tel:${p.phone.replace(/\s/g, "")}`}>{p.phone}</a>
                      {p.phoneType && <span className="text-[10px] text-muted-foreground">{t(`phoneType.${p.phoneType}`, { defaultValue: p.phoneType })}</span>}
                      {p.phoneType === "mobile" && (
                        <a className="inline-flex items-center gap-1 text-[11px] text-green-700 hover:underline" target="_blank" rel="noreferrer"
                          href={`https://wa.me/${p.phone.replace(/\D/g, "")}`}><MessageCircle className="h-3 w-3" />{t("prospects.whatsapp")}</a>
                      )}
                    </span>
                  ) : <span className="text-muted-foreground">{t("prospects.none")}</span>}
                </Row>
                <Row icon={Mail} label={t("prospects.email")}>
                  {p.email ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <a className="text-primary hover:underline break-all" href={`mailto:${p.email}`}>{p.email}</a>
                      <EmailStatusPill status={p.emailStatus} />
                      {p.emailIsRole && <span className="text-[10px] text-muted-foreground">{t("prospects.roleEmail")}</span>}
                    </span>
                  ) : <span className="text-muted-foreground">{t("prospects.none")}</span>}
                </Row>
                <Row icon={Globe} label={t("prospects.website")}>
                  {p.website ? <a className="text-primary hover:underline break-all inline-flex items-center gap-1" href={p.website.startsWith("http") ? p.website : `https://${p.website}`} target="_blank" rel="noreferrer">{p.website}<ExternalLink className="h-3 w-3" /></a>
                    : <span className="text-muted-foreground">{t("prospects.none")}</span>}
                </Row>
                {p.social && Object.keys(p.social).length > 0 && (
                  <Row icon={Users} label={t("prospects.social")}>
                    <span className="flex flex-wrap gap-2">
                      {Object.entries(p.social).map(([k, v]) => <a key={k} className="text-primary hover:underline capitalize" href={v} target="_blank" rel="noreferrer">{k}</a>)}
                    </span>
                  </Row>
                )}
                <Row icon={MapPin} label={t("prospects.address")}>
                  <span>{p.address ?? "—"}{p.googleMapsUri && <a className="ms-2 text-primary hover:underline inline-flex items-center gap-1" href={p.googleMapsUri} target="_blank" rel="noreferrer">{t("prospects.map")}<ExternalLink className="h-3 w-3" /></a>}</span>
                </Row>
                {p.lastVerifiedAt && <p className="text-[11px] text-muted-foreground">{t("prospects.checked", { date: formatDate(p.lastVerifiedAt, "relative") })}</p>}
              </dl>
            )}
          </section>

          {/* ── WhatsApp (only once the number is revealed) ── */}
          {p.isRevealed && p.phone && (
            <section className="rounded-xl border border-border p-4">
              <WhatsAppHistory target={{
                phone: p.phone, name: p.name, relatedType: "prospect", relatedId: p.id, relatedName: p.name,
                fields: { businessName: p.name, city: p.city, category: p.categoryLabel },
              }} />
            </section>
          )}

          {/* ── Why the scores ── */}
          {p.scoreNotes.length > 0 && (
            <section className="rounded-xl border border-border p-4">
              <h3 className="text-sm font-bold mb-2">{t("prospects.whyScores")}</h3>
              <ul className="text-xs space-y-1 text-muted-foreground list-disc ps-5">{p.scoreNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </section>
          )}

          {/* ── People ── */}
          {p.isRevealed && (
            <section className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">{t("prospects.people")}</h3>
                <Can permission="leadgen.prospects.edit"><Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowContact(v => !v)}><UserPlus className="h-3.5 w-3.5" />{t("prospects.addPerson")}</Button></Can>
              </div>
              {(p.contacts ?? []).length === 0 && !showContact && <p className="text-xs text-muted-foreground">{t("prospects.noPeople")}</p>}
              {(p.contacts ?? []).map(person => (
                <div key={person.id} className="flex items-start justify-between gap-2 text-sm rounded-lg bg-muted/30 px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium">{person.fullName}{person.title && <span className="text-muted-foreground font-normal"> · {person.title}</span>}</p>
                    <p className="text-xs text-muted-foreground break-all">{[person.email, person.phone].filter(Boolean).join(" · ")}{person.email && <span className="ms-2"><EmailStatusPill status={person.emailStatus} /></span>}</p>
                  </div>
                  <Can permission="leadgen.prospects.edit"><button className="text-muted-foreground hover:text-destructive p-1" aria-label={t("action.delete")} onClick={() => delContact.mutate({ id: p.id, contactId: person.id })}><Trash2 className="h-3.5 w-3.5" /></button></Can>
                </div>
              ))}
              {showContact && (
                <form className="grid sm:grid-cols-2 gap-2" onSubmit={e => {
                  e.preventDefault();
                  addContact.mutate({ id: p.id, ...c }, { onSuccess: () => { setC({ fullName: "", title: "", email: "", phone: "" }); setShowContact(false); } });
                }}>
                  <Input required placeholder={t("prospects.personName")} value={c.fullName} onChange={e => setC({ ...c, fullName: e.target.value })} />
                  <Input placeholder={t("prospects.personTitle")} value={c.title} onChange={e => setC({ ...c, title: e.target.value })} />
                  <Input type="email" placeholder={t("prospects.email")} value={c.email} onChange={e => setC({ ...c, email: e.target.value })} />
                  <Input placeholder={t("prospects.phone")} value={c.phone} onChange={e => setC({ ...c, phone: e.target.value })} />
                  <div className="sm:col-span-2 flex justify-end"><Button type="submit" size="sm" disabled={addContact.isPending}>{addContact.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin me-1" />}{t("action.save")}</Button></div>
                </form>
              )}
            </section>
          )}

          {/* ── Working it ── */}
          <section className="rounded-xl border border-border p-4 space-y-3">
            <h3 className="text-sm font-bold">{t("prospects.workIt")}</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={t("prospects.status")}>
                <select className={SELECT} value={p.status} disabled={update.isPending || (!p.isRevealed && p.status === "discovered")}
                  onChange={e => update.mutate({ id: p.id, status: e.target.value })}>
                  {p.status === "discovered" && <option value="discovered">{t("status.discovered")}</option>}
                  {p.status === "converted" && <option value="converted">{t("status.converted")}</option>}
                  {MANUAL_STATUSES.map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
                </select>
              </Field>
              <Field label={t("prospects.owner")}>
                <div className="flex items-center gap-2">
                  <span className="text-sm truncate flex-1">{p.ownerName ?? t("prospects.unassigned")}</span>
                  <Can permission="leadgen.prospects.edit"><Button size="sm" variant="outline" onClick={() => onAssign([p.id])}>{t("prospects.assign")}</Button></Can>
                </div>
              </Field>
            </div>
            <Field label={t("prospects.notes")}>
              <textarea className={TEXTAREA} value={notes} maxLength={4000} onChange={e => setNotes(e.target.value)} placeholder={t("prospects.notesPlaceholder")} />
              <Can permission="leadgen.prospects.edit">
                <div className="flex justify-end mt-2">
                  <Button size="sm" variant="outline" disabled={update.isPending || notes === (p.notes ?? "")} onClick={() => update.mutate({ id: p.id, notes })}>
                    {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin me-1" /> : <Check className="h-3.5 w-3.5 me-1" />}{t("prospects.saveNotes")}
                  </Button>
                </div>
              </Can>
            </Field>
          </section>

          <div className="flex flex-wrap gap-2 pt-1">
            <Can permission="leadgen.campaigns.edit">
              <Button variant="outline" className="gap-2" disabled={!p.isRevealed || !p.email || p.suppressed} onClick={() => onAddToCampaign([p.id])}><Send className="h-4 w-4" />{t("prospects.addToCampaign")}</Button>
            </Can>
            <Can permission="leadgen.prospects.import">
              <Button variant="outline" className="gap-2" disabled={!p.isRevealed || !!p.crmLeadId || p.suppressed} onClick={() => onImportToCrm([p.id])}><UserPlus className="h-4 w-4" />{p.crmLeadId ? t("prospects.inCrm") : t("prospects.addToCrm")}</Button>
            </Can>
            <Can permission="leadgen.prospects.delete">
              <Button variant="ghost" className="gap-2 text-destructive ms-auto" onClick={() => onDelete(p)}><Trash2 className="h-4 w-4" />{t("action.delete")}</Button>
            </Can>
          </div>
        </>
      )}
    </Modal>
  );
}

function Row({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1"><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-0.5">{children}</dd></div>
    </div>
  );
}
