// Eject Tab Module
// Handles page sizing, layout orientation, and G-code generation

import { debugLog } from './shared/debug.js';
import { state, setState } from './shared/state.js';
import { toMm, fromMm } from './shared/utils.js';
import { PAGE_SIZES } from './hardware.js';

// ============ MODULE STATE ============

// Eject tab state
let ejectPageSize = 'A4';
let ejectLayout = 'portrait'; // 'portrait' or 'landscape'
let ejectPageBackgroundElement = null;
let ejectOriginalAspectRatio = 1; // Store original SVG aspect ratio
let ejectPreviousUnit = 'in'; // Track previous unit for conversion
let ejectScale = 100; // Scale percentage for the art (100 = 100%)
let ejectPositionX = 0; // X offset in pixels from center
let ejectPositionY = 0; // Y offset in pixels from center
let ejectWorkAreaPosition = 'center'; // Position in work area: top-left, top-center, top-right, center-left, center, center-right, bottom-left, bottom-center, bottom-right
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragOffsetX = 0;
let dragOffsetY = 0;

// ============ CORE FUNCTIONS ============

/**
 * Load SVG into Eject tab
 * Called when switching to eject tab or when a vector is loaded
 */
export function loadEjectTab() {
  const ejectMessage = document.getElementById('ejectMessage');
  const ejectSvgContainer = document.getElementById('ejectSvgContainer');
  const ejectInfoBar = document.getElementById('ejectInfoBar');
  const ejectDimensions = document.getElementById('ejectDimensions');
  const ejectOutputToolbar = document.getElementById('ejectOutputToolbar');

  if (state.currentSVGData && state.currentSVGData.content) {
    // Hide message and show SVG container
    ejectMessage.style.display = 'none';
    ejectSvgContainer.style.display = 'flex';
    ejectInfoBar.style.display = 'flex';
    ejectOutputToolbar.style.display = 'flex';

    // Reset position and scale for new SVG
    ejectPositionX = 0;
    ejectPositionY = 0;
    ejectScale = 100;

    // Update scale slider if it exists
    const scaleSlider = document.getElementById('ejectScaleSlider');
    const scaleValue = document.getElementById('ejectScaleValue');
    if (scaleSlider) scaleSlider.value = 100;
    if (scaleValue) scaleValue.textContent = '100%';

    ejectSvgContainer.innerHTML = state.currentSVGData.content;

    // Apply proper sizing to the SVG
    const svg = ejectSvgContainer.querySelector('svg');
    if (svg) {
      // Extract dimensions from viewBox or width/height attributes
      let width, height;

      const viewBox = svg.getAttribute('viewBox');
      if (viewBox) {
        const viewBoxValues = viewBox.split(/\s+/);
        width = parseFloat(viewBoxValues[2]);
        height = parseFloat(viewBoxValues[3]);
      } else {
        width = parseFloat(svg.getAttribute('width')) || 0;
        height = parseFloat(svg.getAttribute('height')) || 0;
      }

      // Display dimensions
      if (width && height) {
        ejectDimensions.textContent = `${width} × ${height}`;

        // Store original aspect ratio for locked scaling
        ejectOriginalAspectRatio = width / height;
        debugLog('Stored original aspect ratio:', ejectOriginalAspectRatio);

        // Always set output dimensions based on the loaded SVG
        // Default to 4 inches for the smaller dimension, maintaining aspect ratio
        let defaultWidth, defaultHeight;

        if (width < height) {
          // Portrait or square
          defaultWidth = 4;
          defaultHeight = 4 / ejectOriginalAspectRatio;
        } else {
          // Landscape
          defaultHeight = 4;
          defaultWidth = 4 * ejectOriginalAspectRatio;
        }

        document.getElementById('ejectCustomWidth').value = defaultWidth.toFixed(2);
        document.getElementById('ejectCustomHeight').value = defaultHeight.toFixed(2);

        debugLog('Set output dimensions:', defaultWidth.toFixed(2) + '" × ' + defaultHeight.toFixed(2) + '"');
      } else {
        ejectDimensions.textContent = 'Unknown';
      }

      // Apply black stroke to all paths
      const paths = svg.querySelectorAll('path');
      paths.forEach(path => {
        path.style.stroke = '#000000';
        path.style.strokeWidth = '1';
      });

      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.style.width = '100%';
      svg.style.height = '100%';
      svg.style.maxWidth = '100%';
      svg.style.maxHeight = '100%';
    }

    // Update page background
    updateEjectPageBackground();

    // Update page size buttons based on output dimensions
    updateEjectPageSizeButtons();
  } else {
    // Show message and hide SVG container
    ejectMessage.style.display = 'block';
    ejectSvgContainer.style.display = 'none';
    ejectInfoBar.style.display = 'none';
    ejectOutputToolbar.style.display = 'none';
    ejectMessage.textContent = 'No vector image loaded';
  }

  // Update eject nav button state
  updateEjectNavButton();
}

// ============ DIMENSION HELPERS ============

/**
 * Get eject page dimensions in mm (respects layout orientation)
 */
function getEjectPageDimensions() {
  let dimensions;

  if (ejectPageSize === 'custom') {
    const width = parseFloat(document.getElementById('ejectCustomWidth').value);
    const height = parseFloat(document.getElementById('ejectCustomHeight').value);
    const unit = document.getElementById('ejectCustomUnit').value;

    if (isNaN(width) || isNaN(height)) {
      return null;
    }

    dimensions = [toMm(width, unit), toMm(height, unit)];
  } else {
    dimensions = [...PAGE_SIZES[ejectPageSize]]; // Clone array
  }

  // Swap dimensions if landscape
  if (ejectLayout === 'landscape') {
    return [dimensions[1], dimensions[0]]; // Swap width and height
  }

  return dimensions;
}

/**
 * Convert mm to inches (for display)
 */
function mmToInches(mm) {
  return (mm / 25.4).toFixed(2);
}

/**
 * Convert mm to cm (for display)
 */
function mmToCm(mm) {
  return (mm / 10).toFixed(1);
}

// ============ PAGE VISUALIZATION ============

/**
 * Create dimension lines for eject page
 */
function createEjectDimensionLines(viewer, displayWidth, displayHeight, widthMm, heightMm) {
  // Remove existing dimension lines
  document.querySelectorAll('.eject-dimension-line').forEach(el => el.remove());

  // Format dimension text
  const widthText = `${mmToInches(widthMm)}" / ${mmToCm(widthMm)}cm / ${widthMm.toFixed(0)}mm`;
  const heightText = `${mmToInches(heightMm)}" / ${mmToCm(heightMm)}cm / ${heightMm.toFixed(0)}mm`;

  // Calculate offsets to position lines outside page border
  const topOffset = (displayHeight / 2) + 30; // 30px gap from top edge of page
  const rightOffset = (displayWidth / 2) + 30; // 30px gap from right edge of page

  // Create top dimension line (for width)
  const topDimension = document.createElement('div');
  topDimension.className = 'eject-dimension-line eject-dimension-top';
  topDimension.innerHTML = `
    <div class="dimension-line-segment"></div>
    <div class="dimension-text">${widthText}</div>
    <div class="dimension-line-segment"></div>
  `;
  topDimension.style.width = displayWidth + 'px';
  topDimension.style.transform = `translate(-50%, calc(-50% - ${topOffset}px))`;
  viewer.appendChild(topDimension);

  // Create right dimension line (for height)
  const rightDimension = document.createElement('div');
  rightDimension.className = 'eject-dimension-line eject-dimension-right';
  rightDimension.innerHTML = `
    <div class="dimension-line-segment"></div>
    <div class="dimension-text dimension-text-vertical">${heightText}</div>
    <div class="dimension-line-segment"></div>
  `;
  rightDimension.style.height = displayHeight + 'px';
  rightDimension.style.transform = `translate(calc(-50% + ${rightOffset}px), -50%)`;
  viewer.appendChild(rightDimension);
}

/**
 * Create or update eject page background
 */
function updateEjectPageBackground() {
  const ejectViewer = document.getElementById('ejectViewer');
  const ejectSvgContainer = document.getElementById('ejectSvgContainer');

  if (!ejectSvgContainer || ejectSvgContainer.style.display === 'none') {
    return;
  }

  const dimensions = getEjectPageDimensions();
  if (!dimensions) {
    removeEjectPageBackground();
    return;
  }

  const [widthMm, heightMm] = dimensions;
  const aspectRatio = widthMm / heightMm;

  // Remove existing background
  if (ejectPageBackgroundElement) {
    ejectPageBackgroundElement.remove();
  }

  // Create new page background
  ejectPageBackgroundElement = document.createElement('div');
  ejectPageBackgroundElement.className = 'page-background';

  // Calculate size to fit in viewer while maintaining aspect ratio
  const viewerRect = ejectViewer.getBoundingClientRect();
  const maxWidth = viewerRect.width * 0.85;
  const maxHeight = viewerRect.height * 0.85;

  let displayWidth, displayHeight;

  if (maxWidth / maxHeight > aspectRatio) {
    // Constrained by height
    displayHeight = maxHeight;
    displayWidth = displayHeight * aspectRatio;
  } else {
    // Constrained by width
    displayWidth = maxWidth;
    displayHeight = displayWidth / aspectRatio;
  }

  ejectPageBackgroundElement.style.width = displayWidth + 'px';
  ejectPageBackgroundElement.style.height = displayHeight + 'px';
  ejectPageBackgroundElement.style.left = '50%';
  ejectPageBackgroundElement.style.top = '50%';
  ejectPageBackgroundElement.style.transform = 'translate(-50%, -50%)';

  // Insert into viewer before the svg container
  ejectViewer.insertBefore(ejectPageBackgroundElement, ejectSvgContainer);

  // Create dimension lines
  createEjectDimensionLines(ejectViewer, displayWidth, displayHeight, widthMm, heightMm);

  debugLog('=== Scaling Calculation ===');
  debugLog('Page size:', ejectPageSize, '→', widthMm + 'mm × ' + heightMm + 'mm');
  debugLog('Display size:', displayWidth + 'px × ' + displayHeight + 'px');

  // Read output dimensions from inputs
  const outputWidth = parseFloat(document.getElementById('ejectCustomWidth').value);
  const outputHeight = parseFloat(document.getElementById('ejectCustomHeight').value);
  const outputUnit = document.getElementById('ejectCustomUnit').value;

  debugLog('Output dimensions:', outputWidth, '×', outputHeight, outputUnit);

  let scaledWidth, scaledHeight;

  if (!isNaN(outputWidth) && !isNaN(outputHeight) && outputWidth > 0 && outputHeight > 0) {
    // Convert output dimensions to mm
    const outputWidthMm = toMm(outputWidth, outputUnit);
    const outputHeightMm = toMm(outputHeight, outputUnit);

    // Calculate scale factor to convert mm to display pixels
    // Using the page's display dimensions as reference
    const mmToPixelRatio = displayWidth / widthMm;

    scaledWidth = outputWidthMm * mmToPixelRatio;
    scaledHeight = outputHeightMm * mmToPixelRatio;

    debugLog('Output dimensions in mm:', outputWidthMm + 'mm × ' + outputHeightMm + 'mm');
    debugLog('MM to pixel ratio:', mmToPixelRatio);
    debugLog('Calculated scaled size:', scaledWidth + 'px × ' + scaledHeight + 'px');
  } else {
    debugLog('No output dimensions set, using full page size');
    // Use full page size if inputs are invalid or empty
    scaledWidth = displayWidth;
    scaledHeight = displayHeight;
  }

  // Apply scale factor to the dimensions
  const scaleFactor = ejectScale / 100;
  const finalWidth = scaledWidth * scaleFactor;
  const finalHeight = scaledHeight * scaleFactor;

  // Scale the svg container to fit the page
  ejectSvgContainer.style.width = finalWidth + 'px';
  ejectSvgContainer.style.height = finalHeight + 'px';
  ejectSvgContainer.style.maxWidth = finalWidth + 'px';
  ejectSvgContainer.style.maxHeight = finalHeight + 'px';

  // Apply position offset
  ejectSvgContainer.style.left = `calc(50% + ${ejectPositionX}px)`;
  ejectSvgContainer.style.top = `calc(50% + ${ejectPositionY}px)`;
  ejectSvgContainer.style.transform = 'translate(-50%, -50%)';
  ejectSvgContainer.style.position = 'absolute';
  ejectSvgContainer.style.cursor = 'move';

  debugLog('Eject page background updated:', ejectPageSize, widthMm + 'mm × ' + heightMm + 'mm', 'scale:', ejectScale + '%');
}

/**
 * Remove eject page background
 */
function removeEjectPageBackground() {
  if (ejectPageBackgroundElement) {
    ejectPageBackgroundElement.remove();
    ejectPageBackgroundElement = null;
  }

  // Remove dimension lines
  document.querySelectorAll('.eject-dimension-line').forEach(el => el.remove());

  const ejectSvgContainer = document.getElementById('ejectSvgContainer');
  if (ejectSvgContainer) {
    ejectSvgContainer.style.width = '';
    ejectSvgContainer.style.height = '';
    ejectSvgContainer.style.maxWidth = '';
    ejectSvgContainer.style.maxHeight = '';
  }
}

/**
 * Update page size button states based on output dimensions
 */
function updateEjectPageSizeButtons() {
  const outputWidth = parseFloat(document.getElementById('ejectCustomWidth').value);
  const outputHeight = parseFloat(document.getElementById('ejectCustomHeight').value);
  const outputUnit = document.getElementById('ejectCustomUnit').value;

  // If no valid dimensions, enable all buttons
  if (isNaN(outputWidth) || isNaN(outputHeight) || outputWidth <= 0 || outputHeight <= 0) {
    document.querySelectorAll('.eject-page-size-btn').forEach(btn => {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    });
    return;
  }

  // Convert output dimensions to mm and apply scale factor
  const outputWidthMm = toMm(outputWidth, outputUnit) * (ejectScale / 100);
  const outputHeightMm = toMm(outputHeight, outputUnit) * (ejectScale / 100);

  debugLog('Checking page sizes for output:', outputWidthMm + 'mm × ' + outputHeightMm + 'mm', '(scale:', ejectScale + '%)');

  // Check each page size button
  document.querySelectorAll('.eject-page-size-btn').forEach(btn => {
    const size = btn.dataset.size;

    // Custom size is always enabled
    if (size === 'custom') {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      return;
    }

    // Get page dimensions for this size
    const pageDimensions = PAGE_SIZES[size];
    if (!pageDimensions) {
      return;
    }

    const [pageWidthMm, pageHeightMm] = pageDimensions;

    // Check if output fits on this page size (considering both orientations)
    const fitsPortrait = outputWidthMm <= pageWidthMm && outputHeightMm <= pageHeightMm;
    const fitsLandscape = outputWidthMm <= pageHeightMm && outputHeightMm <= pageWidthMm;
    const fits = fitsPortrait || fitsLandscape;

    // Enable or disable button
    btn.disabled = !fits;
    btn.style.opacity = fits ? '1' : '0.3';
    btn.style.cursor = fits ? 'pointer' : 'not-allowed';

    debugLog(`  ${size}: ${fits ? 'fits' : 'too large'} (${pageWidthMm}×${pageHeightMm}mm)`);
  });
}

// ============ EVENT HANDLERS ============

/**
 * Handle layout orientation toggle (portrait/landscape)
 */
function handleLayoutToggle(btn) {
  const layout = btn.dataset.layout;

  // Update active state
  document.querySelectorAll('.eject-layout-toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  ejectLayout = layout;

  // Update page background
  updateEjectPageBackground();

  debugLog('Eject layout changed:', layout);
}

/**
 * Handle work area position button click
 */
function handleWorkAreaPositionClick(btn) {
  const position = btn.dataset.position;

  // Update active state
  document.querySelectorAll('.position-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  ejectWorkAreaPosition = position;

  debugLog('Work area position changed:', position);
}

/**
 * Handle page size button click
 */
function handlePageSizeClick(btn) {
  const size = btn.dataset.size;

  // Update active state
  document.querySelectorAll('.eject-page-size-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  ejectPageSize = size;

  // Show/hide custom inputs
  const ejectCustomInputs = document.getElementById('ejectCustomSizeInputs');
  if (size === 'custom') {
    ejectCustomInputs.style.display = 'flex';
  } else {
    ejectCustomInputs.style.display = 'none';
  }

  // Update page background when page size changes
  updateEjectPageBackground();

  debugLog('Eject page size selected:', size);
}

/**
 * Handle custom size input changes
 */
function handleCustomSizeInput() {
  if (ejectPageSize === 'custom') {
    updateEjectPageBackground();
  }
}

/**
 * Handle fixed width input change
 */
function handleFixedWidthInput() {
  const width = parseFloat(document.getElementById('ejectCustomWidth').value);
  const ejectCustomHeight = document.getElementById('ejectCustomHeight');

  if (!isNaN(width) && width > 0 && ejectOriginalAspectRatio > 0) {
    const newHeight = width / ejectOriginalAspectRatio;
    ejectCustomHeight.value = newHeight.toFixed(2);
    debugLog('Width changed, adjusted height:', newHeight.toFixed(2));
  }

  if (ejectPageBackgroundElement) {
    updateEjectPageBackground();
  }
  updateEjectPageSizeButtons();
}

/**
 * Handle fixed height input change
 */
function handleFixedHeightInput() {
  const height = parseFloat(document.getElementById('ejectCustomHeight').value);
  const ejectCustomWidth = document.getElementById('ejectCustomWidth');

  if (!isNaN(height) && height > 0 && ejectOriginalAspectRatio > 0) {
    const newWidth = height * ejectOriginalAspectRatio;
    ejectCustomWidth.value = newWidth.toFixed(2);
    debugLog('Height changed, adjusted width:', newWidth.toFixed(2));
  }

  if (ejectPageBackgroundElement) {
    updateEjectPageBackground();
  }
  updateEjectPageSizeButtons();
}

/**
 * Handle unit change with value conversion
 */
function handleUnitChange() {
  const ejectCustomUnit = document.getElementById('ejectCustomUnit');
  const ejectCustomWidth = document.getElementById('ejectCustomWidth');
  const ejectCustomHeight = document.getElementById('ejectCustomHeight');

  const newUnit = ejectCustomUnit.value;
  const oldUnit = ejectPreviousUnit;

  // Get current values
  const currentWidth = parseFloat(ejectCustomWidth.value);
  const currentHeight = parseFloat(ejectCustomHeight.value);

  if (!isNaN(currentWidth) && !isNaN(currentHeight)) {
    // Convert to mm first, then to new unit
    const widthMm = toMm(currentWidth, oldUnit);
    const heightMm = toMm(currentHeight, oldUnit);

    const newWidth = fromMm(widthMm, newUnit);
    const newHeight = fromMm(heightMm, newUnit);

    // Update input values with appropriate precision
    let precision = 2;
    if (newUnit === 'mm') precision = 0;
    else if (newUnit === 'cm') precision = 1;

    ejectCustomWidth.value = newWidth.toFixed(precision);
    ejectCustomHeight.value = newHeight.toFixed(precision);

    debugLog(`Unit changed from ${oldUnit} to ${newUnit}:`,
      `${currentWidth}${oldUnit} → ${newWidth.toFixed(precision)}${newUnit}`);
  }

  // Update previous unit tracker
  ejectPreviousUnit = newUnit;

  if (ejectPageBackgroundElement) {
    updateEjectPageBackground();
  }
  updateEjectPageSizeButtons();
}

/**
 * Handle scale slider input
 */
function handleEjectScaleInput() {
  const scaleSlider = document.getElementById('ejectScaleSlider');
  const scaleValue = document.getElementById('ejectScaleValue');

  if (scaleSlider && scaleValue) {
    ejectScale = parseInt(scaleSlider.value);
    scaleValue.textContent = ejectScale + '%';

    // Update the page background with new scale
    if (ejectPageBackgroundElement) {
      updateEjectPageBackground();
    }

    // Update available page sizes based on scaled dimensions
    updateEjectPageSizeButtons();

    debugLog('Scale changed:', ejectScale + '%');
  }
}

/**
 * Handle mouse down on SVG container (start drag)
 */
function handleSvgMouseDown(e) {
  if (e.button !== 0) return; // Only left mouse button

  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragOffsetX = ejectPositionX;
  dragOffsetY = ejectPositionY;

  // Change cursor
  const ejectSvgContainer = document.getElementById('ejectSvgContainer');
  if (ejectSvgContainer) {
    ejectSvgContainer.style.cursor = 'grabbing';
  }

  e.preventDefault();
}

/**
 * Handle mouse move (drag)
 */
function handleSvgMouseMove(e) {
  if (!isDragging) return;

  const deltaX = e.clientX - dragStartX;
  const deltaY = e.clientY - dragStartY;

  ejectPositionX = dragOffsetX + deltaX;
  ejectPositionY = dragOffsetY + deltaY;

  // Update SVG container position
  const ejectSvgContainer = document.getElementById('ejectSvgContainer');
  if (ejectSvgContainer) {
    ejectSvgContainer.style.left = `calc(50% + ${ejectPositionX}px)`;
    ejectSvgContainer.style.top = `calc(50% + ${ejectPositionY}px)`;
  }

  e.preventDefault();
}

/**
 * Handle mouse up (end drag)
 */
function handleSvgMouseUp(e) {
  if (!isDragging) return;

  isDragging = false;

  // Restore cursor
  const ejectSvgContainer = document.getElementById('ejectSvgContainer');
  if (ejectSvgContainer) {
    ejectSvgContainer.style.cursor = 'move';
  }

  debugLog('Art repositioned:', ejectPositionX + 'px,', ejectPositionY + 'px');

  e.preventDefault();
}

/**
 * Handle window resize
 */
function handleWindowResize() {
  if (ejectPageBackgroundElement) {
    updateEjectPageBackground();
  }
}

/**
 * Handle Generate G-code button click
 */
async function handleEjectToGcode() {
  debugLog('=== EJECT TO G-CODE CLICKED ===');

  // Verify we have a loaded SVG
  if (!state.currentSVGData || !state.currentSVGData.path) {
    alert('No vector file loaded. Please load a vector file first.');
    return;
  }

  // Get output dimensions and apply scale
  const outputWidth = parseFloat(document.getElementById('ejectCustomWidth').value);
  const outputHeight = parseFloat(document.getElementById('ejectCustomHeight').value);
  const outputUnit = document.getElementById('ejectCustomUnit').value;

  // Validate dimensions
  if (isNaN(outputWidth) || isNaN(outputHeight) || outputWidth <= 0 || outputHeight <= 0) {
    alert('Please enter valid output dimensions.');
    return;
  }

  // Apply scale factor to output dimensions
  const scaleFactor = ejectScale / 100;
  const scaledOutputWidth = outputWidth * scaleFactor;
  const scaledOutputHeight = outputHeight * scaleFactor;

  debugLog('Current SVG path:', state.currentSVGData.path);
  debugLog('Output dimensions (base):', outputWidth, 'x', outputHeight, outputUnit);
  debugLog('Output dimensions (scaled):', scaledOutputWidth, 'x', scaledOutputHeight, outputUnit, '(' + ejectScale + '%)');

  // Disable button and show loading state
  const ejectToGcodeBtn = document.getElementById('ejectToGcodeBtn');
  ejectToGcodeBtn.disabled = true;
  const originalText = ejectToGcodeBtn.innerHTML;
  ejectToGcodeBtn.innerHTML = '<span>⏳</span> Generating...';

  try {
    // Call the backend to convert SVG to G-code with scaled dimensions and position
    const result = await window.electronAPI.ejectToGcode(
      state.currentSVGData.path,
      scaledOutputWidth,
      scaledOutputHeight,
      outputUnit,
      ejectWorkAreaPosition
    );

    debugLog('Eject result:', result);
    debugLog('Work area position:', ejectWorkAreaPosition);

    if (result.success) {
      debugLog('G-code file created:', result.gcodeFilePath);

      // Clear eject data after generating
      setState({ currentSVGData: null });
      updateEjectNavButton();

      // Navigate to render tab with the newly created file
      window.switchTab('render');

      // Wait a moment for the render tab to load, then select the file
      setTimeout(async () => {
        // Find and click the G-code item that matches our file
        const gcodeItems = document.querySelectorAll('.gcode-item');
        const fileName = result.gcodeFilePath.split('/').pop();

        for (const item of gcodeItems) {
          const nameElement = item.querySelector('.gcode-item-name');
          if (nameElement && nameElement.textContent === fileName) {
            item.click();
            break;
          }
        }
      }, 100);
    } else {
      alert(`Failed to generate G-code:\n\n${result.error}\n\n${result.stderr || ''}`);
      console.error('Eject failed:', result);
    }
  } catch (error) {
    console.error('Error ejecting to G-code:', error);
    alert(`Error generating G-code:\n\n${error.message}`);
  } finally {
    // Re-enable button and restore text
    ejectToGcodeBtn.disabled = false;
    ejectToGcodeBtn.innerHTML = originalText;
    updateEjectNavButton();
  }
}

// ============ INITIALIZATION ============

/**
 * Initialize Eject tab event listeners
 * Called once on app startup
 */
export function initEjectTab() {
  // Layout toggle handlers
  document.querySelectorAll('.eject-layout-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => handleLayoutToggle(btn));
  });

  // Work area position button handlers
  document.querySelectorAll('.position-btn').forEach(btn => {
    btn.addEventListener('click', () => handleWorkAreaPositionClick(btn));
  });

  // Page size button handlers
  document.querySelectorAll('.eject-page-size-btn').forEach(btn => {
    btn.addEventListener('click', () => handlePageSizeClick(btn));
  });

  // Custom size and fixed dimension input handlers
  const ejectCustomWidth = document.getElementById('ejectCustomWidth');
  const ejectCustomHeight = document.getElementById('ejectCustomHeight');
  const ejectCustomUnit = document.getElementById('ejectCustomUnit');

  [ejectCustomWidth, ejectCustomHeight, ejectCustomUnit].forEach(input => {
    if (input) {
      input.addEventListener('input', handleCustomSizeInput);
    }
  });

  // Fixed dimension input handlers (reuse the same elements)
  if (ejectCustomWidth) {
    ejectCustomWidth.addEventListener('input', handleFixedWidthInput);
  }

  if (ejectCustomHeight) {
    ejectCustomHeight.addEventListener('input', handleFixedHeightInput);
  }

  if (ejectCustomUnit) {
    ejectCustomUnit.addEventListener('change', handleUnitChange);
  }

  // Scale slider handler
  const ejectScaleSlider = document.getElementById('ejectScaleSlider');
  if (ejectScaleSlider) {
    ejectScaleSlider.addEventListener('input', handleEjectScaleInput);
  }

  // SVG container drag handlers
  const ejectSvgContainer = document.getElementById('ejectSvgContainer');
  if (ejectSvgContainer) {
    ejectSvgContainer.addEventListener('mousedown', handleSvgMouseDown);
    document.addEventListener('mousemove', handleSvgMouseMove);
    document.addEventListener('mouseup', handleSvgMouseUp);
  }

  // Generate G-code button handler
  const ejectToGcodeBtn = document.getElementById('ejectToGcodeBtn');
  if (ejectToGcodeBtn) {
    ejectToGcodeBtn.addEventListener('click', handleEjectToGcode);
  }

  // Window resize handler
  window.addEventListener('resize', handleWindowResize);

  debugLog('Eject tab initialized');
}

// ============ NAV BUTTON STATE ============

// Update the Eject nav button state based on whether there's eject data
export function updateEjectNavButton() {
  const ejectNavBtn = document.getElementById('ejectNavBtn');
  if (ejectNavBtn) {
    ejectNavBtn.disabled = !state.currentSVGData;
  }
}

// Export function to get current work area position
export function getEjectWorkAreaPosition() {
  return ejectWorkAreaPosition;
}
