/**
 * Renders docs/on-premises-installation.md to a printable A4 PDF.
 *
 *   node docs/build-runbook-pdf.js
 *
 * Needs pandoc on PATH and Chrome (or Edge) installed. Run it whenever the markdown changes —
 * nothing regenerates the PDF on its own, and a stale runbook reaching a site is worse than none.
 *
 * Why the DevTools protocol rather than `chrome --headless --print-to-pdf`: that CLI path can only
 * turn the header and footer fully on or fully off. On, it stamps the `file:///C:/Users/...` path
 * across the bottom of all 18 pages; off, there are no page numbers at all, so a dropped sheet
 * cannot be re-filed and no one can cite a page. Page.printToPDF takes real templates, so we get
 * page numbers and nothing else.
 */
const { spawn, spawnSync } = require("child_process");
const fs   = require("fs");
const os   = require("os");
const path = require("path");
const WebSocket = require(path.join(__dirname, "..", "FrontendVite", "node_modules", "ws"));

const ROOT     = path.join(__dirname, "..");
const MD       = path.join(ROOT, "docs", "on-premises-installation.md");
const CSS      = path.join(ROOT, "docs", "runbook.css");
const OUT      = path.join(ROOT, "docs", "Vrodux-ERP-On-Premises-Installation.pdf");
const TMP_HTML = path.join(os.tmpdir(), `vrodux-runbook-${process.pid}.html`);

const CHROMES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

const TITLE = "Vrodux ERP — On-Premises Installation Runbook";

const FOOTER = `
<div style="width:100%;font-family:'Segoe UI',sans-serif;font-size:8pt;color:#64748b;
            padding:0 16mm;display:flex;justify-content:space-between;">
  <span>${TITLE}</span>
  <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
</div>`;

function die(msg) { console.error("ERROR: " + msg); process.exit(1); }

// ── 1. Markdown → standalone HTML ────────────────────────────────────────────
if (!fs.existsSync(MD))  die(`markdown not found: ${MD}`);
if (!fs.existsSync(CSS)) die(`stylesheet not found: ${CSS}`);

const pandoc = spawnSync("pandoc", [
  MD, "-f", "gfm", "-t", "html5", "-s", "--toc", "--toc-depth=2",
  "-c", CSS, "--embed-resources", "-o", TMP_HTML,
], { encoding: "utf-8" });

if (pandoc.error || pandoc.status !== 0)
  die("pandoc failed — is it on PATH?\n" + (pandoc.stderr || pandoc.error));

// ── 2. HTML → PDF via Chrome's DevTools protocol ─────────────────────────────
const chrome = CHROMES.find(fs.existsSync);
if (!chrome) die("no Chrome or Edge found in the usual locations");

const proc = spawn(chrome, [
  "--headless", "--disable-gpu", "--remote-debugging-port=0",
  "--no-first-run", "--no-default-browser-check",
  `--user-data-dir=${path.join(os.tmpdir(), "vrodux-pdf-profile")}`,
  "about:blank",
]);

let stderr = "";
proc.stderr.on("data", d => {
  stderr += d;
  // Chrome prints the WebSocket endpoint to stderr once the debugger is listening; there is no
  // fixed port to poll because we asked for 0 (let the OS pick) to avoid colliding with a
  // browser the developer already has open.
  const m = stderr.match(/ws:\/\/([^\s\/]+)\//);
  if (m) { stderr = ""; openPage(m[1]); }
});

proc.on("exit", code => { if (code && code !== 0) die("chrome exited: " + code); });

/**
 * The endpoint Chrome prints is the BROWSER target. Page.navigate and Page.printToPDF sent there
 * are accepted and silently do nothing, so the script waits forever for a load event that cannot
 * arrive. The page target has to be looked up separately.
 */
async function openPage(hostPort) {
  const targets = await (await fetch(`http://${hostPort}/json/list`)).json();
  const page = targets.find(t => t.type === "page" && t.webSocketDebuggerUrl);
  if (!page) die("chrome exposed no page target");
  render(page.webSocketDebuggerUrl);
}

function render(wsUrl) {
  const ws = new WebSocket(wsUrl, { perMessageDeflate: false, maxPayload: 512 * 1024 * 1024 });
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) =>
    new Promise(res => { pending.set(++id, res); ws.send(JSON.stringify({ id, method, params })); });

  ws.on("message", raw => {
    const msg = JSON.parse(raw);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
  });

  ws.on("open", async () => {
    await send("Page.enable");
    const loaded = new Promise(res => {
      ws.on("message", raw => {
        const m = JSON.parse(raw);
        if (m.method === "Page.loadEventFired") res();
      });
    });

    await send("Page.navigate", { url: "file:///" + TMP_HTML.replace(/\\/g, "/") });
    await loaded;
    // Web fonts and layout settle a beat after load; printing too early clips the last page.
    await new Promise(r => setTimeout(r, 700));

    const { data } = await send("Page.printToPDF", {
      paperWidth: 8.27, paperHeight: 11.69,          // A4
      marginTop: 0.7, marginBottom: 0.8, marginLeft: 0.63, marginRight: 0.63,
      printBackground: true,                          // callouts and table shading are the content
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",                // empty, or Chrome prints the file path
      footerTemplate: FOOTER,
      preferCSSPageSize: false,
    });

    fs.writeFileSync(OUT, Buffer.from(data, "base64"));
    ws.close();
    proc.kill();
    try { fs.unlinkSync(TMP_HTML); } catch { /* best effort */ }

    const kb = Math.round(fs.statSync(OUT).size / 1024);
    console.log(`Wrote ${OUT} (${kb} KB)`);
  });
}
