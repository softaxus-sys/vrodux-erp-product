import * as React from "react";
import { useTranslation } from "react-i18next";
import { Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/auth/can";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useListProductsOnline } from "@/hooks/inventory/use-listings";

interface Props {
  /** Stock items to list. The server skips any that are already listed, switched off or gone. */
  productIds: string[];
  onDone?: () => void;
  size?: "sm" | "default";
}

/**
 * "List online" for stock items. Each item becomes its own draft listing filled from the stock item;
 * price and stock stay with the stock item. Used from the stock list and the Not-yet-listed worklist.
 */
export function ListOnlineButton({ productIds, onDone, size = "sm" }: Props) {
  const { t } = useTranslation("inventory");
  const [open, setOpen] = React.useState(false);
  const [publish, setPublish] = React.useState(false);
  const run = useListProductsOnline();

  const submit = async () => {
    try {
      const r = await run.mutateAsync({ productIds, publish });
      if (r.created > 0) {
        toast.success(t("listings.listOnline.done", { count: r.created })
          + (r.published > 0 ? " " + t("listings.listOnline.publishedN", { count: r.published }) : ""));
      } else toast.info(t("listings.listOnline.doneNone"));
      if (r.skipped.length > 0) {
        toast.warning(t("listings.listOnline.skipped", { count: r.skipped.length, reason: r.skipped[0].reason }));
      }
      setOpen(false);
      setPublish(false);
      onDone?.();
    } catch { /* the hook already toasted the reason; keep the dialog open to retry */ }
  };

  return (
    <Can permission="inventory.stock.edit">
      <Button size={size} className="gap-1.5" disabled={productIds.length === 0} onClick={() => setOpen(true)}>
        <Globe className="h-4 w-4" />
        {productIds.length > 1 ? t("listings.listOnline.actionN", { count: productIds.length }) : t("listings.listOnline.action")}
      </Button>
      <Dialog open={open} onOpenChange={o => { if (!run.isPending) setOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("listings.listOnline.confirmTitle", { count: productIds.length })}</DialogTitle>
            <DialogDescription>{t("listings.listOnline.confirmBody")}</DialogDescription>
          </DialogHeader>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={publish} onChange={e => setPublish(e.target.checked)} className="h-4 w-4 rounded border-border" />
            {t("listings.listOnline.alsoPublish")}
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={run.isPending}>{t("listings.listOnline.cancel")}</Button>
            <Button onClick={submit} disabled={run.isPending} className="gap-1.5">
              {run.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("listings.listOnline.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Can>
  );
}
