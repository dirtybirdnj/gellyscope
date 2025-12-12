# Gellyscope Codebase Overview

## Project Summary

**Gellyscope** (codename: Gellyroller) is a cross-platform Electron desktop application that provides an integrated workflow for:
- Image capture and processing
- Bitmap-to-vector tracing (using Potrace algorithm)
- SVG structure exploration
- G-code generation for CNC plotters/engravers

The application is optimized for jellyfish photography processing and plotter control workflows, particularly targeting the "Johnny5" plotter configuration.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Desktop Framework | Electron v33.0.0 |
| Frontend | JavaScript (ES6 modules), HTML5, CSS3 |
| Build Tool | electron-builder v25.0.0 |
| Testing | Jest v30.2.0 |
| SVG/XML Parsing | xml2js v0.6.2 |
| Image Vectorization | Potrace (custom JS port) |
| G-code Generation | vpype (external Python tool) |

## Directory Structure

```
gellyscope/
├── main.js                    # Electron main process, IPC handlers
├── preload.js                 # Electron preload script (API bridge)
├── index.html                 # Main application UI
├── styles.css                 # Application styling (dark theme)
├── potrace.js                 # Potrace algorithm (JS port)
├── vpype.toml                 # vpype G-code configuration
├── package.json               # Dependencies and build config
├── jest.config.js             # Test configuration
│
├── src/
│   ├── renderer.js            # Modular entry point
│   └── modules/
│       ├── home.js            # Home/dashboard tab
│       ├── camera.js          # Camera capture tab
│       ├── images.js          # Image gallery tab
│       ├── trace.js           # Image tracing & processing (largest)
│       ├── vectors.js         # Vector file gallery
│       ├── scope.js           # SVG structure explorer
│       ├── eject.js           # Page layout & G-code params
│       ├── render.js          # G-code visualization
│       ├── hardware.js        # Hardware config & page sizes
│       └── shared/
│           ├── debug.js       # Debug logging utility
│           ├── state.js       # Global state management
│           ├── tabs.js        # Tab navigation system
│           ├── utils.js       # Common utility functions
│           ├── ui-controls.js # Arrow buttons & collapsibles
│           ├── init.js        # App initialization
│           └── statusBar.js   # Status bar management
│
├── tests/
│   ├── unit/                  # Unit tests
│   └── integration/           # Integration tests
│
├── samples/                   # Sample images and SVGs
└── dist/                      # Build output
```

**User Workspace**: `~/gellyroller/` - Contains user images, SVGs, and G-code files

## Key Features by Tab

### Tab 1: Home Dashboard
- Workspace statistics (image/vector/G-code counts)
- Quick action buttons
- Navigation to other tabs via stat cards

### Tab 2: Camera Capture
- WebRTC camera access (ideal: 1920x1080)
- PNG capture with timestamp filenames
- Direct save to workspace

### Tab 3: Image Gallery
- Upload images (JPEG, PNG, BMP, WebP, TIFF)
- Grid thumbnail display
- Delete and "Trace" actions per image

### Tab 4: Trace (Core Feature)
- Real-time image filtering: brightness, contrast, saturation, hue, blur, sharpen, invert
- **Sobel edge detection** with threshold control
- Auto white/black frame removal
- Image scaling (100%, 75%, 50%, 25%)
- Crop controls with 4-point handles
- Horizontal/vertical flip
- **Potrace integration** with configurable parameters
- Layer capture and management
- Export to SVG or PNG

### Tab 5: Vector Gallery
- List SVG files from workspace
- Thumbnail previews
- Actions: Eject (to layout), Download, Delete

### Tab 6: Scope (SVG Explorer)
- Hierarchical tree view of SVG elements
- Interactive canvas with zoom/pan
- Element selection and inspection
- Crop controls

### Tab 7: Eject (Page Layout)
- Page presets: A0-A7, Letter, Legal, Tabloid, B4, B5
- Custom dimensions with unit conversion (mm, cm, in)
- 9-position workspace grid
- Scale control (50%-200%)
- G-code generation via vpype

### Tab 8: Render (G-code Viewer)
- Visual G-code path preview
- Zoom/pan controls
- Raw G-code text viewer
- File selection from workspace

### Tab 9: Hardware (Configuration)
- System info display
- vpype status and version
- Page size management
- Installation warnings

## Development Commands

```bash
# Install dependencies
npm install

# Run development
npm start

# Build for distribution
npm run build

# Testing
npm test                  # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
```

## External Dependencies

**Required for G-code generation:**
- Python 3.6+
- vpype package (`pip install vpype`)

**Build targets:**
- macOS: DMG, ZIP
- Windows: NSIS installer, portable EXE
- Linux: AppImage, DEB

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DEBUG` | Set to 'true' for verbose main process logging |

## File Format Support

| Type | Extensions |
|------|------------|
| Images | PNG, JPG, JPEG, BMP, WebP, TIFF |
| Vectors | SVG |
| G-code | .gcode, .nc, .gc |
