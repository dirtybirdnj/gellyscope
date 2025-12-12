# Gellyscope API Reference

## IPC Handlers (main.js)

The main process exposes these IPC handlers via `window.electronAPI` in the renderer.

### Directory Management

```javascript
// Ensure ~/gellyroller directory exists
await window.electronAPI.ensureGellyrollerDirectory()
// Returns: void

// Get workspace path
await window.electronAPI.getGellyrollerPath()
// Returns: string (e.g., "/Users/name/gellyroller")
```

### File Listing

```javascript
// List image files in workspace
await window.electronAPI.listImages()
// Returns: Array<{ name: string, path: string }>

// List SVG files in workspace
await window.electronAPI.listVectors()
// Returns: Array<{ name: string, path: string }>

// List G-code files with metadata
await window.electronAPI.listGcodeFiles()
// Returns: Array<{
//   name: string,
//   path: string,
//   size: number,      // bytes
//   modified: string   // ISO date
// }>
```

### File Operations

```javascript
// Read file as base64 data URL
await window.electronAPI.readFileBase64(filePath: string)
// Returns: string (data:mime/type;base64,...)

// Read file as plain text
await window.electronAPI.readFileText(filePath: string)
// Returns: string

// Delete file (with safety checks)
await window.electronAPI.deleteFile(filePath: string)
// Returns: { success: boolean, error?: string }

// Save base64 image to disk
await window.electronAPI.saveImage(fileName: string, dataUrl: string)
// Returns: { success: boolean, filePath?: string, error?: string }
```

### SVG Processing

```javascript
// Parse SVG file and build element tree
await window.electronAPI.parseSVG(filePath: string)
// Returns: {
//   viewBox: string,
//   width: string,
//   height: string,
//   content: string,      // Raw SVG XML
//   tree: SVGTreeNode,    // See DATA_FORMATS.md
//   elementCount: number
// }
```

### G-code Generation

```javascript
// Convert SVG to G-code using vpype
await window.electronAPI.ejectToGcode({
  svgPath: string,           // Input SVG file path
  pageWidth: number,         // Page width in mm
  pageHeight: number,        // Page height in mm
  positionX: number,         // X offset in work area (mm)
  positionY: number,         // Y offset in work area (mm)
  outputFileName?: string    // Optional output filename
})
// Returns: { success: boolean, outputPath?: string, error?: string }

// Save G-code file via dialog
await window.electronAPI.downloadGcode(gcodeContent: string, suggestedName: string)
// Returns: { success: boolean, filePath?: string }
```

### System Information

```javascript
// Get system versions
await window.electronAPI.getSystemInfo()
// Returns: {
//   nodeVersion: string,
//   platform: string,
//   pythonVersion: string | null
// }

// Get vpype status
await window.electronAPI.getVpypeInfo()
// Returns: {
//   installed: boolean,
//   version: string | null,
//   plugins: string[]
// }
```

---

## Module APIs

### src/modules/shared/state.js

```javascript
import { state, setState, getState } from './shared/state.js';

// Direct state access (read)
const svgData = state.currentSVGData;

// Update state
setState({ currentSVGData: newData, zoomLevel: 1.5 });

// Read specific key
const zoom = getState('zoomLevel');
```

### src/modules/shared/utils.js

```javascript
import { formatBytes, escapeHtml, toMm, fromMm, mmToInches, mmToCm } from './shared/utils.js';

// Format bytes to human readable
formatBytes(1024)              // "1.00 KB"
formatBytes(1048576)           // "1.00 MB"

// Escape HTML special characters
escapeHtml('<script>')         // "&lt;script&gt;"

// Unit conversion
toMm(1, 'in')                  // 25.4
toMm(10, 'cm')                 // 100
fromMm(25.4, 'in')             // 1
mmToInches(25.4)               // 1
mmToCm(100)                    // 10
```

### src/modules/shared/tabs.js

```javascript
import { switchTab, initTabNavigation } from './shared/tabs.js';

// Switch to a specific tab
switchTab('trace');            // 'home', 'camera', 'images', 'trace',
                               // 'vectors', 'scope', 'eject', 'render', 'hardware'

// Initialize tab click handlers (called once at startup)
initTabNavigation();
```

### src/modules/shared/debug.js

```javascript
import { debugLog } from './shared/debug.js';

// Conditional console logging (respects DEBUG env)
debugLog('Processing image:', imagePath);
debugLog('SVG parsed:', { elementCount: 47 });
```

---

## Tab Module Functions

### home.js

```javascript
initHomeTab()        // Initialize home tab event listeners
loadHomeScreen()     // Load statistics and display dashboard
```

### camera.js

```javascript
initCameraTab()      // Initialize camera access and capture button
// Camera stream managed internally via WebRTC getUserMedia()
```

### images.js

```javascript
initImagesTab()      // Initialize upload button and gallery
loadImages()         // Refresh image gallery from workspace
```

### trace.js (Main entry points)

```javascript
initTraceTab()       // Initialize all trace controls and listeners

// Display image for tracing
showImageInTraceTab(imageSrc: string, fileName: string)

// Run potrace algorithm on current image
performTrace()

// Update dimension display after changes
updateDimensionDisplay()
```

### vectors.js

```javascript
initVectorsTab()     // Initialize vector gallery

loadVectors()        // Refresh vector list from workspace

// Action handlers (called from UI buttons)
handleVectorEject(filePath: string)              // Load SVG into eject tab
handleVectorDownload(filePath: string, fileName: string)  // Download SVG
handleVectorDelete(filePath: string, fileName: string)    // Delete file
```

### scope.js

```javascript
initScopeTab()       // Initialize scope tab controls

handleFile(file: File)              // Process uploaded SVG file
displaySVG(data: SVGData)           // Render SVG on canvas
renderTree(tree: SVGTreeNode)       // Display element hierarchy in sidebar
```

### eject.js

```javascript
initEjectTab()       // Initialize eject tab controls

loadEjectTab()       // Load current SVG into layout view
updatePagePreview()  // Redraw page visualization on canvas
generateGcode()      // Call eject-to-gcode IPC handler
```

### render.js

```javascript
initRenderTab()      // Initialize render tab controls

loadGcodeFiles()     // Refresh G-code file list
drawGcode()          // Render G-code paths on canvas
```

### hardware.js

```javascript
initHardwareTab()    // Initialize hardware tab

loadHardwareInfo()   // Load and display system/vpype info

// Page size management
addPageSize(name: string, width: number, height: number, unit: string)
editPageSize(index: number)
deletePageSize(index: number)
```

---

## Potrace API (potrace.js)

```javascript
// The potrace module is used internally by trace.js
// Key parameters passed to potrace:

{
  turnpolicy: string,    // 'minority', 'majority', 'black', 'white', 'left', 'right'
  turdsize: number,      // Suppress speckles up to N pixels (default: 2)
  optcurve: boolean,     // Enable curve optimization (default: true)
  alphamax: number,      // Corner threshold 0-1.34 (default: 1)
  opttolerance: number   // Optimization tolerance 0-1 (default: 0.2)
}
```

---

## Key DOM Element IDs

### Trace Tab
- `#trace-canvas` - Main trace preview canvas
- `#trace-image` - Hidden image element for processing
- `#brightness-slider`, `#contrast-slider`, etc. - Filter controls
- `#sobel-checkbox`, `#sobel-threshold` - Edge detection controls
- `#trace-button` - Trigger potrace
- `#save-svg-button`, `#save-png-button` - Export buttons

### Eject Tab
- `#eject-canvas` - Page layout preview
- `#page-size-select` - Page preset dropdown
- `#page-width`, `#page-height` - Custom dimensions
- `#position-grid` - 9-position placement grid
- `#scale-slider` - Artwork scale control
- `#generate-gcode-button` - Generate G-code

### Render Tab
- `#render-canvas` - G-code visualization canvas
- `#gcode-file-select` - File selection dropdown
- `#gcode-text` - Raw G-code display

### Scope Tab
- `#scope-canvas` - SVG preview canvas
- `#element-tree` - Hierarchical element list
- `#svg-upload` - File upload input
