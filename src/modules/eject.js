// Eject Tab Module
// Handles page sizing, layout orientation, and G-code generation

import { debugLog } from './shared/debug.js';
import { state, setState } from './shared/state.js';
import { toMm, fromMm } from './shared/utils.js';
import { PAGE_SIZES, ejectOutputUnit, workspaceWidth, workspaceHeight } from './hardware.js';

// ============ MODULE STATE ============

// Eject tab state
let ejectPageSize = 'A4';
let ejectLayout = 'portrait'; // 'portrait' or 'landscape'
let ejectPageBackgroundElement = null;
let ejectOriginalAspectRatio = 1; // Store original SVG aspect ratio
let ejectPreviousUnit = 'in'; // Track previous unit for conversion

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

        // Set default output dimensions if not already set
        // Default to 4 inches for the smaller dimension, maintaining aspect ratio
        const currentWidth = document.getElementById('ejectFixedWidth').value;
        const currentHeight = document.getElementById('ejectFixedHeight').value;

        if (!currentWidth || !currentHeight) {
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

          document.getElementById('ejectFixedWidth').value = defaultWidth.toFixed(2);
          document.getElementById('ejectFixedHeight').value = defaultHeight.toFixed(2);

          debugLog('Set default output dimensions:', defaultWidth.toFixed(2) + '" × ' + defaultHeight.toFixed(2) + '"');
        }
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
  const outputWidth = parseFloat(document.getElementById('ejectFixedWidth').value);
  const outputHeight = parseFloat(document.getElementById('ejectFixedHeight').value);
  const outputUnit = document.getElementById('ejectFixedUnit').value;

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

  // Scale the svg container to fit the page
  ejectSvgContainer.style.width = scaledWidth + 'px';
  ejectSvgContainer.style.height = scaledHeight + 'px';
  ejectSvgContainer.style.maxWidth = scaledWidth + 'px';
  ejectSvgContainer.style.maxHeight = scaledHeight + 'px';

  debugLog('Eject page background updated:', ejectPageSize, widthMm + 'mm × ' + heightMm + 'mm');
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
  const outputWidth = parseFloat(document.getElementById('ejectFixedWidth').value);
  const outputHeight = parseFloat(document.getElementById('ejectFixedHeight').value);
  const outputUnit = document.getElementById('ejectFixedUnit').value;

  // If no valid dimensions, enable all buttons
  if (isNaN(outputWidth) || isNaN(outputHeight) || outputWidth <= 0 || outputHeight <= 0) {
    document.querySelectorAll('.eject-page-size-btn').forEach(btn => {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    });
    return;
  }

  // Convert output dimensions to mm
  const outputWidthMm = toMm(outputWidth, outputUnit);
  const outputHeightMm = toMm(outputHeight, outputUnit);

  debugLog('Checking page sizes for output:', outputWidthMm + 'mm × ' + outputHeightMm + 'mm');

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
  const width = parseFloat(document.getElementById('ejectFixedWidth').value);
  const ejectFixedHeight = document.getElementById('ejectFixedHeight');

  if (!isNaN(width) && width > 0 && ejectOriginalAspectRatio > 0) {
    const newHeight = width / ejectOriginalAspectRatio;
    ejectFixedHeight.value = newHeight.toFixed(2);
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
  const height = parseFloat(document.getElementById('ejectFixedHeight').value);
  const ejectFixedWidth = document.getElementById('ejectFixedWidth');

  if (!isNaN(height) && height > 0 && ejectOriginalAspectRatio > 0) {
    const newWidth = height * ejectOriginalAspectRatio;
    ejectFixedWidth.value = newWidth.toFixed(2);
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
  const ejectFixedUnit = document.getElementById('ejectFixedUnit');
  const ejectFixedWidth = document.getElementById('ejectFixedWidth');
  const ejectFixedHeight = document.getElementById('ejectFixedHeight');

  const newUnit = ejectFixedUnit.value;
  const oldUnit = ejectPreviousUnit;

  // Get current values
  const currentWidth = parseFloat(ejectFixedWidth.value);
  const currentHeight = parseFloat(ejectFixedHeight.value);

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

    ejectFixedWidth.value = newWidth.toFixed(precision);
    ejectFixedHeight.value = newHeight.toFixed(precision);

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

  // Get output dimensions
  const outputWidth = parseFloat(document.getElementById('ejectFixedWidth').value);
  const outputHeight = parseFloat(document.getElementById('ejectFixedHeight').value);
  const outputUnit = document.getElementById('ejectFixedUnit').value;

  // Validate dimensions
  if (isNaN(outputWidth) || isNaN(outputHeight) || outputWidth <= 0 || outputHeight <= 0) {
    alert('Please enter valid output dimensions.');
    return;
  }

  debugLog('Current SVG path:', state.currentSVGData.path);
  debugLog('Output dimensions:', outputWidth, 'x', outputHeight, outputUnit);

  // Disable button and show loading state
  const ejectToGcodeBtn = document.getElementById('ejectToGcodeBtn');
  ejectToGcodeBtn.disabled = true;
  const originalText = ejectToGcodeBtn.innerHTML;
  ejectToGcodeBtn.innerHTML = '<span>⏳</span> Generating...';

  try {
    // Call the backend to convert SVG to G-code
    const result = await window.electronAPI.ejectToGcode(
      state.currentSVGData.path,
      outputWidth,
      outputHeight,
      outputUnit
    );

    debugLog('Eject result:', result);

    if (result.success) {
      alert(`G-code generated successfully!\n\nSaved to ~/gellyroller directory.`);
      debugLog('G-code file created:', result.gcodeFilePath);

      // Clear eject data after generating
      setState({ currentSVGData: null });
      updateEjectNavButton();
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

  // Page size button handlers
  document.querySelectorAll('.eject-page-size-btn').forEach(btn => {
    btn.addEventListener('click', () => handlePageSizeClick(btn));
  });

  // Custom size input handlers
  const ejectCustomWidth = document.getElementById('ejectCustomWidth');
  const ejectCustomHeight = document.getElementById('ejectCustomHeight');
  const ejectCustomUnit = document.getElementById('ejectCustomUnit');

  [ejectCustomWidth, ejectCustomHeight, ejectCustomUnit].forEach(input => {
    if (input) {
      input.addEventListener('input', handleCustomSizeInput);
    }
  });

  // Fixed dimension input handlers
  const ejectFixedWidth = document.getElementById('ejectFixedWidth');
  const ejectFixedHeight = document.getElementById('ejectFixedHeight');
  const ejectFixedUnit = document.getElementById('ejectFixedUnit');

  if (ejectFixedWidth) {
    ejectFixedWidth.addEventListener('input', handleFixedWidthInput);
  }

  if (ejectFixedHeight) {
    ejectFixedHeight.addEventListener('input', handleFixedHeightInput);
  }

  if (ejectFixedUnit) {
    ejectFixedUnit.addEventListener('change', handleUnitChange);
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
