// preload.js - v2
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  parseSVG: (filePath, fileContent) => ipcRenderer.invoke('parse-svg', filePath, fileContent),
  getSerialPorts: () => ipcRenderer.invoke('get-serial-ports'),
  connectSerial: (port, baudRate) => ipcRenderer.invoke('connect-serial', port, baudRate),
  disconnectSerial: () => ipcRenderer.invoke('disconnect-serial'),
  sendFileToPlotter: (fileContent) => ipcRenderer.invoke('send-file-to-plotter', fileContent),
  onSerialData: (callback) => ipcRenderer.on('serial-data', (event, data) => callback(data))
});