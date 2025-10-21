// main.js - v7
// Electron Main Process
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { parseString } = require('xml2js');
const { SerialPort } = require('serialport');

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
  console.log('=== PARSE-SVG HANDLER CALLED ===');
  console.log('File path:', filePath);
  console.log('Content length:', fileContent.length);
  console.log('Content preview:', fileContent.substring(0, 200));
  
  try {
    console.log('Calling parseSVGContent...');
    const svgData = await parseSVGContent(fileContent);
    console.log('Parse completed successfully');
    console.log('SVG Data:', svgData);
    
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
  console.log('=== parseSVGContent called ===');
  return new Promise((resolve, reject) => {
    console.log('Starting XML parse with xml2js...');
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
      
      console.log('XML parsed successfully');
      console.log('Parsed structure keys:', Object.keys(result));
      
      // Extract basic SVG attributes
      const svgRoot = result.svg || result;
      console.log('SVG root keys:', Object.keys(svgRoot));
      const attrs = svgRoot.$ || {};
      console.log('SVG attributes:', attrs);
      
      // Build hierarchical tree structure
      try {
        console.log('Building element tree...');
        const tree = buildElementTree(svgRoot, 'svg', 0);
        console.log('Tree built successfully');
        
        // Count total elements
        const elementCount = countElements(tree);
        console.log('Total element count:', elementCount);
        
        const finalResult = {
          viewBox: attrs.viewBox || null,
          width: attrs.width || null,
          height: attrs.height || null,
          content: content,
          tree: tree,
          elementCount: elementCount
        };
        
        console.log('Resolving with final result');
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
  console.log(`Building tree for tag: ${tagName}, depth: ${depth}`);
  console.log('Node keys:', Object.keys(node));
  
  const attrs = node.$ || {};
  const id = attrs.id || `${tagName}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`Element: ${tagName}, ID: ${id}, Attributes:`, attrs);
  
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
      console.log(`Skipping special property: ${key}`);
      continue;
    }
    
    const items = node[key];
    console.log(`Processing property: ${key}, is array: ${Array.isArray(items)}, length: ${items?.length}`);
    
    if (Array.isArray(items)) {
      items.forEach((item, idx) => {
        console.log(`Processing item ${idx} of ${key}:`, typeof item);
        if (typeof item === 'object' && item !== null) {
          const childElement = buildElementTree(item, key, depth + 1);
          element.children.push(childElement);
          console.log(`Added child: ${key}`);
        }
      });
    }
  }
  
  console.log(`Finished building ${tagName}, children count: ${element.children.length}`);
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