# Refactoring Testing Plan

This document outlines all the manual tests needed to verify the backend refactoring work is functioning correctly.

## Overview

The following tasks were completed:
- ✅ Task 1: Extract IPC Handler Utilities
- ✅ Task 2: Split trace.js Module
- ✅ Task 3: Centralize Path Utilities
- ✅ Task 4: Consolidate Unit Conversion
- ✅ Task 5: Extract Large Functions from eject-to-gcode
- ✅ Task 6: Validation Testing (syntax checks passed)
- ✅ Task 7: Fix Save SVG UX Navigation
- ✅ Task 8: Fix Save G-code UX Navigation
- ✅ Task 9: Refactor SVG Parsing to Functional Approach
- ✅ Task 10: Standardize Error Handling
- ✅ Task 11: Extend State Management

## Test Environment Setup

1. **Start the application:**
   ```bash
   cd /home/user/gellyscope
   npm start
   ```

2. **Prepare test files:**
   - Have at least one bitmap image ready (PNG, JPG, etc.)
   - Have at least one SVG file ready for testing

## Critical Path Tests

### 1. Trace Tab - Core Functionality (Task 2)

**Test: Image Loading and Tracing**
- [ ] Open the Trace tab
- [ ] Click "Upload Image" and select a bitmap image
- [ ] Verify image appears in the viewer
- [ ] Verify default Potrace parameters are visible
- [ ] Adjust Potrace parameters (threshold, turdSize, etc.)
- [ ] Verify the trace preview updates automatically (500ms debounce)
- [ ] Verify SVG overlay appears on top of the image

**Test: Image Processing Filters**
- [ ] Upload an image
- [ ] Adjust brightness slider (-100 to 100)
- [ ] Adjust contrast slider (0 to 200)
- [ ] Verify image processing updates the trace
- [ ] Verify dimension display shows correct values

**Test: Layer Management**
- [ ] Upload and trace an image
- [ ] Click "Capture Layer" button
- [ ] Verify layer appears in the layers list
- [ ] Verify layer shows shape count and point count
- [ ] Capture multiple layers (2-3)
- [ ] Verify all layers are stacked in the display
- [ ] Delete a layer using the × button
- [ ] Verify layer is removed from both list and display

**Test: Page Size and Layout**
- [ ] Select different page sizes (A4, Letter, Legal)
- [ ] Toggle between Portrait and Landscape
- [ ] Verify page background updates correctly
- [ ] Select "Custom" page size
- [ ] Enter custom dimensions (4 × 6 inches)
- [ ] Verify custom page background appears

**Test: Output Scale**
- [ ] Adjust output scale slider (10% - 200%)
- [ ] Verify image container scales correctly
- [ ] Verify page background remains properly sized

### 2. Trace → Save SVG → Eject Flow (Tasks 3, 7)

**Test: Save SVG and Navigate to Eject**
- [ ] Complete a trace with at least one captured layer
- [ ] Click "Save SVG" button
- [ ] Verify save dialog appears with correct default location (gellyroller/svg/)
- [ ] Save the file with a descriptive name
- [ ] **CRITICAL:** Verify app automatically switches to Eject tab
- [ ] **CRITICAL:** Verify the saved SVG is loaded in Eject tab
- [ ] Verify SVG is displayed correctly
- [ ] Verify SVG dimensions are shown

### 3. Eject Tab - State Management (Task 11)

**Test: Page Size Selection**
- [ ] With an SVG loaded, select different page sizes
- [ ] Verify page background updates correctly
- [ ] Verify dimensions shown on page edges
- [ ] Toggle between Portrait and Landscape
- [ ] Verify layout orientation changes

**Test: Output Dimensions**
- [ ] Adjust width input
- [ ] Verify height auto-adjusts (aspect ratio locked)
- [ ] Adjust height input
- [ ] Verify width auto-adjusts
- [ ] Change unit dropdown (in → cm → mm)
- [ ] Verify values convert correctly
- [ ] Change back to inches
- [ ] Verify values convert back correctly

**Test: Page Size Button States**
- [ ] Set output dimensions to 4 × 6 inches
- [ ] Verify A4 and Letter buttons are enabled (size fits)
- [ ] Set output dimensions to 20 × 30 inches
- [ ] Verify smaller page size buttons are disabled/grayed
- [ ] Verify "Custom" is always enabled

### 4. Eject → Generate G-code → Render Flow (Tasks 5, 8, 10)

**Test: G-code Generation with Error Handling**
- [ ] With an SVG loaded in Eject tab
- [ ] Set output dimensions (e.g., 4 × 6 inches)
- [ ] Select a page size (e.g., A4 Portrait)
- [ ] Click "Generate G-code" button
- [ ] Verify button shows "⏳ Generating..." state
- [ ] Wait for generation to complete
- [ ] **CRITICAL:** Verify app automatically switches to Render tab
- [ ] **CRITICAL:** Verify the generated G-code file is loaded
- [ ] Verify G-code preview displays on canvas

**Test: G-code Generation Error Cases**
- [ ] Load an SVG in Eject tab
- [ ] Clear output dimensions (leave inputs empty)
- [ ] Click "Generate G-code"
- [ ] Verify alert: "Please enter valid output dimensions"
- [ ] Enter invalid dimensions (0 or negative)
- [ ] Click "Generate G-code"
- [ ] Verify error is caught and displayed

### 5. Render Tab - State Management (Task 11)

**Test: G-code File List**
- [ ] Switch to Render tab
- [ ] Verify list of G-code files appears
- [ ] Verify file names, sizes, and dates are shown
- [ ] Click on a G-code file
- [ ] Verify file becomes active (highlighted)
- [ ] Verify G-code loads and displays on canvas
- [ ] Verify G-code text appears in expandable section

**Test: G-code Visualization Controls**
- [ ] With a G-code file loaded
- [ ] Click "Zoom In" button multiple times
- [ ] Verify canvas zooms in correctly
- [ ] Click "Zoom Out" button
- [ ] Verify canvas zooms out
- [ ] Click "Reset View"
- [ ] Verify zoom resets to 1x and pan resets to center
- [ ] Use mouse wheel to zoom in/out
- [ ] Verify wheel zoom works correctly

**Test: G-code Panning**
- [ ] With a G-code file loaded and zoomed in
- [ ] Click and drag on canvas
- [ ] Verify drawing pans with mouse
- [ ] Verify cursor shows "panning" state
- [ ] Release mouse button
- [ ] Verify panning stops
- [ ] Move mouse outside canvas while panning
- [ ] Verify panning stops when leaving canvas

**Test: G-code Info Display**
- [ ] With a G-code file loaded
- [ ] Verify info overlay shows:
  - Dimensions (width × height in mm)
  - Number of paths
  - Current zoom percentage
- [ ] Zoom in/out
- [ ] Verify zoom percentage updates

**Test: G-code File Deletion**
- [ ] In Render tab, find a test G-code file
- [ ] Click the 🗑️ delete button
- [ ] Verify confirmation dialog appears
- [ ] Click "Cancel" - verify file is not deleted
- [ ] Click delete button again
- [ ] Click "OK" - verify file is deleted
- [ ] Verify file list refreshes
- [ ] If deleted file was active, verify preview clears

### 6. Unit Conversion Functions (Task 4)

**Test: Unit Conversions in Eject Tab**
- [ ] Load an SVG in Eject tab
- [ ] Set output dimensions: 4.00 × 6.00 inches
- [ ] Change unit to "cm"
- [ ] Verify values change to approximately 10.2 × 15.2 cm
- [ ] Change unit to "mm"
- [ ] Verify values change to approximately 102 × 152 mm
- [ ] Change back to "in"
- [ ] Verify values return to 4.00 × 6.00 inches

### 7. Path Utilities (Task 3)

**Test: File Operations Use Correct Paths**
- [ ] Save an SVG file from Trace tab
- [ ] Verify file is saved to `gellyroller/svg/` directory
- [ ] Generate G-code from Eject tab
- [ ] Verify G-code is saved to `gellyroller/gcode/` directory
- [ ] Check filesystem to confirm files are in correct locations

### 8. SVG Element Tree Building (Task 9)

**Test: SVG Scope Tab (if available)**
- [ ] Load an SVG file with multiple elements
- [ ] Switch to SVG Scope tab
- [ ] Verify element tree displays correctly
- [ ] Verify hierarchy shows parent/child relationships
- [ ] Click on elements in tree
- [ ] Verify corresponding elements highlight

### 9. Window Resize Handling

**Test: Responsive Behavior**
- [ ] Load content in Trace tab (page background visible)
- [ ] Resize application window
- [ ] Verify page background resizes proportionally
- [ ] Switch to Eject tab with SVG loaded
- [ ] Resize window
- [ ] Verify page background and dimension lines update
- [ ] Switch to Render tab with G-code loaded
- [ ] Resize window
- [ ] Verify canvas redraws correctly

### 10. Error Handling (Task 10)

**Test: IPC Error Handling**
- [ ] Try to load a corrupted or invalid file
- [ ] Verify error message is displayed (not just console error)
- [ ] Verify app doesn't crash
- [ ] Verify user can continue using the app

**Test: File System Errors**
- [ ] Try to save to a read-only location (if possible)
- [ ] Verify error is caught and displayed
- [ ] Try to delete a file that doesn't exist
- [ ] Verify error is caught gracefully

## Regression Tests

### Test: Existing Functionality Still Works

**Vector File Loading**
- [ ] Load a vector SVG file directly (not from trace)
- [ ] Verify it displays in Scope tab
- [ ] Verify element tree is built correctly

**Multiple File Types**
- [ ] Test with PNG images
- [ ] Test with JPG images
- [ ] Test with SVG files
- [ ] Verify all formats load correctly

**State Persistence**
- [ ] Make changes in Trace tab (adjust parameters)
- [ ] Switch to another tab
- [ ] Return to Trace tab
- [ ] Verify parameters are maintained
- [ ] Similarly test Eject and Render tabs

## Performance Tests

**Test: Large File Handling**
- [ ] Load a large bitmap image (>2MB)
- [ ] Verify tracing completes without freezing
- [ ] Load a complex SVG with many paths
- [ ] Verify rendering is smooth
- [ ] Generate G-code from complex SVG
- [ ] Verify generation completes successfully

**Test: Memory Leaks**
- [ ] Perform complete workflow 3-5 times:
  - Upload image → Trace → Save SVG → Generate G-code
- [ ] Monitor memory usage (Task Manager / Activity Monitor)
- [ ] Verify memory doesn't continuously increase

## Known Issues to Watch For

Based on the refactoring work, pay special attention to:

1. **State Management Issues:**
   - State not persisting between tabs
   - State updates not triggering UI refreshes
   - Old state values being used after updates

2. **Navigation Flow:**
   - Save SVG should go to Eject tab (not Vectors tab)
   - Save G-code should go to Render tab
   - File lists should refresh after saves

3. **Unit Conversion:**
   - Conversions between mm, cm, and inches
   - Precision issues (rounding errors)
   - previousUnit not tracking correctly

4. **Error Handling:**
   - IPC handler errors should display user-friendly messages
   - App should not crash on file system errors
   - Invalid inputs should be validated

## Test Results Template

For each test section, note:
- ✅ Pass: Working as expected
- ⚠️ Warning: Works but has minor issues (describe)
- ❌ Fail: Not working (describe issue)

## Reporting Issues

If you find any issues during testing:

1. **Note the exact steps to reproduce**
2. **Check browser console for errors** (Ctrl+Shift+I / Cmd+Option+I)
3. **Check terminal output for backend errors**
4. **Note which task/refactor the issue relates to**
5. **Take screenshots if UI issues**

## Summary

This refactoring touched:
- **3 core files:** main.js, eject.js, render.js
- **4 new utility modules:** shared/state.js, shared/utils.js, trace modules
- **~500 lines** of code refactored or reorganized
- **11 tasks** completed

The most critical paths to test are:
1. Trace → Save SVG → Eject → Generate G-code → Render (complete workflow)
2. State management in Eject and Render tabs
3. Unit conversions and page sizing
4. Error handling in file operations
