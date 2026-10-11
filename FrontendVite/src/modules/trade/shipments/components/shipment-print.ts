import i18n from "@/i18n";
import { exportPdf } from "@/lib/pdf";
import { useAuthStore } from "@/store/auth.store";
import type { ShipmentDto } from "@/lib/trade/trade.api";

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: "trade", ...opts }) as string;

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });
const route = (s: ShipmentDto) =>
  [[s.originPort, s.originCountry], [s.destinationPort, s.destinationCountry]]
    .map(p => p.filter(Boolean).join(", ")).filter(Boolean).join("  →  ");

/** Who is selling and who is buying on this shipment, from our side of it. */
function parties(s: ShipmentDto) {
  const us = useAuthStore.getState().tenant?.name ?? "";
  const them = s.partnerName ?? "—";
  return s.direction === "export" ? { seller: us, buyer: them } : { seller: them, buyer: us };
}

/**
 * Commercial invoice for the shipment, built from the goods as entered. Printed through the
 * browser like every other document in the product, so it needs no template engine or dependency.
 */
export function printCommercialInvoice(s: ShipmentDto) {
  const { seller, buyer } = parties(s);
  exportPdf({
    title: t("print.invoiceTitle"),
    subtitle: [
      `${t("print.seller")}: ${seller}`, `${t("print.buyer")}: ${buyer}`,
      `${t("print.shipment")}: ${s.shipmentNumber}`, s.orderReference ? `${t("print.order")}: ${s.orderReference}` : null,
      s.incoterm ? `${t("print.incoterm")}: ${s.incoterm}` : null, route(s) || null, `${t("print.currency")}: ${s.currency}`,
    ].filter(Boolean).join("  ·  "),
    columns: ["#", t("print.description"), t("print.hsCode"), t("print.origin"), t("print.qty"), t("print.unit"), t("print.unitPrice"), t("print.amount")],
    rows: [
      ...s.items.map((i, n) => [n + 1, i.description, i.hsCode ?? "", i.originCountry ?? "", qty(i.quantity), i.unit, money(i.unitPrice), money(i.lineValue)]),
      ["", t("print.total"), "", "", qty(s.items.reduce((a, i) => a + i.quantity, 0)), "", "", `${money(s.goodsValue)} ${s.currency}`],
    ],
    landscape: true,
  });
}

/** Packing list: quantities, packages, weights and volumes, plus the containers they travel in. */
export function printPackingList(s: ShipmentDto) {
  const { seller, buyer } = parties(s);
  const sum = (f: (i: ShipmentDto["items"][number]) => number | null) => s.items.reduce((a, i) => a + (f(i) ?? 0), 0);
  const boxes = s.containers.length
    ? `${t("print.containers")}: ${s.containers.map(c => [c.number, c.type, c.sealNumber ? `${t("print.seal")} ${c.sealNumber}` : null].filter(Boolean).join(" ")).join("; ")}`
    : null;

  exportPdf({
    title: t("print.packingTitle"),
    subtitle: [
      `${t("print.seller")}: ${seller}`, `${t("print.buyer")}: ${buyer}`, `${t("print.shipment")}: ${s.shipmentNumber}`,
      s.blNumber ? `${t("print.bl")}: ${s.blNumber}` : null, route(s) || null, boxes,
    ].filter(Boolean).join("  ·  "),
    columns: ["#", t("print.description"), t("print.hsCode"), t("print.qty"), t("print.unit"), t("print.packages"), t("print.weight"), t("print.volume")],
    rows: [
      ...s.items.map((i, n) => [n + 1, i.description, i.hsCode ?? "", qty(i.quantity), i.unit, i.packages ?? "", i.weightKg ?? "", i.volumeCbm ?? ""]),
      ["", t("print.total"), "", qty(sum(i => i.quantity)), "", sum(i => i.packages) || "", sum(i => i.weightKg) || "", sum(i => i.volumeCbm) || ""],
    ],
    landscape: true,
  });
}
