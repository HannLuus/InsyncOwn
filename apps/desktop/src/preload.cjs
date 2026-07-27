const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("insyncown", {
  getStatus: () => ipcRenderer.invoke("daemon:getStatus"),
  pause: () => ipcRenderer.invoke("daemon:pause"),
  resume: () => ipcRenderer.invoke("daemon:resume"),
  authStatus: () => ipcRenderer.invoke("daemon:authStatus"),
  startAuth: () => ipcRenderer.invoke("daemon:startAuth"),
  importExistingRcloneAuth: (sourceConfigPath) =>
    ipcRenderer.invoke("daemon:importExistingRcloneAuth", sourceConfigPath),
  configureAuth: (clientId, clientSecret) =>
    ipcRenderer.invoke("daemon:configureAuth", clientId, clientSecret),
  listRemoteFolders: (path) => ipcRenderer.invoke("daemon:listRemoteFolders", path),
  addPair: (input) => ipcRenderer.invoke("daemon:addPair", input),
  removePair: (id) => ipcRenderer.invoke("daemon:removePair", id),
  setPairEnabled: (id, enabled) =>
    ipcRenderer.invoke("daemon:setPairEnabled", id, enabled),
  syncNow: (id) => ipcRenderer.invoke("daemon:syncNow", id),
  resyncPair: (id) => ipcRenderer.invoke("daemon:resyncPair", id),
  pickLocalFolder: () => ipcRenderer.invoke("dialog:pickLocalFolder"),
  openPath: (path) => ipcRenderer.invoke("shell:openPath", path),
  getAppInfo: () => ipcRenderer.invoke("app:getInfo"),
});
