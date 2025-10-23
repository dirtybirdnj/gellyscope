import { debugLog } from './shared/debug.js';

// ============ RENDER TAB ============

// DOM elements
let gcodeList;
let renderCanvas;
let renderMessage;
let gcodeTextArea;
let gcodeSection;
let gcodeHeader;
let gcodeTextContainer;
let gcodeCollapseArrow;

// State
let currentGcodeFile = null;

// Zoom and pan state for G-code rendering
let renderZoom = 1;
let renderPanX = 0;
let renderPanY = 0;
let renderBaseScale = 1;
let renderBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
let renderPaths = [];

// Pan state
let renderIsPanning = false;
let renderPanStartX = 0;
let renderPanStartY = 0;

/**
 * Check if render paths are available
 * @returns {boolean} True if there are paths to render
 */
export function hasRenderPaths() {
  return renderPaths.length > 0;
}

/**
 * Initialize the Render tab
 * Sets up all event listeners for the render tab including:
 * - Collapse/expand for G-code text viewer
 * - Zoom controls (in, out, reset)
 * - Pan functionality (mouse drag)
 * - Window resize handler
 */
export function initRenderTab() {
  // Get DOM elements
  gcodeList = document.getElementById('gcodeList');
  renderCanvas = document.getElementById('renderCanvas');
  renderMessage = document.getElementById('renderMessage');
  gcodeTextArea = document.getElementById('gcodeText');
  gcodeSection = document.getElementById('renderGcodeSection');
  gcodeHeader = document.getElementById('gcodeHeader');
  gcodeTextContainer = document.getElementById('gcodeTextContainer');
  gcodeCollapseArrow = document.getElementById('gcodeCollapseArrow');

  // Setup collapse/expand functionality for G-code text viewer
  if (gcodeHeader) {
    gcodeHeader.addEventListener('click', () => {
      const isExpanded = gcodeTextContainer.style.display !== 'none';

      if (isExpanded) {
        // Collapse
        gcodeTextContainer.style.display = 'none';
        gcodeCollapseArrow.textContent = '▼';
      } else {
        // Expand
        gcodeTextContainer.style.display = 'block';
        gcodeCollapseArrow.textContent = '▲';
      }
    });
  }

  // Zoom button handlers
  document.getElementById('renderZoomIn')?.addEventListener('click', () => {
    renderZoom *= 1.2;
    drawGcode();
  });

  document.getElementById('renderZoomOut')?.addEventListener('click', () => {
    renderZoom /= 1.2;
    drawGcode();
  });

  document.getElementById('renderZoomReset')?.addEventListener('click', () => {
    renderZoom = 1;
    renderPanX = 0;
    renderPanY = 0;
    drawGcode();
  });

  // Mouse wheel zoom for render canvas
  renderCanvas?.addEventListener('wheel', (e) => {
    e.preventDefault();

    // Determine zoom direction based on wheel delta
    if (e.deltaY < 0) {
      // Scroll up = zoom in
      renderZoom *= 1.2;
    } else {
      // Scroll down = zoom out
      renderZoom /= 1.2;
    }

    drawGcode();
  });

  // Pan functionality with mouse drag for G-code rendering
  renderCanvas.addEventListener('mousedown', (e) => {
    renderIsPanning = true;
    renderPanStartX = e.clientX - renderPanX;
    renderPanStartY = e.clientY - renderPanY;
    renderCanvas.classList.add('panning');
  });

  renderCanvas.addEventListener('mousemove', (e) => {
    if (renderIsPanning) {
      renderPanX = e.clientX - renderPanStartX;
      renderPanY = e.clientY - renderPanStartY;
      drawGcode();
    }
  });

  renderCanvas.addEventListener('mouseup', () => {
    renderIsPanning = false;
    renderCanvas.classList.remove('panning');
  });

  renderCanvas.addEventListener('mouseleave', () => {
    renderIsPanning = false;
    renderCanvas.classList.remove('panning');
  });

  // Handle window resize for canvas
  window.addEventListener('resize', () => {
    if (renderPaths.length > 0 && renderCanvas.style.display !== 'none') {
      drawGcode();
    }
  });

  debugLog('Render tab initialized');
}

/**
 * Handle G-code file deletion
 * @param {string} filePath - Path to the G-code file to delete
 * @param {string} fileName - Name of the file for confirmation dialog
 */
async function handleGcodeDelete(filePath, fileName) {
  try {
    const confirmed = confirm(`Are you sure you want to delete "${fileName}"?\n\nThis action cannot be undone.`);
    if (!confirmed) return;

    const result = await window.electronAPI.deleteFile(filePath);
    if (result.success) {
      // Reload the list
      await loadGcodeFiles();

      // Clear preview if this was the active file
      if (currentGcodeFile === filePath) {
        currentGcodeFile = null;
        renderPaths = [];
        renderCanvas.style.display = 'none';
        renderMessage.textContent = 'Select a G-code file to preview';
        renderMessage.style.display = 'block';
        document.getElementById('renderZoomControls').style.display = 'none';
      }
    } else {
      alert('Error deleting file: ' + result.error);
    }
  } catch (error) {
    console.error('Error deleting G-code:', error);
    alert('Error deleting file: ' + error.message);
  }
}

/**
 * Load G-code files list
 * Called when switching to the render tab to display available G-code files
 */
export async function loadGcodeFiles() {
  try {
    const result = await window.electronAPI.listGcodeFiles();

    if (!result.success) {
      gcodeList.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.5;">No G-code files found or directory not accessible</div>';
      return;
    }

    if (result.files.length === 0) {
      gcodeList.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.5;">No G-code files in gellyroller directory</div>';
      return;
    }

    // Clear existing items
    gcodeList.innerHTML = '';

    // Load each G-code file
    for (const file of result.files) {
      const gcodeItem = document.createElement('div');
      gcodeItem.className = 'gcode-item';

      // Format file size
      const sizeKB = (file.size / 1024).toFixed(1);
      const sizeText = sizeKB < 1024 ? `${sizeKB} KB` : `${(sizeKB / 1024).toFixed(1)} MB`;

      // Format date
      const date = new Date(file.modified);
      const dateText = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      gcodeItem.innerHTML = `
        <div class="gcode-item-header">
          <div class="gcode-item-name" title="${file.name}">${file.name}</div>
          <button class="gcode-delete-btn" title="Delete file">🗑️</button>
        </div>
        <div class="gcode-item-info">
          <span class="gcode-item-size">${sizeText}</span>
          <span class="gcode-item-date">${dateText}</span>
        </div>
      `;

      // Click to preview
      gcodeItem.addEventListener('click', async () => {
        // Remove active class from all items
        document.querySelectorAll('.gcode-item').forEach(item => {
          item.classList.remove('active');
        });

        // Add active class to this item
        gcodeItem.classList.add('active');

        // Load and render the G-code
        await loadGcodeFile(file.path);
      });

      // Delete button handler
      const deleteBtn = gcodeItem.querySelector('.gcode-delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation(); // Prevent triggering the item click
          await handleGcodeDelete(file.path, file.name);
        });
      }

      gcodeList.appendChild(gcodeItem);
    }
  } catch (error) {
    console.error('Error loading G-code files:', error);
    gcodeList.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.5;">Error loading G-code files</div>';
  }
}

/**
 * Load and display a specific G-code file
 * @param {string} filePath - Path to the G-code file
 */
async function loadGcodeFile(filePath) {
  try {
    // Read the G-code file
    const result = await window.electronAPI.readFileText(filePath);

    if (!result.success) {
      renderMessage.textContent = 'Error loading G-code file';
      renderMessage.style.display = 'block';
      renderCanvas.style.display = 'none';
      gcodeSection.style.display = 'none';
      return;
    }

    currentGcodeFile = result.data;

    // Hide message and show canvas
    renderMessage.style.display = 'none';
    renderCanvas.style.display = 'block';

    // Show G-code section and populate textarea
    gcodeSection.style.display = 'block';
    gcodeTextArea.value = result.data;

    // Parse and render the G-code
    renderGcode(result.data);
  } catch (error) {
    console.error('Error loading G-code file:', error);
    renderMessage.textContent = 'Error loading G-code file';
    renderMessage.style.display = 'block';
    renderCanvas.style.display = 'none';
    gcodeSection.style.display = 'none';
  }
}

/**
 * Parse G-code text and extract drawing paths
 * Handles M42 pen control commands and G0/G1 movement commands
 * @param {string} gcodeText - The G-code text to parse
 */
function renderGcode(gcodeText) {
  const lines = gcodeText.split('\n');

  // Parse G-code to extract drawing commands
  const paths = [];
  let currentX = 0, currentY = 0;
  let isPenDown = false;
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let currentPath = [];

  for (const line of lines) {
    // Remove comments and trim
    const cleanLine = line.split(';')[0].trim().toUpperCase();
    if (!cleanLine) continue;

    // Parse M42 commands (pen control)
    // M42 P0 S1 = pen up (pin high)
    // M42 P0 S0 = pen down (pin low)
    if (cleanLine.includes('M42')) {
      const sMatch = cleanLine.match(/S(\d+)/);
      if (sMatch) {
        const sValue = parseInt(sMatch[1]);
        if (sValue === 1) {
          // Pen up - save current path if it exists
          if (currentPath.length > 0) {
            paths.push([...currentPath]);
            currentPath = [];
          }
          isPenDown = false;
        } else if (sValue === 0) {
          // Pen down - start new path at current position
          isPenDown = true;
          currentPath.push({ x: currentX, y: currentY });
        }
      }
    }

    // Parse G0/G1 movement commands
    if (cleanLine.startsWith('G0') || cleanLine.startsWith('G00') ||
        cleanLine.startsWith('G1') || cleanLine.startsWith('G01')) {

      // Extract X, Y coordinates
      const xMatch = cleanLine.match(/X([-\d.]+)/);
      const yMatch = cleanLine.match(/Y([-\d.]+)/);

      if (xMatch) currentX = parseFloat(xMatch[1]);
      if (yMatch) currentY = parseFloat(yMatch[1]);

      // Track bounds for all movements
      minX = Math.min(minX, currentX);
      maxX = Math.max(maxX, currentX);
      minY = Math.min(minY, currentY);
      maxY = Math.max(maxY, currentY);

      // Only add to path if pen is down
      if (isPenDown) {
        currentPath.push({ x: currentX, y: currentY });
      }
    }
  }

  // Add the last path if it exists
  if (currentPath.length > 0) {
    paths.push(currentPath);
  }

  // If no paths found, show message
  if (paths.length === 0) {
    renderMessage.textContent = 'No drawing commands found in G-code';
    renderMessage.style.display = 'block';
    renderCanvas.style.display = 'none';
    document.getElementById('renderZoomControls').style.display = 'none';
    return;
  }

  // Store paths and bounds for re-rendering with zoom/pan
  renderPaths = paths;
  const width = maxX - minX;
  const height = maxY - minY;
  renderBounds = { minX, maxX, minY, maxY, width, height };

  // Reset zoom and pan on new file
  renderZoom = 1;
  renderPanX = 0;
  renderPanY = 0;

  // Show zoom controls
  document.getElementById('renderZoomControls').style.display = 'flex';

  // Draw the G-code
  drawGcode();
}

/**
 * Draw the G-code paths on the canvas with current zoom and pan
 * Applies coordinate transformations and scaling to fit the canvas
 */
export function drawGcode() {
  const canvas = renderCanvas;
  const ctx = canvas.getContext('2d');

  // Set canvas size to match container
  const container = canvas.parentElement;
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;

  canvas.width = containerWidth;
  canvas.height = containerHeight;

  // Calculate scale to fit the drawing in the canvas with padding
  const padding = 40;
  const scaleX = (containerWidth - 2 * padding) / renderBounds.width;
  const scaleY = (containerHeight - 2 * padding) / renderBounds.height;
  renderBaseScale = Math.min(scaleX, scaleY);

  const scale = renderBaseScale * renderZoom;

  // Clear canvas
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Set up transformation to center and scale the drawing
  ctx.save();
  ctx.translate(containerWidth / 2 + renderPanX, containerHeight / 2 + renderPanY);
  ctx.scale(scale, -scale); // Flip Y axis for typical G-code coordinate system
  ctx.translate(-renderBounds.minX - renderBounds.width / 2, -renderBounds.minY - renderBounds.height / 2);

  // Draw all paths
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 0.5 / scale; // Adjust line width based on scale
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const path of renderPaths) {
    if (path.length < 2) continue;

    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);

    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x, path[i].y);
    }

    ctx.stroke();
  }

  ctx.restore();

  // Draw info overlay
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = '12px monospace';
  ctx.fillText(`Dimensions: ${renderBounds.width.toFixed(2)} × ${renderBounds.height.toFixed(2)} mm`, 10, 20);
  ctx.fillText(`Paths: ${renderPaths.length}`, 10, 35);
  ctx.fillText(`Zoom: ${(renderZoom * 100).toFixed(0)}%`, 10, 50);
}
