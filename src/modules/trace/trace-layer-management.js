// Trace Layer Management Module
// Handles layer capture, display, page backgrounds, and layer combining

import { debugLog } from '../shared/debug.js';
import { toMm } from '../shared/utils.js';
import { PAGE_SIZES } from '../hardware.js';

// ============ MODULE STATE ============
// These are exported so trace.js can access/modify them
export let capturedLayers = [];
export let currentLayout = 'portrait'; // 'portrait' or 'landscape'
export let pageBackgroundElement = null;
export let outputScale = 100; // Output scale percentage

// State setters
export function setCapturedLayers(layers) {
  capturedLayers = layers;
}

export function addCapturedLayer(layer) {
  capturedLayers.push(layer);
}

export function setCurrentLayout(layout) {
  currentLayout = layout;
}

export function setOutputScale(scale) {
  outputScale = scale;
}

export function setPageBackgroundElement(element) {
  pageBackgroundElement = element;
}

// ============ LAYER METADATA ============

/**
 * Get metadata about an SVG layer (shapes, points)
 * @param {string} svgData - SVG string data
 * @returns {Object} Metadata with shapes and points count
 */
export function getLayerMetadata(svgData) {
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

// ============ LAYER LIST UI ============

/**
 * Update the layers list UI in the sidebar
 */
export function updateLayersList() {
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

/**
 * Update the display to show captured layers list
 */
export function updateLayersDisplay() {
  updateLayersAndCurrentTrace();
}

/**
 * Update the display to show all captured layers + current trace stacked together
 */
export function updateLayersAndCurrentTrace() {
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

/**
 * Get page dimensions in mm (respects layout orientation)
 * @param {string} currentPageSize - Current page size key
 * @returns {Array<number>|null} [widthMm, heightMm] or null if invalid
 */
export function getPageDimensions(currentPageSize) {
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

/**
 * Create or update page background
 * @param {string} currentPageSize - Current page size key
 */
export function updatePageBackground(currentPageSize) {
  const traceViewer = document.getElementById('traceViewer');
  const traceImageContainer = document.getElementById('traceImageContainer');

  if (!traceImageContainer || traceImageContainer.style.display === 'none') {
    return;
  }

  const dimensions = getPageDimensions(currentPageSize);
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

/**
 * Remove page background and reset image container sizing
 */
export function removePageBackground() {
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

/**
 * Combine all layers into a single SVG with proper dimensions
 * @param {Array} layers - Array of layer objects with svgData
 * @param {number} widthMm - Width in millimeters
 * @param {number} heightMm - Height in millimeters
 * @returns {string} Combined SVG string
 */
export function combineLayersToSVG(layers, widthMm, heightMm) {
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
