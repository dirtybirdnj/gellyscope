// Trace Tab Module
import { debugLog } from './shared/debug.js';
import { toMm, escapeHtml } from './shared/utils.js';
import { PAGE_SIZES, currentPageSize, setCurrentPageSize } from './hardware.js';
import { updateStatusBar } from './shared/statusBar.js';

// ============ MODULE STATE ============

let capturedLayers = [];
let traceDebounceTimer = null;
let currentLayout = 'portrait'; // 'portrait' or 'landscape'
let pageBackgroundElement = null;
let outputScale = 100; // Output scale percentage

// ============ CORE TRACE FUNCTIONS ============

export function showImageInTraceTab(imageSrc, fileName) {
  // Get trace tab elements
  const traceImage = document.getElementById('traceImage');
  const traceMessage = document.getElementById('traceMessage');
  const traceImageContainer = document.getElementById('traceImageContainer');
  const traceSvgOverlay = document.getElementById('traceSvgOverlay');

  // Clear any previous trace
  traceSvgOverlay.innerHTML = '';
  const captureBtn = document.getElementById('captureTraceBtn');
  if (captureBtn) {
    captureBtn.disabled = true;
  }

  // Store current image info
  window.currentTraceImage = {
    src: imageSrc,
    originalSrc: imageSrc,  // Store original unscaled image
    fileName: fileName,
    svgData: null,
    processedSrc: null,  // Will store the processed image
    scale: 100,  // Current scale percentage
    originalWidth: 0,
    originalHeight: 0,
    isInitialLoad: true  // Flag to prevent infinite loop on trace updates
  };

  // Set the image
  traceImage.src = imageSrc;
  traceImageContainer.style.display = 'block';
  traceMessage.style.display = 'none';

  // Show the output toolbar
  const outputToolbar = document.getElementById('outputToolbar');
  if (outputToolbar) {
    outputToolbar.style.display = 'flex';
  }

  // Switch to trace tab
  window.switchTab('trace');

  // Automatically run the trace process after image loads
  // Only run this for the initial load, not when we update the processed image
  traceImage.onload = () => {
    if (window.currentTraceImage && window.currentTraceImage.isInitialLoad) {
      // Store original dimensions
      window.currentTraceImage.originalWidth = traceImage.naturalWidth;
      window.currentTraceImage.originalHeight = traceImage.naturalHeight;

      // Mark that initial load is complete
      window.currentTraceImage.isInitialLoad = false;

      // Update dimension display
      updateDimensionDisplay();

      // Run initial trace
      performTrace();
    }
  };

  debugLog('Showing image in Trace tab:', fileName);
}

// Apply image processing filters and return processed image URL
function applyImageProcessing(originalSrc) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Get current control values
      const brightness = parseInt(document.getElementById('brightnessSlider').value);
      const contrast = parseInt(document.getElementById('contrastSlider').value);
      const saturation = parseInt(document.getElementById('saturationSlider').value);
      const hue = parseInt(document.getElementById('hueSlider').value);
      const greyscale = document.getElementById('greyscaleToggle').checked;
      const sepia = document.getElementById('sepiaToggle').checked;

      // Build CSS filter string
      let filters = [];

      if (brightness !== 0) {
        filters.push(`brightness(${1 + brightness / 100})`);
      }
      if (contrast !== 0) {
        filters.push(`contrast(${1 + contrast / 100})`);
      }
      if (saturation !== 0) {
        filters.push(`saturate(${1 + saturation / 100})`);
      }
      if (hue !== 0) {
        filters.push(`hue-rotate(${hue}deg)`);
      }
      if (greyscale) {
        filters.push('grayscale(100%)');
      }
      if (sepia) {
        filters.push('sepia(100%)');
      }

      // Apply filters
      if (filters.length > 0) {
        ctx.filter = filters.join(' ');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }

      // Return processed image as data URL
      resolve(canvas.toDataURL());
    };

    img.src = originalSrc;
  });
}

// Scale image based on percentage
function scaleImage(imageSrc, scalePercent) {
  return new Promise((resolve) => {
    if (scalePercent === 100) {
      resolve(imageSrc);
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      const scale = scalePercent / 100;
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL());
    };

    img.src = imageSrc;
  });
}

// Update dimension display
function updateDimensionDisplay() {
  const originalDimensions = document.getElementById('originalDimensions');
  const scaledDimensions = document.getElementById('scaledDimensions');
  const scaledDimensionsGroup = document.getElementById('scaledDimensionsGroup');

  if (window.currentTraceImage) {
    const width = window.currentTraceImage.originalWidth;
    const height = window.currentTraceImage.originalHeight;

    originalDimensions.textContent = `${width} × ${height} px`;

    if (window.currentTraceImage.scale !== 100) {
      const scale = window.currentTraceImage.scale / 100;
      const scaledWidth = Math.round(width * scale);
      const scaledHeight = Math.round(height * scale);

      scaledDimensions.textContent = `${scaledWidth} × ${scaledHeight} px`;
      scaledDimensionsGroup.style.display = 'block';
    } else {
      scaledDimensionsGroup.style.display = 'none';
    }
  }
}

// Debounced trace function
async function performTrace() {
  if (!window.currentTraceImage || !window.currentTraceImage.src) {
    return;
  }

  try {
    // First scale the image if needed
    const scaledImageSrc = await scaleImage(
      window.currentTraceImage.originalSrc,
      window.currentTraceImage.scale
    );

    // Then apply image processing filters to the scaled image
    const processedImageSrc = await applyImageProcessing(scaledImageSrc);

    // Store the processed image and update the display
    window.currentTraceImage.processedSrc = processedImageSrc;
    const traceImage = document.getElementById('traceImage');
    if (traceImage) {
      traceImage.src = processedImageSrc;
    }

    // Get potrace parameters
    const turnPolicy = document.getElementById('turnPolicySelect').value;
    const turdSize = parseInt(document.getElementById('turdSizeSlider').value);
    const alphaMax = parseFloat(document.getElementById('alphaMaxSlider').value);
    const optTolerance = parseFloat(document.getElementById('optToleranceSlider').value);
    const optCurve = document.getElementById('optCurveToggle').checked;

    Potrace.setParameter({
      turnpolicy: turnPolicy,
      turdsize: turdSize,
      optcurve: optCurve,
      alphamax: alphaMax,
      opttolerance: optTolerance
    });

    // Load processed image into potrace
    Potrace.loadImageFromUrl(processedImageSrc);

    // Process the image
    Potrace.process(() => {
      // Get SVG output
      let svgString = Potrace.getSVG(1);

      // Apply fill/stroke options
      const useFill = document.getElementById('fillToggle').checked;
      const strokeColor = document.getElementById('strokeColorPicker').value;
      const strokeWidth = document.getElementById('strokeWidthSlider').value;

      // Parse SVG to modify path attributes
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
      const svgElement = svgDoc.querySelector('svg');
      const paths = svgDoc.querySelectorAll('path');

      // Make SVG responsive by removing fixed dimensions
      if (svgElement) {
        // Preserve viewBox if it exists, or create one from width/height
        if (!svgElement.hasAttribute('viewBox') && svgElement.hasAttribute('width') && svgElement.hasAttribute('height')) {
          const width = svgElement.getAttribute('width');
          const height = svgElement.getAttribute('height');
          svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
        }

        // Remove fixed width and height to make it responsive
        svgElement.removeAttribute('width');
        svgElement.removeAttribute('height');
      }

      paths.forEach(path => {
        if (useFill) {
          // Fill mode: black fill, no stroke
          path.setAttribute('fill', '#000000');
          path.setAttribute('stroke', 'none');
        } else {
          // Stroke mode: no fill, custom stroke
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke', strokeColor);
          path.setAttribute('stroke-width', strokeWidth);
        }
      });

      // Serialize back to string
      const serializer = new XMLSerializer();
      svgString = serializer.serializeToString(svgDoc);

      // Store the SVG data
      window.currentTraceImage.svgData = svgString;

      // Update the display to show captured layers + current trace
      updateLayersAndCurrentTrace();

      // Enable capture button
      const captureBtn = document.getElementById('captureTraceBtn');
      if (captureBtn) {
        captureBtn.disabled = false;
      }

      // Update status bar with trace information
      if (window.currentTraceImage) {
        const turnPolicy = document.getElementById('turnPolicySelect').value;
        const turdSize = parseInt(document.getElementById('turdSizeSlider').value);
        const nodeCount = paths.length;

        updateStatusBar('trace', {
          imageName: window.currentTraceImage.fileName || 'Unknown',
          dimensions: `${window.currentTraceImage.originalWidth} × ${window.currentTraceImage.originalHeight} px`,
          turnPolicy: turnPolicy,
          turdSize: turdSize,
          nodeCount: nodeCount
        });
      }

      // Update page background after trace
      setTimeout(() => {
        updatePageBackground();
      }, 100);

      debugLog('Trace completed successfully with fill:', useFill);
    });
  } catch (error) {
    console.error('Error tracing image:', error);
  }
}

// Debounced trace trigger
function triggerAutoTrace() {
  if (traceDebounceTimer) {
    clearTimeout(traceDebounceTimer);
  }
  traceDebounceTimer = setTimeout(() => {
    performTrace();
  }, 500); // Wait 500ms after last change
}

// ============ LAYER MANAGEMENT ============

// Count paths and points in an SVG layer
function getLayerMetadata(svgData) {
  try {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgData, 'image/svg+xml');
    const paths = svgDoc.querySelectorAll('path');

    let totalPoints = 0;
    paths.forEach(path => {
      const d = path.getAttribute('d');
      if (d) {
        // Count M, L, C, Q commands (rough estimate of points)
        const commands = d.match(/[MLHVCSQTAZ]/gi);
        totalPoints += commands ? commands.length : 0;
      }
    });

    return {
      shapes: paths.length,
      points: totalPoints
    };
  } catch (error) {
    console.error('Error getting layer metadata:', error);
    return { shapes: 0, points: 0 };
  }
}

function updateLayersList() {
  const layersList = document.getElementById('traceLayersList');

  if (capturedLayers.length === 0) {
    layersList.innerHTML = '<div style="padding: 16px; text-align: center; opacity: 0.5; font-size: 13px;">No layers</div>';
    return;
  }

  layersList.innerHTML = '';

  capturedLayers.forEach((layer, index) => {
    const metadata = getLayerMetadata(layer.svgData);

    const layerItem = document.createElement('div');
    layerItem.className = 'layer-item';
    layerItem.style.cssText = 'padding: 8px 12px; border-bottom: 1px solid #e0e0e0; cursor: pointer; display: flex; flex-direction: column; gap: 4px;';

    const topRow = document.createElement('div');
    topRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

    const layerName = document.createElement('span');
    layerName.textContent = layer.name;
    layerName.style.cssText = 'font-size: 13px; font-weight: 500;';

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '×';
    deleteBtn.style.cssText = 'background: none; border: none; font-size: 20px; color: #d32f2f; cursor: pointer; padding: 0; width: 24px; height: 24px;';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Remove from array
      capturedLayers.splice(index, 1);
      // Update displays
      updateLayersList();
      updateLayersDisplay();
      debugLog('Deleted layer:', layer.name);
    });

    topRow.appendChild(layerName);
    topRow.appendChild(deleteBtn);

    // Add metadata row
    const metaRow = document.createElement('div');
    metaRow.style.cssText = 'font-size: 11px; color: #666; display: flex; gap: 12px;';
    metaRow.innerHTML = `<span>${metadata.shapes} shapes</span><span>${metadata.points} points</span>`;

    layerItem.appendChild(topRow);
    layerItem.appendChild(metaRow);
    layersList.appendChild(layerItem);
  });
}

// Update the display to show captured layers list (just the sidebar list)
function updateLayersDisplay() {
  // Just update the visual in the overlay
  updateLayersAndCurrentTrace();
}

// Update the display to show all captured layers + current trace stacked together
function updateLayersAndCurrentTrace() {
  const traceSvgOverlay = document.getElementById('traceSvgOverlay');

  if (!traceSvgOverlay) return;

  const parser = new DOMParser();
  let combinedSvg = '';
  let viewBox = null;

  // Add all captured layers first
  for (const layer of capturedLayers) {
    if (!layer.visible) continue;

    try {
      const svgDoc = parser.parseFromString(layer.svgData, 'image/svg+xml');
      const svgElement = svgDoc.querySelector('svg');

      // Get viewBox from first layer
      if (!viewBox && svgElement) {
        viewBox = svgElement.getAttribute('viewBox');
      }

      const paths = svgDoc.querySelectorAll('path');
      paths.forEach(path => {
        combinedSvg += path.outerHTML;
      });
    } catch (error) {
      console.error('Error parsing captured layer SVG:', error);
    }
  }

  // Add current trace on top (if exists and not yet captured)
  if (window.currentTraceImage && window.currentTraceImage.svgData) {
    try {
      const svgDoc = parser.parseFromString(window.currentTraceImage.svgData, 'image/svg+xml');
      const svgElement = svgDoc.querySelector('svg');

      // Get viewBox if we don't have one yet
      if (!viewBox && svgElement) {
        viewBox = svgElement.getAttribute('viewBox');
      }

      // Add current trace paths with a different opacity or style to show it's a preview
      const paths = svgDoc.querySelectorAll('path');
      paths.forEach(path => {
        // Clone the path and add opacity to show it's a preview
        const previewPath = path.cloneNode(true);
        previewPath.setAttribute('opacity', '0.5');
        combinedSvg += previewPath.outerHTML;
      });
    } catch (error) {
      console.error('Error parsing current trace SVG:', error);
    }
  }

  // Update the overlay
  if (combinedSvg) {
    if (viewBox) {
      traceSvgOverlay.innerHTML = `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">${combinedSvg}</svg>`;
    } else {
      traceSvgOverlay.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${combinedSvg}</svg>`;
    }
  } else {
    traceSvgOverlay.innerHTML = '';
  }
}

// ============ PAGE SIZE & OUTPUT SCALING ============

// Get page dimensions in mm (respects layout orientation)
function getPageDimensions() {
  let dimensions;

  if (currentPageSize === 'custom') {
    const width = parseFloat(document.getElementById('customWidth').value);
    const height = parseFloat(document.getElementById('customHeight').value);
    const unit = document.getElementById('customUnit').value;

    if (isNaN(width) || isNaN(height)) {
      return null;
    }

    dimensions = [toMm(width, unit), toMm(height, unit)];
  } else {
    dimensions = [...PAGE_SIZES[currentPageSize]]; // Clone array
  }

  // Swap dimensions if landscape
  if (currentLayout === 'landscape') {
    return [dimensions[1], dimensions[0]]; // Swap width and height
  }

  return dimensions;
}

// Create or update page background
function updatePageBackground() {
  const traceViewer = document.getElementById('traceViewer');
  const traceImageContainer = document.getElementById('traceImageContainer');

  if (!traceImageContainer || traceImageContainer.style.display === 'none') {
    return;
  }

  const dimensions = getPageDimensions();
  if (!dimensions) {
    removePageBackground();
    return;
  }

  const [widthMm, heightMm] = dimensions;
  const aspectRatio = widthMm / heightMm;

  // Remove existing background
  if (pageBackgroundElement) {
    pageBackgroundElement.remove();
  }

  // Create new page background
  pageBackgroundElement = document.createElement('div');
  pageBackgroundElement.className = 'page-background';

  // Calculate size to fit in viewer while maintaining aspect ratio
  const viewerRect = traceViewer.getBoundingClientRect();
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

  pageBackgroundElement.style.width = displayWidth + 'px';
  pageBackgroundElement.style.height = displayHeight + 'px';
  pageBackgroundElement.style.left = '50%';
  pageBackgroundElement.style.top = '50%';
  pageBackgroundElement.style.transform = 'translate(-50%, -50%)';

  // Insert into viewer before the image container
  traceViewer.insertBefore(pageBackgroundElement, traceImageContainer);

  // Apply output scale to the image container
  const scaleFactor = outputScale / 100;
  const scaledWidth = displayWidth * scaleFactor;
  const scaledHeight = displayHeight * scaleFactor;

  // Scale the image container to fit the page
  traceImageContainer.style.width = scaledWidth + 'px';
  traceImageContainer.style.height = scaledHeight + 'px';
  traceImageContainer.style.maxWidth = scaledWidth + 'px';
  traceImageContainer.style.maxHeight = scaledHeight + 'px';

  debugLog('Page background updated:', currentPageSize, widthMm + 'mm × ' + heightMm + 'mm', 'scale:', outputScale + '%');
}

function removePageBackground() {
  if (pageBackgroundElement) {
    pageBackgroundElement.remove();
    pageBackgroundElement = null;
  }

  const traceImageContainer = document.getElementById('traceImageContainer');
  if (traceImageContainer) {
    traceImageContainer.style.width = '';
    traceImageContainer.style.height = '';
    traceImageContainer.style.maxWidth = '';
    traceImageContainer.style.maxHeight = '';
  }
}

// ============ SAVE FUNCTIONALITY ============

// Function to combine all layers into a single SVG with proper dimensions
function combineLayersToSVG(layers, widthMm, heightMm) {
  console.log('[combineLayersToSVG] Starting with', layers.length, 'layers');
  const parser = new DOMParser();
  const allPaths = [];
  let viewBox = null;

  // Extract paths from all visible layers and get viewBox
  for (const layer of layers) {
    if (!layer.visible) {
      console.log('[combineLayersToSVG] Skipping invisible layer:', layer.name);
      continue;
    }

    try {
      const svgDoc = parser.parseFromString(layer.svgData, 'image/svg+xml');
      const svgElement = svgDoc.querySelector('svg');

      // Get viewBox from first layer
      if (!viewBox && svgElement) {
        viewBox = svgElement.getAttribute('viewBox');
        console.log('[combineLayersToSVG] Using viewBox from layer:', viewBox);
      }

      const paths = svgDoc.querySelectorAll('path');
      console.log('[combineLayersToSVG] Found', paths.length, 'paths in layer:', layer.name);

      paths.forEach((path, idx) => {
        const d = path.getAttribute('d');
        if (!d || d.trim() === '') {
          console.warn('[combineLayersToSVG] Path', idx, 'has empty d attribute, skipping');
          return;
        }

        allPaths.push({
          d: d,
          fill: path.getAttribute('fill') || 'none',
          stroke: path.getAttribute('stroke') || '#000000',
          strokeWidth: path.getAttribute('stroke-width') || '1'
        });

        // Log first path for debugging
        if (idx === 0) {
          console.log('[combineLayersToSVG] Sample path d (first 100 chars):', d.substring(0, 100));
        }
      });
    } catch (error) {
      console.error('[combineLayersToSVG] Error parsing layer SVG:', error);
    }
  }

  console.log('[combineLayersToSVG] Total paths collected:', allPaths.length);

  if (allPaths.length === 0) {
    throw new Error('No paths found in layers');
  }

  // If no viewBox found, create one based on page dimensions
  if (!viewBox) {
    const mmToPx = 3.7795275591;
    const widthPx = widthMm * mmToPx;
    const heightPx = heightMm * mmToPx;
    viewBox = `0 0 ${widthPx} ${heightPx}`;
    console.log('[combineLayersToSVG] Created default viewBox:', viewBox);
  }

  // Create SVG with proper dimensions
  let svg = `<?xml version="1.0" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg width="${widthMm}mm" height="${heightMm}mm" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" version="1.1">
`;

  // Add all paths
  for (const path of allPaths) {
    svg += `  <path d="${path.d}" fill="${path.fill}" stroke="${path.stroke}" stroke-width="${path.strokeWidth}"/>\n`;
  }

  svg += `</svg>`;

  console.log('[combineLayersToSVG] ✓ Combined SVG created:', allPaths.length, 'paths,', widthMm + 'x' + heightMm + 'mm');
  console.log('[combineLayersToSVG] SVG preview (first 500 chars):', svg.substring(0, 500));
  console.log('[combineLayersToSVG] SVG preview (last 200 chars):', svg.substring(svg.length - 200));
  return svg;
}

// ============ EVENT LISTENERS INITIALIZATION ============

export function initTraceTab() {
  // ========== IMAGE PROCESSING CONTROLS ==========

  // Brightness
  const brightnessSlider = document.getElementById('brightnessSlider');
  const brightnessValue = document.getElementById('brightnessValue');

  if (brightnessSlider && brightnessValue) {
    brightnessSlider.addEventListener('input', (e) => {
      brightnessValue.textContent = e.target.value;
      if (window.currentTraceImage && window.currentTraceImage.src) {
        triggerAutoTrace();
      }
    });
  }

  // Contrast
  const contrastSlider = document.getElementById('contrastSlider');
  const contrastValue = document.getElementById('contrastValue');

  if (contrastSlider && contrastValue) {
    contrastSlider.addEventListener('input', (e) => {
      contrastValue.textContent = e.target.value;
      if (window.currentTraceImage && window.currentTraceImage.src) {
        triggerAutoTrace();
      }
    });
  }

  // Saturation
  const saturationSlider = document.getElementById('saturationSlider');
  const saturationValue = document.getElementById('saturationValue');

  if (saturationSlider && saturationValue) {
    saturationSlider.addEventListener('input', (e) => {
      saturationValue.textContent = e.target.value;
      if (window.currentTraceImage && window.currentTraceImage.src) {
        triggerAutoTrace();
      }
    });
  }

  // Hue
  const hueSlider = document.getElementById('hueSlider');
  const hueValue = document.getElementById('hueValue');

  if (hueSlider && hueValue) {
    hueSlider.addEventListener('input', (e) => {
      hueValue.textContent = e.target.value + '°';
      if (window.currentTraceImage && window.currentTraceImage.src) {
        triggerAutoTrace();
      }
    });
  }

  // Greyscale
  const greyscaleToggle = document.getElementById('greyscaleToggle');

  if (greyscaleToggle) {
    greyscaleToggle.addEventListener('change', (e) => {
      if (window.currentTraceImage && window.currentTraceImage.src) {
        triggerAutoTrace();
      }
    });
  }

  // Sepia
  const sepiaToggle = document.getElementById('sepiaToggle');

  if (sepiaToggle) {
    sepiaToggle.addEventListener('change', (e) => {
      if (window.currentTraceImage && window.currentTraceImage.src) {
        triggerAutoTrace();
      }
    });
  }

  // ========== POTRACE PARAMETERS CONTROLS ==========

  // Turn Policy
  const turnPolicySelect = document.getElementById('turnPolicySelect');

  if (turnPolicySelect) {
    turnPolicySelect.addEventListener('change', (e) => {
      if (window.currentTraceImage && window.currentTraceImage.src) {
        triggerAutoTrace();
      }
    });
  }

  // Turd Size
  const turdSizeSlider = document.getElementById('turdSizeSlider');
  const turdSizeValue = document.getElementById('turdSizeValue');

  if (turdSizeSlider && turdSizeValue) {
    turdSizeSlider.addEventListener('input', (e) => {
      turdSizeValue.textContent = e.target.value;
      if (window.currentTraceImage && window.currentTraceImage.src) {
        triggerAutoTrace();
      }
    });
  }

  // Alpha Max
  const alphaMaxSlider = document.getElementById('alphaMaxSlider');
  const alphaMaxValue = document.getElementById('alphaMaxValue');

  if (alphaMaxSlider && alphaMaxValue) {
    alphaMaxSlider.addEventListener('input', (e) => {
      alphaMaxValue.textContent = parseFloat(e.target.value).toFixed(1);
      if (window.currentTraceImage && window.currentTraceImage.src) {
        triggerAutoTrace();
      }
    });
  }

  // Opt Tolerance
  const optToleranceSlider = document.getElementById('optToleranceSlider');
  const optToleranceValue = document.getElementById('optToleranceValue');

  if (optToleranceSlider && optToleranceValue) {
    optToleranceSlider.addEventListener('input', (e) => {
      optToleranceValue.textContent = parseFloat(e.target.value).toFixed(2);
      if (window.currentTraceImage && window.currentTraceImage.src) {
        triggerAutoTrace();
      }
    });
  }

  // Curve Optimization
  const optCurveToggle = document.getElementById('optCurveToggle');

  if (optCurveToggle) {
    optCurveToggle.addEventListener('change', (e) => {
      if (window.currentTraceImage && window.currentTraceImage.src) {
        triggerAutoTrace();
      }
    });
  }

  // ========== DISPLAY CONTROLS ==========

  // Show bitmap toggle - only affects visibility
  const showBitmapToggle = document.getElementById('showBitmapToggle');

  if (showBitmapToggle) {
    showBitmapToggle.addEventListener('change', (e) => {
      const traceImage = document.getElementById('traceImage');
      if (traceImage) {
        if (e.target.checked) {
          // Restore the opacity from the slider
          const opacitySlider = document.getElementById('bitmapOpacitySlider');
          const opacity = opacitySlider ? parseFloat(opacitySlider.value) / 100 : 1;
          traceImage.style.opacity = opacity;
        } else {
          traceImage.style.opacity = '0';
        }
        debugLog('Show bitmap:', e.target.checked);
      }
    });
  }

  // Bitmap opacity slider
  const bitmapOpacitySlider = document.getElementById('bitmapOpacitySlider');
  const bitmapOpacityValue = document.getElementById('bitmapOpacityValue');

  if (bitmapOpacitySlider && bitmapOpacityValue) {
    bitmapOpacitySlider.addEventListener('input', (e) => {
      const opacity = parseFloat(e.target.value) / 100;
      bitmapOpacityValue.textContent = e.target.value + '%';

      const traceImage = document.getElementById('traceImage');
      const showBitmapToggle = document.getElementById('showBitmapToggle');

      // Only apply opacity if bitmap is visible
      if (traceImage && showBitmapToggle && showBitmapToggle.checked) {
        traceImage.style.opacity = opacity;
      }

      debugLog('Bitmap opacity:', opacity);
    });
  }

  // ========== ACTION BUTTONS ==========

  // Capture trace button with loading spinner
  const captureTraceBtn = document.getElementById('captureTraceBtn');

  if (captureTraceBtn) {
    captureTraceBtn.addEventListener('click', () => {
      if (!window.currentTraceImage || !window.currentTraceImage.svgData) {
        alert('No trace data to capture');
        return;
      }

      // Disable button and show loading spinner
      captureTraceBtn.disabled = true;
      const originalText = captureTraceBtn.textContent;
      captureTraceBtn.innerHTML = 'Capturing<span class="spinner"></span>';

      // Simulate processing time (potrace processing happens sync, so we use setTimeout to show spinner)
      setTimeout(() => {
        // Create a new layer
        const layerName = `Layer ${capturedLayers.length + 1}`;
        const layer = {
          id: Date.now(),
          name: layerName,
          svgData: window.currentTraceImage.svgData,
          visible: true
        };

        capturedLayers.push(layer);

        // Update the layers list
        updateLayersList();

        // Update the display to show all layers
        updateLayersDisplay();

        // Re-enable button and remove spinner
        captureTraceBtn.disabled = false;
        captureTraceBtn.textContent = originalText;

        debugLog('Captured trace as:', layerName);
      }, 300);
    });
  }

  // ============ PATH OPTIONS CONTROLS ============

  // Fill toggle - show/hide stroke controls
  const fillToggle = document.getElementById('fillToggle');
  const strokeControls = document.getElementById('strokeControls');

  if (fillToggle && strokeControls) {
    // Set initial state (fill is OFF by default, so show stroke controls)
    strokeControls.style.display = fillToggle.checked ? 'none' : 'block';

    fillToggle.addEventListener('change', (e) => {
      strokeControls.style.display = e.target.checked ? 'none' : 'block';

      // Re-trace with new fill/stroke settings
      if (window.currentTraceImage && window.currentTraceImage.src) {
        triggerAutoTrace();
      }

      debugLog('Fill toggle:', e.target.checked);
    });
  }

  // Stroke color picker
  const strokeColorPicker = document.getElementById('strokeColorPicker');

  if (strokeColorPicker) {
    strokeColorPicker.addEventListener('input', (e) => {
      if (window.currentTraceImage && window.currentTraceImage.src) {
        triggerAutoTrace();
      }
      debugLog('Stroke color:', e.target.value);
    });
  }

  // Stroke width slider
  const strokeWidthSlider = document.getElementById('strokeWidthSlider');
  const strokeWidthValue = document.getElementById('strokeWidthValue');

  if (strokeWidthSlider && strokeWidthValue) {
    strokeWidthSlider.addEventListener('input', (e) => {
      strokeWidthValue.textContent = parseFloat(e.target.value).toFixed(1);
      if (window.currentTraceImage && window.currentTraceImage.src) {
        triggerAutoTrace();
      }
    });
  }

  // ============ COLLAPSIBLE SECTIONS ============
  // Handle section collapse/expand
  document.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', () => {
      const sectionName = header.dataset.section;
      const content = document.querySelector(`[data-section-content="${sectionName}"]`);

      if (content) {
        header.classList.toggle('collapsed');
        content.classList.toggle('collapsed');

        debugLog('Section toggled:', sectionName, header.classList.contains('collapsed') ? 'collapsed' : 'expanded');
      }
    });
  });

  // ============ OUTPUT SCALING & PAGE SIZE ============

  // Output scale slider handler
  const outputScaleSlider = document.getElementById('outputScaleSlider');
  const outputScaleValue = document.getElementById('outputScaleValue');

  if (outputScaleSlider && outputScaleValue) {
    outputScaleSlider.addEventListener('input', (e) => {
      outputScale = parseInt(e.target.value);
      outputScaleValue.textContent = outputScale + '%';

      // Update page background with new scale
      if (pageBackgroundElement) {
        updatePageBackground();
      }

      debugLog('Output scale changed:', outputScale + '%');
    });
  }

  // Layout toggle handlers (portrait/landscape)
  document.querySelectorAll('.layout-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const layout = btn.dataset.layout;

      // Update active state
      document.querySelectorAll('.layout-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentLayout = layout;

      // Update page background
      updatePageBackground();

      debugLog('Layout changed:', layout);
    });
  });

  // Page size button handlers
  document.querySelectorAll('.page-size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const size = btn.dataset.size;

      // Update active state
      document.querySelectorAll('.page-size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      setCurrentPageSize(size);

      // Show/hide custom inputs
      const customInputs = document.getElementById('customSizeInputs');
      if (size === 'custom') {
        customInputs.style.display = 'flex';
      } else {
        customInputs.style.display = 'none';
        updatePageBackground();
      }

      debugLog('Page size selected:', size);
    });
  });

  // Custom size input handlers
  const customWidth = document.getElementById('customWidth');
  const customHeight = document.getElementById('customHeight');
  const customUnit = document.getElementById('customUnit');

  [customWidth, customHeight, customUnit].forEach(input => {
    if (input) {
      input.addEventListener('input', () => {
        if (currentPageSize === 'custom') {
          updatePageBackground();
        }
      });
    }
  });

  // Update page background on window resize
  window.addEventListener('resize', () => {
    if (pageBackgroundElement) {
      updatePageBackground();
    }
  });

  // ============ IMAGE SCALING CONTROLS ============

  // Scale button handlers
  document.querySelectorAll('.scale-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const scale = parseInt(btn.dataset.scale);

      // Update active state
      document.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update scale in current image
      if (window.currentTraceImage) {
        window.currentTraceImage.scale = scale;

        // Update dimension display
        updateDimensionDisplay();

        // Re-trace with new scale
        if (window.currentTraceImage.originalSrc) {
          triggerAutoTrace();
        }
      }

      debugLog('Image scale changed:', scale + '%');
    });
  });

  // Initialize page background for A4
  setTimeout(() => {
    if (window.currentTraceImage && window.currentTraceImage.src) {
      updatePageBackground();
    }
  }, 100);

  // ============ SAVE FUNCTIONALITY ============

  // Save SVG button - combines all captured layers and uses page size
  const saveSvgBtn = document.getElementById('saveSvgBtn');
  if (saveSvgBtn) {
    saveSvgBtn.addEventListener('click', async () => {
      // Check if there are any captured layers
      if (capturedLayers.length === 0) {
        alert('No layers captured. Please capture at least one trace layer first.');
        return;
      }

      try {
        saveSvgBtn.disabled = true;
        const originalText = saveSvgBtn.innerHTML;
        saveSvgBtn.innerHTML = '<span>⏳</span> Saving...';

        // Get page dimensions in mm
        const dimensions = getPageDimensions();
        if (!dimensions) {
          alert('Please select a page size first.');
          saveSvgBtn.disabled = false;
          saveSvgBtn.innerHTML = originalText;
          return;
        }

        const [widthMm, heightMm] = dimensions;
        console.log('[SVG Save] Creating SVG with dimensions:', widthMm + 'mm x ' + heightMm + 'mm', 'from', capturedLayers.length, 'layers');

        // Create combined SVG with proper dimensions
        let svgString;
        try {
          svgString = combineLayersToSVG(capturedLayers, widthMm, heightMm);
          console.log('[SVG Save] SVG string created, length:', svgString.length);
        } catch (combineError) {
          console.error('[SVG Save] Error combining layers:', combineError);
          throw new Error('Failed to combine layers: ' + combineError.message);
        }

        // Generate filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `combined_trace_${timestamp}.svg`;
        console.log('[SVG Save] Saving as:', filename);

        // Convert SVG string to data URL
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
        const reader = new FileReader();

        reader.onerror = function() {
          console.error('[SVG Save] FileReader error');
          alert('Error converting SVG to data URL');
          saveSvgBtn.disabled = false;
          saveSvgBtn.innerHTML = originalText;
        };

        reader.onload = async function() {
          try {
            const dataUrl = reader.result;
            console.log('[SVG Save] Data URL created, saving to file...');

            // Save using existing saveImage method (works for SVG too)
            const result = await window.electronAPI.saveImage(dataUrl, filename);

            if (result.success) {
              console.log('[SVG Save] ✓ Combined SVG saved:', result.path, `(${capturedLayers.length} layers, ${widthMm}x${heightMm}mm)`);

              // Switch to vectors tab - use window.switchTab which is the enhanced
              // version from renderer.js that automatically calls loadVectors()
              window.switchTab('vectors');

              // Clear trace interface after successful save
              clearTraceInterface();

              // Show success message briefly
              saveSvgBtn.innerHTML = '<span>✓</span> Saved!';
              setTimeout(() => {
                saveSvgBtn.innerHTML = originalText;
                saveSvgBtn.disabled = false;
              }, 2000);
            } else {
              console.error('[SVG Save] Save failed:', result.error);
              throw new Error(result.error || 'Unknown error saving file');
            }
          } catch (saveError) {
            console.error('[SVG Save] Error in save handler:', saveError);
            alert('Error saving SVG: ' + saveError.message);
            saveSvgBtn.disabled = false;
            saveSvgBtn.innerHTML = originalText;
          }
        };

        reader.readAsDataURL(svgBlob);

      } catch (error) {
        console.error('Error saving SVG:', error);
        alert('Error saving SVG: ' + error.message);
        saveSvgBtn.disabled = false;
        saveSvgBtn.innerHTML = '<span>💾</span> Save SVG';
      }
    });
  }

  // Save Image button
  const saveImageBtn = document.getElementById('saveImageBtn');
  if (saveImageBtn) {
    saveImageBtn.addEventListener('click', async () => {
      const traceImageContainer = document.getElementById('traceImageContainer');
      const traceSvgOverlay = document.getElementById('traceSvgOverlay');

      if (!traceSvgOverlay || !traceSvgOverlay.innerHTML) {
        alert('No trace to save. Please trace an image first.');
        return;
      }

      try {
        saveImageBtn.disabled = true;
        const originalText = saveImageBtn.innerHTML;
        saveImageBtn.innerHTML = '<span>⏳</span> Saving...';

        // Create a canvas to render the composite image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Get the container dimensions
        const containerRect = traceImageContainer.getBoundingClientRect();
        canvas.width = containerRect.width;
        canvas.height = containerRect.height;

        // Draw white background if page background exists
        if (pageBackgroundElement) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Draw the processed bitmap image at full opacity
        // (ignore display opacity settings - always save at 100%)
        const traceImage = document.getElementById('traceImage');
        ctx.globalAlpha = 1.0;
        ctx.drawImage(traceImage, 0, 0, canvas.width, canvas.height);

        // Draw the SVG
        const svgElement = traceSvgOverlay.querySelector('svg');
        if (svgElement) {
          const svgData = new XMLSerializer().serializeToString(svgElement);
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const svgUrl = URL.createObjectURL(svgBlob);

          const img = new Image();
          img.onload = function() {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(svgUrl);

            // Convert canvas to JPEG
            canvas.toBlob(async (blob) => {
              const reader = new FileReader();
              reader.onload = async function() {
                const dataUrl = reader.result;

                // Generate filename
                const baseName = window.currentTraceImage.fileName.replace(/\.[^/.]+$/, '');
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const filename = `${baseName}_traced_${timestamp}.jpg`;

                // Trigger download
                const a = document.createElement('a');
                a.href = dataUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                debugLog('Image downloaded:', filename);

                // Show success message
                saveImageBtn.innerHTML = '<span>✓</span> Downloaded!';
                setTimeout(() => {
                  saveImageBtn.innerHTML = originalText;
                  saveImageBtn.disabled = false;
                }, 2000);
              };
              reader.readAsDataURL(blob);
            }, 'image/jpeg', 0.95);
          };
          img.src = svgUrl;
        }

      } catch (error) {
        console.error('Error saving image:', error);
        alert('Error saving image: ' + error.message);
        saveImageBtn.disabled = false;
        saveImageBtn.innerHTML = '<span>📷</span> Save Image';
      }
    });
  }

  // Add Enter key shortcut for Capture Trace when on Trace tab
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      // Check if Trace tab is active
      const traceTab = document.querySelector('[data-tab="trace"]');
      if (traceTab && traceTab.classList.contains('active')) {
        const captureTraceBtn = document.getElementById('captureTraceBtn');
        // Check if button exists and is not disabled
        if (captureTraceBtn && !captureTraceBtn.disabled) {
          e.preventDefault();
          captureTraceBtn.click();
        }
      }
    }
  });

  // ============ UPLOAD IMAGE BUTTON ============

  // Setup upload button on trace page
  const traceUploadImageBtn = document.getElementById('traceUploadImageBtn');
  const traceImageUploadInput = document.getElementById('traceImageUploadInput');

  if (traceUploadImageBtn && traceImageUploadInput) {
    traceUploadImageBtn.addEventListener('click', () => {
      traceImageUploadInput.click();
    });

    traceImageUploadInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/bmp'];
      if (!validTypes.includes(file.type)) {
        alert('Please select a valid image file (JPEG, PNG, or BMP)');
        return;
      }

      try {
        // Read file as data URL
        const reader = new FileReader();
        reader.onload = async (event) => {
          const imageData = event.target.result;

          // Save image to gellyroller directory
          const result = await window.electronAPI.saveImage(imageData, file.name);

          if (result.success) {
            debugLog('Image uploaded successfully:', result.filename);

            // Load the image directly into the trace tab
            showImageInTraceTab(imageData, file.name);
          } else {
            alert(`Failed to upload image: ${result.error}`);
          }
        };

        reader.onerror = () => {
          alert('Failed to read file');
        };

        reader.readAsDataURL(file);
      } catch (error) {
        console.error('Error uploading image:', error);
        alert('Error uploading image: ' + error.message);
      }

      // Clear the input so the same file can be uploaded again if needed
      e.target.value = '';
    });
  }
}

// ============ CLEAR INTERFACE ============

// Clear the trace interface (all layers and uploaded image)
function clearTraceInterface() {
  // Clear all captured layers
  capturedLayers = [];

  // Clear current trace image
  window.currentTraceImage = null;

  // Clear the trace image element
  const traceImage = document.getElementById('traceImage');
  if (traceImage) {
    traceImage.src = '';
    traceImage.style.display = 'none';
  }

  // Clear the trace image container background
  const traceImageContainer = document.getElementById('traceImageContainer');
  if (traceImageContainer) {
    traceImageContainer.style.backgroundImage = '';
  }

  // Update displays
  updateLayersList();
  updateLayersDisplay();

  // Disable capture button
  const captureBtn = document.getElementById('captureTraceBtn');
  if (captureBtn) {
    captureBtn.disabled = true;
  }

  console.log('Trace interface cleared');
}
