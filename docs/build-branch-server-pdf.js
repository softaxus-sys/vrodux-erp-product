/**
 * Renders docs/branch-server-design.html to an A4 PDF.
 *
 *   node docs/build-branch-server-pdf.js
 *
 * Needs Chrome or Edge installed. The page layout, headers and page numbers are in the HTML itself
 * (each .page is one A4 sheet), so the PDF is printed with zero margins and no browser header/footer.
 * Uses the DevTools protocol the same way build-runbook-pdf.js does.
 */
const { spawn } = require("child_process");
const fs   = require("fs");
const os   = require("os");
const path = require("path");
const WebSocket = require(path.join(__dirname, "..", "FrontendVite", "node_modules", "ws"));

const HTML = path.join(__dirname, "branch-server-design.html");
const OUT  = path.join(__dirname, "Vrodux-ERP-Branch-Server-Design.pdf");

const CHROMES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

function die(msg) { console.error("ERROR: " + msg); process.exit(1); }
if (!fs.existsSync(HTML)) die(`not found: ${HTML}`);
const chrome = CHROMES.find(fs.existsSync);
if (!chrome) die("no Chrome or Edge found in the usual locations");

const proc = spawn(chrome, [
  "--headless", "--disable-gpu", "--remote-debugging-port=0",
  "--no-first-run", "--no-default-browser-check",
  `--user-data-dir=${path.join(os.tmpdir(), "vrodux-pdf-profile-branch")}`,
  "about:blank",
]);

let stderr = "";
proc.stderr.on("data", d => {
  stderr += d;
  const m = stderr.match(/ws:\/\/([^\s\/]+)\//);
  if (m) { stderr = ""; openPage(m[1]); }
});

// The endpoint Chrome prints is the BROWSER target; navigation must go to the page target.
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
      ws.on("message", raw => { if (JSON.parse(raw).method === "Page.loadEventFired") res(); });
    });
    await send("Page.navigate", { url: "file:///" + HTML.replace(/\\/g, "/") });
    await loaded;
    await new Promise(r => setTimeout(r, 700));

    const { data } = await send("Page.printToPDF", {
      paperWidth: 8.27, paperHeight: 11.69,
      marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
      printBackground: true,
      displayHeaderFooter: false,
      preferCSSPageSize: true,
    });

    fs.writeFileSync(OUT, Buffer.from(data, "base64"));
    ws.close();
    proc.kill();
    console.log(`Wrote ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
  });
}
