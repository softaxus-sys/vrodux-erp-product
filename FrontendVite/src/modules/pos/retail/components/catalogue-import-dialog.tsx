import * as React from "react";
import { useTranslation } from "react-i18next";
import { Loader2, PackageSearch, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth.store";
import { useCataloguePacks, useImportCatalogue } from "@/hooks/pos/use-catalogue";
import type { ImportCatalogueResultDto } from "@/lib/pos/catalogue.api";

interface Props { open: boolean; onClose: () => void }

/**
 * Import a bundled product catalogue (country x industry) into this store's products, on demand.
 * The catalogue supplies names, barcodes and categories — never prices, which are the store's own.
 */
export function CatalogueImportDialog({ open, onClose }: Props) {
  const { t } = useTranslation("pos");
  const tenantCountry = useAuthStore((s) => s.tenant?.country ?? "");
  const { data: packs = [], isLoading } = useCataloguePacks(open);
  const importer = useImportCatalogue();

  const [key, setKey]           = React.useState("");   // "{country}|{industry}"
  const [picked, setPicked]     = React.useState<Set<string>>(new Set());
  const [taxRate, setTaxRate]   = React.useState("0");
  const [result, setResult]     = React.useState<ImportCatalogueResultDto | null>(null);

  const pack = packs.find((p) => `${p.country}|${p.industry}` === key);

  // Default to the tenant's own country once the packs arrive.
  React.useEffect(() => {
    if (!open || key || packs.length === 0) return;
    const own = packs.find((p) => p.countryName.toLowerCase() === tenantCountry.toLowerCase()) ?? packs[0];
    setKey(`${own.country}|${own.industry}`);
  }, [open, key, packs, tenantCountry]);

  // A different pack means a different category list and tax default: start with everything selected.
  React.useEffect(() => {
    if (!pack) return;
    setPicked(new Set(pack.categories.map((c) => c.name)));
    setTaxRate(String(pack.taxRate));
  }, [pack?.country, pack?.industry]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => { if (!open) { setResult(null); setKey(""); } }, [open]);

  const selectedCount = pack
    ? pack.categories.filter((c) => picked.has(c.name)).reduce((n, c) => n + c.count, 0)
    : 0;

  const toggle = (name: string) =>
    setPicked((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });

  const run = async () => {
    if (!pack) return;
    try {
      const res = await importer.mutateAsync({
        country: pack.country,
        industry: pack.industry,
        categories: pack.categories.length === picked.size ? undefined : [...picked],
        taxRate: Number(taxRate) || 0,
      });
      setResult(res);
    } catch { /* the hook toasts; the dialog stays open for a retry */ }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageSearch className="h-5 w-5" />
            {t("catalogue.title", { defaultValue: "Import products from catalogue" })}
          </DialogTitle>
          <DialogDescription>
            {t("catalogue.subtitle", {
              defaultValue: "Start with real products and barcodes for your country and store type. Prices come in as 0 — set your own after importing.",
            })}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-emerald-600 font-medium">
              <CheckCircle2 className="h-5 w-5" />
              {t("catalogue.done", { defaultValue: "{{n}} products imported", n: result.imported.toLocaleString() })}
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>{t("catalogue.existing", { defaultValue: "{{n}} skipped — barcode already in your products", n: result.skippedExisting.toLocaleString() })}</li>
              {result.skippedInvalid > 0 && (
                <li>{t("catalogue.invalid", { defaultValue: "{{n}} skipped — invalid data", n: result.skippedInvalid })}</li>
              )}
              {result.categoriesCreated > 0 && (
                <li>{t("catalogue.cats", { defaultValue: "{{n}} new categories created", n: result.categoriesCreated })}</li>
              )}
            </ul>
            <Button className="w-full" onClick={onClose}>{t("catalogue.close", { defaultValue: "Done" })}</Button>
          </div>
        ) : isLoading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : packs.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            {t("catalogue.none", { defaultValue: "No catalogue packs are bundled with this version." })}
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t("catalogue.pack", { defaultValue: "Country & store type" })}</label>
              <select
                className="mt-1 w-full h-10 rounded-md border bg-card px-3 text-sm"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              >
                {packs.map((p) => (
                  <option key={`${p.country}|${p.industry}`} value={`${p.country}|${p.industry}`}>
                    {p.countryName} — {p.industryLabel} ({p.productCount.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            {pack && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium">{t("catalogue.categories", { defaultValue: "Categories" })}</label>
                    <div className="text-xs space-x-3">
                      <button type="button" className="text-primary hover:underline"
                        onClick={() => setPicked(new Set(pack.categories.map((c) => c.name)))}>
                        {t("catalogue.all", { defaultValue: "All" })}
                      </button>
                      <button type="button" className="text-primary hover:underline" onClick={() => setPicked(new Set())}>
                        {t("catalogue.none2", { defaultValue: "None" })}
                      </button>
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto rounded-md border divide-y">
                    {pack.categories.map((c) => (
                      <label key={c.name} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                        <input type="checkbox" checked={picked.has(c.name)} onChange={() => toggle(c.name)} />
                        <span className="flex-1">{c.name}</span>
                        <span className="text-muted-foreground tabular-nums">{c.count.toLocaleString()}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">{t("catalogue.tax", { defaultValue: "Default tax rate (%)" })}</label>
                  <Input type="number" min={0} max={100} className="mt-1 w-32" value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("catalogue.taxHint", { defaultValue: "Applied to every imported product; edit individual products later." })}
                  </p>
                </div>

                <p className="text-xs text-muted-foreground">
                  {t("catalogue.source", { defaultValue: "Data: {{source}}. Built {{date}}.", source: pack.source, date: pack.builtAt })}
                </p>

                <Button className="w-full" disabled={selectedCount === 0 || importer.isPending} onClick={run}>
                  {importer.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {t("catalogue.import", { defaultValue: "Import {{n}} products", n: selectedCount.toLocaleString() })}
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
