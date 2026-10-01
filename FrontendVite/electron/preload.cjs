const { contextBridge, ipcRenderer } = require("electron");

// Resolved SYNCHRONOUSLY, here in preload, before any page script runs.
//
// This is the whole point of the file: the 90-odd API modules build their base URL in a
// module-level const (`const BASE = `${getApiBaseUrl()}/api/hr``), which evaluates the moment the
// module is imported — long before any promise could resolve. An async bridge would hand them
// `undefined` and they would silently fall back to localhost, which is exactly the bug this
// replaces. A plain string, available before the bundle loads, is the only shape that works.
const apiUrl = ipcRenderer.sendSync("get-api-url-sync");

contextBridge.exposeInMainWorld("vroduxDesktop", {
  /** The configured server, already resolved. Synchronous by necessity — see above. */
  apiUrl,
  getApiUrl: () => ipcRenderer.invoke("get-api-url"),
  setApiUrl: (url) => ipcRenderer.invoke("set-api-url", url),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  isDesktop: true,
  onShowServerPrompt: (callback) => {
    ipcRenderer.on("show-server-prompt", (_event, currentUrl) => callback(currentUrl));
  },
});
