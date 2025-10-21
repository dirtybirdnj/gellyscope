// main.js - v10
// Electron Main Process
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { parseString } = require('xml2js');
const { SerialPort } = require('serialport');
require('dotenv').config();

// Debug flag from .env
const DEBUG = process.env.DEBUG === 'true';

// Debug logging helper
function debugLog(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

// Enable live reload in development
try {
  require('electron-reloader')(module, {
    debug: true,
    watchRenderer: true
  });
} catch (_) { 
  // electron-reloader not installed - running without hot reload
}

let mainWindow;
let serialPort = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  
  // Open DevTools in development
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serialPort && serialPort.isOpen) {
    serialPort.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handler for parsing SVG files
ipcMain.handle('parse-svg', async (event, filePath, fileContent) => {
  debugLog('=== PARSE-SVG HANDLER CALLED ===');
  debugLog('File path:', filePath);
  debugLog('Content length:', fileContent.length);
  debugLog('Content preview:', fileContent.substring(0, 200));
  
  try {
    debugLog('Calling parseSVGContent...');
    const svgData = await parseSVGContent(fileContent);
    debugLog('Parse completed successfully');
    debugLog('SVG Data:', svgData);
    
    return {
      success: true,
      data: svgData
    };
  } catch (error) {
    console.error('=== PARSE ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return {
      success: false,
      error: error.message
    };
  }
});

// IPC Handler for getting serial ports
ipcMain.handle('get-serial-ports', async () => {
  try {
    const ports = await SerialPort.list();
    return ports;
  } catch (error) {
    console.error('Error listing ports:', error);
    return [];
  }
});

// IPC Handler for connecting to serial port
ipcMain.handle('connect-serial', async (event, portPath, baudRate) => {
  try {
    if (serialPort && serialPort.isOpen) {
      await serialPort.close();
    }
    
    serialPort = new SerialPort({
      path: portPath,
      baudRate: baudRate,
      dataBits: 8,
      stopBits: 1,
      parity: 'none'
    });
    
    serialPort.on('data', (data) => {
      mainWindow.webContents.send('serial-data', data.toString());
    });
    
    serialPort.on('error', (err) => {
      console.error('Serial port error:', err);
      mainWindow.webContents.send('serial-data', `Error: ${err.message}`);
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC Handler for disconnecting serial port
ipcMain.handle('disconnect-serial', async () => {
  try {
    if (serialPort && serialPort.isOpen) {
      await serialPort.close();
      serialPort = null;
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC Handler for sending file to plotter
ipcMain.handle('send-file-to-plotter', async (event, fileContent) => {
  try {
    if (!serialPort || !serialPort.isOpen) {
      return { success: false, error: 'Serial port not connected' };
    }
    
    // Send file content line by line
    const lines = fileContent.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length > 0) {
        await new Promise((resolve, reject) => {
          serialPort.write(line + '\n', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        // Small delay between lines
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

async function parseSVGContent(content) {
  debugLog('=== parseSVGContent called ===');
  return new Promise((resolve, reject) => {
    debugLog('Starting XML parse with xml2js...');
    parseString(content, { 
      explicitChildren: true,
      preserveChildrenOrder: true,
      charsAsChildren: false,
      includeWhiteChars: false,
      normalize: true,
      normalizeTags: false,
      explicitArray: true
    }, (err, result) => {
      if (err) {
        console.error('XML parse error:', err);
        reject(err);
        return;
      }
      
      debugLog('XML parsed successfully');
      debugLog('Parsed structure keys:', Object.keys(result));
      
      // Extract basic SVG attributes
      const svgRoot = result.svg || result;
      debugLog('SVG root keys:', Object.keys(svgRoot));
      const attrs = svgRoot.$ || {};
      debugLog('SVG attributes:', attrs);
      
      // Build hierarchical tree structure
      try {
        debugLog('Building element tree...');
        const tree = buildElementTree(svgRoot, 'svg', 0);
        debugLog('Tree built successfully');
        
        // Count total elements
        const elementCount = countElements(tree);
        debugLog('Total element count:', elementCount);
        
        const finalResult = {
          viewBox: attrs.viewBox || null,
          width: attrs.width || null,
          height: attrs.height || null,
          content: content,
          tree: tree,
          elementCount: elementCount
        };
        
        debugLog('Resolving with final result');
        resolve(finalResult);
      } catch (buildError) {
        console.error('=== BUILD TREE ERROR ===');
        console.error('Error message:', buildError.message);
        console.error('Error stack:', buildError.stack);
        reject(buildError);
      }
    });
  });
}

function buildElementTree(node, tagName, depth) {
  debugLog(`Building tree for tag: ${tagName}, depth: ${depth}`);
  debugLog('Node keys:', Object.keys(node));
  
  const attrs = node.$ || {};
  const id = attrs.id || `${tagName}-${Math.random().toString(36).substr(2, 9)}`;
  
  debugLog(`Element: ${tagName}, ID: ${id}, Attributes:`, attrs);
  
  const element = {
    id: id,
    tag: tagName,
    name: attrs.id || tagName,
    depth: depth,
    attributes: attrs,
    children: []
  };
  
  // xml2js stores child elements directly as properties on the node object
  // Each property is an array of elements with that tag name
  for (const key in node) {
    // Skip special xml2js properties
    if (key === '$' || key === '_' || key === '$$') {
      debugLog(`Skipping special property: ${key}`);
      continue;
    }
    
    const items = node[key];
    debugLog(`Processing property: ${key}, is array: ${Array.isArray(items)}, length: ${items?.length}`);
    
    if (Array.isArray(items)) {
      items.forEach((item, idx) => {
        debugLog(`Processing item ${idx} of ${key}:`, typeof item);
        if (typeof item === 'object' && item !== null) {
          const childElement = buildElementTree(item, key, depth + 1);
          element.children.push(childElement);
          debugLog(`Added child: ${key}`);
        }
      });
    }
  }
  
  debugLog(`Finished building ${tagName}, children count: ${element.children.length}`);
  return element;
}

function countElements(tree) {
  let count = 1;
  if (tree.children) {
    tree.children.forEach(child => {
      count += countElements(child);
    });
  }
  return count;
}