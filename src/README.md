# Gellyscope Modular Architecture

This directory contains the refactored modular codebase for Gellyscope.

## Structure Overview

### Main Entry Point
- **`renderer.js`** (60 lines) - Main entry point that initializes all modules

### Tab Modules
Each tab is now a self-contained module:

- **`modules/home.js`** (193 lines) - Home screen with workspace overview
- **`modules/camera.js`** (118 lines) - Camera capture functionality
- **`modules/images.js`** (195 lines) - Image gallery and management
- **`modules/trace.js`** (1,280 lines) - Image tracing with Potrace
- **`modules/vectors.js`** (161 lines) - Vector file gallery
- **`modules/eject.js`** (660 lines) - Page layout and sizing
- **`modules/render.js`** (385 lines) - G-code preview and rendering
- **`modules/scope.js`** (869 lines) - SVG structure explorer

### Shared Utilities
Reusable code shared across modules:

- **`modules/shared/debug.js`** (10 lines) - Debug logging utilities
- **`modules/shared/state.js`** (28 lines) - Global state management
- **`modules/shared/tabs.js`** (25 lines) - Tab navigation system
- **`modules/shared/utils.js`** (46 lines) - Common utility functions
- **`modules/shared/ui-controls.js`** (73 lines) - Arrow buttons & collapsible sections
- **`modules/shared/init.js`** (25 lines) - Initialization tasks

## Module Communication

Modules communicate through:

1. **Shared State** - Centralized state management via `modules/shared/state.js`
2. **Dynamic Imports** - Modules can dynamically import other modules when needed
3. **Global Functions** - `switchTab()` is globally available for cross-module navigation

Example:
```javascript
// From images.js - loading an image into trace tab
import('./trace.js').then(module => {
  module.showImageInTraceTab(imageSrc, fileName);
});
```

## Benefits of This Architecture

### For Development
- **Smaller Files**: Each file is now under 1,300 lines (largest was 3,789 lines)
- **Better Organization**: Related functionality grouped together
- **Easier Testing**: Each module can be tested independently
- **Code Reuse**: Shared utilities prevent duplication

### For AI Coding
- **Token Efficiency**: AI can work with individual modules without loading entire codebase
- **Context Focus**: Smaller files mean better AI understanding of context
- **Faster Iterations**: Changes to one tab don't require loading all tabs

## File Size Comparison

**Before Refactoring:**
- `renderer.js`: 3,789 lines (36,550 tokens) ❌ Exceeds AI context limits

**After Refactoring:**
- Largest module: `trace.js` at 1,280 lines (~12,000 tokens) ✅ Well within limits
- Most modules: 200-700 lines (~2,000-7,000 tokens) ✅ Optimal for AI
- Main entry: `renderer.js` at 60 lines ✅ Easy to understand

## Module Dependencies

```
renderer.js (Main Entry)
├── shared/init.js
├── shared/tabs.js
├── shared/ui-controls.js
└── All Tab Modules
    ├── home.js
    ├── camera.js
    ├── images.js → trace.js
    ├── trace.js → shared/utils, shared/tabs
    ├── vectors.js → eject.js
    ├── eject.js → shared/state, shared/utils
    ├── render.js → shared/debug
    └── scope.js → shared/state, shared/utils

shared/
├── debug.js (no dependencies)
├── state.js (no dependencies)
├── tabs.js (no dependencies)
├── utils.js (no dependencies)
├── ui-controls.js → debug.js
└── init.js → debug.js
```

## Adding New Features

To add a new feature:

1. Identify which module it belongs to
2. Edit only that module file
3. If it's shared functionality, add to `modules/shared/utils.js`
4. If it needs state, use `modules/shared/state.js`

## Rollback

If you need to revert to the original monolithic version:

```bash
cp renderer.js.backup renderer.js
# Update index.html to use <script src="renderer.js"></script>
```

The backup file `renderer.js.backup` contains the original 3,789-line version.
