import { PostToFinanceButton } from "@/components/finance/post-to-finance";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { Coins, Landmark, Loader2, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { Can, useCan } from "@/components/auth/can";
import { useCreateFine, useFines, useFinesSummary, usePayFine, useWaiveFine } from "@/hooks/library/use-library";
import { FINE_TYPES, PAYMENT_METHODS, statusMeta, type FineDto, type MemberDto } from "@/lib/library/library.api";
import {
  Field, MemberPicker, Modal, PageHeader, Pill, SearchBox, SELECT, TableState, TH, num, useCanAny, useDebounced,
} from "../../shared/ui";
import { useCanPostFines } from "@/hooks/library/use-library-finance";
import { PostFinesModal } from "./post-fines-modal";

function PayForm({ fine, onClose }: { fine: FineDto; onClose: () => void }) {
  const { t } = useTranslation("library");
  const currency = useCurrency();
  const pay = usePayFine();
  const [amount, setAmount] = React.useState(String(fine.balance));
  const [method, setMethod] = React.useState<string>("cash");
  const value = num(amount);
  const valid = value > 0 && value <= fine.balance;

  return (
    <Modal title={t("fines.pay.title")} subtitle={`${fine.memberName} · ${fine.memberNumber}`} onClose={onClose} size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={pay.isPending}>{t("action.cancel")}</Button>
          <Button size="sm" className="gap-1.5" disabled={!valid || pay.isPending}
            onClick={() => pay.mutate({ id: fine.id, amount: value, method }, { onSuccess: onClose })}>
            {pay.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t("fines.pay.confirm")}
          </Button>
        </>
      }>
      <p className="text-sm text-muted-foreground">{t("fines.pay.owed", { amount: formatCurrency(fine.balance, currency) })}</p>
      <Field label={t("fines.amount", { currency })} hint={value > fine.balance ? t("fines.pay.tooMuch") : undefined}>
        <Input type="number" min={0} step="any" value={amount} onChange={e => setAmount(e.target.value)} className="h-9 text-sm" autoFocus />
      </Field>
      <Field label={t("fines.method")}>
        <select value={method} onChange={e => setMethod(e.target.value)} className={SELECT}>
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{t(`paymentMethod.${m}`)}</option>)}
        </select>
      </Field>
    </Modal>
  );
}

function WaiveForm({ fine, onClose }: { fine: FineDto; onClose: () => void }) {
  const { t } = useTranslation("library");
  const currency = useCurrency();
  const waive = useWaiveFine();
  const [reason, setReason] = React.useState("");

  return (
    <Modal title={t("fines.waive.title")} subtitle={`${fine.memberName} · ${formatCurrency(fine.balance, currency)}`} onClose={onClose} size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={waive.isPending}>{t("action.cancel")}</Button>
          <Button size="sm" className="gap-1.5" disabled={waive.isPending}
            onClick={() => waive.mutate({ id: fine.id, reason: reason || null }, { onSuccess: onClose })}>
            {waive.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t("fines.waive.confirm")}
          </Button>
        </>
      }>
      <p className="text-sm text-muted-foreground">{t("fines.waive.body")}</p>
      <Field label={t("fines.reason")}>
        <Input value={reason} onChange={e => setReason(e.target.value)} className="h-9 text-sm" autoFocus />
      </Field>
    </Modal>
  );
}

/** Charge a member by hand — a damaged book, a replacement card, a membership fee. */
export function AddFineForm({ member: seedMember, onClose }: { member?: MemberDto | null; onClose: () => void }) {
  const { t } = useTranslation("library");
  const currency = useCurrency();
  const create = useCreateFine();
  const [member, setMember] = React.useState<MemberDto | null>(seedMember ?? null);
  const [type, setType] = React.useState<string>("damage");
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const valid = !!member && num(amount) > 0;

  return (
    <Modal title={t("fines.add")} onClose={onClose} size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={create.isPending}>{t("action.cancel")}</Button>
          <Button size="sm" className="gap-1.5" disabled={!valid || create.isPending}
            onClick={() => member && create.mutate({ memberId: member.id, type, amount: num(amount), reason: reason || null }, { onSuccess: onClose })}>
            {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t("fines.add")}
          </Button>
        </>
      }>
      <Field label={t("desk.member")}><MemberPicker value={member} onChange={setMember} autoFocus={!seedMember} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("fines.type")}>
          <select value={type} onChange={e => setType(e.target.value)} className={SELECT}>
            {FINE_TYPES.map(x => <option key={x} value={x}>{t(`fineType.${x}`)}</option>)}
          </select>
        </Field>
        <Field label={t("fines.amount", { currency })}>
          <Input type="number" min={0} step="any" value={amount} onChange={e => setAmount(e.target.value)} className="h-9 text-sm" />
        </Field>
      </div>
      <Field label={t("fines.reason")}><Input value={reason} onChange={e => setReason(e.target.value)} className="h-9 text-sm" /></Field>
    </Modal>
  );
}

/** The fines table with collect / waive. Pass `memberId` to show one member's fines on their record. */
export function FinesTable({ memberId, status, search }: { memberId?: string; status?: string; search?: string }) {
  const { t } = useTranslation("library");
  const currency = useCurrency();
  const canCollect = useCan("library.fines.edit");
  const canWaive = useCan("library.fines.approve");
  const { data: rows = [], isLoading, isError, error } = useFines({ status, memberId, search });

  const [paying, setPaying] = React.useState<FineDto | null>(null);
  const [waiving, setWaiving] = React.useState<FineDto | null>(null);

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <TableState loading={isLoading} error={isError ? (error as Error) : null} empty={rows.length === 0}
            emptyText={t("fines.empty")} icon={Coins} />
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {!memberId && <th className={TH}>{t("col.member")}</th>}
                    <th className={TH}>{t("fines.for")}</th>
                    <th className={TH}>{t("col.date")}</th>
                    <th className="text-end font-semibold px-4 py-3">{t("fines.amountCol")}</th>
                    <th className={TH}>{t("field.status")}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(f => (
                    <tr key={f.id} className="border-t border-border align-top">
                      {!memberId && (
                        <td className="px-4 py-3">
                          <p>{f.memberName}</p>
                          <p className="text-[11px] text-muted-foreground">{f.memberNumber}</p>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <p className="font-medium">{t(`fineType.${f.type}`, { defaultValue: f.type })}</p>
                        <p className="text-[11px] text-muted-foreground">{[f.title, f.reason].filter(Boolean).join(" — ") || "—"}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(f.createdOn)}</td>
                      <td className="px-4 py-3 text-end tabular-nums whitespace-nowrap">
                        <p className="font-semibold">{formatCurrency(f.amount, currency)}</p>
                        {f.amountPaid > 0 && f.status === "unpaid" && (
                          <p className="text-[11px] text-muted-foreground">{t("fines.paidSoFar", { amount: formatCurrency(f.amountPaid, currency) })}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Pill meta={statusMeta(f.status)}>{t(`fineStatus.${f.status}`, { defaultValue: f.status })}</Pill>
                        {f.settledOn && <p className="text-[11px] text-muted-foreground mt-1">{formatDate(f.settledOn)}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {f.status === "unpaid" && (
                          <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                            {canCollect && <Button size="sm" className="h-7 text-xs" onClick={() => setPaying(f)}>{t("fines.collect")}</Button>}
                            {canWaive && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setWaiving(f)}>{t("fines.waiveBtn")}</Button>}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AnimatePresence>
        {paying && <PayForm key="pay" fine={paying} onClose={() => setPaying(null)} />}
        {waiving && <WaiveForm key="waive" fine={waiving} onClose={() => setWaiving(null)} />}
      </AnimatePresence>
    </>
  );
}

export function FinesView() {
  const { t } = useTranslation("library");
  const currency = useCurrency();
  const canView = useCanAny(["library.fines.view"]);
  const { data: summary } = useFinesSummary(canView);

  const [status, setStatus] = React.useState("unpaid");
  const [search, setSearch] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [posting, setPosting] = React.useState(false);
  // Only offered when the workspace has Finance and this user may create journal entries there.
  const canPost = useCanPostFines();
  const term = useDebounced(search.trim());

  if (!canView) return <div className="p-12 text-center text-sm text-muted-foreground">{t("noAccess")}</div>;

  const tiles = [
    { label: t("fines.tile.outstanding"), value: formatCurrency(summary?.outstanding ?? 0, currency), hint: t("fines.tile.unpaidCount", { count: summary?.unpaidCount ?? 0 }) },
    { label: t("fines.tile.collected"), value: formatCurrency(summary?.collectedThisMonth ?? 0, currency) },
    { label: t("fines.tile.waived"), value: formatCurrency(summary?.waivedThisMonth ?? 0, currency) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("fines.title")} description={t("fines.description")}>
        <PostToFinanceButton module="library" />
        {canPost && (
          <Button size="sm" variant="outline" className="h-9 gap-1.5 text-sm" onClick={() => setPosting(true)}>
            <Landmark className="h-4 w-4" />{t("finance.button")}
          </Button>
        )}
        <Can permission="library.fines.create">
          <Button size="sm" className="h-9 gap-1.5 text-sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4" />{t("fines.add")}</Button>
        </Can>
      </PageHeader>

      <div className="grid sm:grid-cols-3 gap-3">
        {tiles.map(x => (
          <Card key={x.label}>
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{x.label}</p>
              <p className="text-2xl font-bold mt-1 tabular-nums">{x.value}</p>
              {x.hint && <p className="text-[11px] text-muted-foreground mt-0.5">{x.hint}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {["unpaid", "paid", "waived", "all"].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={cn("px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                status === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted/40")}>
              {s === "all" ? t("fines.all") : t(`fineStatus.${s}`)}
            </button>
          ))}
        </div>
        <SearchBox value={search} onChange={setSearch} placeholder={t("fines.search")} className="flex-1" />
      </div>

      <FinesTable status={status === "all" ? undefined : status} search={term || undefined} />

      <AnimatePresence>
        {adding && <AddFineForm onClose={() => setAdding(false)} />}
        {posting && <PostFinesModal key="post" onClose={() => setPosting(false)} />}
      </AnimatePresence>
    </div>
  );
}
