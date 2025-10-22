// preload.js - v6
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  parseSVG: (filePath, fileContent) => ipcRenderer.invoke('parse-svg', filePath, fileContent),
  ensureGellyrollerDirectory: () => ipcRenderer.invoke('ensure-gellyroller-directory'),
  getGellyrollerPath: () => ipcRenderer.invoke('get-gellyroller-path'),
  listImages: () => ipcRenderer.invoke('list-images'),
  listVectors: () => ipcRenderer.invoke('list-vectors'),
  readFileBase64: (filePath) => ipcRenderer.invoke('read-file-base64', filePath),
  readFileText: (filePath) => ipcRenderer.invoke('read-file-text', filePath),
  saveImage: (imageData, filename) => ipcRenderer.invoke('save-image', imageData, filename),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  ejectToGcode: (svgFilePath, outputWidth, outputHeight, unit) => ipcRenderer.invoke('eject-to-gcode', svgFilePath, outputWidth, outputHeight, unit),
  downloadGcode: (gcodeFilePath) => ipcRenderer.invoke('download-gcode', gcodeFilePath)
});