/**
 * Prepares electron-builder's winCodeSign cache before a Windows build.
 *
 * Runs automatically as part of `npm run electron:build-win`.
 *
 * ── The problem ──────────────────────────────────────────────────────────────
 * electron-builder downloads a signing toolchain (winCodeSign-2.6.0.7z) that also contains the
 * macOS half, including two symlinks:
 *
 *   darwin/10.12/lib/libcrypto.dylib
 *   darwin/10.12/lib/libssl.dylib
 *
 * Creating a symlink on Windows needs SeCreateSymbolicLinkPrivilege, which a normal account only
 * has when Developer Mode is on. Without it 7-Zip fails the whole extraction, electron-builder
 * retries four times — re-downloading 5.6 MB each go — and then gives up. NSIS packaging never
 * runs, so no installer is produced.
 *
 * Worse, `npm run electron:build-win` still exits 0. Someone copies release/ to a USB stick,
 * travels to a customer site and discovers there is no installer in it.
 *
 * ── The fix ──────────────────────────────────────────────────────────────────
 * Extract the archive ourselves, excluding darwin/, into the folder electron-builder looks for.
 * A Windows build only ever uses rcedit and signtool; the macOS files are dead weight here.
 *
 * This needs no elevation and no system setting, so it works the same on a developer's machine
 * and on a clean build agent. Enabling Developer Mode also fixes it, but that is a per-machine
 * change nobody remembers to make on the next one.
 */
const { spawnSync } = require("child_process");
const fs    = require("fs");
const https = require("https");
const os    = require("os");
const path  = require("path");

const VERSION = "2.6.0";
const NAME    = `winCodeSign-${VERSION}`;
const URL     = `https://github.com/electron-userland/electron-builder-binaries/releases/download/${NAME}/${NAME}.7z`;

const CACHE = path.join(
  process.env.ELECTRON_BUILDER_CACHE || path.join(os.homedir(), "AppData", "Local", "electron-builder", "Cache"),
  "winCodeSign",
);
const DEST = path.join(CACHE, NAME);
const SEVEN_ZIP = path.join(__dirname, "..", "node_modules", "7zip-bin", "win", "x64", "7za.exe");

// What a usable extraction must contain. Checking for the folder alone is not enough: a previous
// failed attempt can leave a directory holding half an archive.
const REQUIRED = [
  path.join(DEST, "rcedit-x64.exe"),
  path.join(DEST, "windows-10", "x64", "signtool.exe"),
];

function log(m) { console.log(`[winCodeSign] ${m}`); }

/** Leftovers from failed attempts: numeric temp dirs and their .7z files, beside the real one. */
function clearLeftovers() {
  if (!fs.existsSync(CACHE)) return;
  let removed = 0;
  for (const entry of fs.readdirSync(CACHE)) {
    if (!/^\d+(\.7z)?$/.test(entry)) continue;          // never touch winCodeSign-<version>
    fs.rmSync(path.join(CACHE, entry), { recursive: true, force: true });
    removed++;
  }
  if (removed) log(`removed ${removed} leftover item(s) from a previous failed attempt`);
}

function download(url, file, redirects = 0) {
  if (redirects > 5) throw new Error("too many redirects");
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "vrodux-build" } }, res => {
      // GitHub releases redirect to a CDN, so following them is not optional.
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(download(res.headers.location, file, redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const out = fs.createWriteStream(file);
      res.pipe(out);
      out.on("finish", () => out.close(resolve));
      out.on("error", reject);
    }).on("error", reject);
  });
}

(async () => {
  clearLeftovers();

  if (REQUIRED.every(fs.existsSync)) {
    log("cache is ready");
    return;
  }

  if (!fs.existsSync(SEVEN_ZIP)) {
    // Not fatal: electron-builder may still manage on a machine with Developer Mode on.
    log("WARNING: 7za.exe not found in node_modules — skipping, the build may fail to package");
    return;
  }

  const archive = path.join(os.tmpdir(), `${NAME}-${process.pid}.7z`);
  log(`downloading ${NAME} …`);
  await download(URL, archive);

  fs.rmSync(DEST, { recursive: true, force: true });
  log("extracting without the macOS symlinks …");

  const r = spawnSync(SEVEN_ZIP, ["x", "-snld", "-bd", "-y", archive, `-o${DEST}`, "-x!darwin"], {
    encoding: "utf-8",
  });
  fs.rmSync(archive, { force: true });

  if (r.status !== 0)
    throw new Error(`7za exited ${r.status}\n${r.stdout || ""}${r.stderr || ""}`);

  const missing = REQUIRED.filter(p => !fs.existsSync(p));
  if (missing.length)
    throw new Error("extraction did not produce:\n  " + missing.join("\n  "));

  log(`ready at ${DEST}`);
})().catch(err => {
  console.error(`[winCodeSign] ERROR: ${err.message}`);
  process.exit(1);   // fail loudly — a silent miss here is a USB stick with no installer on it
});
