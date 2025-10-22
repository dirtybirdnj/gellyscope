// preload.js - v4
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  parseSVG: (filePath, fileContent) => ipcRenderer.invoke('parse-svg', filePath, fileContent),
  ensureGellyrollerDirectory: () => ipcRenderer.invoke('ensure-gellyroller-directory'),
  getGellyrollerPath: () => ipcRenderer.invoke('get-gellyroller-path')
});