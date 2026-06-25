const { app, BrowserWindow, Menu, Tray, shell, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

// ── Config file (persisted API URL) ──────────────────────────────────────────

const CONFIG_PATH = path.join(app.getPath("userData"), "vrodux-config.json");

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
}

// ── Globals ──────────────────────────────────────────────────────────────────

let mainWindow = null;
let tray = null;
let isQuitting = false;

const DEFAULT_API_URL = "http://localhost:5000";

function getApiUrl() {
  return loadConfig().apiUrl || DEFAULT_API_URL;
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

ipcMain.handle("set-api-url", (_event, url) => {
  const cfg = loadConfig();
  cfg.apiUrl = url;
  saveConfig(cfg);
  // Reload the app with the new URL
  if (mainWindow) {
    mainWindow.webContents.reload();
  }
  return true;
});

ipcMain.handle("get-app-version", () => app.getVersion());

// ── App lifecycle ────────────────────────────────────────────────────────────

app.on("ready", () => {
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
