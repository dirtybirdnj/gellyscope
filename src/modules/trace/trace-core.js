// Trace Core Module
// Handles main tracing logic and Potrace integration

import { debugLog } from '../shared/debug.js';
import { scaleImage, applyImageProcessing } from './trace-image-processing.js';
import { updateLayersAndCurrentTrace, updatePageBackground } from './trace-layer-management.js';

// ============ MODULE STATE ============
let traceDebounceTimer = null;

// ============ CORE TRACING FUNCTIONS ============

/**
 * Perform the actual tracing operation using Potrace
 */
export async function performTrace(currentPageSize) {
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

      // Update page background after trace
      setTimeout(() => {
        updatePageBackground(currentPageSize);
      }, 100);

      debugLog('Trace completed successfully with fill:', useFill);
    });
  } catch (error) {
    console.error('Error tracing image:', error);
  }
}

/**
 * Debounced trace trigger - waits 500ms after last change
 */
export function triggerAutoTrace(currentPageSize) {
  if (traceDebounceTimer) {
    clearTimeout(traceDebounceTimer);
  }
  traceDebounceTimer = setTimeout(() => {
    performTrace(currentPageSize);
  }, 500); // Wait 500ms after last change
}
