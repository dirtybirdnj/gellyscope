# Gellyscope - Session Notes

## Session Date: 2025-12-09

## Current Status: Codebase Review & Planning

Project was dormant since November 26, 2025. This session focused on repository cleanup and architectural review before implementing the Mask tab feature.

---

## Actions Completed

### Git Cleanup
- Fetched latest from remote
- PR #13 (`ui-enhancements-buttons`) was already merged
- Synced local main with origin/main
- Deleted 7 merged local branches:
  - `claude/add-render-tab-011CUP3qmoPHRUNjLZ58xBik`
  - `claude/add-trace-tab-011CUMSfhY3XrkdNwQ49EGhK`
  - `claude/fix-svg-save-bug-011CUR6FdS1kCxpZ7Gb6Pbas`
  - `claude/improve-svg-scaling-011CUPRugJAzioxV6VE66MMF`
  - `claude/improve-ui-design-011CUSEAYDn9Ws3ipxGgs5By`
  - `claude/update-photos-tab-011CUMRHxyFgaE5kVsWABxe6`
  - `ui-enhancements-buttons`

### New Feature Since Last Session
Commit `7849055` added:
- Sobel edge detection filter
- Extended scaling options
- Auto frame removal for traces

---

## Codebase Architecture Summary

### File Structure
| Component | File | Purpose |
|-----------|------|---------|
| Main Process | `main.js` (~25KB) | Electron main, IPC handlers, file I/O |
| Preload | `preload.js` | IPC bridge (`window.electronAPI`) |
| Entry Point | `src/renderer.js` | Tab initialization, routing |
| Tab Modules | `src/modules/*.js` | One module per tab |
| Shared Utils | `src/modules/shared/*.js` | tabs.js, utils.js, statusBar.js, debug.js |

### Tab Modules
| Module | Lines | Purpose |
|--------|-------|---------|
| `trace.js` | ~1790 | Image tracing with Potrace, layer management |
| `eject.js` | ~600 | G-code generation, vpype integration |
| `vectors.js` | ~300 | SVG file management |
| `images.js` | ~195 | Image upload and grid display |
| `hardware.js` | ~200 | Page sizes, hardware config |
| `home.js` | ~100 | Welcome screen, file counts |
| `camera.js` | ~150 | Webcam capture |
| `render.js` | ~200 | G-code preview |
| `scope.js` | ~50 | Debug/inspection (hidden) |

### Key Patterns

1. **Tab Module Pattern**:
   ```javascript
   export function initTabName() { /* setup event listeners */ }
   export function loadTabName() { /* load content on tab switch */ }
   ```

2. **3-Panel Layout** (Trace tab):
   - Left panel: Layers list
   - Center: Canvas/viewer area
   - Right panel: Controls

3. **File Storage**: All user files in `~/gellyroller/`

4. **No Build Step**: Pure ES modules, no webpack/bundler

5. **Image Pipeline**: Images → Trace (potrace.js) → Vectors (SVG) → Eject (G-code)

---

## Mask Tab Feature - Revised Recommendations

### Previous Plan (Nov 26)
The original plan proposed using `react-mask-editor` library, requiring:
- Adding React + ReactDOM as dependencies
- Creating React "island" components
- Dynamic mounting/unmounting on tab switch

### Concerns with React Approach

1. **Architectural Mismatch**: Entire codebase is vanilla JS - React creates two paradigms to maintain

2. **Dependency Bloat**: react + react-dom + react-mask-editor for one feature

3. **Unnecessary Complexity**: The core functionality (canvas brush painting) can be done with vanilla JS

### Recommended Approach: Vanilla JS Canvas

**Rationale**:
- Maintain architectural consistency
- Leverage existing patterns from `trace.js`
- The `applySobelFilter()` and `applyImageProcessing()` functions already demonstrate canvas manipulation

### Alternative: Integrate into Trace Tab

Instead of a separate Mask tab, consider adding mask tools within the Trace tab:
- Simpler workflow (no tab switching)
- Mask and trace are tightly coupled
- Trade-off: Trace tab is already ~1800 lines

### Revised Implementation Plan (if separate tab)

| Phase | Description |
|-------|-------------|
| 1 | Add Mask tab button and HTML structure to index.html |
| 2 | Create `src/modules/mask.js` with vanilla JS canvas |
| 3 | Implement brush tools (size, opacity, clear/invert) |
| 4 | Add mask upload with dimension validation |
| 5 | Add color region extraction for uploaded masks |
| 6 | Bridge to Trace via `window.currentMaskData` |
| 7 | Modify `trace.js` to apply mask before Potrace |

### Code Organization Suggestion

Consider splitting `trace.js` (~1800 lines) before adding mask integration:
- `trace-core.js` - Core tracing logic
- `trace-layers.js` - Layer management
- `trace-output.js` - Save/export functionality
- `trace-ui.js` - UI event handlers

---

## Original Mask Feature Requirements (Preserved)

### User Decisions (Nov 26)
| Question | Answer |
|----------|--------|
| Mask creation method | **Both** - Paint in-app for simple masks, upload bitmaps for complex masks |
| Tab position | **Before Trace** (Images → Mask → Trace) |

### Core Features Needed
1. Paint masks directly on uploaded images using brush tools
2. Upload pre-made mask bitmaps (from Photoshop/Illustrator)
3. Divide uploaded masks into color regions
4. Use masks to isolate parts of images for selective tracing

---

## Next Steps

1. **Decision Required**: Separate Mask tab vs. integrated into Trace tab
2. **Before Implementation**: Test the new Sobel edge detection feature
3. **If Proceeding**:
   - Prototype vanilla JS canvas brush drawing
   - Start with Phase 1 (HTML structure)

---

## Notes

- Remote still has stale branches that could be pruned with `git push origin --delete <branch>`
- The app uses Potrace (JavaScript port) for bitmap-to-vector conversion
- vpype is used for G-code optimization (optional external dependency)
