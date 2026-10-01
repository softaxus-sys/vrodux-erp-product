const { app, BrowserWindow, Menu, Tray, shell, ipcMain, dialog, session } = require("electron");
const path = require("path");
const fs = require("fs");

// ── Config file (persisted API URL) ──────────────────────────────────────────

const CONFIG_PATH = path.join(app.getPath("userData"), "vrodux-config.json");

// Written by the installer's "Server address" page, next to the app rather than in a user profile:
// a till is usually installed by an administrator and then run by a cashier, so a per-user file
// would be written for the wrong account and the operator would land on localhost anyway.
// It is only the DEFAULT — the tray dialog still wins, so a server that moves can be repointed
// without reinstalling.
const INSTALL_CONFIG_PATH = path.join(process.resourcesPath || __dirname, "server-config.json");

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return {};
  }
}

function loadConfig() {
  return readJson(CONFIG_PATH);
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
}

// ── Globals ──────────────────────────────────────────────────────────────────

let mainWindow = null;
let tray = null;
let isQuitting = false;

const DEFAULT_API_URL = "http://localhost:5000";

// Identifies the current installation: the installer rewrites server-config.json on every
// install, so its modification time changes with each one.
function installStamp() {
  try {
    return fs.statSync(INSTALL_CONFIG_PATH).mtimeMs;
  } catch {
    return null;
  }
}

function getApiUrl() {
  // A tray override lives in the user's profile and survives a reinstall. It only counts if it was
  // made against THIS installation — otherwise an address typed months ago silently outranks the
  // one the installer was just given, and the app keeps calling a server that is no longer there.
  const cfg = loadConfig();
  const override = cfg.installStamp === installStamp() ? usableUrl(cfg.apiUrl) : null;
  return override || usableUrl(readJson(INSTALL_CONFIG_PATH).apiUrl) || DEFAULT_API_URL;
}

// A truncated address ("http:") is truthy, so it used to win over the default and every request
// went nowhere. Only an http(s) URL with a host counts as configured.
function usableUrl(value) {
  try {
    const u = new URL(value);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname ? value : null;
  } catch {
    return null;
  }
}

// ── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: "Vrodux ERP",
    icon: path.join(__dirname, "../public/vrodux-logo.png"),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // In dev, load the Vite dev server; in prod, load the built files
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Minimize to tray instead of closing
  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// ── Tray ─────────────────────────────────────────────────────────────────────

function createTray() {
  const iconPath = path.join(__dirname, "../public/vrodux-logo.png");
  tray = new Tray(iconPath);
  tray.setToolTip("Vrodux ERP");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Vrodux",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "Server Settings...",
      click: () => showServerSettings(),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ── Server settings dialog ───────────────────────────────────────────────────

async function showServerSettings() {
  const currentUrl = getApiUrl();
  const { response, checkboxChecked } = await dialog.showMessageBox(mainWindow, {
    type: "question",
    title: "Server Settings",
    message: `Current server: ${currentUrl}\n\nWould you like to change the server URL?`,
    buttons: ["Change", "Cancel"],
    defaultId: 1,
    cancelId: 1,
  });

  if (response === 0) {
    // Electron doesn't have a native text input dialog, so we use a prompt via the renderer
    mainWindow.webContents.send("show-server-prompt", currentUrl);
  }
}

// ── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle("get-api-url", () => getApiUrl());

// Synchronous twin of the above, consumed once by preload before any page script runs.
// Every API module resolves its base URL at import time, so this cannot be a promise.
ipcMain.on("get-api-url-sync", (event) => {
  event.returnValue = getApiUrl();
});

ipcMain.handle("set-api-url", (_event, url) => {
  const cfg = loadConfig();
  cfg.apiUrl = url;
  cfg.installStamp = installStamp();
  saveConfig(cfg);
  refreshApiOrigin();
  // Reload the app with the new URL
  if (mainWindow) {
    mainWindow.webContents.reload();
  }
  return true;
});

ipcMain.handle("get-app-version", () => app.getVersion());

// ── App lifecycle ────────────────────────────────────────────────────────────

// ── CORS ─────────────────────────────────────────────────────────────────────
//
// The renderer is loaded from disk (loadFile), so its origin is opaque and Chromium sends
// `Origin: null` on every API call. The gateway's AllowFrontend policy is an explicit origin
// allow-list (AllowedOrigins in appsettings) plus AllowCredentials, which can never match a null
// origin and can never answer with `*` — so a desktop client talking to any server, local or
// remote, would have every authenticated request refused at the preflight.
//
// The alternative — adding "null" to the server's allow-list — is both broader (it would admit any
// sandboxed iframe or local file on the network) and not reliably honoured alongside
// AllowCredentials. Relaxing it here instead keeps the change on the client that already trusts
// this server, and only for responses from the exact host the app is configured to use.
//
// The app authenticates with a bearer token, not cookies (fetch is left at its default
// credentials: "same-origin"), so no credentialed cross-origin request is being enabled.
// Re-read whenever the server changes, or switching servers from the tray would keep relaxing CORS
// for the OLD host and refuse the new one.
let apiOrigin = null;

function refreshApiOrigin() {
  try {
    apiOrigin = new URL(getApiUrl()).origin;
  } catch {
    apiOrigin = null; // Unparseable — leave CORS untouched rather than widening it.
  }
}

function allowApiCors() {
  refreshApiOrigin();

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (!apiOrigin) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }
    let sameServer = false;
    try {
      sameServer = new URL(details.url).origin === apiOrigin;
    } catch {
      sameServer = false;
    }
    if (!sameServer) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Access-Control-Allow-Origin": ["*"],
        "Access-Control-Allow-Headers": ["*"],
        "Access-Control-Allow-Methods": ["GET,POST,PUT,PATCH,DELETE,OPTIONS"],
      },
    });
  });
}

app.on("ready", () => {
  allowApiCors();
  createWindow();
  createTray();
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});
