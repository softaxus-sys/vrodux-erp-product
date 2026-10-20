import { formatCurrency } from "@/lib/utils";
import type { TourBookingDetailDto } from "./tours.api";

// The trip document a customer is sent: itinerary, what is included, travellers, price and the
// payment schedule. Printed through the browser like every other document (lib/pdf.ts pattern).

const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const day = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", year: "numeric" }) => {
  const d = new Date(iso + "T00:00:00Z");
  return isNaN(+d) ? iso : d.toLocaleDateString(undefined, { ...opts, timeZone: "UTC" });
};
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const lines = (s: string | null) => (s ?? "").split(/\r?\n/).map(x => x.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);

export function printTourDocument(d: TourBookingDetailDto, opts: { companyName: string; currency: string; showPrices: boolean }) {
  const b = d.booking;
  const cur = (n: number) => formatCurrency(n, opts.currency);
  const title = b.status === "enquiry" ? "Trip Quotation" : "Trip Confirmation";

  const itinerary = d.itinerary.length === 0 ? "" : `
    <h2>Itinerary</h2>
    ${d.itinerary.map(x => `
      <div class="day">
        <div class="dayno">Day ${x.dayNumber}<span>${esc(day(addDays(b.startDate, x.dayNumber - 1), { weekday: "short", day: "numeric", month: "short" }))}</span></div>
        <div class="daybody">
          <p class="daytitle">${esc(x.title)}</p>
          ${x.description ? `<p>${esc(x.description).replace(/\n/g, "<br>")}</p>` : ""}
          <p class="meta">${[x.accommodation ? `Stay: ${esc(x.accommodation)}` : "", x.meals ? `Meals: ${esc(x.meals)}` : ""].filter(Boolean).join(" &nbsp;·&nbsp; ")}</p>
        </div>
      </div>`).join("")}`;

  const inc = lines(d.inclusions), exc = lines(d.exclusions);
  const incExc = inc.length + exc.length === 0 ? "" : `
    <div class="cols">
      ${inc.length ? `<div><h3>Included</h3><ul>${inc.map(i => `<li>${esc(i)}</li>`).join("")}</ul></div>` : ""}
      ${exc.length ? `<div><h3>Not included</h3><ul class="x">${exc.map(i => `<li>${esc(i)}</li>`).join("")}</ul></div>` : ""}
    </div>`;

  const services = d.services.filter(s => s.status !== "cancelled");
  const servicesHtml = services.length === 0 ? "" : `
    <h2>Arrangements</h2>
    <table><thead><tr><th>Service</th><th>Details</th><th>Date</th><th>Ref.</th></tr></thead><tbody>
    ${services.map(s => `<tr><td>${esc(s.type[0].toUpperCase() + s.type.slice(1))}</td><td>${esc(s.description)}<br><span class="muted">${esc(s.supplierName)}</span></td>
      <td>${s.serviceDate ? esc(day(s.serviceDate)) : "—"}${s.endDate && s.endDate !== s.serviceDate ? " – " + esc(day(s.endDate)) : ""}</td>
      <td>${s.status === "confirmed" ? esc(s.confirmationNumber ?? "Confirmed") : "To be confirmed"}</td></tr>`).join("")}
    </tbody></table>`;

  const travellers = d.travellers.length === 0 ? "" : `
    <h2>Travellers</h2>
    <table><thead><tr><th>#</th><th>Name</th><th>Type</th><th>Nationality</th><th>Passport</th></tr></thead><tbody>
    ${d.travellers.map((t, i) => `<tr><td>${i + 1}</td><td>${esc(t.fullName)}</td><td>${esc(t.type)}</td><td>${esc(t.nationality) || "—"}</td>
      <td>${esc(t.passportNumber) || "—"}${t.passportExpiry ? ` <span class="muted">exp. ${esc(t.passportExpiry)}</span>` : ""}</td></tr>`).join("")}
    </tbody></table>`;

  const priceRows: [string, number][] = [];
  if (b.adults) priceRows.push([`${b.adults} adult${b.adults === 1 ? "" : "s"} × ${cur(b.adultPrice)}`, b.adults * b.adultPrice]);
  if (b.children) priceRows.push([`${b.children} child${b.children === 1 ? "" : "ren"} × ${cur(b.childPrice)}`, b.children * b.childPrice]);
  if (b.singleRooms) priceRows.push([`${b.singleRooms} single room supplement${b.singleRooms === 1 ? "" : "s"}`, b.singleRooms * b.singleSupplement]);
  for (const s of services.filter(x => x.isExtra)) priceRows.push([s.description, s.sellPrice]);
  if (b.discountAmount) priceRows.push(["Discount", -b.discountAmount]);
  if (b.taxAmount) priceRows.push([`Tax ${b.taxPercent}%`, b.taxAmount]);

  const price = !opts.showPrices ? "" : `
    <h2>Price</h2>
    <table class="price"><tbody>
      ${priceRows.map(([l, v]) => `<tr><td>${esc(l)}</td><td class="num">${cur(v)}</td></tr>`).join("")}
      <tr class="total"><td>Total</td><td class="num">${cur(b.totalAmount)}</td></tr>
      ${b.amountPaid ? `<tr><td>Paid</td><td class="num">${cur(b.amountPaid)}</td></tr><tr class="total"><td>Balance</td><td class="num">${cur(b.balance)}</td></tr>` : ""}
    </tbody></table>
    ${d.instalments.length ? `<h3>Payment schedule</h3><table><thead><tr><th>Instalment</th><th>Due</th><th class="num">Amount</th><th>Status</th></tr></thead><tbody>
      ${d.instalments.map(i => `<tr><td>${esc(i.label)}</td><td>${esc(day(i.dueDate))}</td><td class="num">${cur(i.amount)}</td><td>${i.status === "paid" ? "Paid" : i.paid > 0 ? `${cur(i.paid)} paid` : "Due"}</td></tr>`).join("")}
      </tbody></table>` : ""}`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} ${esc(b.bookingNumber)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1e293b; font-size: 12px; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #0f766e; padding-bottom: 10px; margin-bottom: 14px; }
  .brand { font-size: 18px; font-weight: 700; color: #0f766e; }
  .doc { text-align: right; } .doc b { font-size: 16px; display: block; }
  .hero { background: #f0fdfa; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; }
  .hero h1 { margin: 0 0 4px; font-size: 20px; }
  .hero p { margin: 2px 0; color: #475569; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: #0f766e; margin: 18px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  h3 { font-size: 12px; margin: 10px 0 4px; }
  .day { display: flex; gap: 12px; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; page-break-inside: avoid; }
  .dayno { width: 64px; flex-shrink: 0; font-weight: 700; color: #0f766e; } .dayno span { display: block; font-weight: 400; color: #64748b; font-size: 11px; }
  .daytitle { font-weight: 600; margin: 0 0 2px; } .day p { margin: 2px 0; } .meta, .muted { color: #64748b; font-size: 11px; }
  .cols { display: flex; gap: 24px; } .cols > div { flex: 1; }
  ul { margin: 0; padding-left: 18px; } li { margin: 2px 0; } ul.x li { color: #64748b; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th { text-align: left; font-size: 11px; color: #64748b; border-bottom: 1px solid #e2e8f0; padding: 5px 6px; }
  td { padding: 5px 6px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .price { max-width: 360px; margin-left: auto; } .price .total td { font-weight: 700; border-top: 2px solid #1e293b; }
  footer { margin-top: 24px; color: #94a3b8; font-size: 10px; text-align: center; }
</style></head><body>
<header><div class="brand">${esc(opts.companyName)}</div>
  <div class="doc"><b>${esc(title)}</b>${esc(b.bookingNumber)} · ${esc(day(new Date().toISOString().slice(0, 10)))}</div></header>
<div class="hero">
  <h1>${esc(b.title)}</h1>
  ${d.destination ? `<p>${esc(d.destination)}</p>` : ""}
  <p><b>${esc(day(b.startDate))}</b> to <b>${esc(day(b.endDate))}</b> · ${b.adults} adult${b.adults === 1 ? "" : "s"}${b.children ? `, ${b.children} child${b.children === 1 ? "" : "ren"}` : ""}</p>
  <p>Prepared for ${esc(b.customerName)}</p>
</div>
${itinerary}${incExc}${servicesHtml}${travellers}${price}
${b.notes ? `<h2>Notes</h2><p>${esc(b.notes).replace(/\n/g, "<br>")}</p>` : ""}
<footer>${esc(opts.companyName)} · ${esc(b.bookingNumber)}</footer>
<script>window.onload = () => setTimeout(() => window.print(), 300);</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (w) { w.document.open(); w.document.write(html); w.document.close(); return; }
  // Popup blocked: open as a blob page instead.
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const a = document.createElement("a");
  a.href = url; a.target = "_blank"; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
