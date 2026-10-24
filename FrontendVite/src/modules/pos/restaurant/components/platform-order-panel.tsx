import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bike, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Can } from "@/components/auth/can";
import { platformsApi, REJECT_REASONS } from "@/lib/restaurant/tax-platforms.api";
import type { RestaurantOrder } from "@/lib/restaurant/restaurant.api";
import { rKeys } from "@/hooks/restaurant/use-restaurant";

const PREP_CHOICES = [10, 15, 20, 30, 45, 60];

/**
 * Shown on a bill that came from Foodpanda. The platform is waiting for an answer, so this replaces
 * the till's usual next step: accept (with a ready time) or reject, then "Handed to rider".
 */
export function PlatformOrderPanel({ order }: { order: RestaurantOrder }) {
  const { t } = useTranslation("restaurant");
  const qc = useQueryClient();
  const [prep, setPrep] = React.useState(20);
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState<string>(REJECT_REASONS[0][0]);

  const done = (msg: string) => { qc.invalidateQueries({ queryKey: rKeys.all }); toast.success(msg); };
  const fail = (e: Error) => toast.error(e.message);
  const accept = useMutation({ mutationFn: () => platformsApi.accept(order.id, prep), onSuccess: () => done(t("platform.accepted")), onError: fail });
  const reject = useMutation({ mutationFn: () => platformsApi.reject(order.id, reason), onSuccess: () => done(t("platform.rejected")), onError: fail });
  const handOver = useMutation({ mutationFn: () => platformsApi.handOver(order.id), onSuccess: () => done(t("platform.handedOver")), onError: fail });

  const state = order.externalStatus;
  const isNew = state === "new" && order.status !== "cancelled";
  const canHandOver = state === "accepted" && order.status !== "paid" && order.status !== "cancelled";

  return (
    <div className="rounded-2xl border-2 border-pink-500/40 bg-pink-500/5 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-pink-600 px-2 py-1 text-xs font-black uppercase tracking-wide text-white">foodpanda</span>
        <span className="font-extrabold text-foreground">#{order.externalOrderCode ?? "—"}</span>
        <span className="ms-auto text-sm font-bold text-muted-foreground">{t(`platform.state.${state ?? "new"}`)}</span>
      </div>

      <Can permission="restaurant.orders.edit">
        {isNew && !rejecting && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-semibold text-muted-foreground me-1">{t("platform.readyIn")}</span>
              {PREP_CHOICES.map(m => (
                <button key={m} onClick={() => setPrep(m)}
                  className={cn("rounded-lg border px-2.5 py-1 text-sm font-bold", prep === m ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                  {t("platform.minutes", { count: m })}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setRejecting(true)} className="h-12 w-32 rounded-xl border-2 border-destructive/50 font-bold text-destructive inline-flex items-center justify-center gap-1.5">
                <XCircle className="h-5 w-5" />{t("platform.reject")}
              </button>
              <button disabled={accept.isPending} onClick={() => accept.mutate()}
                className="h-12 flex-1 rounded-xl bg-success font-extrabold text-white inline-flex items-center justify-center gap-2 disabled:opacity-60">
                {accept.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                {t("platform.accept")}
              </button>
            </div>
          </div>
        )}
        {isNew && rejecting && (
          <div className="space-y-2">
            <select value={reason} onChange={e => setReason(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-card px-3 font-semibold">
              {REJECT_REASONS.map(([code]) => <option key={code} value={code}>{t(`platform.reason.${code}`)}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setRejecting(false)} className="h-12 w-28 rounded-xl border-2 border-border font-bold">{t("platform.back")}</button>
              <button disabled={reject.isPending} onClick={() => reject.mutate()}
                className="h-12 flex-1 rounded-xl bg-destructive font-extrabold text-white inline-flex items-center justify-center gap-2 disabled:opacity-60">
                {reject.isPending && <Loader2 className="h-5 w-5 animate-spin" />}{t("platform.confirmReject")}
              </button>
            </div>
          </div>
        )}
        {canHandOver && (
          <button disabled={handOver.isPending} onClick={() => handOver.mutate()}
            className="h-14 w-full rounded-xl bg-pink-600 text-lg font-extrabold text-white inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {handOver.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bike className="h-5 w-5" />}
            {t("platform.handOver")}
          </button>
        )}
      </Can>
      {canHandOver && <p className="text-xs font-medium text-muted-foreground">{t("platform.handOverHint")}</p>}
    </div>
  );
}
