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

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Gellyroller',
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

// IPC Handler for listing image files
ipcMain.handle('list-images', async () => {
  const homeDir = os.homedir();
  const gellyrollerPath = path.join(homeDir, 'gellyroller');

  try {
    // Check if directory exists
    if (!fs.existsSync(gellyrollerPath)) {
      return { success: false, files: [] };
    }

    // Read directory contents
    const files = fs.readdirSync(gellyrollerPath);

    // Filter for image files (bitmap formats)
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff', '.tif'];
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return imageExtensions.includes(ext);
    }).map(file => ({
      name: file,
      path: path.join(gellyrollerPath, file)
    }));

    debugLog('Found', imageFiles.length, 'image files');
    return { success: true, files: imageFiles };
  } catch (error) {
    console.error('Error listing images:', error);
    return { success: false, error: error.message, files: [] };
  }
});

// IPC Handler for listing vector files
ipcMain.handle('list-vectors', async () => {
  const homeDir = os.homedir();
  const gellyrollerPath = path.join(homeDir, 'gellyroller');

  try {
    // Check if directory exists
    if (!fs.existsSync(gellyrollerPath)) {
      return { success: false, files: [] };
    }

    // Read directory contents
    const files = fs.readdirSync(gellyrollerPath);

    // Filter for SVG files
    const vectorFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ext === '.svg';
    }).map(file => ({
      name: file,
      path: path.join(gellyrollerPath, file)
    }));

    debugLog('Found', vectorFiles.length, 'vector files');
    return { success: true, files: vectorFiles };
  } catch (error) {
    console.error('Error listing vectors:', error);
    return { success: false, error: error.message, files: [] };
  }
});

// IPC Handler for listing G-code files
ipcMain.handle('list-gcode', async () => {
  const homeDir = os.homedir();
  const gellyrollerPath = path.join(homeDir, 'gellyroller');

  try {
    // Check if directory exists
    if (!fs.existsSync(gellyrollerPath)) {
      return { success: false, files: [] };
    }

    // Read directory contents
    const files = fs.readdirSync(gellyrollerPath);

    // Filter for G-code files
    const gcodeFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ext === '.gcode' || ext === '.nc' || ext === '.gc';
    }).map(file => {
      const filePath = path.join(gellyrollerPath, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        path: filePath,
        size: stats.size,
        modified: stats.mtime
      };
    });

    // Sort by modified date (newest first)
    gcodeFiles.sort((a, b) => b.modified - a.modified);

    debugLog('Found', gcodeFiles.length, 'G-code files');
    return { success: true, files: gcodeFiles };
  } catch (error) {
    console.error('Error listing G-code files:', error);
    return { success: false, error: error.message, files: [] };
  }
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
    const homeDir = os.homedir();
    const gellyrollerPath = path.join(homeDir, 'gellyroller');

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

// IPC Handler for converting SVG to G-code using vpype
ipcMain.handle('eject-to-gcode', async (event, svgFilePath, outputWidth, outputHeight, unit, position = 'center') => {
  try {
    debugLog('=== EJECT-TO-GCODE HANDLER CALLED ===');
    debugLog('SVG file path:', svgFilePath);
    debugLog('Output dimensions:', outputWidth, 'x', outputHeight, unit);
    debugLog('Work area position:', position);

    // Verify the file exists
    if (!fs.existsSync(svgFilePath)) {
      return { success: false, error: 'SVG file does not exist' };
    }

    // Convert dimensions to mm for vpype
    const toMm = (value, unit) => {
      switch (unit) {
        case 'mm': return value;
        case 'cm': return value * 10;
        case 'in': return value * 25.4;
        default: return value;
      }
    };

    const widthMm = toMm(outputWidth, unit);
    const heightMm = toMm(outputHeight, unit);

    debugLog('Converted dimensions to mm:', widthMm, 'x', heightMm);

    // Calculate position offset based on selected position
    // Work area is assumed to be 400mm × 400mm (from hardware.js defaults)
    const workAreaWidth = 400;
    const workAreaHeight = 400;
    const margin = 5; // 5mm margin for paper
    const paperWidth = widthMm + (margin * 2);
    const paperHeight = heightMm + (margin * 2);

    let translateX, translateY;

    // Calculate X offset based on position
    switch (position) {
      case 'top-left':
      case 'center-left':
      case 'bottom-left':
        translateX = paperWidth / 2;
        break;
      case 'top-center':
      case 'center':
      case 'bottom-center':
        translateX = workAreaWidth / 2;
        break;
      case 'top-right':
      case 'center-right':
      case 'bottom-right':
        translateX = workAreaWidth - (paperWidth / 2);
        break;
      default:
        translateX = workAreaWidth / 2; // Default to center
    }

    // Calculate Y offset based on position
    switch (position) {
      case 'top-left':
      case 'top-center':
      case 'top-right':
        translateY = workAreaHeight - (paperHeight / 2);
        break;
      case 'center-left':
      case 'center':
      case 'center-right':
        translateY = workAreaHeight / 2;
        break;
      case 'bottom-left':
      case 'bottom-center':
      case 'bottom-right':
        translateY = paperHeight / 2;
        break;
      default:
        translateY = workAreaHeight / 2; // Default to center
    }

    debugLog('Position offsets:', `X: ${translateX}mm, Y: ${translateY}mm`);

    // Use gellyroller directory in user's home for G-code output
    const homeDir = os.homedir();
    const gcodePath = path.join(homeDir, 'gellyroller');
    if (!fs.existsSync(gcodePath)) {
      fs.mkdirSync(gcodePath, { recursive: true });
      debugLog('Created gellyroller directory:', gcodePath);
    }

    // Generate output filename
    const baseName = path.basename(svgFilePath, path.extname(svgFilePath));
    const timestamp = Date.now();
    const gcodeFilePath = path.join(gcodePath, `${baseName}_${timestamp}.gcode`);
    debugLog('Output G-code path:', gcodeFilePath);

    // Path to project vpype config file
    const vpypeConfigPath = path.join(__dirname, 'vpype.toml');
    debugLog('vpype config path:', vpypeConfigPath);

    // Build vpype command - scale to target dimensions and position in work area
    // The layout command fits the drawing to the specified page size
    const vpypeArgs = [
      '--config', vpypeConfigPath,
      'read', svgFilePath,  // Read original SVG
      'layout', '--fit-to-margins', '0mm', `${widthMm}mmx${heightMm}mm`,  // Scale to output dimensions with no margins
      'translate', `${translateX}mm`, `${translateY}mm`,  // Position in work area based on user selection
      'gwrite', '-p', 'johnny5', gcodeFilePath
    ];

    debugLog('Executing vpype command:', 'vpype', vpypeArgs.join(' '));

    // Execute vpype command
    return new Promise((resolve, reject) => {
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
        debugLog('vpype stdout:', stdout);
        debugLog('vpype stderr:', stderr);

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
              error: 'G-code file was not created',
              stderr: stderr
            });
          }
        } else {
          resolve({
            success: false,
            error: `vpype exited with code ${code}`,
            stderr: stderr,
            stdout: stdout
          });
        }
      });

      vpype.on('error', (err) => {
        console.error('Error spawning vpype:', err);
        resolve({
          success: false,
          error: 'Failed to execute vpype. Make sure vpype and vpype-gcode are installed.',
          details: err.message
        });
      });
    });
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
  const homeDir = os.homedir();
  const gellyrollerPath = path.join(homeDir, 'gellyroller');

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
            resolve('Not installed');
          } else {
            resolve(stdout.trim().replace('Python ', ''));
          }
        });
      });
      systemInfo.pythonVersion = pythonVersion;
    } catch (error) {
      systemInfo.pythonVersion = 'Not installed';
    }

    // Get pip version
    try {
      const { exec } = require('child_process');
      const pipVersion = await new Promise((resolve) => {
        exec('pip --version 2>&1 || pip3 --version 2>&1', (error, stdout) => {
          if (error) {
            resolve('Not installed');
          } else {
            const versionMatch = stdout.match(/pip\s+([\d.]+)/);
            resolve(versionMatch ? versionMatch[1] : 'Installed');
          }
        });
      });
      systemInfo.pipVersion = pipVersion;
    } catch (error) {
      systemInfo.pipVersion = 'Not installed';
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