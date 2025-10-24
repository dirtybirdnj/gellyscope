// statusBar.js - Status Bar Management
// Handles dynamic status bar updates based on active tab

/**
 * Update the status bar with contextual information
 * @param {string} tabName - The name of the active tab
 * @param {object} data - Tab-specific data to display
 */
export function updateStatusBar(tabName, data = {}) {
  const statusBarInfo = document.getElementById('statusBarInfo');
  const statusBarStatus = document.getElementById('statusBarStatus');

  if (!statusBarInfo || !statusBarStatus) return;

  // Default status
  statusBarStatus.textContent = data.status || 'Ready';

  // Clear existing content
  statusBarInfo.innerHTML = '';

  // Tab-specific status bar content
  switch (tabName) {
    case 'camera':
      updateCameraStatus(statusBarInfo, data);
      break;

    case 'images':
      updateImagesStatus(statusBarInfo, data);
      break;

    case 'trace':
      updateTraceStatus(statusBarInfo, data);
      break;

    case 'vectors':
      updateVectorsStatus(statusBarInfo, data);
      break;

    case 'eject':
      updateEjectStatus(statusBarInfo, data);
      break;

    case 'render':
      updateRenderStatus(statusBarInfo, data);
      break;

    case 'hardware':
      updateHardwareStatus(statusBarInfo, data);
      break;

    default:
      statusBarInfo.innerHTML = '<span class="status-bar-value">No information available</span>';
  }
}

function updateCameraStatus(container, data) {
  const items = [];

  if (data.resolution) {
    items.push(createStatusItem('Resolution', data.resolution));
  }

  if (data.device) {
    items.push(createStatusItem('Device', data.device));
  }

  if (data.fps) {
    items.push(createStatusItem('FPS', data.fps));
  }

  container.innerHTML = items.length > 0
    ? items.join('<div class="status-bar-divider"></div>')
    : '<span class="status-bar-value">Camera inactive</span>';
}

function updateImagesStatus(container, data) {
  const items = [];

  if (data.count !== undefined) {
    items.push(createStatusItem('Images', data.count));
  }

  if (data.selectedImage) {
    items.push(createStatusItem('Selected', data.selectedImage));
  }

  if (data.dimensions) {
    items.push(createStatusItem('Dimensions', data.dimensions));
  }

  if (data.fileSize) {
    items.push(createStatusItem('Size', data.fileSize));
  }

  container.innerHTML = items.length > 0
    ? items.join('<div class="status-bar-divider"></div>')
    : '<span class="status-bar-value">No images</span>';
}

function updateTraceStatus(container, data) {
  const items = [];

  if (data.imageName) {
    items.push(createStatusItem('Image', data.imageName));
  }

  if (data.dimensions) {
    items.push(createStatusItem('Size', data.dimensions));
  }

  if (data.turnPolicy) {
    items.push(createStatusItem('Turn Policy', data.turnPolicy));
  }

  if (data.turdSize !== undefined) {
    items.push(createStatusItem('Turd Size', data.turdSize));
  }

  if (data.nodeCount !== undefined) {
    items.push(createStatusItem('Nodes', data.nodeCount));
  }

  container.innerHTML = items.length > 0
    ? items.join('<div class="status-bar-divider"></div>')
    : '<span class="status-bar-value">No image loaded</span>';
}

function updateVectorsStatus(container, data) {
  const items = [];

  if (data.count !== undefined) {
    items.push(createStatusItem('Vectors', data.count));
  }

  if (data.selectedVector) {
    items.push(createStatusItem('Selected', data.selectedVector));
  }

  if (data.dimensions) {
    items.push(createStatusItem('Dimensions', data.dimensions));
  }

  if (data.pathCount !== undefined) {
    items.push(createStatusItem('Paths', data.pathCount));
  }

  container.innerHTML = items.length > 0
    ? items.join('<div class="status-bar-divider"></div>')
    : '<span class="status-bar-value">No vectors</span>';
}

function updateEjectStatus(container, data) {
  const items = [];

  if (data.pageSize) {
    items.push(createStatusItem('Page Size', data.pageSize));
  }

  if (data.layout) {
    items.push(createStatusItem('Layout', data.layout));
  }

  if (data.scale !== undefined) {
    items.push(createStatusItem('Scale', `${data.scale}%`));
  }

  if (data.workArea) {
    items.push(createStatusItem('Work Area', data.workArea));
  }

  if (data.outputDimensions) {
    items.push(createStatusItem('Output', data.outputDimensions));
  }

  container.innerHTML = items.length > 0
    ? items.join('<div class="status-bar-divider"></div>')
    : '<span class="status-bar-value">No vector loaded</span>';
}

function updateRenderStatus(container, data) {
  const items = [];

  if (data.fileName) {
    items.push(createStatusItem('File', data.fileName));
  }

  if (data.lines !== undefined) {
    items.push(createStatusItem('Lines', data.lines));
  }

  if (data.bounds) {
    items.push(createStatusItem('Bounds', data.bounds));
  }

  if (data.travelDistance) {
    items.push(createStatusItem('Travel', data.travelDistance));
  }

  if (data.estimatedTime) {
    items.push(createStatusItem('Est. Time', data.estimatedTime));
  }

  if (data.zoom !== undefined) {
    items.push(createStatusItem('Zoom', `${data.zoom}%`));
  }

  container.innerHTML = items.length > 0
    ? items.join('<div class="status-bar-divider"></div>')
    : '<span class="status-bar-value">No G-code file selected</span>';
}

function updateHardwareStatus(container, data) {
  const items = [];

  if (data.workspaceWidth && data.workspaceHeight) {
    items.push(createStatusItem('Workspace', `${data.workspaceWidth} × ${data.workspaceHeight} mm`));
  }

  if (data.outputUnit) {
    items.push(createStatusItem('Unit', data.outputUnit));
  }

  if (data.vpypeVersion) {
    items.push(createStatusItem('vpype', data.vpypeVersion));
  }

  container.innerHTML = items.length > 0
    ? items.join('<div class="status-bar-divider"></div>')
    : '<span class="status-bar-value">Hardware settings</span>';
}

/**
 * Create a status bar item HTML string
 * @param {string} label
 * @param {string|number} value
 * @returns {string}
 */
function createStatusItem(label, value) {
  return `
    <span class="status-bar-label">${label}:</span>
    <span class="status-bar-value">${value}</span>
  `;
}

/**
 * Set the general status message
 * @param {string} status
 */
export function setStatus(status) {
  const statusBarStatus = document.getElementById('statusBarStatus');
  if (statusBarStatus) {
    statusBarStatus.textContent = status;
  }
}

/**
 * Clear the status bar info section
 */
export function clearStatusBarInfo() {
  const statusBarInfo = document.getElementById('statusBarInfo');
  if (statusBarInfo) {
    statusBarInfo.innerHTML = '';
  }
}
