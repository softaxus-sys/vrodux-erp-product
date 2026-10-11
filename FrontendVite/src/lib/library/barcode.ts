/**
 * Code 128 barcodes as SVG, with no dependency. Code 128 is what handheld scanners read out of
 * the box, and it encodes letters, digits and punctuation — so both generated barcodes
 * ("BK000123") and whatever a library already has on its books can be printed.
 */

// Bar/space widths for symbol values 0–105, then the stop pattern. Every data pattern is six
// widths summing to 11 modules; the stop is seven summing to 13.
const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

const START_B = 104, START_C = 105, STOP = 106;

/** True when every character can be put in a Code 128 barcode (printable ASCII). */
export function canEncode(text: string): boolean {
  return text.length > 0 && /^[\x20-\x7E]+$/.test(text);
}

/**
 * Symbol values for the text, start and checksum included (no stop).
 * An all-digit, even-length value uses set C — two digits per symbol, so a long numeric
 * accession number comes out half as wide. Anything else uses set B.
 */
export function code128Values(text: string): number[] {
  if (!canEncode(text)) throw new Error(`"${text}" cannot be encoded as Code 128.`);

  const numeric = /^\d+$/.test(text) && text.length % 2 === 0 && text.length >= 4;
  const values = numeric
    ? [START_C, ...(text.match(/\d\d/g) ?? []).map(Number)]
    : [START_B, ...[...text].map(ch => ch.charCodeAt(0) - 32)];

  // Checksum: start value, plus each symbol weighted by its position, modulo 103.
  const sum = values.reduce((acc, v, i) => acc + (i === 0 ? v : v * i), 0);
  return [...values, sum % 103];
}

/** Module widths left to right, alternating bar, space, bar… (starts with a bar). */
export function code128Widths(text: string): number[] {
  return [...code128Values(text), STOP].flatMap(v => [...PATTERNS[v]].map(Number));
}

/**
 * An SVG that scales to its container. The viewBox is in modules, with the 10-module quiet
 * zone each side that scanners need to find the edges of the code.
 */
export function code128Svg(text: string, opts: { height?: string; className?: string } = {}): string {
  const widths = code128Widths(text);
  const quiet = 10;
  const total = widths.reduce((a, b) => a + b, 0) + quiet * 2;

  let x = quiet;
  let bars = "";
  widths.forEach((w, i) => {
    if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${w}" height="1"/>`;
    x += w;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} 1" preserveAspectRatio="none"`
    + ` shape-rendering="crispEdges" style="width:100%;height:${opts.height ?? "12mm"};display:block"`
    + `${opts.className ? ` class="${opts.className}"` : ""}><g fill="#000">${bars}</g></svg>`;
}
