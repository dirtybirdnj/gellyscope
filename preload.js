// preload.js - v3
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  parseSVG: (filePath, fileContent) => ipcRenderer.invoke('parse-svg', filePath, fileContent)
});