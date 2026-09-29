/**
 * Builds public/vrodux-icon.ico from public/favicon.svg.
 *
 *   node scripts/build-app-icon.cjs
 *
 * Why this exists: electron-builder's Windows targets need a square icon, and the only brand
 * raster in the repo is vrodux-logo.png — a 2882x834 wordmark. NSIS rejects it ("invalid icon
 * file") and the installer cannot be produced at all. favicon.svg is the square mark, so the
 * icon is rendered from that instead of hand-maintaining a binary .ico nobody can diff.
 *
 * Chrome does the rasterising because it is already required to exist for the desktop build, and
 * it renders the same SVG engine the app itself uses. No image library is added for this.
 */
const { spawnSync } = require("child_process");
const fs   = require("fs");
const os   = require("os");
const path = require("path");
const zlib = require("zlib");

const PUBLIC = path.join(__dirname, "..", "public");
const SVG    = path.join(PUBLIC, "favicon.svg");
const OUT    = path.join(PUBLIC, "vrodux-icon.ico");

// Windows picks the nearest size per context: 16/32 in Explorer lists, 48 on the desktop,
// 256 for the large-icon view and the installer header. Shipping only 256 makes Explorer
// downscale it, which looks muddy at 16px.
const SIZES = [16, 32, 48, 64, 128, 256];

const CHROMES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

function die(m) { console.error("ERROR: " + m); process.exit(1); }

const chrome = CHROMES.find(fs.existsSync);
if (!chrome)            die("no Chrome or Edge found");
if (!fs.existsSync(SVG)) die(`missing ${SVG}`);

const svg = fs.readFileSync(SVG, "utf-8");

/** Render the SVG at one pixel size and return the PNG bytes. */
function render(size) {
  // The SVG is wrapped in a page sized exactly to the icon, with every margin removed, so the
  // screenshot is the artwork and nothing else. Screenshotting the .svg file directly leaves
  // Chrome's own document margin baked into the image.
  const html = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden}
svg{display:block;width:${size}px;height:${size}px}</style>${svg}`;

  const page = path.join(os.tmpdir(), `icon-${size}-${process.pid}.html`);
  const png  = path.join(os.tmpdir(), `icon-${size}-${process.pid}.png`);
  fs.writeFileSync(page, html, "utf-8");

  const r = spawnSync(chrome, [
    "--headless", "--disable-gpu", "--hide-scrollbars",
    "--default-background-color=00000000",      // transparent, not white
    `--window-size=${size},${size}`,
    `--screenshot=${png}`,
    "file:///" + page.replace(/\\/g, "/"),
  ], { encoding: "utf-8" });

  if (!fs.existsSync(png)) die(`chrome produced no ${size}px image\n${r.stderr || ""}`);
  const bytes = fs.readFileSync(png);
  fs.unlinkSync(page); fs.unlinkSync(png);
  return bytes;
}

/** Actual pixel dimensions from a PNG's IHDR — trust the file, not the flag we passed. */
function pngSize(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) die("not a PNG");
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

const entries = SIZES.map(size => {
  const png = render(size);
  const [w, h] = pngSize(png);
  if (w !== size || h !== size) die(`expected ${size}x${size}, got ${w}x${h}`);
  return { size, png };
});

// ── ICO container ────────────────────────────────────────────────────────────
// Every entry is stored as a PNG. Windows has accepted PNG-in-ICO since Vista, and it is the
// only sane option here: the alternative is a bottom-up BGRA bitmap with a legacy AND mask,
// which is easy to get subtly wrong and impossible to eyeball afterwards.
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);              // reserved
header.writeUInt16LE(1, 2);              // 1 = icon
header.writeUInt16LE(entries.length, 4);

let offset = 6 + entries.length * 16;
const dir = [];
for (const e of entries) {
  const d = Buffer.alloc(16);
  d.writeUInt8(e.size >= 256 ? 0 : e.size, 0);  // 0 means 256 — the field is one byte
  d.writeUInt8(e.size >= 256 ? 0 : e.size, 1);
  d.writeUInt8(0, 2);                            // palette
  d.writeUInt8(0, 3);                            // reserved
  d.writeUInt16LE(1, 4);                         // colour planes
  d.writeUInt16LE(32, 6);                        // bits per pixel
  d.writeUInt32LE(e.png.length, 8);
  d.writeUInt32LE(offset, 12);
  offset += e.png.length;
  dir.push(d);
}

fs.writeFileSync(OUT, Buffer.concat([header, ...dir, ...entries.map(e => e.png)]));

const kb = Math.round(fs.statSync(OUT).size / 1024);
console.log(`Wrote ${OUT} (${kb} KB, sizes: ${SIZES.join(", ")})`);
