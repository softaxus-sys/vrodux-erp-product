const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vroduxDesktop", {
  getApiUrl: () => ipcRenderer.invoke("get-api-url"),
  setApiUrl: (url) => ipcRenderer.invoke("set-api-url", url),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  isDesktop: true,
  onShowServerPrompt: (callback) => {
    ipcRenderer.on("show-server-prompt", (_event, currentUrl) => callback(currentUrl));
  },
});
