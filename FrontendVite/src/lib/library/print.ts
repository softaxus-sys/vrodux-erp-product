import { canEncode, code128Svg } from "./barcode";

/**
 * Barcode labels and member cards, printed through the browser like every other document here
 * (see lib/pdf.ts): a window is opened with the laid-out sheet and the print dialog raised.
 * Sizes are in millimetres so they land on label stock — the print dialog must be left at
 * 100% / "actual size", which the dialogs that call this say.
 */

export interface LabelLayout {
  id: string;
  /** Page size: "A4", or a roll label as [width, height] in mm. */
  page: "A4" | [number, number];
  cols: number; rows: number;
  width: number; height: number;       // one label, mm
  marginTop: number; marginLeft: number; gapX: number; gapY: number;
}

/** Common label stock. The A4 sheets follow the usual Avery-style die-cuts. */
export const LABEL_LAYOUTS: LabelLayout[] = [
  { id: "a4_21",   page: "A4", cols: 3, rows: 7,  width: 63.5, height: 38.1, marginTop: 15.1, marginLeft: 7.25, gapX: 2.5, gapY: 0 },
  { id: "a4_24",   page: "A4", cols: 3, rows: 8,  width: 63.5, height: 33.9, marginTop: 12.9, marginLeft: 7.25, gapX: 2.5, gapY: 0 },
  { id: "a4_65",   page: "A4", cols: 5, rows: 13, width: 38.1, height: 21.2, marginTop: 10.7, marginLeft: 4.75, gapX: 2.5, gapY: 0 },
  { id: "roll_50", page: [50, 25], cols: 1, rows: 1, width: 50, height: 25, marginTop: 0, marginLeft: 0, gapX: 0, gapY: 0 },
  { id: "roll_38", page: [38, 25], cols: 1, rows: 1, width: 38, height: 25, marginTop: 0, marginLeft: 0, gapX: 0, gapY: 0 },
];

export interface LabelItem { barcode: string; title?: string | null; shelf?: string | null; }

export interface LabelOptions {
  layout: LabelLayout;
  /** Labels already used on the first sheet, to print onto a part-used sheet. */
  skip?: number;
  libraryName?: string | null;
  showTitle?: boolean;
  showShelf?: boolean;
}

export interface CardItem {
  memberNumber: string; fullName: string; membershipType?: string | null; expiresOn?: string | null;
}

export interface CardOptions {
  /** "a4" = ten cards a sheet to cut out; "card" = one per page, for a card printer. */
  layout: "a4" | "card";
  libraryName?: string | null;
  /** Wording for the expiry line, already translated — e.g. "Valid until". */
  validUntilLabel: string;
  formatDate: (date: string) => string;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function open(title: string, pageCss: string, css: string, body: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page { ${pageCss} margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.one-line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
${css}
</style></head><body>${body}
<script>window.onload = function () { setTimeout(function () { window.focus(); window.print(); }, 300); };</script>
</body></html>`;

  const win = window.open("", "_blank", "width=900,height=700,scrollbars=yes");
  if (!win) {
    // Popup blocked — open it as a document instead, as lib/pdf.ts does.
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

/** A barcode, or — for a value Code 128 cannot hold — nothing, so the text below still prints. */
const bars = (value: string, height: string) => (canEncode(value) ? code128Svg(value, { height }) : "");

/** Builds the label sheet markup. Exported so it can be checked without opening a window. */
export function buildLabelSheets(items: LabelItem[], o: LabelOptions): string {
  const l = o.layout;
  const perSheet = l.cols * l.rows;
  const small = l.height < 24 || l.width < 45;
  const barHeight = `${Math.max(6, l.height - (small ? 9 : 16) - (o.libraryName && !small ? 3 : 0)).toFixed(1)}mm`;

  const cells: string[] = Array.from({ length: Math.max(0, (o.skip ?? 0) % perSheet) }, () => `<div class="label"></div>`);
  for (const it of items) {
    cells.push(`<div class="label">`
      + (o.libraryName && !small ? `<div class="lib one-line">${esc(o.libraryName)}</div>` : "")
      + (o.showTitle && it.title ? `<div class="title one-line">${esc(it.title)}</div>` : "")
      + `<div class="bars">${bars(it.barcode, barHeight)}</div>`
      + `<div class="code one-line">${esc(it.barcode)}${o.showShelf && it.shelf ? ` <span class="shelf">· ${esc(it.shelf)}</span>` : ""}</div>`
      + `</div>`);
  }

  let out = "";
  for (let i = 0; i < cells.length; i += perSheet)
    out += `<div class="sheet">${cells.slice(i, i + perSheet).join("")}</div>`;
  return out;
}

export function printLabels(items: LabelItem[], o: LabelOptions) {
  const l = o.layout;
  const a4 = l.page === "A4";
  const [pw, ph] = a4 ? [210, 297] : (l.page as [number, number]);
  const small = l.height < 24 || l.width < 45;

  open("Barcode labels", `size: ${a4 ? "A4" : `${pw}mm ${ph}mm`};`, `
.sheet { width: ${pw}mm; height: ${ph}mm; padding: ${l.marginTop}mm 0 0 ${l.marginLeft}mm; display: grid;
  grid-template-columns: repeat(${l.cols}, ${l.width}mm); grid-auto-rows: ${l.height}mm;
  column-gap: ${l.gapX}mm; row-gap: ${l.gapY}mm; align-content: start; overflow: hidden; page-break-after: always; }
.sheet:last-child { page-break-after: auto; }
.label { width: ${l.width}mm; height: ${l.height}mm; padding: ${small ? "1mm 1.5mm" : "2mm 3mm"}; overflow: hidden;
  display: flex; flex-direction: column; justify-content: center; text-align: center; }
.lib { font-size: 6.5pt; text-transform: uppercase; letter-spacing: .04em; }
.title { font-size: ${small ? "5.5pt" : "7.5pt"}; font-weight: bold; margin-bottom: .5mm; }
.code { font-family: "Courier New", monospace; font-size: ${small ? "6.5pt" : "8.5pt"}; font-weight: bold; margin-top: .6mm; }
.shelf { font-weight: normal; }
`, buildLabelSheets(items, o));
}

/** Builds the member card markup. Exported so it can be checked without opening a window. */
export function buildCards(items: CardItem[], o: CardOptions): string {
  const cards = items.map(m => `<div class="card">
<div class="band one-line">${esc(o.libraryName || "Library")}</div>
<div class="body">
  <div class="name one-line">${esc(m.fullName)}</div>
  <div class="meta one-line">${esc([m.membershipType, m.expiresOn ? `${o.validUntilLabel} ${o.formatDate(m.expiresOn)}` : null].filter(Boolean).join(" · "))}</div>
  <div class="bars">${bars(m.memberNumber, "11mm")}</div>
  <div class="code">${esc(m.memberNumber)}</div>
</div></div>`);

  if (o.layout === "card") return cards.map(c => `<div class="sheet">${c}</div>`).join("");

  let out = "";
  for (let i = 0; i < cards.length; i += 10) out += `<div class="sheet">${cards.slice(i, i + 10).join("")}</div>`;
  return out;
}

/** Member cards at bank-card size (85.6 × 54 mm), with the card number as a barcode. */
export function printMemberCards(items: CardItem[], o: CardOptions) {
  const single = o.layout === "card";
  open("Member cards", `size: ${single ? "85.6mm 54mm" : "A4"};`, `
.sheet { page-break-after: always; ${single
    ? "width: 85.6mm; height: 54mm;"
    : "width: 210mm; height: 297mm; padding: 13.5mm 0 0 16.4mm; display: grid; grid-template-columns: repeat(2, 85.6mm); grid-auto-rows: 54mm; column-gap: 6mm; row-gap: 0; align-content: start;"} }
.sheet:last-child { page-break-after: auto; }
.card { width: 85.6mm; height: 54mm; overflow: hidden; display: flex; flex-direction: column; ${single ? "" : "border: .2mm dashed #999;"} }
.band { background: #0f172a; color: #fff; font-size: 10pt; font-weight: bold; padding: 2.6mm 5mm; }
.body { flex: 1; padding: 3mm 5mm 2.5mm; display: flex; flex-direction: column; }
.name { font-size: 12pt; font-weight: bold; }
.meta { font-size: 7.5pt; color: #333; margin-top: .8mm; min-height: 3.4mm; }
.bars { margin-top: auto; padding: 0 4mm; }
.code { font-family: "Courier New", monospace; font-size: 9pt; font-weight: bold; text-align: center; margin-top: .8mm; }
`, buildCards(items, o));
}
