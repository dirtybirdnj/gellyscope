// Trace Tab Module - Main Coordinator
// Refactored to use sub-modules for image processing, layer management, and core tracing

import { debugLog } from './shared/debug.js';
import { switchTab } from './shared/tabs.js';
import { escapeHtml } from './shared/utils.js';
import { setState } from './shared/state.js';
import { currentPageSize, setCurrentPageSize } from './hardware.js';

// Import sub-modules
import { updateDimensionDisplay } from './trace/trace-image-processing.js';
import {
  capturedLayers,
  setCapturedLayers,
  addCapturedLayer,
  setCurrentLayout,
  setOutputScale,
  outputScale,
  pageBackgroundElement,
  updateLayersList,
  updateLayersDisplay,
  getPageDimensions,
  updatePageBackground,
  removePageBackground,
  combineLayersToSVG
} from './trace/trace-layer-management.js';
import { performTrace, triggerAutoTrace } from './trace/trace-core.js';

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
  switchTab('trace');

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
      performTrace(currentPageSize);
    }
  };

  debugLog('Showing image in Trace tab:', fileName);
}

// ============ EXTRACTED FUNCTIONS ============
// The following functions have been moved to sub-modules:
// - Image processing functions → trace/trace-image-processing.js
// - Layer management functions → trace/trace-layer-management.js
// - Core tracing functions → trace/trace-core.js

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
        triggerAutoTrace(currentPageSize);
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
        triggerAutoTrace(currentPageSize);
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
        triggerAutoTrace(currentPageSize);
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
        triggerAutoTrace(currentPageSize);
      }
    });
  }

  // Greyscale
  const greyscaleToggle = document.getElementById('greyscaleToggle');

  if (greyscaleToggle) {
    greyscaleToggle.addEventListener('change', (e) => {
      if (window.currentTraceImage && window.currentTraceImage.src) {
        triggerAutoTrace(currentPageSize);
      }
    });
  }

  // Sepia
  const sepiaToggle = document.getElementById('sepiaToggle');

  if (sepiaToggle) {
    sepiaToggle.addEventListener('change', (e) => {
      if (window.currentTraceImage && window.currentTraceImage.src) {
        triggerAutoTrace(currentPageSize);
      }
    });
  }

  // ========== POTRACE PARAMETERS CONTROLS ==========

  // Turn Policy
  const turnPolicySelect = document.getElementById('turnPolicySelect');

  if (turnPolicySelect) {
    turnPolicySelect.addEventListener('change', (e) => {
      if (window.currentTraceImage && window.currentTraceImage.src) {
        triggerAutoTrace(currentPageSize);
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
        triggerAutoTrace(currentPageSize);
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
        triggerAutoTrace(currentPageSize);
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
        triggerAutoTrace(currentPageSize);
      }
    });
  }

  // Curve Optimization
  const optCurveToggle = document.getElementById('optCurveToggle');

  if (optCurveToggle) {
    optCurveToggle.addEventListener('change', (e) => {
      if (window.currentTraceImage && window.currentTraceImage.src) {
        triggerAutoTrace(currentPageSize);
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

        addCapturedLayer(layer);

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
        triggerAutoTrace(currentPageSize);
      }

      debugLog('Fill toggle:', e.target.checked);
    });
  }

  // Stroke color picker
  const strokeColorPicker = document.getElementById('strokeColorPicker');

  if (strokeColorPicker) {
    strokeColorPicker.addEventListener('input', (e) => {
      if (window.currentTraceImage && window.currentTraceImage.src) {
        triggerAutoTrace(currentPageSize);
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
        triggerAutoTrace(currentPageSize);
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
      setOutputScale(parseInt(e.target.value));
      outputScaleValue.textContent = outputScale + '%';

      // Update page background with new scale
      if (pageBackgroundElement) {
        updatePageBackground(currentPageSize);
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

      setCurrentLayout(layout);

      // Update page background
      updatePageBackground(currentPageSize);

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
        updatePageBackground(currentPageSize);
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
          updatePageBackground(currentPageSize);
        }
      });
    }
  });

  // Update page background on window resize
  window.addEventListener('resize', () => {
    if (pageBackgroundElement) {
      updatePageBackground(currentPageSize);
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
          triggerAutoTrace(currentPageSize);
        }
      }

      debugLog('Image scale changed:', scale + '%');
    });
  });

  // Initialize page background for A4
  setTimeout(() => {
    if (window.currentTraceImage && window.currentTraceImage.src) {
      updatePageBackground(currentPageSize);
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
        const dimensions = getPageDimensions(currentPageSize);
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

              // Store SVG data in state for eject tab
              const svgData = {
                path: result.path,
                content: svgString
              };
              setState({ currentSVGData: svgData });

              // Reload vectors to show the new file
              if (typeof loadVectors === 'function') {
                await loadVectors();
              }

              // Switch to eject tab and load the saved SVG
              switchTab('eject');

              // Dynamically import and load eject tab
              import('./eject.js').then(module => {
                module.loadEjectTab();
              });

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
}

// ============ CLEAR INTERFACE ============

// Clear the trace interface (all layers and uploaded image)
function clearTraceInterface() {
  // Clear all captured layers
  setCapturedLayers([]);

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
