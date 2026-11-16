import * as React from "react";
import { Link } from "react-router-dom";
import { Loader2, Check, Building2, Download, Globe, AlertTriangle, Info, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import {
  useBusinessProfile, useTenantProfilePreview, useSaveBusinessProfile, useImportProfileFromTenant, useDraftProfileFromWebsite, useAutofillProfile,
} from "@/hooks/seo/use-seo-profile";
import type { ProfileSource } from "@/lib/seo/seo-profile.api";

const toLines = (s: string) => s.split(/\r?\n|,/).map(x => x.trim()).filter(Boolean);
const label = "text-[10px] font-semibold text-muted-foreground uppercase tracking-wide";
const areaClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none";

/** Shown on Competitors and Content while the website has no usable business profile. */
export function ProfileNeededBanner({ onOpen, draft = false }: { onOpen: () => void; draft?: boolean }) {
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 flex items-start gap-2.5">
      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      <div className="text-xs flex-1">
        <p className="font-medium text-foreground">{draft ? "Confirm your business profile" : "Add your business profile first"}</p>
        <p className="text-muted-foreground mt-0.5">
          {draft
            ? "We filled it in from your website. Check it and confirm so plans and articles can use it."
            : "Plans and articles are judged against what your business does, so they stay on topic. Without it they can only copy whatever competitors publish."}
        </p>
      </div>
      <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={onOpen}>{draft ? "Review" : "Set up"}</Button>
    </div>
  );
}

/** What the business is and sells. Everything the SEO module suggests is checked against this. */
export function BusinessProfileTab({ siteId, domain }: { siteId: string; domain: string }) {
  const { hasRawPermission } = useAuthStore();
  const canEdit = hasRawPermission("seo.sites.edit");
  const { data: profile, isLoading } = useBusinessProfile(siteId);
  const save = useSaveBusinessProfile();
  const importTenant = useImportProfileFromTenant();
  const draft = useDraftProfileFromWebsite();
  const autofill = useAutofillProfile();

  const [name, setName] = React.useState("");
  const [industry, setIndustry] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [offers, setOffers] = React.useState("");
  const [audience, setAudience] = React.useState("");
  const [areas, setAreas] = React.useState("");
  const [avoid, setAvoid] = React.useState("");
  const [source, setSource] = React.useState<ProfileSource>("manual");
  const [dirty, setDirty] = React.useState(false);
  const [showImport, setShowImport] = React.useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = React.useState(false);
  const { data: preview, isFetching: previewLoading } = useTenantProfilePreview(siteId, showImport);

  React.useEffect(() => {
    if (!profile || dirty) return;
    setName(profile.businessName); setIndustry(profile.industry); setSummary(profile.summary);
    setOffers(profile.offers.join("\n")); setAudience(profile.audience); setAreas(profile.serviceAreas);
    setAvoid(profile.avoidTopics.join("\n")); setSource(profile.source);
  }, [profile, dirty]);

  const touch = <T,>(set: (v: T) => void) => (v: T) => { set(v); setDirty(true); };

  if (isLoading || !profile) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  const offerList = toLines(offers);
  const formReady = summary.trim().length >= 20 && name.trim().length > 0 && (offerList.length > 0 || industry.trim().length > 0);
  const pending = profile.autofillStatus === "pending";
  const isDraft = profile.isDraft && profile.summary.length > 0 && !pending;        // filled in automatically, awaiting a person
  const failed = profile.autofillStatus === "failed" && !profile.ready && !isDraft;
  const confirmed = profile.exists && !profile.isDraft;

  const handleSave = () => save.mutate(
    { siteId, body: { businessName: name.trim(), industry: industry.trim() || null, summary: summary.trim(), offers: offerList,
        audience: audience.trim() || null, serviceAreas: areas.trim() || null, avoidTopics: toLines(avoid),
        source: source === "website" ? "website" : "manual" } },
    { onSuccess: () => setDirty(false) });

  const handleDraft = async () => {
    try {
      const d = await draft.mutateAsync(siteId);
      if (d.industry) setIndustry(d.industry);
      setSummary(d.summary); setOffers(d.offers.join("\n")); setAudience(d.audience);
      if (d.serviceAreas) setAreas(d.serviceAreas);
      setSource("website"); setDirty(true);
    } catch { /* hook toasts */ }
  };

  const handleImport = async () => {
    try {
      await importTenant.mutateAsync({ siteId, overwrite: profile.ready && profile.exists });
      setShowImport(false); setConfirmOverwrite(false); setDirty(false);
    } catch { /* hook toasts */ }
  };

  return (
    <div className="space-y-5">
      {pending ? (
        <div className="rounded-lg border border-sky-500/40 bg-sky-500/5 p-3 flex items-start gap-2.5 text-xs">
          <Loader2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5 animate-spin" />
          <div>
            <p className="font-medium text-foreground">Reading {domain} and your workspace details to fill this in…</p>
            <p className="text-muted-foreground mt-0.5">This usually takes under a minute. You can leave this page; we will have a draft ready for you to check.</p>
          </div>
        </div>
      ) : isDraft ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 flex items-start gap-2.5 text-xs">
          <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">We filled this in for you. Please check it.</p>
            <p className="text-muted-foreground mt-0.5">
              {profile.autofillNote ?? "Filled in automatically."} Edit anything that is wrong, then press <b>Confirm and save</b>. Competitor plans and AI articles stay locked until you do, so a wrong guess never steers your content.
            </p>
          </div>
        </div>
      ) : (
        <div className={cn("rounded-lg border p-3 flex items-start gap-2.5 text-xs",
          profile.ready ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5")}>
          {profile.ready ? <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
          <div>
            <p className="font-medium text-foreground">
              {profile.ready ? "Suggestions are judged against this profile." : "Competitor plans and AI articles are locked until this is filled in."}
            </p>
            <p className="text-muted-foreground mt-0.5">
              {failed ? (profile.autofillNote ?? "We could not fill this in automatically.")
                : profile.usingNicheHint
                  ? "Right now only your older “what is this site about” note is being used. Save a proper profile for better results."
                  : profile.ready
                    ? `${profile.source === "tenant" ? "Imported from your workspace" : profile.source === "website" ? "Drafted from your website, confirmed by you" : "Written by hand"}${profile.updatedAt ? ` · saved ${formatDate(profile.updatedAt)}` : ""}.`
                    : "Describe what the business does and what it sells, in a couple of sentences."}
            </p>
          </div>
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {!confirmed ? (
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" disabled={pending || autofill.isPending} onClick={() => { setDirty(false); autofill.mutate(siteId); }}>
              {pending || autofill.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {isDraft || failed ? "Fill in again from my website" : "Fill in from my website"}
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" disabled={draft.isPending} onClick={handleDraft}>
              {draft.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
              Re-read {domain}
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => setShowImport(v => !v)}>
            <Download className="w-3.5 h-3.5" />Import from my workspace
          </Button>
        </div>
      )}

      {showImport && (
        <div className="rounded-xl border border-border p-4 space-y-3 text-xs">
          <div className="flex items-center gap-2 font-semibold text-sm"><Building2 className="w-4 h-4" />Your workspace's company details</div>
          {previewLoading || !preview ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : (
            <>
              <dl className="grid grid-cols-[110px_1fr] gap-y-1.5">
                <dt className="text-muted-foreground">Business</dt><dd>{preview.businessName || <i className="text-muted-foreground">not set</i>}</dd>
                <dt className="text-muted-foreground">Industry</dt><dd>{preview.industry || <i className="text-muted-foreground">not set</i>}</dd>
                <dt className="text-muted-foreground">Country</dt><dd>{preview.country || <i className="text-muted-foreground">not set</i>}</dd>
                <dt className="text-muted-foreground">Website</dt><dd>{preview.website || <i className="text-muted-foreground">not set</i>}</dd>
              </dl>

              {preview.websiteMatches === false && (
                <p className="flex gap-1.5 text-amber-700 dark:text-amber-400"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Your workspace's website ({preview.website}) is not {preview.siteDomain}. Import only if this is the same business.</p>
              )}

              {preview.enough ? (
                <>
                  <p className="text-muted-foreground flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    This fills in the name, industry, country and a one-line description. Your workspace does not record {preview.notInWorkspace.join(" or ")}, so add those yourself or use “Draft from {domain}”.</p>
                  {profile.exists && profile.ready && (
                    <label className="flex items-start gap-2">
                      <input type="checkbox" checked={confirmOverwrite} onChange={e => setConfirmOverwrite(e.target.checked)} className="mt-0.5" />
                      <span>This website already has a profile. Replace its name, industry and description with these.</span>
                    </label>
                  )}
                  <Button size="sm" className="h-8 text-xs gap-1.5"
                    disabled={importTenant.isPending || (profile.exists && profile.ready && !confirmOverwrite)} onClick={handleImport}>
                    {importTenant.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}Use these details
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground">
                  There is not enough to import yet. Missing: <b>{preview.missing.join(", ")}</b>. Add {preview.missing.length > 1 ? "them" : "it"} in{" "}
                  <Link to="/settings/general" className="underline">Settings → General</Link>, or fill the profile in below.
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><label className={label}>Business name</label>
            <Input value={name} onChange={e => touch(setName)(e.target.value)} disabled={!canEdit} className="h-8 text-xs" /></div>
          <div className="space-y-1"><label className={label}>Industry</label>
            <Input value={industry} onChange={e => touch(setIndustry)(e.target.value)} disabled={!canEdit} placeholder="e.g. Dental clinic" className="h-8 text-xs" /></div>
        </div>

        <div className="space-y-1">
          <label className={label}>What does the business do? <span className="normal-case font-normal">({summary.trim().length}/20+ characters)</span></label>
          <textarea value={summary} onChange={e => touch(setSummary)(e.target.value)} disabled={!canEdit} rows={4}
            placeholder="e.g. A family dental clinic in Islamabad offering teeth whitening, braces, implants and routine check-ups." className={areaClass} />
        </div>

        <div className="space-y-1">
          <label className={label}>What it sells (one per line)</label>
          <textarea value={offers} onChange={e => touch(setOffers)(e.target.value)} disabled={!canEdit} rows={4}
            placeholder={"teeth whitening\ndental implants\nbraces"} className={areaClass} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><label className={label}>Who the customers are</label>
            <textarea value={audience} onChange={e => touch(setAudience)(e.target.value)} disabled={!canEdit} rows={2} className={areaClass} /></div>
          <div className="space-y-1"><label className={label}>Where it works</label>
            <textarea value={areas} onChange={e => touch(setAreas)(e.target.value)} disabled={!canEdit} rows={2} placeholder="e.g. Islamabad, Pakistan" className={areaClass} /></div>
        </div>

        <div className="space-y-1">
          <label className={label}>Never write about (one per line, optional)</label>
          <textarea value={avoid} onChange={e => touch(setAvoid)(e.target.value)} disabled={!canEdit} rows={2}
            placeholder={"politics\nmedical advice"} className={areaClass} />
          <p className="text-[10px] text-muted-foreground">Any idea that mentions one of these is left out of plans and articles.</p>
        </div>
      </div>

      {canEdit && (
        <div className="flex items-center gap-3">
          <Button size="sm" className="h-8 text-xs gap-1.5" disabled={!formReady || save.isPending || pending || (!dirty && !isDraft)} onClick={handleSave}>
            {save.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}{isDraft ? "Confirm and save" : "Save profile"}
          </Button>
          {source === "website" && dirty && <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" />Drafted by AI from your site — check it before saving.</span>}
          {!formReady && <span className="text-xs text-muted-foreground">Needs a name, a description, and either what you sell or your industry.</span>}
        </div>
      )}
    </div>
  );
}
