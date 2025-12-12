# Gellyscope Data Formats

## SVG Data Structure

When an SVG is parsed via `window.electronAPI.parseSVG()`, it returns this structure:

```javascript
{
  viewBox: "0 0 800 600",           // SVG viewport string
  width: "800",                      // Width attribute
  height: "600",                     // Height attribute
  content: "<svg>...</svg>",         // Raw SVG XML string
  elementCount: 47,                  // Total elements in SVG
  tree: {                            // Hierarchical element tree
    id: "svg-root-uuid",
    tag: "svg",
    name: "svg",
    depth: 0,
    attributes: {
      viewBox: "0 0 800 600",
      width: "800",
      height: "600",
      xmlns: "http://www.w3.org/2000/svg"
    },
    children: [
      {
        id: "group-uuid",
        tag: "g",
        name: "g",
        depth: 1,
        attributes: {
          id: "layer1",
          transform: "translate(10, 20)"
        },
        children: [
          {
            id: "path-uuid",
            tag: "path",
            name: "path",
            depth: 2,
            attributes: {
              d: "M10,20 L30,40 C50,60 70,80 90,100",
              fill: "none",
              stroke: "#000000",
              "stroke-width": "1"
            },
            children: []
          }
        ]
      }
    ]
  }
}
```

### SVG Tree Node Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique identifier (UUID generated during parsing) |
| `tag` | string | SVG element tag name (svg, g, path, rect, etc.) |
| `name` | string | Display name (usually same as tag) |
| `depth` | number | Nesting level (0 = root) |
| `attributes` | object | All SVG attributes on this element |
| `children` | array | Nested child elements |

---

## Application State Structure

Global state managed by `src/modules/shared/state.js`:

```javascript
{
  // SVG/Scope tab state
  currentSVGData: null | SVGData,      // Parsed SVG data (see above)
  currentSelectedElement: null | string, // ID of selected tree element

  // View state
  zoomLevel: 1,                        // Canvas zoom multiplier
  viewMode: 'fit' | 'full',            // Fit to viewport or full size

  // Pan state (for canvas dragging)
  isPanning: false,
  startX: 0,                           // Mouse start X
  startY: 0,                           // Mouse start Y
  scrollLeft: 0,                       // Container scroll position
  scrollTop: 0,

  // Crop state
  isCropping: false,
  cropTop: 0.25,                       // 0-1 percentage from top
  cropBottom: 0.75,                    // 0-1 percentage from top
  cropLeft: 0.25,                      // 0-1 percentage from left
  cropRight: 0.75,                     // 0-1 percentage from left

  // Transform state
  flipH: false,                        // Horizontal flip
  flipV: false                         // Vertical flip
}
```

---

## G-code Output Format

Generated G-code follows the "johnny5" plotter profile defined in `vpype.toml`:

### Configuration (vpype.toml)

```toml
[gwrite.johnny5]
unit = "mm"
document_start = "G21\nG90\nM42 P0 S1\n"
segment_first = "M42 P0 S0\nG1 X{x:.4f} Y{y:.4f}\n"
segment = "G1 X{x:.4f} Y{y:.4f}\n"
segment_last = "G1 X{x:.4f} Y{y:.4f}\nM42 P0 S1\n"
vertical_flip = false
```

### G-code Commands Used

| Command | Description |
|---------|-------------|
| `G21` | Set units to millimeters |
| `G90` | Absolute positioning mode |
| `G1 X{x} Y{y}` | Linear move to coordinate |
| `M42 P0 S0` | Servo control: pen DOWN |
| `M42 P0 S1` | Servo control: pen UP |

### Example Output

```gcode
G21
G90
M42 P0 S1
M42 P0 S0
G1 X10.0000 Y20.0000
G1 X30.0000 Y40.0000
G1 X50.0000 Y60.0000
G1 X50.0000 Y60.0000
M42 P0 S1
M42 P0 S0
G1 X100.0000 Y100.0000
G1 X120.0000 Y120.0000
M42 P0 S1
```

---

## Page Size Presets

Built-in page sizes used in the Eject tab:

```javascript
const PAGE_PRESETS = {
  // ISO A Series (mm)
  'A0': { width: 841, height: 1189 },
  'A1': { width: 594, height: 841 },
  'A2': { width: 420, height: 594 },
  'A3': { width: 297, height: 420 },
  'A4': { width: 210, height: 297 },
  'A5': { width: 148, height: 210 },
  'A6': { width: 105, height: 148 },
  'A7': { width: 74, height: 105 },

  // ISO B Series (mm)
  'B4': { width: 250, height: 353 },
  'B5': { width: 176, height: 250 },

  // US Sizes (converted to mm)
  'Letter': { width: 215.9, height: 279.4 },
  'Legal': { width: 215.9, height: 355.6 },
  'Tabloid': { width: 279.4, height: 431.8 }
};
```

---

## Work Area Dimensions

The plotter work area is fixed at 400mm x 400mm.

Position grid (9 positions):

```
┌─────────┬─────────┬─────────┐
│ top-    │   top   │  top-   │
│  left   │         │  right  │
├─────────┼─────────┼─────────┤
│ middle- │ middle  │ middle- │
│  left   │         │  right  │
├─────────┼─────────┼─────────┤
│ bottom- │ bottom  │ bottom- │
│  left   │         │  right  │
└─────────┴─────────┴─────────┘
```

Position offset calculations (for centering page on work area):

```javascript
// Example for 'middle' position with A4 paper (210x297mm)
const workAreaWidth = 400;  // mm
const workAreaHeight = 400; // mm
const offsetX = (workAreaWidth - pageWidth) / 2;   // (400 - 210) / 2 = 95
const offsetY = (workAreaHeight - pageHeight) / 2; // (400 - 297) / 2 = 51.5
```

---

## Image Filter Parameters

Filter values used in the Trace tab:

| Filter | Range | Default | CSS Property |
|--------|-------|---------|--------------|
| Brightness | 0-200 | 100 | `brightness()` |
| Contrast | 0-200 | 100 | `contrast()` |
| Saturation | 0-200 | 100 | `saturate()` |
| Hue | 0-360 | 0 | `hue-rotate()` |
| Blur | 0-20 | 0 | `blur()` |
| Sharpen | 0-100 | 0 | Custom convolution |
| Greyscale | 0-100 | 0 | `grayscale()` |
| Sepia | 0-100 | 0 | `sepia()` |
| Invert | 0-100 | 0 | `invert()` |

---

## Sobel Edge Detection Parameters

| Parameter | Type | Range | Description |
|-----------|------|-------|-------------|
| enabled | boolean | - | Enable/disable edge detection |
| threshold | number | 0-255 | Gradient magnitude threshold |
| invert | boolean | - | Swap edge/background colors |

---

## Potrace Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| turnpolicy | string | 'minority' | Path ambiguity resolution |
| turdsize | number | 2 | Suppress speckles up to N pixels |
| optcurve | boolean | true | Enable curve optimization |
| alphamax | number | 1 | Corner threshold (0-1.34) |
| opttolerance | number | 0.2 | Optimization tolerance (0-1) |

**Turn Policy Options:**
- `minority` - Prefer turning in minority direction
- `majority` - Prefer turning in majority direction
- `black` - Prefer connecting black areas
- `white` - Prefer connecting white areas
- `left` - Always turn left
- `right` - Always turn right

---

## File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Camera capture | `capture_YYYYMMDD_HHMMSS.png` | `capture_20241215_143022.png` |
| Traced SVG | `{original}_traced.svg` | `photo_traced.svg` |
| G-code output | `{svg_name}.gcode` | `photo_traced.gcode` |
