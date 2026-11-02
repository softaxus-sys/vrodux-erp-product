import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { Banknote, CheckCircle2, Loader2, Package, Printer, Truck, Undo2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Can } from "@/components/auth/can";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { exportPdf } from "@/lib/pdf";
import {
  useCancelStoreOrder, useDeliverOrder, useMarkOrderPaid, useRefundStoreOrder, useSetOrderNote, useShipOrder, useStoreOrder, useStoreOrders, useStoreOrdersSummary, useStoreSettings,
} from "@/hooks/ecommerce/use-store";
import type { StoreOrder, StoreOrderStatus, StorePaymentStatus } from "@/lib/ecommerce/store.api";
import { ConfirmDialog, Modal, PageHeader, Pager, Pill, SearchBox, TH, TableState, useDebounced } from "../../shared/ui";
import { TextAreaField, TextField } from "./builder-fields";
import { SetupStore } from "./store-settings-view";

const PAGE = 25;
const STATUS: Record<StoreOrderStatus, { label: string; color: string; bg: string }> = {
  awaiting_payment: { label: "Awaiting payment", color: "text-amber-800", bg: "bg-amber-100" },
  placed: { label: "To fulfil", color: "text-blue-800", bg: "bg-blue-100" },
  shipped: { label: "Shipped", color: "text-indigo-800", bg: "bg-indigo-100" },
  delivered: { label: "Delivered", color: "text-emerald-800", bg: "bg-emerald-100" },
  cancelled: { label: "Cancelled", color: "text-slate-700", bg: "bg-slate-200" },
};
const PAY: Record<StorePaymentStatus, { label: string; color: string; bg: string }> = {
  pending: { label: "Unpaid", color: "text-amber-800", bg: "bg-amber-100" },
  paid: { label: "Paid", color: "text-emerald-800", bg: "bg-emerald-100" },
  failed: { label: "Failed", color: "text-red-800", bg: "bg-red-100" },
  refunded: { label: "Refunded", color: "text-slate-700", bg: "bg-slate-200" },
};
const METHOD: Record<string, string> = { cod: "Cash on delivery", bank: "Bank transfer", stripe: "Card (Stripe)", paypal: "PayPal" };
const TABS: { id: string; label: string }[] = [{ id: "", label: "All" }, { id: "placed", label: "To fulfil" }, { id: "awaiting_payment", label: "Awaiting payment" }, { id: "shipped", label: "Shipped" }, { id: "delivered", label: "Delivered" }, { id: "cancelled", label: "Cancelled" }];

function ShipDialog({ order, onClose }: { order: StoreOrder; onClose: () => void }) {
  const ship = useShipOrder();
  const [carrier, setCarrier] = React.useState(order.trackingCarrier ?? "");
  const [no, setNo] = React.useState(order.trackingNumber ?? "");
  const [url, setUrl] = React.useState(order.trackingUrl ?? "");
  return (
    <Modal title={order.status === "shipped" ? "Update tracking" : "Mark as shipped"} subtitle={`Order ${order.number} — the customer is emailed.`} onClose={onClose} size="sm" layer={60}
      footer={<><Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" className="gap-1.5" disabled={ship.isPending} onClick={async () => { try { await ship.mutateAsync({ id: order.id, carrier, trackingNumber: no, trackingUrl: url }); onClose(); } catch { /* toast shown */ } }}>
          {ship.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Save</Button></>}>
      <TextField label="Courier (optional)" value={carrier} onChange={setCarrier} placeholder="DHL, Aramex…" />
      <TextField label="Tracking number (optional)" value={no} onChange={setNo} dir="ltr" />
      <TextField label="Tracking link (optional)" value={url} onChange={setUrl} dir="ltr" placeholder="https://…" />
    </Modal>
  );
}

function ReasonDialog({ title, body, confirm, destructive, pending, onConfirm, onClose }: { title: string; body: string; confirm: string; destructive?: boolean; pending: boolean; onConfirm: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = React.useState("");
  return <ConfirmDialog title={title} confirmLabel={confirm} destructive={destructive} pending={pending} onClose={onClose} onConfirm={() => onConfirm(reason)}
    body={<><p>{body}</p><input className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground" placeholder="Reason (optional)" value={reason} onChange={e => setReason(e.target.value)} /></>} />;
}

function OrderDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useStoreOrder(id);
  const paid = useMarkOrderPaid(), deliver = useDeliverOrder(), cancel = useCancelStoreOrder(), refund = useRefundStoreOrder(), note = useSetOrderNote();
  const [dlg, setDlg] = React.useState<"ship" | "cancel" | "refund" | "paid" | null>(null);
  const [staffNote, setStaffNote] = React.useState<string | null>(null);
  const [ref, setRef] = React.useState("");
  const o = q.data;
  React.useEffect(() => { if (o && staffNote === null) setStaffNote(o.staffNote ?? ""); }, [o, staffNote]);

  const money = (n: number) => formatCurrency(n, o?.currencyCode);
  const printSlip = () => o && exportPdf({
    title: `Packing slip ${o.number}`, subtitle: `${o.customerName} · ${o.shipLine1}, ${o.shipCity}, ${o.shipCountry}`,
    columns: ["Item", "Variant", "SKU", "Qty"], rows: o.lines.map(l => [l.title, l.variantName ?? "", l.sku ?? "", l.quantity]),
  });

  return (
    <>
      <Modal title={o ? `Order ${o.number}` : "Order"} subtitle={o ? `${formatDate(o.createdAt)} · ${o.customerName}` : undefined} onClose={onClose} size="xl"
        footer={o && <Button variant="outline" size="sm" className="gap-1.5" onClick={printSlip}><Printer className="h-4 w-4" />Packing slip</Button>}>
        {q.isLoading || !o ? <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p> : (
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Pill meta={STATUS[o.status]}>{STATUS[o.status].label}</Pill><Pill meta={PAY[o.paymentStatus]}>{PAY[o.paymentStatus].label}</Pill>
                <span className="text-xs text-muted-foreground self-center">{METHOD[o.paymentMethod] ?? o.paymentMethod}{o.paymentReference ? ` · ${o.paymentReference}` : ""}</span>
              </div>

              <Can permission="ecommerce.orders.edit">
                <div className="flex flex-wrap gap-2">
                  {o.paymentStatus === "pending" && o.status !== "cancelled" && <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDlg("paid")}><Banknote className="h-4 w-4" />Mark as paid</Button>}
                  {(o.status === "placed" || o.status === "shipped") && <Button size="sm" className="gap-1.5" onClick={() => setDlg("ship")}><Truck className="h-4 w-4" />{o.status === "shipped" ? "Update tracking" : "Mark as shipped"}</Button>}
                  {(o.status === "placed" || o.status === "shipped") && <Button size="sm" variant="outline" className="gap-1.5" disabled={deliver.isPending} onClick={() => deliver.mutate(o.id)}><CheckCircle2 className="h-4 w-4" />Mark delivered</Button>}
                  {o.status !== "cancelled" && o.status !== "delivered" && !(o.paymentStatus === "paid" && (o.paymentMethod === "stripe" || o.paymentMethod === "paypal")) && <Button size="sm" variant="ghost" className="gap-1.5 text-destructive" onClick={() => setDlg("cancel")}><XCircle className="h-4 w-4" />Cancel order</Button>}
                </div>
              </Can>
              <Can permission="ecommerce.orders.refund">
                {o.paymentStatus === "paid" && <Button size="sm" variant="outline" className="gap-1.5 text-destructive" onClick={() => setDlg("refund")}><Undo2 className="h-4 w-4" />Refund {money(o.total)}</Button>}
              </Can>

              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className={TH}>Item</th><th className={cn(TH, "text-end")}>Qty</th><th className={cn(TH, "text-end")}>Price</th><th className={cn(TH, "text-end")}>Total</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {o.lines.map((l, i) => (
                      <tr key={i}><td className="px-4 py-2.5"><p className="font-medium">{l.title}</p><p className="text-xs text-muted-foreground">{[l.variantName, l.sku].filter(Boolean).join(" · ")}</p></td>
                        <td className="px-4 py-2.5 text-end tabular-nums">{l.quantity}</td><td className="px-4 py-2.5 text-end tabular-nums">{money(l.unitPrice)}</td><td className="px-4 py-2.5 text-end tabular-nums">{money(l.lineTotal)}</td></tr>
                    ))}
                  </tbody>
                </table>
                <dl className="text-sm space-y-1 border-t border-border p-4">
                  <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{money(o.subtotal)}</dd></div>
                  {o.discountTotal > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Discount {o.discountCode && `(${o.discountCode})`}</dt><dd>−{money(o.discountTotal)}</dd></div>}
                  <div className="flex justify-between"><dt className="text-muted-foreground">Delivery{o.shippingMethod && ` (${o.shippingMethod})`}</dt><dd>{money(o.shippingTotal)}</dd></div>
                  {o.taxTotal > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd>{money(o.taxTotal)}</dd></div>}
                  <div className="flex justify-between font-bold text-base pt-1"><dt>Total</dt><dd>{money(o.total)}</dd></div>
                </dl>
              </Card>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">History</p>
                <ol className="space-y-2 border-s border-border ps-4">
                  {o.events.map((e, i) => <li key={i} className="text-sm relative"><span className="absolute -start-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />{e.message}<span className="block text-xs text-muted-foreground">{formatDate(e.at)}{e.byName ? ` · ${e.byName}` : ""}</span></li>)}
                </ol>
              </div>
            </div>

            <div className="space-y-4">
              <Card className="p-4 text-sm space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</p>
                <p className="font-medium">{o.customerName}</p><p dir="ltr" className="text-start">{o.email}</p>{o.phone && <p dir="ltr" className="text-start">{o.phone}</p>}
              </Card>
              <Card className="p-4 text-sm space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deliver to</p>
                <p className="font-medium">{o.shipName}</p><p>{o.shipLine1}</p>{o.shipLine2 && <p>{o.shipLine2}</p>}<p>{[o.shipCity, o.shipRegion, o.shipPostal].filter(Boolean).join(", ")}</p><p>{o.shipCountry}</p>
              </Card>
              {(o.trackingNumber || o.trackingUrl) && <Card className="p-4 text-sm"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tracking</p><p>{o.trackingCarrier} {o.trackingNumber}</p>{o.trackingUrl && <a className="text-primary underline text-xs" href={o.trackingUrl} target="_blank" rel="noreferrer">Open tracking</a>}</Card>}
              {o.customerNote && <Card className="p-4 text-sm"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer note</p><p className="whitespace-pre-line">{o.customerNote}</p></Card>}
              <Card className="p-4 space-y-2">
                <TextAreaField label="Private note" rows={3} value={staffNote ?? ""} onChange={setStaffNote} hint="Only your team sees this." />
                <Can permission="ecommerce.orders.edit"><Button size="sm" variant="outline" disabled={note.isPending || staffNote === (o.staffNote ?? "")} onClick={() => note.mutate({ id: o.id, note: staffNote ?? "" })}>Save note</Button></Can>
              </Card>
            </div>
          </div>
        )}
      </Modal>

      <AnimatePresence>
        {o && dlg === "ship" && <ShipDialog order={o} onClose={() => setDlg(null)} />}
        {o && dlg === "paid" && <ConfirmDialog title="Mark this order as paid?" destructive={false} confirmLabel="Mark as paid" pending={paid.isPending} onClose={() => setDlg(null)}
          onConfirm={async () => { try { await paid.mutateAsync({ id: o.id, reference: ref || undefined }); setDlg(null); } catch { /* toast shown */ } }}
          body={<><p>Use this when the money has reached you (a bank transfer, or cash collected).</p><input className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground" placeholder="Reference (optional)" value={ref} onChange={e => setRef(e.target.value)} /></>} />}
        {o && dlg === "cancel" && <ReasonDialog title="Cancel this order?" body="The stock goes back to Inventory and the customer is not charged." confirm="Cancel order" pending={cancel.isPending} onClose={() => setDlg(null)}
          onConfirm={async r => { try { await cancel.mutateAsync({ id: o.id, reason: r || undefined }); setDlg(null); } catch { /* toast shown */ } }} />}
        {o && dlg === "refund" && <ReasonDialog title={`Refund ${money(o.total)}?`} body={o.paymentMethod === "stripe" || o.paymentMethod === "paypal" ? "The full amount goes back to the customer's card / PayPal, the order is cancelled and the stock returns to Inventory." : "This records that you returned the money, cancels the order and returns the stock. Send the money back yourself."}
          confirm="Refund" pending={refund.isPending} onClose={() => setDlg(null)} onConfirm={async r => { try { await refund.mutateAsync({ id: o.id, reason: r || undefined }); setDlg(null); } catch { /* toast shown */ } }} />}
      </AnimatePresence>
    </>
  );
}

export function StoreOrdersView() {
  const store = useStoreSettings();
  const summary = useStoreOrdersSummary();
  const [status, setStatus] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [open, setOpen] = React.useState<string | null>(null);
  const q = useDebounced(search);
  React.useEffect(() => setPage(1), [status, q]);
  const orders = useStoreOrders({ status: status || undefined, search: q || undefined, page, pageSize: PAGE });

  if (store.isLoading) return <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!store.data) return <SetupStore />;
  const rows = orders.data?.items ?? [];
  const s = summary.data;

  return (
    <div className="space-y-6">
      <PageHeader title="Store orders" description="Orders placed in your own online store." />
      {s && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[{ l: "To fulfil", v: String(s.toFulfil), hi: s.toFulfil > 0 }, { l: "Awaiting payment", v: String(s.awaitingPayment) }, { l: "Shipped", v: String(s.shipped) }, { l: "Last 30 days", v: `${formatCurrency(s.revenue30Days, s.currencyCode)} · ${s.orders30Days}` }].map(c => (
            <Card key={c.l} className={cn("p-4", c.hi && "border-primary")}><p className="text-xs text-muted-foreground">{c.l}</p><p className="text-xl font-bold mt-1">{c.v}</p></Card>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-3 items-center">
        <SearchBox value={search} onChange={setSearch} placeholder="Search order, name, email" className="w-full sm:w-72" />
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t => <button key={t.id} onClick={() => setStatus(t.id)} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap", status === t.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40")}>{t.label}</button>)}
        </div>
      </div>
      <Card className="overflow-hidden">
        <TableState loading={orders.isLoading} error={orders.error as Error | null} empty={rows.length === 0} emptyText="No orders yet. They appear here as customers buy." icon={Package} />
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className={TH}>Order</th><th className={TH}>Customer</th><th className={TH}>Payment</th><th className={TH}>Status</th><th className={cn(TH, "text-end")}>Total</th><th className={TH}>Placed</th></tr></thead>
              <tbody className="divide-y divide-border">
                {rows.map(o => (
                  <tr key={o.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => setOpen(o.id)}>
                    <td className="px-4 py-3 font-semibold">{o.number}<span className="block text-xs font-normal text-muted-foreground">{o.itemCount} item{o.itemCount === 1 ? "" : "s"}</span></td>
                    <td className="px-4 py-3">{o.customerName}<span className="block text-xs text-muted-foreground" dir="ltr">{o.email}</span></td>
                    <td className="px-4 py-3"><Pill meta={PAY[o.paymentStatus]}>{PAY[o.paymentStatus].label}</Pill><span className="block text-xs text-muted-foreground mt-0.5">{METHOD[o.paymentMethod] ?? o.paymentMethod}</span></td>
                    <td className="px-4 py-3"><Pill meta={STATUS[o.status]}>{STATUS[o.status].label}</Pill></td>
                    <td className="px-4 py-3 text-end tabular-nums font-medium">{formatCurrency(o.total, o.currencyCode)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pageSize={PAGE} total={orders.data?.totalCount ?? 0} onPage={setPage} />
      </Card>
      <AnimatePresence>{open && <OrderDetail id={open} onClose={() => setOpen(null)} />}</AnimatePresence>
    </div>
  );
}
