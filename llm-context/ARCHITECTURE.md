# Gellyscope Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        ELECTRON APP                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Renderer   │◄──►│   Preload    │◄──►│    Main      │      │
│  │   Process    │    │   Script     │    │   Process    │      │
│  │              │    │              │    │              │      │
│  │  index.html  │    │  preload.js  │    │   main.js    │      │
│  │  styles.css  │    │              │    │              │      │
│  │  src/        │    │  electronAPI │    │  IPC handlers│      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                                       │               │
│         ▼                                       ▼               │
│  ┌──────────────┐                      ┌──────────────┐        │
│  │  potrace.js  │                      │  File System │        │
│  │  (in-memory) │                      │  ~/gellyroller│       │
│  └──────────────┘                      └──────────────┘        │
│                                                │               │
│                                                ▼               │
│                                        ┌──────────────┐        │
│                                        │    vpype     │        │
│                                        │  (external)  │        │
│                                        └──────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

## Process Architecture

### Main Process (main.js)
- Creates browser window with security settings
- Handles all file system operations
- Manages IPC communication with renderer
- Spawns external processes (vpype)
- Context isolation enabled, nodeIntegration disabled

### Preload Script (preload.js)
- Bridges main and renderer processes
- Exposes safe `electronAPI` to renderer
- No direct Node.js access in renderer

### Renderer Process (src/)
- All UI logic and DOM manipulation
- ES6 modules for code organization
- In-memory image processing (potrace)
- Communicates with main via `window.electronAPI`

---

## Module Architecture

```
src/renderer.js (Entry Point)
│
├── shared/init.js ──────► shared/debug.js
│
├── shared/tabs.js
│
├── shared/ui-controls.js ──► shared/debug.js
│
├── shared/statusBar.js
│
├── home.js
│
├── camera.js
│
├── images.js ──────────────► trace.js (dynamic import)
│
├── trace.js ───────────────► shared/{utils, debug, tabs}
│                            └► hardware.js
│
├── vectors.js ─────────────► shared/{state, tabs}
│                            └► eject.js (dynamic import)
│
├── scope.js ───────────────► shared/{state, utils, debug}
│
├── eject.js ───────────────► shared/{state, utils, debug}
│                            └► hardware.js
│
├── render.js ──────────────► hardware.js
│                            └► eject.js (dynamic import)
│
└── hardware.js ────────────► render.js (cross-reference)
```

### Dynamic Imports
Some modules use dynamic imports for lazy loading:
- `images.js` → `trace.js` (when clicking "Trace" button)
- `vectors.js` → `eject.js` (when clicking "Eject" button)
- `render.js` → `eject.js` (for page size data)

---

## Data Flow

### Image Capture to G-code Pipeline

```
1. IMAGE INPUT
   ┌─────────────┐     ┌─────────────┐
   │   Camera    │     │   Upload    │
   │   Tab       │     │   Tab       │
   └──────┬──────┘     └──────┬──────┘
          │                    │
          └────────┬───────────┘
                   ▼
2. IMAGE PROCESSING (Trace Tab)
   ┌─────────────────────────────────┐
   │  • Load image onto canvas       │
   │  • Apply filters (brightness,   │
   │    contrast, etc.)              │
   │  • Sobel edge detection         │
   │  • Crop/scale/flip              │
   └──────────────┬──────────────────┘
                  ▼
3. VECTORIZATION (Trace Tab)
   ┌─────────────────────────────────┐
   │  • Potrace algorithm            │
   │  • Generate SVG paths           │
   │  • Layer management             │
   │  • Save to ~/gellyroller/       │
   └──────────────┬──────────────────┘
                  ▼
4. SVG SELECTION (Vectors Tab)
   ┌─────────────────────────────────┐
   │  • List SVG files               │
   │  • Preview thumbnails           │
   │  • Select for layout            │
   └──────────────┬──────────────────┘
                  ▼
5. PAGE LAYOUT (Eject Tab)
   ┌─────────────────────────────────┐
   │  • Select page size             │
   │  • Position on work area        │
   │  • Scale artwork                │
   │  • Generate G-code              │
   └──────────────┬──────────────────┘
                  ▼
6. G-CODE GENERATION (vpype)
   ┌─────────────────────────────────┐
   │  • vpype read <svg>             │
   │  • layout --fit-to-margins      │
   │  • translate <offset>           │
   │  • gwrite -p johnny5            │
   └──────────────┬──────────────────┘
                  ▼
7. OUTPUT (Render Tab)
   ┌─────────────────────────────────┐
   │  • Visualize G-code paths       │
   │  • Download for plotter         │
   └─────────────────────────────────┘
```

---

## State Management

### Global State (shared/state.js)

```javascript
// Singleton pattern
const state = {
  currentSVGData: null,
  currentSelectedElement: null,
  zoomLevel: 1,
  viewMode: 'fit',
  isPanning: false,
  // ... more state
};

// Read
import { state } from './shared/state.js';
const data = state.currentSVGData;

// Write
import { setState } from './shared/state.js';
setState({ currentSVGData: newData });
```

### Module-Local State
Each tab module manages its own local state for:
- UI component states (expanded/collapsed)
- Temporary values (filter previews)
- Form inputs

---

## IPC Communication Pattern

```
Renderer                    Preload                     Main
   │                           │                          │
   │  electronAPI.listImages() │                          │
   ├──────────────────────────►│                          │
   │                           │   ipcRenderer.invoke     │
   │                           │   ('list-images')        │
   │                           ├─────────────────────────►│
   │                           │                          │
   │                           │   fs.readdirSync()       │
   │                           │   filter by extension    │
   │                           │                          │
   │                           │◄─────────────────────────┤
   │                           │   [{name, path}, ...]    │
   │◄──────────────────────────┤                          │
   │   [{name, path}, ...]     │                          │
```

---

## Security Model

### Context Isolation
- Renderer cannot access Node.js APIs directly
- All system operations go through IPC
- Preload script creates controlled API surface

### File System Restrictions
- All user files confined to `~/gellyroller/`
- Path validation before file operations
- No arbitrary file system access

### External Process Execution
- Only vpype is executed
- Fixed command structure
- User input sanitized before shell execution

---

## Tab Loading Lifecycle

```
Tab Button Click
      │
      ▼
switchTab(tabName)
      │
      ├── Hide all tab contents
      │
      ├── Remove 'active' from all buttons
      │
      ├── Show target tab content
      │
      ├── Add 'active' to target button
      │
      └── Call tab-specific loader
          │
          ├── 'home'     → loadHomeScreen()
          ├── 'camera'   → (camera initialized on first use)
          ├── 'images'   → loadImages()
          ├── 'trace'    → (content persists)
          ├── 'vectors'  → loadVectors()
          ├── 'scope'    → (content persists)
          ├── 'eject'    → loadEjectTab()
          ├── 'render'   → loadGcodeFiles()
          └── 'hardware' → loadHardwareInfo()
```

---

## Error Handling Strategy

### File Operations
```javascript
// Main process wraps all file ops in try/catch
try {
  const files = fs.readdirSync(directory);
  return files.filter(/* ... */);
} catch (error) {
  console.error('Error listing files:', error);
  return [];
}
```

### IPC Responses
```javascript
// Success/error pattern
return { success: true, data: result };
return { success: false, error: error.message };
```

### Renderer Handling
```javascript
const result = await window.electronAPI.someOperation();
if (!result.success) {
  showError(result.error);
  return;
}
// Continue with result.data
```

---

## Build & Distribution

### Build Targets
```
electron-builder
├── macOS
│   ├── DMG (installer)
│   └── ZIP (portable)
├── Windows
│   ├── NSIS (installer)
│   └── Portable EXE
└── Linux
    ├── AppImage
    └── DEB package
```

### Included Files
- main.js, preload.js
- index.html, styles.css
- potrace.js
- src/** (all modules)
- vpype.toml
- node_modules (production only)
