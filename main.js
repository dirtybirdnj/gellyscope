// main.js - Electron Main Process
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { parseString } = require('xml2js');
const { SerialPort } = require('serialport');

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
  try {
    const svgData = await parseSVGContent(fileContent);
    
    return {
      success: true,
      data: svgData
    };
  } catch (error) {
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
  return new Promise((resolve, reject) => {
    parseString(content, { 
      preserveChildrenOrder: true,
      explicitChildren: true,
      charsAsChildren: true
    }, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Extract basic SVG attributes
      const svgRoot = result.svg || result;
      const attrs = svgRoot.$ || {};
      
      // Build hierarchical tree structure
      const tree = buildElementTree(svgRoot, 'svg', 0);
      
      // Count total elements
      const elementCount = countElements(tree);
      
      resolve({
        viewBox: attrs.viewBox || null,
        width: attrs.width || null,
        height: attrs.height || null,
        content: content,
        tree: tree,
        elementCount: elementCount
      });
    });
  });
}

function buildElementTree(node, tagName, depth) {
  const attrs = node.$ || {};
  const id = attrs.id || `${tagName}-${Math.random().toString(36).substr(2, 9)}`;
  
  const element = {
    id: id,
    tag: tagName,
    name: attrs.id || tagName,
    depth: depth,
    attributes: attrs,
    children: []
  };
  
  // Process children
  if (node.$) {
    node.$.forEach(child => {
      if (child['#name']) {
        const childElement = buildElementTree(child, child['#name'], depth + 1);
        element.children.push(childElement);
      }
    });
  } else {
    // Fallback: check for common SVG element properties
    const childTags = ['g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'image', 'use', 'defs', 'symbol', 'clipPath', 'mask'];
    childTags.forEach(tag => {
      if (node[tag]) {
        const items = Array.isArray(node[tag]) ? node[tag] : [node[tag]];
        items.forEach(item => {
          const childElement = buildElementTree(item, tag, depth + 1);
          element.children.push(childElement);
        });
      }
    });
  }
  
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