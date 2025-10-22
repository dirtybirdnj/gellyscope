// renderer.js - v24
// Frontend Logic

// Check if debug mode is enabled (fallback to false if not set)
const DEBUG = typeof localStorage !== 'undefined' && localStorage.getItem('DEBUG') === 'true';

// Debug logging helper
function debugLog(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

// Ensure gellyroller directory exists on app startup
async function initializeGellyroller() {
  try {
    const result = await window.electronAPI.ensureGellyrollerDirectory();
    if (result.success) {
      debugLog('Gellyroller directory ready at:', result.path);
      if (result.existed) {
        debugLog('Directory already existed');
      } else {
        debugLog('Directory was created');
      }
    } else if (result.cancelled) {
      debugLog('User cancelled directory creation');
    } else {
      console.error('Failed to setup gellyroller directory:', result.error);
    }
  } catch (error) {
    console.error('Error initializing gellyroller:', error);
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  initializeGellyroller();
});

let currentSVGData = null;
let currentSelectedElement = null;
let zoomLevel = 1;
let isPanning = false;
let startX = 0;
let startY = 0;
let scrollLeft = 0;
let scrollTop = 0;
let viewMode = 'fit'; // 'fit' or 'full'
let isCropping = false;
let cropTop = 0.25;
let cropBottom = 0.75;
let cropLeft = 0.25;
let cropRight = 0.75;
let flipH = false;
let flipV = false;

// Tab switching
document.querySelectorAll('.tab-button').forEach(button => {
  button.addEventListener('click', () => {
    const tabName = button.dataset.tab;
    switchTab(tabName);
  });
});

function switchTab(tabName) {
  // Update buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  
  // Update content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`${tabName}Tab`).classList.add('active');
}

// ============ TRACE TAB ============
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const canvasContent = document.getElementById('canvasContent');
const layersList = document.getElementById('layersList');
const infoContent = document.getElementById('infoContent');

uploadBtn.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    await handleFile(file);
  }
});

canvasContent.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
});

canvasContent.addEventListener('drop', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith('.svg')) {
    await handleFile(file);
  }
});

async function handleFile(file) {
  try {
    debugLog('Reading file:', file.name);
    const content = await file.text();
    debugLog('File content length:', content.length);
    
    debugLog('Sending to backend for parsing...');
    const result = await window.electronAPI.parseSVG(file.path, content);
    debugLog('Parse result:', result);
    
    if (result.success) {
      debugLog('Parse successful, updating UI...');
      currentSVGData = result.data;
      debugLog('SVG data:', currentSVGData);
      
      displaySVG(result.data);
      debugLog('SVG displayed');
      
      renderTree(result.data.tree);
      debugLog('Tree rendered');
      
      updateFileInfo(result.data, file);
      debugLog('File info updated');
    } else {
      console.error('Parse failed:', result.error);
      alert('Error parsing SVG: ' + result.error);
    }
  } catch (error) {
    console.error('Error in handleFile:', error);
    alert('Error reading file: ' + error.message);
  }
}

function displaySVG(data) {
  debugLog('=== displaySVG called ===');
  debugLog('Data:', data);
  debugLog('Content length:', data.content?.length);
  
  const html = `
    <div class="svg-display">
      <div class="svg-container fit-viewport" id="svgContainer">
        ${data.content}
      </div>
    </div>
  `;
  debugLog('Generated HTML preview:', html.substring(0, 200));
  
  canvasContent.innerHTML = html;
  debugLog('Canvas content updated');
  
  // Apply proper sizing to the SVG
  const svg = document.querySelector('#svgContainer svg');
  if (svg) {
    // Preserve the viewBox but remove fixed width/height
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.style.width = '100%';
    svg.style.height = '100%';
  }
  
  // Show the toolbar and info bar
  const toolbar = document.getElementById('canvasToolbar');
  const infoBar = document.getElementById('canvasInfoBar');
  if (toolbar) {
    toolbar.classList.add('visible');
  }
  if (infoBar) {
    infoBar.classList.add('visible');
  }
  
  setupSVGControls();
  setupCropControls();
}

function renderTree(tree) {
  debugLog('=== renderTree called ===');
  debugLog('Tree:', tree);
  debugLog('Tree children count:', tree.children?.length);
  
  layersList.innerHTML = '';
  const treeElement = createTreeNode(tree);
  debugLog('Tree element created:', treeElement);
  
  layersList.appendChild(treeElement);
  debugLog('Tree element appended to layersList');
}

function createTreeNode(node) {
  debugLog('Creating tree node for:', node.tag, node.id);
  
  const nodeDiv = document.createElement('div');
  nodeDiv.className = 'tree-node';
  
  const hasChildren = node.children && node.children.length > 0;
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'tree-node-content';
  contentDiv.dataset.nodeId = node.id;
  
  const toggleDiv = document.createElement('div');
  toggleDiv.className = hasChildren ? 'tree-toggle expanded' : 'tree-toggle empty';
  
  const icon = document.createElement('svg');
  icon.className = 'tree-icon';
  icon.setAttribute('viewBox', '0 0 16 16');
  icon.setAttribute('fill', 'currentColor');
  icon.innerHTML = getIconForTag(node.tag);
  
  const label = document.createElement('div');
  label.className = 'tree-label';
  
  const tagSpan = document.createElement('span');
  tagSpan.className = 'tree-tag';
  tagSpan.textContent = `<${node.tag}>`;
  
  label.appendChild(tagSpan);
  
  if (node.attributes && node.attributes.id) {
    const idSpan = document.createElement('span');
    idSpan.className = 'tree-id';
    idSpan.textContent = ` #${node.attributes.id}`;
    label.appendChild(idSpan);
  }
  
  contentDiv.appendChild(toggleDiv);
  contentDiv.appendChild(icon);
  contentDiv.appendChild(label);
  
  nodeDiv.appendChild(contentDiv);
  
  if (hasChildren) {
    const childrenDiv = document.createElement('div');
    childrenDiv.className = 'tree-children';
    
    node.children.forEach(child => {
      const childNode = createTreeNode(child);
      childrenDiv.appendChild(childNode);
    });
    
    nodeDiv.appendChild(childrenDiv);
    
    toggleDiv.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = toggleDiv.classList.contains('expanded');
      
      if (isExpanded) {
        toggleDiv.classList.remove('expanded');
        toggleDiv.classList.add('collapsed');
        childrenDiv.classList.add('collapsed');
      } else {
        toggleDiv.classList.remove('collapsed');
        toggleDiv.classList.add('expanded');
        childrenDiv.classList.remove('collapsed');
      }
    });
  }
  
  contentDiv.addEventListener('click', (e) => {
    if (e.target === toggleDiv || toggleDiv.contains(e.target)) {
      return;
    }
    
    // Remove active class from all tree nodes
    document.querySelectorAll('.tree-node-content').forEach(el => {
      el.classList.remove('active');
    });
    
    // Remove selection highlight from all SVG elements
    document.querySelectorAll('#svgContainer svg [data-selected="true"]').forEach(el => {
      el.removeAttribute('data-selected');
    });
    
    // Add active class to clicked node
    contentDiv.classList.add('active');
    currentSelectedElement = node;
    
    // Highlight the corresponding SVG element
    highlightSVGElement(node);
    
    // Update info displays - ensure info bar is visible
    updateElementInfo(node);
    updateInfoBar(node);
    
    // Force info bar to show
    const infoBar = document.getElementById('canvasInfoBar');
    if (infoBar) {
      infoBar.classList.add('visible');
      infoBar.style.display = 'flex'; // Force display
    }
  });
  
  return nodeDiv;
}

function getIconForTag(tag) {
  const icons = {
    'svg': '<path d="M2 2h12v12H2z"/>',
    'g': '<circle cx="8" cy="8" r="6"/>',
    'path': '<path d="M2 8 Q8 2 14 8 T14 14"/>',
    'rect': '<rect x="3" y="3" width="10" height="10" rx="1"/>',
    'circle': '<circle cx="8" cy="8" r="5"/>',
    'ellipse': '<ellipse cx="8" cy="8" rx="6" ry="4"/>',
    'line': '<line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" stroke-width="2"/>',
    'polyline': '<polyline points="2,14 8,2 14,14" fill="none" stroke="currentColor" stroke-width="2"/>',
    'polygon': '<polygon points="8,2 14,14 2,14"/>',
    'text': '<text x="3" y="12" font-size="10">A</text>',
    'defs': '<rect x="2" y="2" width="5" height="5"/><rect x="9" y="9" width="5" height="5"/>',
    'use': '<use href="#" x="4" y="4"/><rect x="4" y="4" width="8" height="8" fill="none" stroke="currentColor"/>',
  };
  
  return icons[tag] || '<rect x="4" y="4" width="8" height="8"/>';
}

function updateElementInfo(node) {
  const attributes = node.attributes || {};
  const attrCount = Object.keys(attributes).length;
  const childCount = node.children ? node.children.length : 0;
  
  // Check if element supports stroke properties
  const supportsStroke = ['path', 'line', 'polyline', 'polygon', 'rect', 'circle', 'ellipse'].includes(node.tag);
  
  let attributesHTML = '';
  if (attrCount > 0) {
    attributesHTML = '<div class="attribute-list">';
    for (const [key, value] of Object.entries(attributes)) {
      // Special handling for 'd' attribute (path data)
      if (key === 'd') {
        const preview = value.length > 50 ? value.substring(0, 50) + '...' : value;
        attributesHTML += `
          <div class="attribute-item">
            <span class="attr-name">${key}:</span>
            <div class="attr-collapse" data-attr="${key}">
              <span class="attr-toggle collapsed"></span>
              <span class="attr-value-preview">${escapeHtml(preview)}</span>
            </div>
            <div class="attr-value-full hidden" data-attr-full="${key}">${escapeHtml(value)}</div>
          </div>
        `;
      }
      // Stroke properties with dropdowns
      else if (supportsStroke && key === 'stroke') {
        attributesHTML += `
          <div class="attribute-item">
            <span class="attr-name">${key}:</span>
            <div class="attr-control">
              <input type="color" class="attr-input" value="${value}" data-attr="${key}" data-node-id="${node.id}" style="width: 60px;">
              <input type="text" class="attr-input" value="${value}" data-attr="${key}" data-node-id="${node.id}">
            </div>
          </div>
        `;
      }
      else if (supportsStroke && key === 'stroke-width') {
        attributesHTML += `
          <div class="attribute-item">
            <span class="attr-name">${key}:</span>
            <div class="attr-control">
              <input type="number" class="attr-input" value="${value}" data-attr="${key}" data-node-id="${node.id}" min="0" step="0.5">
            </div>
          </div>
        `;
      }
      else if (supportsStroke && key === 'stroke-linecap') {
        attributesHTML += `
          <div class="attribute-item">
            <span class="attr-name">${key}:</span>
            <div class="attr-control">
              <select class="attr-select" data-attr="${key}" data-node-id="${node.id}">
                <option value="butt" ${value === 'butt' ? 'selected' : ''}>butt</option>
                <option value="round" ${value === 'round' ? 'selected' : ''}>round</option>
                <option value="square" ${value === 'square' ? 'selected' : ''}>square</option>
              </select>
            </div>
          </div>
        `;
      }
      else if (supportsStroke && key === 'stroke-linejoin') {
        attributesHTML += `
          <div class="attribute-item">
            <span class="attr-name">${key}:</span>
            <div class="attr-control">
              <select class="attr-select" data-attr="${key}" data-node-id="${node.id}">
                <option value="miter" ${value === 'miter' ? 'selected' : ''}>miter</option>
                <option value="round" ${value === 'round' ? 'selected' : ''}>round</option>
                <option value="bevel" ${value === 'bevel' ? 'selected' : ''}>bevel</option>
              </select>
            </div>
          </div>
        `;
      }
      else if (supportsStroke && key === 'fill') {
        attributesHTML += `
          <div class="attribute-item">
            <span class="attr-name">${key}:</span>
            <div class="attr-control">
              <input type="color" class="attr-input" value="${value === 'none' ? '#000000' : value}" data-attr="${key}" data-node-id="${node.id}" style="width: 60px;" ${value === 'none' ? 'disabled' : ''}>
              <input type="text" class="attr-input" value="${value}" data-attr="${key}" data-node-id="${node.id}">
            </div>
          </div>
        `;
      }
      // Regular attributes
      else {
        attributesHTML += `
          <div class="attribute-item">
            <span class="attr-name">${key}:</span>
            <span class="attr-value">${escapeHtml(value)}</span>
          </div>
        `;
      }
    }
    attributesHTML += '</div>';
  } else {
    attributesHTML = '<div class="info-value">No attributes</div>';
  }
  
  infoContent.innerHTML = `
    <div class="info-section">
      <div class="info-label">Element Type</div>
      <div class="info-value">&lt;${node.tag}&gt;</div>
    </div>
    
    <div class="info-section">
      <div class="info-label">Element ID</div>
      <div class="info-value">${node.name}</div>
    </div>
    
    <div class="info-section">
      <div class="info-label">Children</div>
      <div class="info-value">${childCount} child element${childCount !== 1 ? 's' : ''}</div>
    </div>
    
    <div class="info-section">
      <div class="info-label">Depth Level</div>
      <div class="info-value">${node.depth}</div>
    </div>
    
    <div class="info-section">
      <div class="info-label">Attributes (${attrCount})</div>
      ${attributesHTML}
    </div>
  `;
  
  // Setup event listeners for editable attributes
  setupAttributeEditors(node);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function setupAttributeEditors(node) {
  // Setup collapse/expand for 'd' attribute
  document.querySelectorAll('.attr-collapse').forEach(el => {
    el.addEventListener('click', () => {
      const attr = el.dataset.attr;
      const toggle = el.querySelector('.attr-toggle');
      const full = document.querySelector(`[data-attr-full="${attr}"]`);
      
      if (toggle && full) {
        toggle.classList.toggle('collapsed');
        toggle.classList.toggle('expanded');
        full.classList.toggle('hidden');
      }
    });
  });
  
  // Setup attribute editors
  document.querySelectorAll('.attr-select, .attr-input').forEach(el => {
    el.addEventListener('change', (e) => {
      updateSVGAttribute(e.target.dataset.nodeId, e.target.dataset.attr, e.target.value);
    });
  });
}

function updateSVGAttribute(nodeId, attrName, attrValue) {
  const svg = document.querySelector('#svgContainer svg');
  if (!svg) return;
  
  // Find element by ID
  const element = svg.querySelector(`#${CSS.escape(nodeId)}`);
  if (!element) return;
  
  // Update the attribute
  element.setAttribute(attrName, attrValue);
  
  debugLog(`Updated ${attrName} to ${attrValue} for element ${nodeId}`);
}

function updateFileInfo(data, file) {
  infoContent.innerHTML = `
    <div class="info-section">
      <div class="info-label">File Name</div>
      <div class="info-value">${file.name}</div>
    </div>
    
    <div class="info-section">
      <div class="info-label">File Size</div>
      <div class="info-value">${formatBytes(file.size)}</div>
    </div>
    
    <div class="info-section">
      <div class="info-label">Dimensions</div>
      <div class="info-value">${data.width || 'N/A'} × ${data.height || 'N/A'}</div>
    </div>
    
    <div class="info-section">
      <div class="info-label">ViewBox</div>
      <div class="info-value">${data.viewBox || 'N/A'}</div>
    </div>
    
    <div class="info-section">
      <div class="info-label">Total Elements</div>
      <div class="info-value">${data.elementCount} elements</div>
    </div>
  `;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function updateInfoBar(node) {
  const infoBar = document.getElementById('canvasInfoBar');
  if (!infoBar) return;
  
  // Show the info bar
  infoBar.classList.add('visible');
  
  const attributes = node.attributes || {};
  const childCount = node.children ? node.children.length : 0;
  
  // Extract position and dimensions from common attributes
  let x = attributes.x || attributes.cx || '—';
  let y = attributes.y || attributes.cy || '—';
  let width = attributes.width || attributes.r || '—';
  let height = attributes.height || attributes.r || '—';
  
  // For paths, try to get bounds from viewBox or d attribute
  if (node.tag === 'path' && attributes.d) {
    // Show that it's a path
    x = 'path';
    y = 'path';
    width = 'path';
    height = 'path';
  }
  
  // For SVG root, show viewBox if available
  if (node.tag === 'svg' && attributes.viewBox) {
    const viewBox = attributes.viewBox.split(' ');
    if (viewBox.length === 4) {
      x = viewBox[0];
      y = viewBox[1];
      width = viewBox[2];
      height = viewBox[3];
    }
  }
  
  // Update the info bar elements
  document.getElementById('infoBarElement').textContent = `<${node.tag}>`;
  document.getElementById('infoBarX').textContent = x;
  document.getElementById('infoBarY').textContent = y;
  document.getElementById('infoBarWidth').textContent = width;
  document.getElementById('infoBarHeight').textContent = height;
  document.getElementById('infoBarChildren').textContent = childCount;
}

function highlightSVGElement(node) {
  const svgContainer = document.getElementById('svgContainer');
  if (!svgContainer) return;
  
  const svg = svgContainer.querySelector('svg');
  if (!svg) return;
  
  // Try to find the element by ID
  let element = null;
  
  if (node.attributes && node.attributes.id) {
    element = svg.querySelector(`#${CSS.escape(node.attributes.id)}`);
  }
  
  // If we found the element, highlight it
  if (element) {
    element.setAttribute('data-selected', 'true');
  }
}

// ============ SVG ZOOM AND PAN CONTROLS ============
function setupSVGControls() {
  debugLog('=== setupSVGControls called ===');
  
  const container = document.getElementById('svgContainer');
  const fitBtn = document.getElementById('fitViewport');
  const fullBtn = document.getElementById('fullSize');
  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');
  const zoomResetBtn = document.getElementById('zoomReset');
  const zoomLevelDisplay = document.getElementById('zoomLevel');
  const svg = container?.querySelector('svg');
  
  debugLog('Container:', container);
  debugLog('Fit button:', fitBtn);
  debugLog('SVG element:', svg);
  
  if (!svg || !container || !fitBtn) {
    console.error('Missing elements - controls not initialized');
    return;
  }
  
  debugLog('All elements found, setting up controls...');
  
  // Reset zoom state
  zoomLevel = 1;
  viewMode = 'fit';
  updateZoomDisplay();
  
  // Fit to viewport button
  fitBtn.addEventListener('click', () => {
    viewMode = 'fit';
    container.classList.add('fit-viewport');
    container.classList.remove('full-size');
    fitBtn.classList.add('active');
    fullBtn.classList.remove('active');
    zoomLevel = 1;
    svg.style.transform = '';
    updateZoomDisplay();
  });
  
  // Full size button
  fullBtn.addEventListener('click', () => {
    viewMode = 'full';
    container.classList.remove('fit-viewport');
    container.classList.add('full-size');
    fullBtn.classList.add('active');
    fitBtn.classList.remove('active');
    zoomLevel = 1;
    svg.style.transform = '';
    updateZoomDisplay();
  });
  
  // Zoom in
  zoomInBtn.addEventListener('click', () => {
    zoomLevel = Math.min(zoomLevel + 0.1, 10);
    applyZoom();
  });
  
  // Zoom out
  zoomOutBtn.addEventListener('click', () => {
    zoomLevel = Math.max(zoomLevel - 0.1, 0.1);
    applyZoom();
  });
  
  // Reset zoom
  zoomResetBtn.addEventListener('click', () => {
    zoomLevel = 1;
    applyZoom();
  });
  
  function applyZoom() {
    if (viewMode === 'fit') {
      // Switch to full size mode when zooming
      viewMode = 'full';
      container.classList.remove('fit-viewport');
      container.classList.add('full-size');
      fullBtn.classList.add('active');
      fitBtn.classList.remove('active');
    }
    
    const transform = getTransformString();
    svg.style.transform = transform;
    svg.style.transformOrigin = 'center center';
    updateZoomDisplay();
  }
  
  function getTransformString() {
    let transforms = [`scale(${zoomLevel})`];
    if (flipH) transforms.push('scaleX(-1)');
    if (flipV) transforms.push('scaleY(-1)');
    return transforms.join(' ');
  }
  
  function updateZoomDisplay() {
    zoomLevelDisplay.textContent = `${Math.round(zoomLevel * 100)}%`;
  }
  
  // Pan functionality
  container.addEventListener('mousedown', (e) => {
    if (e.button === 0 && !e.target.classList.contains('crop-line')) {
      isPanning = true;
      startX = e.clientX;
      startY = e.clientY;
      scrollLeft = container.scrollLeft;
      scrollTop = container.scrollTop;
      container.classList.add('grabbing');
      e.preventDefault();
    }
  });
  
  container.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    container.scrollLeft = scrollLeft - dx;
    container.scrollTop = scrollTop - dy;
  });
  
  container.addEventListener('mouseup', () => {
    isPanning = false;
    container.classList.remove('grabbing');
  });
  
  container.addEventListener('mouseleave', () => {
    isPanning = false;
    container.classList.remove('grabbing');
  });
  
  // Mouse wheel zoom
  container.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      
      if (e.deltaY < 0) {
        zoomLevel = Math.min(zoomLevel + 0.1, 10);
      } else {
        zoomLevel = Math.max(zoomLevel - 0.1, 0.1);
      }
      
      applyZoom();
    }
  });
  
  // Set initial active button
  fitBtn.classList.add('active');
}

// ============ CROP CONTROLS ============
function setupCropControls() {
  debugLog('=== setupCropControls called ===');
  
  const cropBtn = document.getElementById('cropBtn');
  const flipHBtn = document.getElementById('flipHorizontal');
  const flipVBtn = document.getElementById('flipVertical');
  const svgDisplay = document.querySelector('.svg-display');
  
  if (!cropBtn || !svgDisplay) {
    console.error('Missing crop elements');
    return;
  }
  
  debugLog('Crop button found, setting up...');
  
  cropBtn.addEventListener('click', () => {
    isCropping = !isCropping;
    
    if (isCropping) {
      cropBtn.classList.add('active');
      showCropOverlay();
    } else {
      cropBtn.classList.remove('active');
      hideCropOverlay();
    }
  });
  
  // Flip horizontal
  flipHBtn.addEventListener('click', () => {
    flipH = !flipH;
    if (flipH) {
      flipHBtn.classList.add('active');
    } else {
      flipHBtn.classList.remove('active');
    }
    applyFlips();
  });
  
  // Flip vertical
  flipVBtn.addEventListener('click', () => {
    flipV = !flipV;
    if (flipV) {
      flipVBtn.classList.add('active');
    } else {
      flipVBtn.classList.remove('active');
    }
    applyFlips();
  });
}

function applyFlips() {
  const svg = document.querySelector('#svgContainer svg');
  if (!svg) return;
  
  let transforms = [`scale(${zoomLevel})`];
  if (flipH) transforms.push('scaleX(-1)');
  if (flipV) transforms.push('scaleY(-1)');
  
  svg.style.transform = transforms.join(' ');
  svg.style.transformOrigin = 'center center';
}

function showCropOverlay() {
  const svgDisplay = document.querySelector('.svg-display');
  if (!svgDisplay) return;
  
  // Remove existing overlay if any
  hideCropOverlay();
  
  // Create overlay container
  const overlay = document.createElement('div');
  overlay.className = 'crop-overlay';
  overlay.id = 'cropOverlay';
  
  // Create crop bounds box
  const bounds = document.createElement('div');
  bounds.className = 'crop-bounds';
  bounds.id = 'cropBounds';
  overlay.appendChild(bounds);
  
  // Create draggable lines
  const topLine = createCropLine('horizontal', 'top');
  const bottomLine = createCropLine('horizontal', 'bottom');
  const leftLine = createCropLine('vertical', 'left');
  const rightLine = createCropLine('vertical', 'right');
  
  overlay.appendChild(topLine);
  overlay.appendChild(bottomLine);
  overlay.appendChild(leftLine);
  overlay.appendChild(rightLine);
  
  svgDisplay.appendChild(overlay);
  
  // Initial position
  updateCropBounds();
}

function createCropLine(orientation, position) {
  const line = document.createElement('div');
  line.className = `crop-line ${orientation}`;
  line.dataset.position = position;
  
  let isDragging = false;
  let startPos = 0;
  
  line.addEventListener('mousedown', (e) => {
    isDragging = true;
    startPos = orientation === 'horizontal' ? e.clientY : e.clientX;
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const svgDisplay = document.querySelector('.svg-display');
    const rect = svgDisplay.getBoundingClientRect();
    
    if (orientation === 'horizontal') {
      const y = (e.clientY - rect.top) / rect.height;
      const clamped = Math.max(0, Math.min(1, y));
      
      if (position === 'top') {
        cropTop = Math.min(clamped, cropBottom - 0.05);
      } else {
        cropBottom = Math.max(clamped, cropTop + 0.05);
      }
    } else {
      const x = (e.clientX - rect.left) / rect.width;
      const clamped = Math.max(0, Math.min(1, x));
      
      if (position === 'left') {
        cropLeft = Math.min(clamped, cropRight - 0.05);
      } else {
        cropRight = Math.max(clamped, cropLeft + 0.05);
      }
    }
    
    updateCropBounds();
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
  
  return line;
}

function updateCropBounds() {
  const topLine = document.querySelector('[data-position="top"]');
  const bottomLine = document.querySelector('[data-position="bottom"]');
  const leftLine = document.querySelector('[data-position="left"]');
  const rightLine = document.querySelector('[data-position="right"]');
  const bounds = document.getElementById('cropBounds');
  
  if (!topLine || !bottomLine || !leftLine || !rightLine || !bounds) return;
  
  topLine.style.top = `${cropTop * 100}%`;
  bottomLine.style.top = `${cropBottom * 100}%`;
  leftLine.style.left = `${cropLeft * 100}%`;
  rightLine.style.left = `${cropRight * 100}%`;
  
  bounds.style.left = `${cropLeft * 100}%`;
  bounds.style.top = `${cropTop * 100}%`;
  bounds.style.width = `${(cropRight - cropLeft) * 100}%`;
  bounds.style.height = `${(cropBottom - cropTop) * 100}%`;
}

function hideCropOverlay() {
  const overlay = document.getElementById('cropOverlay');
  if (overlay) {
    overlay.remove();
  }
}

// ============ IMAGES TAB ============
const imageGrid = document.getElementById('imageGrid');

async function loadImages() {
  try {
    const result = await window.electronAPI.listImages();

    if (!result.success) {
      imageGrid.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.5;">No images found or directory not accessible</div>';
      return;
    }

    if (result.files.length === 0) {
      imageGrid.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.5;">No images in gellyroller directory</div>';
      return;
    }

    // Clear existing items
    imageGrid.innerHTML = '';

    // Load each image
    for (const file of result.files) {
      const imageItem = document.createElement('div');
      imageItem.className = 'image-item';

      // Create image wrapper
      const imageWrapper = document.createElement('div');
      imageWrapper.className = 'image-wrapper';
      imageWrapper.title = file.name;

      // Read the file as base64
      const fileData = await window.electronAPI.readFileBase64(file.path);

      if (fileData.success) {
        const img = document.createElement('img');
        const imageSrc = `data:${fileData.mimeType};base64,${fileData.data}`;
        img.src = imageSrc;
        img.alt = file.name;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        imageWrapper.appendChild(img);

        // Add click handler to show image in Trace tab
        imageWrapper.addEventListener('click', () => {
          showImageInTraceTab(imageSrc, file.name);
        });

        // Store imageSrc on the item for button access
        imageItem.dataset.imageSrc = imageSrc;
        imageItem.dataset.fileName = file.name;
      } else {
        imageWrapper.textContent = '❌';
        imageWrapper.title = `Error loading ${file.name}`;
      }

      imageItem.appendChild(imageWrapper);

      // Create buttons container
      const buttonsContainer = document.createElement('div');
      buttonsContainer.className = 'image-actions';

      // Create Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'image-action-btn delete-btn';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await handleDeleteImage(file.path, file.name);
      });

      // Create Trace button
      const traceBtn = document.createElement('button');
      traceBtn.className = 'image-action-btn trace-btn';
      traceBtn.textContent = 'Trace';
      traceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const imageSrc = imageItem.dataset.imageSrc;
        const fileName = imageItem.dataset.fileName;
        if (imageSrc) {
          showImageInTraceTab(imageSrc, fileName);
        }
      });

      buttonsContainer.appendChild(deleteBtn);
      buttonsContainer.appendChild(traceBtn);
      imageItem.appendChild(buttonsContainer);

      imageGrid.appendChild(imageItem);
    }

    debugLog('Loaded', result.files.length, 'images');
  } catch (error) {
    console.error('Error loading images:', error);
    imageGrid.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.5;">Error loading images</div>';
  }
}

// Handle image deletion
async function handleDeleteImage(filePath, fileName) {
  // Confirm deletion
  const confirmed = confirm(`Are you sure you want to delete "${fileName}"?`);

  if (!confirmed) {
    return;
  }

  try {
    const result = await window.electronAPI.deleteFile(filePath);

    if (result.success) {
      debugLog('File deleted successfully:', fileName);
      // Reload the images grid
      await loadImages();
    } else {
      alert(`Failed to delete file: ${result.error}`);
      console.error('Delete error:', result.error);
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    alert('An error occurred while deleting the file.');
  }
}

// Show image in Trace tab
function showImageInTraceTab(imageSrc, fileName) {
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
      performTrace();
    }
  };

  debugLog('Showing image in Trace tab:', fileName);
}

// ============ TRACE TAB CONTROLS ============

let capturedLayers = [];
let traceDebounceTimer = null;

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
    const traceActionBtn = document.getElementById('traceActionBtn');
    if (traceActionBtn) {
      traceActionBtn.disabled = true;
      traceActionBtn.textContent = 'Processing...';
    }

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

      // Display the SVG overlay
      const traceSvgOverlay = document.getElementById('traceSvgOverlay');
      traceSvgOverlay.innerHTML = svgString;

      // Enable capture button
      const captureBtn = document.getElementById('captureTraceBtn');
      if (captureBtn) {
        captureBtn.disabled = false;
      }

      if (traceActionBtn) {
        traceActionBtn.disabled = false;
        traceActionBtn.textContent = 'Trace';
      }

      // Update page background after trace
      setTimeout(() => {
        updatePageBackground();
      }, 100);

      debugLog('Trace completed successfully with fill:', useFill);
    });
  } catch (error) {
    console.error('Error tracing image:', error);
    const traceActionBtn = document.getElementById('traceActionBtn');
    if (traceActionBtn) {
      traceActionBtn.disabled = false;
      traceActionBtn.textContent = 'Trace';
    }
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

// Trace action button
const traceActionBtn = document.getElementById('traceActionBtn');

if (traceActionBtn) {
  traceActionBtn.addEventListener('click', () => {
    if (!window.currentTraceImage || !window.currentTraceImage.src) {
      alert('Please select an image first');
      return;
    }
    performTrace();
  });
}

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

      // Add to layers list
      updateLayersList();

      // Re-enable button and remove spinner
      captureTraceBtn.disabled = false;
      captureTraceBtn.textContent = originalText;

      debugLog('Captured trace as:', layerName);
    }, 300);
  });
}

function updateLayersList() {
  const layersList = document.getElementById('traceLayersList');

  if (capturedLayers.length === 0) {
    layersList.innerHTML = '<div style="padding: 16px; text-align: center; opacity: 0.5; font-size: 13px;">No layers</div>';
    return;
  }

  layersList.innerHTML = '';

  capturedLayers.forEach((layer, index) => {
    const layerItem = document.createElement('div');
    layerItem.className = 'layer-item';
    layerItem.style.cssText = 'padding: 8px 12px; border-bottom: 1px solid #e0e0e0; cursor: pointer; display: flex; justify-content: space-between; align-items: center;';

    const layerName = document.createElement('span');
    layerName.textContent = layer.name;
    layerName.style.fontSize = '13px';

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '×';
    deleteBtn.style.cssText = 'background: none; border: none; font-size: 20px; color: #d32f2f; cursor: pointer; padding: 0; width: 24px; height: 24px;';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Remove from array
      capturedLayers.splice(index, 1);
      // Update the list display
      updateLayersList();
      debugLog('Deleted layer:', layer.name);
    });

    layerItem.appendChild(layerName);
    layerItem.appendChild(deleteBtn);
    layersList.appendChild(layerItem);
  });
}

// ============ VECTORS TAB ============
const vectorGrid = document.getElementById('vectorGrid');

async function loadVectors() {
  try {
    const result = await window.electronAPI.listVectors();

    if (!result.success) {
      vectorGrid.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.5;">No vectors found or directory not accessible</div>';
      return;
    }

    if (result.files.length === 0) {
      vectorGrid.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.5;">No SVG files in gellyroller directory</div>';
      return;
    }

    // Clear existing items
    vectorGrid.innerHTML = '';

    // Load each vector
    for (const file of result.files) {
      const vectorItem = document.createElement('div');
      vectorItem.className = 'vector-item';

      // Create image preview container
      const previewContainer = document.createElement('div');
      previewContainer.className = 'vector-preview';
      previewContainer.title = file.name;

      // Read the SVG file as base64
      const fileData = await window.electronAPI.readFileBase64(file.path);

      if (fileData.success) {
        const img = document.createElement('img');
        img.src = `data:${fileData.mimeType};base64,${fileData.data}`;
        img.alt = file.name;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        previewContainer.appendChild(img);
      } else {
        previewContainer.textContent = '❌';
        previewContainer.title = `Error loading ${file.name}`;
      }

      vectorItem.appendChild(previewContainer);

      // Create buttons container
      const buttonsContainer = document.createElement('div');
      buttonsContainer.className = 'vector-buttons';

      // Create Eject button
      const ejectBtn = document.createElement('button');
      ejectBtn.className = 'vector-btn eject-btn';
      ejectBtn.textContent = 'Eject';
      ejectBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await handleVectorEject(file.path);
      });

      // Create Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'vector-btn delete-btn';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await handleVectorDelete(file.path, file.name);
      });

      buttonsContainer.appendChild(ejectBtn);
      buttonsContainer.appendChild(deleteBtn);
      vectorItem.appendChild(buttonsContainer);

      vectorGrid.appendChild(vectorItem);
    }

    debugLog('Loaded', result.files.length, 'vectors');
  } catch (error) {
    console.error('Error loading vectors:', error);
    vectorGrid.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.5;">Error loading vectors</div>';
  }
}

// Handle Eject button - loads vector and switches to Eject tab
async function handleVectorEject(filePath) {
  try {
    debugLog('Ejecting vector:', filePath);

    // Read the file content
    const fileContent = await window.electronAPI.readFileText(filePath);

    if (!fileContent.success) {
      alert('Error loading vector file: ' + fileContent.error);
      return;
    }

    // Parse the SVG
    const result = await window.electronAPI.parseSVG(filePath, fileContent.data);

    if (result.success) {
      currentSVGData = result.data;
      debugLog('Vector loaded for eject:', currentSVGData);

      // Switch to eject tab
      switchTab('eject');
    } else {
      alert('Error parsing SVG: ' + result.error);
    }
  } catch (error) {
    console.error('Error ejecting vector:', error);
    alert('Error loading vector: ' + error.message);
  }
}

// Handle Delete button - deletes vector file with confirmation
async function handleVectorDelete(filePath, fileName) {
  try {
    // Show confirmation dialog
    const confirmed = confirm(`Are you sure you want to delete "${fileName}"?\n\nThis action cannot be undone.`);

    if (!confirmed) {
      return;
    }

    debugLog('Deleting vector:', filePath);

    // Delete the file
    const result = await window.electronAPI.deleteFile(filePath);

    if (result.success) {
      debugLog('Vector deleted successfully');
      // Reload the vectors grid
      await loadVectors();
    } else {
      alert('Error deleting file: ' + result.error);
    }
  } catch (error) {
    console.error('Error deleting vector:', error);
    alert('Error deleting file: ' + error.message);
  }
}

// Load files when switching to the respective tabs
const originalSwitchTab = switchTab;
switchTab = function(tabName) {
  originalSwitchTab(tabName);

  if (tabName === 'images') {
    loadImages();
  } else if (tabName === 'vectors') {
    loadVectors();
  } else if (tabName === 'eject') {
    loadEjectTab();
  }
};

// ============ EJECT TAB ============

// Eject tab page sizing variables
let ejectPageSize = 'A4';
let ejectPageBackgroundElement = null;
let ejectOriginalAspectRatio = 1; // Store original SVG aspect ratio

// Function to load SVG into Eject tab
function loadEjectTab() {
  const ejectMessage = document.getElementById('ejectMessage');
  const ejectSvgContainer = document.getElementById('ejectSvgContainer');
  const ejectInfoBar = document.getElementById('ejectInfoBar');
  const ejectDimensions = document.getElementById('ejectDimensions');
  const ejectOutputToolbar = document.getElementById('ejectOutputToolbar');

  if (currentSVGData && currentSVGData.content) {
    // Hide message and show SVG container
    ejectMessage.style.display = 'none';
    ejectSvgContainer.style.display = 'flex';
    ejectInfoBar.style.display = 'flex';
    ejectOutputToolbar.style.display = 'flex';

    ejectSvgContainer.innerHTML = currentSVGData.content;

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
  } else {
    // Show message and hide SVG container
    ejectMessage.style.display = 'block';
    ejectSvgContainer.style.display = 'none';
    ejectInfoBar.style.display = 'none';
    ejectOutputToolbar.style.display = 'none';
    ejectMessage.textContent = 'No vector image loaded';
  }
}

// Get eject page dimensions in mm
function getEjectPageDimensions() {
  if (ejectPageSize === 'custom') {
    const width = parseFloat(document.getElementById('ejectCustomWidth').value);
    const height = parseFloat(document.getElementById('ejectCustomHeight').value);
    const unit = document.getElementById('ejectCustomUnit').value;

    if (isNaN(width) || isNaN(height)) {
      return null;
    }

    return [toMm(width, unit), toMm(height, unit)];
  } else {
    return PAGE_SIZES[ejectPageSize];
  }
}

// Convert mm to other units
function mmToInches(mm) {
  return (mm / 25.4).toFixed(2);
}

function mmToCm(mm) {
  return (mm / 10).toFixed(1);
}

// Create dimension lines for eject page
function createEjectDimensionLines(viewer, displayWidth, displayHeight, widthMm, heightMm, svgContainer) {
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

// Create or update eject page background
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
  createEjectDimensionLines(ejectViewer, displayWidth, displayHeight, widthMm, heightMm, ejectSvgContainer);

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

// Eject page size button handlers
document.querySelectorAll('.eject-page-size-btn').forEach(btn => {
  btn.addEventListener('click', () => {
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
  });
});

// Eject custom size input handlers
const ejectCustomWidth = document.getElementById('ejectCustomWidth');
const ejectCustomHeight = document.getElementById('ejectCustomHeight');
const ejectCustomUnit = document.getElementById('ejectCustomUnit');

[ejectCustomWidth, ejectCustomHeight, ejectCustomUnit].forEach(input => {
  if (input) {
    input.addEventListener('input', () => {
      if (ejectPageSize === 'custom') {
        updateEjectPageBackground();
      }
    });
  }
});

// Output dimension input handlers with aspect ratio locking
const ejectFixedWidth = document.getElementById('ejectFixedWidth');
const ejectFixedHeight = document.getElementById('ejectFixedHeight');
const ejectFixedUnit = document.getElementById('ejectFixedUnit');

// Width input - automatically adjust height to maintain aspect ratio
if (ejectFixedWidth) {
  ejectFixedWidth.addEventListener('input', () => {
    const width = parseFloat(ejectFixedWidth.value);
    if (!isNaN(width) && width > 0 && ejectOriginalAspectRatio > 0) {
      const newHeight = width / ejectOriginalAspectRatio;
      ejectFixedHeight.value = newHeight.toFixed(2);
      debugLog('Width changed, adjusted height:', newHeight.toFixed(2));
    }
    if (ejectPageBackgroundElement) {
      updateEjectPageBackground();
    }
  });
}

// Height input - automatically adjust width to maintain aspect ratio
if (ejectFixedHeight) {
  ejectFixedHeight.addEventListener('input', () => {
    const height = parseFloat(ejectFixedHeight.value);
    if (!isNaN(height) && height > 0 && ejectOriginalAspectRatio > 0) {
      const newWidth = height * ejectOriginalAspectRatio;
      ejectFixedWidth.value = newWidth.toFixed(2);
      debugLog('Height changed, adjusted width:', newWidth.toFixed(2));
    }
    if (ejectPageBackgroundElement) {
      updateEjectPageBackground();
    }
  });
}

// Unit change - just update the background
if (ejectFixedUnit) {
  ejectFixedUnit.addEventListener('input', () => {
    if (ejectPageBackgroundElement) {
      updateEjectPageBackground();
    }
  });
}

// Update eject page background on window resize
window.addEventListener('resize', () => {
  if (ejectPageBackgroundElement) {
    updateEjectPageBackground();
  }
});

// ============ CAMERA TAB ============
const cameraVideo = document.getElementById('cameraVideo');
const captureCanvas = document.getElementById('captureCanvas');
const cameraMessage = document.getElementById('cameraMessage');
const startCameraBtn = document.getElementById('startCamera');
const capturePhotoBtn = document.getElementById('capturePhoto');
const stopCameraBtn = document.getElementById('stopCamera');

let cameraStream = null;

// Start camera
startCameraBtn.addEventListener('click', async () => {
  try {
    cameraMessage.textContent = 'Requesting camera access...';

    // Request camera access
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });

    // Set video source
    cameraVideo.srcObject = cameraStream;
    cameraVideo.classList.add('active');
    cameraMessage.classList.add('hidden');

    // Enable/disable buttons
    startCameraBtn.disabled = true;
    capturePhotoBtn.disabled = false;
    stopCameraBtn.disabled = false;

    debugLog('Camera started successfully');
  } catch (error) {
    console.error('Error accessing camera:', error);
    cameraMessage.textContent = 'Error: Unable to access camera. Please check permissions.';
    cameraMessage.classList.remove('hidden');
  }
});

// Capture photo
capturePhotoBtn.addEventListener('click', async () => {
  try {
    if (!cameraStream) {
      alert('Camera is not active');
      return;
    }

    // Set canvas size to match video
    captureCanvas.width = cameraVideo.videoWidth;
    captureCanvas.height = cameraVideo.videoHeight;

    // Draw video frame to canvas
    const ctx = captureCanvas.getContext('2d');
    ctx.drawImage(cameraVideo, 0, 0, captureCanvas.width, captureCanvas.height);

    // Convert to base64
    const imageData = captureCanvas.toDataURL('image/png');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `capture_${timestamp}.png`;

    // Save to gellyroller directory
    const result = await window.electronAPI.saveImage(imageData, filename);

    if (result.success) {
      debugLog('Photo saved:', result.path);

      // Show success message
      const originalText = capturePhotoBtn.textContent;
      capturePhotoBtn.textContent = '✓ Photo Saved!';
      capturePhotoBtn.style.background = '#4caf50';

      setTimeout(() => {
        capturePhotoBtn.textContent = originalText;
        capturePhotoBtn.style.background = '';
      }, 2000);
    } else {
      console.error('Error saving photo:', result.error);
      alert('Error saving photo: ' + result.error);
    }
  } catch (error) {
    console.error('Error capturing photo:', error);
    alert('Error capturing photo: ' + error.message);
  }
});

// Stop camera
stopCameraBtn.addEventListener('click', () => {
  if (cameraStream) {
    // Stop all tracks
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;

    // Reset UI
    cameraVideo.srcObject = null;
    cameraVideo.classList.remove('active');
    cameraMessage.textContent = 'Click "Start Camera" to begin';
    cameraMessage.classList.remove('hidden');

    // Enable/disable buttons
    startCameraBtn.disabled = false;
    capturePhotoBtn.disabled = true;
    stopCameraBtn.disabled = true;

    debugLog('Camera stopped');
  }
});

// ============ ARROW BUTTON CONTROLS ============
// Handle all arrow button clicks for slider adjustments
document.querySelectorAll('.arrow-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    const direction = parseInt(btn.dataset.direction);
    const slider = document.getElementById(targetId);

    if (!slider) return;

    const step = parseFloat(slider.step) || 1;
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const currentValue = parseFloat(slider.value);

    // Calculate new value
    const newValue = currentValue + (step * direction);

    // Clamp to min/max range
    slider.value = Math.max(min, Math.min(max, newValue));

    // Trigger input event to update display and trace
    slider.dispatchEvent(new Event('input'));

    debugLog(`Arrow button: ${targetId} ${direction > 0 ? '+' : '-'}${step} = ${slider.value}`);
  });
});

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

// Page sizes in mm (width × height)
const PAGE_SIZES = {
  'A0': [841, 1189],
  'A1': [594, 841],
  'A2': [420, 594],
  'A3': [297, 420],
  'A4': [210, 297],
  'A5': [148, 210],
  'A6': [105, 148],
  'A7': [74, 105]
};

let currentPageSize = 'A4';
let pageBackgroundElement = null;
let outputScale = 100; // Output scale percentage

// Convert units to mm
function toMm(value, unit) {
  switch (unit) {
    case 'mm': return value;
    case 'cm': return value * 10;
    case 'in': return value * 25.4;
    default: return value;
  }
}

// Get page dimensions in mm
function getPageDimensions() {
  if (currentPageSize === 'custom') {
    const width = parseFloat(document.getElementById('customWidth').value);
    const height = parseFloat(document.getElementById('customHeight').value);
    const unit = document.getElementById('customUnit').value;

    if (isNaN(width) || isNaN(height)) {
      return null;
    }

    return [toMm(width, unit), toMm(height, unit)];
  } else {
    return PAGE_SIZES[currentPageSize];
  }
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

// Page size button handlers
document.querySelectorAll('.page-size-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const size = btn.dataset.size;

    // Update active state
    document.querySelectorAll('.page-size-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    currentPageSize = size;

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

// Save SVG button
const saveSvgBtn = document.getElementById('saveSvgBtn');
if (saveSvgBtn) {
  saveSvgBtn.addEventListener('click', async () => {
    if (!window.currentTraceImage || !window.currentTraceImage.svgData) {
      alert('No SVG data to save. Please trace an image first.');
      return;
    }

    try {
      saveSvgBtn.disabled = true;
      const originalText = saveSvgBtn.innerHTML;
      saveSvgBtn.innerHTML = '<span>⏳</span> Saving...';

      // Generate filename from original image name
      const baseName = window.currentTraceImage.fileName.replace(/\.[^/.]+$/, '');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `${baseName}_trace_${timestamp}.svg`;

      // Convert SVG string to data URL
      const svgBlob = new Blob([window.currentTraceImage.svgData], { type: 'image/svg+xml' });
      const reader = new FileReader();

      reader.onload = async function() {
        const dataUrl = reader.result;

        // Save using existing saveImage method (works for SVG too)
        const result = await window.electronAPI.saveImage(dataUrl, filename);

        if (result.success) {
          debugLog('SVG saved:', result.path);

          // Switch to vectors tab
          switchTab('vectors');

          // Show success message briefly
          saveSvgBtn.innerHTML = '<span>✓</span> Saved!';
          setTimeout(() => {
            saveSvgBtn.innerHTML = originalText;
            saveSvgBtn.disabled = false;
          }, 2000);
        } else {
          throw new Error(result.error);
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