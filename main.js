// main.js - v15
// Electron Main Process
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
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

/**
 * Get the path to the gellyroller directory
 * @returns {string} Absolute path to gellyroller directory
 */
function getGellyrollerPath() {
  return path.join(os.homedir(), 'gellyroller');
}

/**
 * Convert value to millimeters from different units
 * Note: This duplicates shared/utils.js toMm() but is kept separate
 * due to CommonJS/ES6 module system differences
 * @param {number} value - The value to convert
 * @param {string} unit - The unit ('mm', 'cm', 'in')
 * @returns {number} Value in millimeters
 */
function toMm(value, unit) {
  switch (unit) {
    case 'mm': return value;
    case 'cm': return value * 10;
    case 'in': return value * 25.4;
    default: return value;
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
  const gellyrollerPath = getGellyrollerPath();

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
  return getGellyrollerPath();
});

/**
 * Lists files in gellyroller directory filtered by extensions
 * @param {string[]} extensions - Array of file extensions (e.g., ['.png', '.jpg'])
 * @param {boolean} includeMetadata - Whether to include file size and modified date
 * @param {boolean} sortByDate - Whether to sort by modified date (newest first)
 * @returns {Object} Result object with success status and files array
 */
async function listFilesByExtension(extensions, includeMetadata = false, sortByDate = false) {
  const gellyrollerPath = getGellyrollerPath();

  try {
    if (!fs.existsSync(gellyrollerPath)) {
      return { success: false, files: [] };
    }

    const files = fs.readdirSync(gellyrollerPath);
    const filtered = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return extensions.includes(ext);
    }).map(file => {
      const filePath = path.join(gellyrollerPath, file);
      const fileObj = { name: file, path: filePath };

      if (includeMetadata) {
        const stats = fs.statSync(filePath);
        fileObj.size = stats.size;
        fileObj.modified = stats.mtime;
      }
      return fileObj;
    });

    if (sortByDate && includeMetadata) {
      filtered.sort((a, b) => b.modified - a.modified);
    }

    return { success: true, files: filtered };
  } catch (error) {
    console.error('Error listing files:', error);
    return { success: false, error: error.message, files: [] };
  }
}

// IPC Handler for listing image files
ipcMain.handle('list-images', async () => {
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff', '.tif'];
  const result = await listFilesByExtension(imageExtensions);
  debugLog('Found', result.files.length, 'image files');
  return result;
});

// IPC Handler for listing vector files
ipcMain.handle('list-vectors', async () => {
  const result = await listFilesByExtension(['.svg']);
  debugLog('Found', result.files.length, 'vector files');
  return result;
});

// IPC Handler for listing G-code files
ipcMain.handle('list-gcode', async () => {
  const result = await listFilesByExtension(['.gcode', '.nc', '.gc'], true, true);
  debugLog('Found', result.files.length, 'G-code files');
  return result;
});

// IPC Handler for reading file as base64 (for displaying images)
ipcMain.handle('read-file-base64', async (event, filePath) => {
  try {
    const data = fs.readFileSync(filePath);
    const base64 = data.toString('base64');
    const ext = path.extname(filePath).toLowerCase();

    // Determine MIME type
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };

    const mimeType = mimeTypes[ext] || 'application/octet-stream';

    return {
      success: true,
      data: base64,
      mimeType: mimeType
    };
  } catch (error) {
    console.error('Error reading file:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler for reading text files
ipcMain.handle('read-file-text', async (event, filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return {
      success: true,
      data: data
    };
  } catch (error) {
    console.error('Error reading text file:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler for deleting files
ipcMain.handle('delete-file', async (event, filePath) => {
  try {
    // Verify the file is in the gellyroller directory for safety
    const gellyrollerPath = getGellyrollerPath();

    if (!filePath.startsWith(gellyrollerPath)) {
      return { success: false, error: 'Cannot delete files outside gellyroller directory' };
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File does not exist' };
    }

    // Delete the file
    fs.unlinkSync(filePath);
    debugLog('File deleted successfully:', filePath);

    return { success: true };
  } catch (error) {
    console.error('Error deleting file:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Modify SVG content to set specific dimensions in millimeters
 * @param {string} svgContent - Original SVG content
 * @param {number} widthMm - Target width in mm
 * @param {number} heightMm - Target height in mm
 * @returns {string} Modified SVG content
 */
function modifySVGDimensions(svgContent, widthMm, heightMm) {
  // Parse SVG to modify viewBox
  const viewBoxMatch = svgContent.match(/viewBox=["']([^"']+)["']/);

  if (viewBoxMatch) {
    const viewBoxValues = viewBoxMatch[1].split(/\s+/).map(parseFloat);
    const [minX, minY] = viewBoxValues;

    debugLog('Original viewBox:', viewBoxValues);
    debugLog('Scaling to:', widthMm, 'x', heightMm, 'mm');

    // Create new viewBox with target dimensions in mm
    const newViewBox = `${minX} ${minY} ${widthMm} ${heightMm}`;
    svgContent = svgContent.replace(/viewBox=["'][^"']+["']/, `viewBox="${newViewBox}"`);

    debugLog('New viewBox:', newViewBox);
  } else {
    // If no viewBox, try to add one based on width/height attributes
    const widthMatch = svgContent.match(/width=["']([^"']+)["']/);
    const heightMatch = svgContent.match(/height=["']([^"']+)["']/);

    if (widthMatch && heightMatch) {
      // Insert viewBox after opening svg tag
      const viewBox = `viewBox="0 0 ${widthMm} ${heightMm}"`;
      svgContent = svgContent.replace(/<svg/, `<svg ${viewBox}`);

      debugLog('Added viewBox:', viewBox);
    }
  }

  // Also set width and height attributes to mm
  svgContent = svgContent.replace(/width=["'][^"']+["']/, `width="${widthMm}mm"`);
  svgContent = svgContent.replace(/height=["'][^"']+["']/, `height="${heightMm}mm"`);

  return svgContent;
}

/**
 * Execute vpype to convert SVG to G-code
 * @param {string} tempFilePath - Path to temporary scaled SVG file
 * @param {string} gcodeFilePath - Path for output G-code file
 * @param {string} vpypeConfigPath - Path to vpype configuration file
 * @returns {Promise<Object>} Result with success status and file path
 */
function executeVpype(tempFilePath, gcodeFilePath, vpypeConfigPath) {
  return new Promise((resolve) => {
    const vpypeArgs = [
      '--config', vpypeConfigPath,
      'read', tempFilePath,
      'gwrite', '-p', 'johnny5', gcodeFilePath
    ];

    debugLog('Executing vpype command:', 'vpype', vpypeArgs.join(' '));

    const vpype = spawn('vpype', vpypeArgs);
    let stdout = '';
    let stderr = '';

    vpype.stdout.on('data', (data) => {
      stdout += data.toString();
      debugLog('vpype stdout:', data.toString());
    });

    vpype.stderr.on('data', (data) => {
      stderr += data.toString();
      debugLog('vpype stderr:', data.toString());
    });

    vpype.on('close', (code) => {
      debugLog('vpype process exited with code:', code);

      // Clean up temporary file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          debugLog('Cleaned up temp file:', tempFilePath);
        } catch (err) {
          console.error('Error cleaning up temp file:', err);
        }
      }

      if (code === 0) {
        // Check if output file was created
        if (fs.existsSync(gcodeFilePath)) {
          debugLog('G-code file created successfully:', gcodeFilePath);
          resolve({
            success: true,
            gcodeFilePath: gcodeFilePath,
            message: 'G-code generated successfully'
          });
        } else {
          resolve({
            success: false,
            error: 'G-code file was not created'
          });
        }
      } else {
        resolve({
          success: false,
          error: `vpype exited with code ${code}`,
          stderr: stderr
        });
      }
    });

    vpype.on('error', (err) => {
      console.error('Error spawning vpype:', err);

      // Clean up temporary file on error
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupErr) {
          console.error('Error cleaning up temp file:', cleanupErr);
        }
      }

      resolve({
        success: false,
        error: 'Failed to execute vpype. Make sure vpype and vpype-gcode are installed.',
        details: err.message
      });
    });
  });
}

// IPC Handler for converting SVG to G-code using vpype
ipcMain.handle('eject-to-gcode', async (event, svgFilePath, outputWidth, outputHeight, unit) => {
  try {
    debugLog('=== EJECT-TO-GCODE HANDLER CALLED ===');
    debugLog('SVG file path:', svgFilePath);
    debugLog('Output dimensions:', outputWidth, 'x', outputHeight, unit);

    // Verify the file exists
    if (!fs.existsSync(svgFilePath)) {
      return { success: false, error: 'SVG file does not exist' };
    }

    // Convert dimensions to mm for vpype
    const widthMm = toMm(outputWidth, unit);
    const heightMm = toMm(outputHeight, unit);
    debugLog('Converted dimensions to mm:', widthMm, 'x', heightMm);

    // Read and modify SVG content
    let svgContent = fs.readFileSync(svgFilePath, 'utf8');
    debugLog('Original SVG length:', svgContent.length);
    svgContent = modifySVGDimensions(svgContent, widthMm, heightMm);

    // Ensure output directory exists
    const gcodePath = getGellyrollerPath();
    if (!fs.existsSync(gcodePath)) {
      fs.mkdirSync(gcodePath, { recursive: true });
      debugLog('Created gellyroller directory:', gcodePath);
    }

    // Write scaled SVG to temporary file
    const baseName = path.basename(svgFilePath, path.extname(svgFilePath));
    const timestamp = Date.now();
    const tempFilePath = path.join(gcodePath, `${baseName}_${timestamp}_scaled.svg`);
    const gcodeFilePath = path.join(gcodePath, `${baseName}_${timestamp}.gcode`);

    fs.writeFileSync(tempFilePath, svgContent, 'utf8');
    debugLog('Scaled SVG written to:', tempFilePath);
    debugLog('Output G-code path:', gcodeFilePath);

    // Path to project vpype config file
    const vpypeConfigPath = path.join(__dirname, 'vpype.toml');
    debugLog('vpype config path:', vpypeConfigPath);

    // Execute vpype command
    return await executeVpype(tempFilePath, gcodeFilePath, vpypeConfigPath);
  } catch (error) {
    console.error('Error in eject-to-gcode handler:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler for downloading G-code file
ipcMain.handle('download-gcode', async (event, gcodeFilePath) => {
  try {
    debugLog('=== DOWNLOAD-GCODE HANDLER CALLED ===');
    debugLog('G-code file path:', gcodeFilePath);

    // Verify the file exists
    if (!fs.existsSync(gcodeFilePath)) {
      return { success: false, error: 'G-code file does not exist' };
    }

    // Get the filename
    const fileName = path.basename(gcodeFilePath);

    // Show save dialog
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save G-code File',
      defaultPath: fileName,
      filters: [
        { name: 'G-code Files', extensions: ['gcode', 'nc', 'txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled) {
      debugLog('Download canceled by user');
      return { success: false, canceled: true };
    }

    // Copy the file to the selected location
    fs.copyFileSync(gcodeFilePath, result.filePath);
    debugLog('G-code file saved to:', result.filePath);

    return { success: true, filePath: result.filePath };
  } catch (error) {
    console.error('Error downloading G-code:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler for saving captured images
ipcMain.handle('save-image', async (event, imageData, filename) => {
  const gellyrollerPath = getGellyrollerPath();

  try {
    // Ensure directory exists
    if (!fs.existsSync(gellyrollerPath)) {
      fs.mkdirSync(gellyrollerPath, { recursive: true });
    }

    // Remove data URL prefix if present (e.g., "data:image/png;base64," or "data:image/svg+xml;base64,")
    const base64Data = imageData.replace(/^data:image\/[^;]+;base64,/, '');

    // Generate filename if not provided
    const finalFilename = filename || `capture_${Date.now()}.png`;
    const filePath = path.join(gellyrollerPath, finalFilename);

    // Write the file
    fs.writeFileSync(filePath, base64Data, 'base64');

    debugLog('Image saved successfully:', filePath);

    return {
      success: true,
      path: filePath,
      filename: finalFilename
    };
  } catch (error) {
    console.error('Error saving image:', error);
    return { success: false, error: error.message };
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

// IPC Handler for getting system information
ipcMain.handle('get-system-info', async () => {
  try {
    const systemInfo = {
      nodeVersion: process.version,
      platform: `${os.platform()} ${os.arch()}`,
      osVersion: os.release()
    };

    // Get npm version
    try {
      const { exec } = require('child_process');
      const npmVersion = await new Promise((resolve) => {
        exec('npm --version', (error, stdout) => {
          if (error) {
            resolve('Not found');
          } else {
            resolve(stdout.trim());
          }
        });
      });
      systemInfo.npmVersion = npmVersion;
    } catch (error) {
      systemInfo.npmVersion = 'Not found';
    }

    // Get Python version
    try {
      const { exec } = require('child_process');
      const pythonVersion = await new Promise((resolve) => {
        exec('python3 --version 2>&1 || python --version 2>&1', (error, stdout) => {
          if (error) {
            resolve('Not found');
          } else {
            resolve(stdout.trim().replace('Python ', ''));
          }
        });
      });
      systemInfo.pythonVersion = pythonVersion;
    } catch (error) {
      systemInfo.pythonVersion = 'Not found';
    }

    return { success: true, data: systemInfo };
  } catch (error) {
    console.error('Error getting system info:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler for getting vpype information
ipcMain.handle('get-vpype-info', async () => {
  try {
    const { exec } = require('child_process');

    // Check if vpype is installed and get version
    const vpypeVersion = await new Promise((resolve) => {
      exec('vpype --version 2>&1', (error, stdout, stderr) => {
        if (error) {
          resolve(null);
        } else {
          const output = stdout + stderr;
          const versionMatch = output.match(/vpype[,\s]+version\s+([\d.]+)/i) || output.match(/([\d.]+)/);
          resolve(versionMatch ? versionMatch[1] : output.trim());
        }
      });
    });

    if (!vpypeVersion) {
      return {
        success: true,
        data: {
          installed: false,
          version: null,
          plugins: []
        }
      };
    }

    // Get vpype plugins
    const plugins = await new Promise((resolve) => {
      exec('vpype --help 2>&1', (error, stdout, stderr) => {
        if (error) {
          resolve([]);
        } else {
          const output = stdout + stderr;
          // Try to extract plugin information from help output
          // This is a basic implementation - vpype doesn't have a direct plugin list command
          const pluginLines = [];
          const lines = output.split('\n');
          let inPluginSection = false;

          for (const line of lines) {
            if (line.includes('Commands') || line.includes('plugins')) {
              inPluginSection = true;
            }
            if (inPluginSection && line.trim().startsWith('-')) {
              break;
            }
            if (inPluginSection && line.trim() && !line.includes('Commands')) {
              const match = line.match(/^\s+([a-z_]+)/);
              if (match) {
                pluginLines.push(match[1]);
              }
            }
          }

          resolve(pluginLines.length > 0 ? pluginLines : ['Standard vpype commands available']);
        }
      });
    });

    return {
      success: true,
      data: {
        installed: true,
        version: vpypeVersion,
        plugins: plugins
      }
    };
  } catch (error) {
    console.error('Error getting vpype info:', error);
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

// XML2JS special keys that should be ignored when building element tree
const XML2JS_SPECIAL_KEYS = new Set(['$', '_', '$$']);

/**
 * Build hierarchical tree structure from parsed XML
 * @param {Object} node - Parsed XML node from xml2js
 * @param {string} tagName - Name of the XML tag
 * @param {number} depth - Current depth in the tree
 * @returns {Object} Element tree structure
 */
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

  // Extract child elements from xml2js structure
  // xml2js stores child elements as properties (each property is an array)
  const childNodes = Object.entries(node)
    .filter(([key]) => !XML2JS_SPECIAL_KEYS.has(key))
    .flatMap(([childTag, items]) =>
      Array.isArray(items)
        ? items.map(item => ({ tag: childTag, item }))
        : []
    );

  debugLog(`Found ${childNodes.length} child nodes`);

  // Recursively build child elements
  element.children = childNodes
    .filter(({ item }) => typeof item === 'object' && item !== null)
    .map(({ tag, item }) => {
      debugLog(`Processing child: ${tag}`);
      return buildElementTree(item, tag, depth + 1);
    });

  debugLog(`Finished building ${tagName}, children count: ${element.children.length}`);
  return element;
}

/**
 * Count total elements in tree recursively
 * @param {Object} tree - Element tree
 * @returns {number} Total count of elements
 */
function countElements(tree) {
  let count = 1;
  if (tree.children) {
    tree.children.forEach(child => {
      count += countElements(child);
    });
  }
  return count;
}