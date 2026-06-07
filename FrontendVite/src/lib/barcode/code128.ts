// Dependency-free CODE128-B barcode encoder → SVG.
// Encodes printable ASCII (32–126). Good enough for SKUs, EAN/UPC digit strings
// rendered as Code128, and internal barcodes. Returns an <svg> string.

// 107 symbol patterns (each = 6 module widths) + stop pattern.
const PATTERNS = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
  "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
  "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
  "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
  "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
  "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
  "114131","311141","411131","211412","211214","211232","2331112",
];

const START_B = 104;
const STOP    = 106;

/** Encode an ASCII string to an array of module widths (1–4). */
function encode(data: string): number[] {
  const codes: number[] = [START_B];
  let checksum = START_B;
  for (let i = 0; i < data.length; i++) {
    const v = data.charCodeAt(i) - 32; // Code set B: ASCII 32 → value 0
    if (v < 0 || v > 94) continue;     // skip non-encodable chars
    codes.push(v);
    checksum += v * (i + 1);
  }
  codes.push(checksum % 103);
  codes.push(STOP);

  const widths: number[] = [];
  for (const c of codes) {
    for (const ch of PATTERNS[c]) widths.push(parseInt(ch, 10));
  }
  return widths;
}

export interface BarcodeOptions {
  height?: number;       // bar height in px (default 50)
  moduleWidth?: number;  // px per narrowest module (default 1.6)
  margin?: number;       // quiet zone px (default 10)
  showText?: boolean;    // render human-readable text under bars (default true)
}

/** Build an SVG string for a CODE128-B barcode of `value`. */
export function barcodeSvg(value: string, opts: BarcodeOptions = {}): string {
  const height = opts.height ?? 50;
  const mw     = opts.moduleWidth ?? 1.6;
  const margin = opts.margin ?? 10;
  const showText = opts.showText ?? true;
  const textH  = showText ? 14 : 0;

  const widths = encode(value);
  const barAreaW = widths.reduce((s, w) => s + w, 0) * mw;
  const totalW = barAreaW + margin * 2;
  const totalH = height + textH + (showText ? 4 : 0);

  let x = margin;
  let bars = "";
  let isBar = true; // pattern starts with a bar
  for (const w of widths) {
    const ww = w * mw;
    if (isBar) bars += `<rect x="${x.toFixed(2)}" y="0" width="${ww.toFixed(2)}" height="${height}" fill="#000"/>`;
    x += ww;
    isBar = !isBar;
  }

  const text = showText
    ? `<text x="${(totalW / 2).toFixed(2)}" y="${height + textH}" text-anchor="middle" font-family="monospace" font-size="${textH}px" fill="#000">${escapeXml(value)}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW.toFixed(0)}" height="${totalH.toFixed(0)}" viewBox="0 0 ${totalW.toFixed(2)} ${totalH.toFixed(2)}">`
    + `<rect width="100%" height="100%" fill="#fff"/>${bars}${text}</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));
}
