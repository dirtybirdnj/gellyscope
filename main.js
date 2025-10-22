// main.js - v12
// Electron Main Process
const { app, BrowserWindow, ipcMain, safeStorage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { parseString } = require('xml2js');
require('dotenv').config();

// Debug flag from .env
const DEBUG = process.env.DEBUG === 'true';

// Debug logging helper
function debugLog(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

let mainWindow;

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

  // Open DevTools for debugging
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Check and create gellyroller directory
async function ensureGellyrollerDirectory() {
  const homeDir = os.homedir();
  const gellyrollerPath = path.join(homeDir, 'gellyroller');

  debugLog('Checking for gellyroller directory at:', gellyrollerPath);

  try {
    // Check if directory exists
    if (!fs.existsSync(gellyrollerPath)) {
      debugLog('Gellyroller directory does not exist');

      // Prompt user to create directory
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Create Directory', 'Cancel'],
        defaultId: 0,
        title: 'Gellyroller Directory',
        message: 'The gellyroller directory does not exist in your home folder.',
        detail: `Would you like to create it at:\n${gellyrollerPath}?`
      });

      if (result.response === 0) {
        // User chose to create directory
        fs.mkdirSync(gellyrollerPath, { recursive: true });
        debugLog('Gellyroller directory created successfully');

        // Store the directory path using safeStorage if available
        if (safeStorage.isEncryptionAvailable()) {
          const encryptedPath = safeStorage.encryptString(gellyrollerPath);
          debugLog('Directory path encrypted and stored');
          // You could store this encrypted path in app config if needed
        }

        return { success: true, path: gellyrollerPath };
      } else {
        debugLog('User cancelled directory creation');
        return { success: false, cancelled: true };
      }
    } else {
      debugLog('Gellyroller directory already exists');
      return { success: true, path: gellyrollerPath, existed: true };
    }
  } catch (error) {
    console.error('Error ensuring gellyroller directory:', error);
    return { success: false, error: error.message };
  }
}

// IPC Handler for checking/creating gellyroller directory
ipcMain.handle('ensure-gellyroller-directory', async () => {
  return await ensureGellyrollerDirectory();
});

// IPC Handler for getting gellyroller directory path
ipcMain.handle('get-gellyroller-path', () => {
  const homeDir = os.homedir();
  return path.join(homeDir, 'gellyroller');
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