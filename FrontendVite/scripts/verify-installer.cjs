/**
 * Fails the build unless a plausible installer actually exists.
 *
 * Runs automatically at the end of `npm run electron:build-win`.
 *
 * electron-builder can fail to package and still let npm exit 0 — the NSIS step reports through a
 * child process whose failure does not always propagate. That is the worst possible outcome for
 * this build: nothing looks wrong, release/ contains win-unpacked, someone copies it to a USB
 * stick and finds out at the customer's premises that there is no installer.
 *
 * So the exit code is not trusted. The artefact is.
 */
const fs   = require("fs");
const path = require("path");

const RELEASE  = path.join(__dirname, "..", "release");
const MIN_BYTES = 40 * 1024 * 1024;   // a real bundle is ~90 MB; a stub or a half-write is not

if (!fs.existsSync(RELEASE)) {
  console.error("[verify] ERROR: release/ does not exist — the build produced nothing.");
  process.exit(1);
}

const installers = fs.readdirSync(RELEASE)
  .filter(f => /^VroduxERP-Setup-.*\.exe$/i.test(f))
  .map(f => ({ name: f, size: fs.statSync(path.join(RELEASE, f)).size }));

if (installers.length === 0) {
  console.error(
    "[verify] ERROR: no VroduxERP-Setup-*.exe in release/.\n" +
    "         The packaging step failed even if the build reported success.\n" +
    "         release/win-unpacked is NOT an installer — do not ship it.\n" +
    "         Scroll up for the real error (a symlink privilege failure and an invalid icon file\n" +
    "         are the two that have bitten this build before).");
  process.exit(1);
}

const tooSmall = installers.filter(i => i.size < MIN_BYTES);
if (tooSmall.length) {
  for (const i of tooSmall)
    console.error(`[verify] ERROR: ${i.name} is only ${(i.size / 1024 / 1024).toFixed(1)} MB — truncated.`);
  process.exit(1);
}

for (const i of installers)
  console.log(`[verify] ${i.name} — ${(i.size / 1024 / 1024).toFixed(0)} MB`);

console.log("[verify] Installer is ready to copy to the handover USB.");
console.log("[verify] NOTE: it is unsigned, so SmartScreen will warn on each PC —");
console.log("[verify]       the engineer must choose 'More info' then 'Run anyway'.");
