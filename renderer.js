// renderer.js - v30
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
  loadHomeScreen();
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

// ============ HOME SCREEN ============
async function loadHomeScreen() {
  try {
    // Get workspace path
    const gellyrollerPath = await window.electronAPI.getGellyrollerPath();
    document.getElementById('homeWorkspacePath').textContent = gellyrollerPath;

    // Load all file types
    const [imagesResult, vectorsResult, gcodeResult] = await Promise.all([
      window.electronAPI.listImages(),
      window.electronAPI.listVectors(),
      window.electronAPI.listGcodeFiles()
    ]);

    // Update stats
    const imageCount = imagesResult.success ? imagesResult.files.length : 0;
    const vectorCount = vectorsResult.success ? vectorsResult.files.length : 0;
    const gcodeCount = gcodeResult.success ? gcodeResult.files.length : 0;

    document.getElementById('homeImageCount').textContent = imageCount;
    document.getElementById('homeVectorCount').textContent = vectorCount;
    document.getElementById('homeGcodeCount').textContent = gcodeCount;

    debugLog('Home screen loaded:', {imageCount, vectorCount, gcodeCount});
  } catch (error) {
    console.error('Error loading home screen:', error);
  }
}

// Home screen quick action buttons and stat cards
document.addEventListener('DOMContentLoaded', () => {
  // Stat card click handlers
  const statCards = document.querySelectorAll('.stat-card[data-tab]');
  statCards.forEach(card => {
    card.addEventListener('click', () => {
      const tabName = card.getAttribute('data-tab');
      if (tabName) {
        switchTab(tabName);
      }
    });
  });

  const homeStartCamera = document.getElementById('homeStartCamera');
  const homeUploadImage = document.getElementById('homeUploadImage');
  const homeOpenGellyroller = document.getElementById('homeOpenGellyroller');

  if (homeStartCamera) {
    homeStartCamera.addEventListener('click', () => {
      switchTab('camera');
    });
  }

  if (homeUploadImage) {
    homeUploadImage.addEventListener('click', () => {
      switchTab('images');
      // Trigger the upload button on the images tab
      setTimeout(() => {
        const uploadBtn = document.getElementById('uploadImageBtn');
        if (uploadBtn) uploadBtn.click();
      }, 100);
    });
  }

  if (homeOpenGellyroller) {
    homeOpenGellyroller.addEventListener('click', async () => {
      const path = await window.electronAPI.getGellyrollerPath();
      alert(`Workspace folder:\n${path}\n\nOpen this folder in your file manager.`);
    });
  }
});

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
const uploadImageBtn = document.getElementById('uploadImageBtn');
const imageUploadInput = document.getElementById('imageUploadInput');

// Setup upload button
if (uploadImageBtn && imageUploadInput) {
  uploadImageBtn.addEventListener('click', () => {
    imageUploadInput.click();
  });

  imageUploadInput.addEventListener('change', async (e) => {
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
          // Reload images to show the new upload
          await loadImages();
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

  // Add Enter key shortcut for Capture Trace when on Trace tab
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      // Check if Trace tab is active
      const traceTab = document.querySelector('[data-tab="trace"]');
      if (traceTab && traceTab.classList.contains('active')) {
        // Check if button is not disabled
        if (captureTraceBtn && !captureTraceBtn.disabled) {
          e.preventDefault();
          captureTraceBtn.click();
        }
      }
    }
  });
}

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
      currentSVGData = {
        ...result.data,
        content: fileContent.data, // Store the raw SVG content
        path: filePath // Store the file path
      };
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
  } else if (tabName === 'render') {
    loadGcodeFiles();
  } else if (tabName === 'eject') {
    loadEjectTab();
  } else if (tabName === 'hardware') {
    loadHardwareInfo();
  }
};

// ============ RENDER TAB ============

const gcodeList = document.getElementById('gcodeList');
const renderCanvas = document.getElementById('renderCanvas');
const renderMessage = document.getElementById('renderMessage');
const gcodeTextArea = document.getElementById('gcodeText');
const gcodeSection = document.getElementById('renderGcodeSection');
const gcodeHeader = document.getElementById('gcodeHeader');
const gcodeTextContainer = document.getElementById('gcodeTextContainer');
const gcodeCollapseArrow = document.getElementById('gcodeCollapseArrow');
let currentGcodeFile = null;

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

async function loadGcodeFiles() {
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
      gcodeItem.addEventListener('click', async (e) => {
        // Don't trigger if clicking delete button
        if (e.target.classList.contains('gcode-delete-btn')) {
          return;
        }

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
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await handleGcodeDelete(file.path, file.name);
      });

      gcodeList.appendChild(gcodeItem);
    }
  } catch (error) {
    console.error('Error loading G-code files:', error);
    gcodeList.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.5;">Error loading G-code files</div>';
  }
}

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

// Zoom and pan state for G-code rendering
let renderZoom = 1;
let renderPanX = 0;
let renderPanY = 0;
let renderBaseScale = 1;
let renderBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
let renderPaths = [];

// Workspace dimensions (in mm)
let workspaceWidth = 400;
let workspaceHeight = 400;

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

function drawGcode() {
  const canvas = renderCanvas;
  const ctx = canvas.getContext('2d');

  // Set canvas size to match container
  const container = canvas.parentElement;
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;

  canvas.width = containerWidth;
  canvas.height = containerHeight;

  // Calculate scale to fit the workspace in the canvas with padding
  const padding = 60;
  const scaleX = (containerWidth - 2 * padding) / workspaceWidth;
  const scaleY = (containerHeight - 2 * padding) / workspaceHeight;
  renderBaseScale = Math.min(scaleX, scaleY);

  const scale = renderBaseScale * renderZoom;

  // Clear canvas
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Set up transformation to center and scale the workspace
  ctx.save();
  ctx.translate(containerWidth / 2 + renderPanX, containerHeight / 2 + renderPanY);
  ctx.scale(scale, -scale); // Flip Y axis for typical G-code coordinate system
  ctx.translate(-workspaceWidth / 2, -workspaceHeight / 2);

  // Draw workspace border
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2 / scale;
  ctx.strokeRect(0, 0, workspaceWidth, workspaceHeight);

  // Draw workspace grid (optional, light grid every 50mm)
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 0.5 / scale;

  // Vertical grid lines
  for (let x = 50; x < workspaceWidth; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, workspaceHeight);
    ctx.stroke();
  }

  // Horizontal grid lines
  for (let y = 50; y < workspaceHeight; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(workspaceWidth, y);
    ctx.stroke();
  }

  // Draw all G-code paths
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

  // Draw rulers with dimension markings
  const workspaceCenterX = containerWidth / 2 + renderPanX;
  const workspaceCenterY = containerHeight / 2 + renderPanY;
  const workspaceDisplayWidth = workspaceWidth * scale;
  const workspaceDisplayHeight = workspaceHeight * scale;

  const workspaceLeft = workspaceCenterX - workspaceDisplayWidth / 2;
  const workspaceRight = workspaceCenterX + workspaceDisplayWidth / 2;
  const workspaceTop = workspaceCenterY - workspaceDisplayHeight / 2;
  const workspaceBottom = workspaceCenterY + workspaceDisplayHeight / 2;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Top horizontal ruler
  const rulerTickInterval = 50; // mm
  const rulerTickPixels = rulerTickInterval * scale;

  // Draw horizontal ruler (top)
  for (let x = 0; x <= workspaceWidth; x += rulerTickInterval) {
    const pixelX = workspaceLeft + x * scale;

    // Draw tick mark
    ctx.beginPath();
    ctx.moveTo(pixelX, workspaceTop - 5);
    ctx.lineTo(pixelX, workspaceTop - 15);
    ctx.stroke();

    // Draw label
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(`${x}`, pixelX, workspaceTop - 22);
    ctx.restore();
  }

  // Draw horizontal ruler line
  ctx.beginPath();
  ctx.moveTo(workspaceLeft, workspaceTop - 5);
  ctx.lineTo(workspaceRight, workspaceTop - 5);
  ctx.stroke();

  // Left vertical ruler
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (let y = 0; y <= workspaceHeight; y += rulerTickInterval) {
    const pixelY = workspaceTop + y * scale;

    // Draw tick mark
    ctx.beginPath();
    ctx.moveTo(workspaceLeft - 5, pixelY);
    ctx.lineTo(workspaceLeft - 15, pixelY);
    ctx.stroke();

    // Draw label (flip to show correct Y value from bottom)
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(`${workspaceHeight - y}`, workspaceLeft - 20, pixelY);
    ctx.restore();
  }

  // Draw vertical ruler line
  ctx.beginPath();
  ctx.moveTo(workspaceLeft - 5, workspaceTop);
  ctx.lineTo(workspaceLeft - 5, workspaceBottom);
  ctx.stroke();

  // Draw info overlay
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`Workspace: ${workspaceWidth} × ${workspaceHeight} mm`, 10, 20);
  ctx.fillText(`G-code: ${renderBounds.width.toFixed(2)} × ${renderBounds.height.toFixed(2)} mm`, 10, 35);
  ctx.fillText(`Paths: ${renderPaths.length}`, 10, 50);
  ctx.fillText(`Zoom: ${(renderZoom * 100).toFixed(0)}%`, 10, 65);
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

// Workspace dimension handlers
// Pan functionality with mouse drag for G-code rendering
let renderIsPanning = false;
let renderPanStartX = 0;
let renderPanStartY = 0;

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

// ============ EJECT TAB ============

// Eject tab page sizing variables
let ejectPageSize = 'A4';
let ejectLayout = 'portrait'; // 'portrait' or 'landscape'
let ejectPageBackgroundElement = null;
let ejectOriginalAspectRatio = 1; // Store original SVG aspect ratio
let ejectPreviousUnit = 'in'; // Track previous unit for conversion
let ejectOutputUnit = 'in'; // Output unit for G-code generation

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
}

// Get eject page dimensions in mm (respects layout orientation)
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

// Convert mm to other units
function mmToInches(mm) {
  return (mm / 25.4).toFixed(2);
}

function mmToCm(mm) {
  return (mm / 10).toFixed(1);
}

// Convert from mm to any unit
function fromMm(mm, unit) {
  switch (unit) {
    case 'mm': return mm;
    case 'cm': return mm / 10;
    case 'in': return mm / 25.4;
    default: return mm;
  }
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

  // Use full page size
  const scaledWidth = displayWidth;
  const scaledHeight = displayHeight;

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

// Update page size button states
function updateEjectPageSizeButtons() {
  // Enable all page size buttons
  document.querySelectorAll('.eject-page-size-btn').forEach(btn => {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
  });
}

// Eject layout toggle handlers (portrait/landscape)
document.querySelectorAll('.eject-layout-toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const layout = btn.dataset.layout;

    // Update active state
    document.querySelectorAll('.eject-layout-toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    ejectLayout = layout;

    // Update page background
    updateEjectPageBackground();

    debugLog('Eject layout changed:', layout);
  });
});

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

// Update eject page background on window resize
window.addEventListener('resize', () => {
  if (ejectPageBackgroundElement) {
    updateEjectPageBackground();
  }
});

// Generate G-code button handler
const ejectToGcodeBtn = document.getElementById('ejectToGcodeBtn');

if (ejectToGcodeBtn) {
  ejectToGcodeBtn.addEventListener('click', async () => {
    debugLog('=== EJECT TO G-CODE CLICKED ===');

    // Verify we have a loaded SVG
    if (!currentSVGData || !currentSVGData.path) {
      alert('No vector file loaded. Please load a vector file first.');
      return;
    }

    // Get output dimensions from page size
    const dimensionsMm = getEjectPageDimensions();
    if (!dimensionsMm) {
      alert('Invalid page dimensions.');
      return;
    }

    // Convert dimensions to the output unit
    const outputWidth = fromMm(dimensionsMm[0], ejectOutputUnit);
    const outputHeight = fromMm(dimensionsMm[1], ejectOutputUnit);
    const outputUnit = ejectOutputUnit;

    debugLog('Current SVG path:', currentSVGData.path);
    debugLog('Output dimensions:', outputWidth, 'x', outputHeight, outputUnit);

    // Disable button and show loading state
    ejectToGcodeBtn.disabled = true;
    const originalText = ejectToGcodeBtn.innerHTML;
    ejectToGcodeBtn.innerHTML = '<span>⏳</span> Generating...';

    try {
      // Call the backend to convert SVG to G-code
      const result = await window.electronAPI.ejectToGcode(
        currentSVGData.path,
        outputWidth,
        outputHeight,
        outputUnit
      );

      debugLog('Eject result:', result);

      if (result.success) {
        debugLog('G-code file created:', result.gcodeFilePath);

        // Switch to Render tab
        switchTab('render');

        // Reload G-code file list
        await loadGcodeFiles();

        // Auto-load the newly created file and highlight it in the list
        await loadGcodeFile(result.gcodeFilePath);

        // Find and highlight the newly created file in the list
        const gcodeItems = document.querySelectorAll('.gcode-item');
        gcodeItems.forEach(item => {
          const itemName = item.querySelector('.gcode-item-name');
          const fileName = result.gcodeFilePath.split('/').pop();
          if (itemName && itemName.textContent.includes(fileName)) {
            item.classList.add('active');
          } else {
            item.classList.remove('active');
          }
        });
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
    }
  });
}

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

// Add keyboard arrow key support for sliders with arrow buttons
document.querySelectorAll('.control-slider').forEach(slider => {
  slider.addEventListener('keydown', (e) => {
    // Check if left or right arrow key was pressed
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault(); // Prevent default browser behavior

      const step = parseFloat(slider.step) || 1;
      const min = parseFloat(slider.min);
      const max = parseFloat(slider.max);
      const currentValue = parseFloat(slider.value);

      // Left arrow decreases, right arrow increases
      const direction = e.key === 'ArrowRight' ? 1 : -1;
      const newValue = currentValue + (step * direction);

      // Clamp to min/max range
      slider.value = Math.max(min, Math.min(max, newValue));

      // Trigger input event to update display and trace
      slider.dispatchEvent(new Event('input'));

      debugLog(`Keyboard arrow: ${slider.id} ${direction > 0 ? '+' : '-'}${step} = ${slider.value}`);
    }
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
let currentLayout = 'portrait'; // 'portrait' or 'landscape'
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

            // Reload vectors to show the new file
            await loadVectors();

            // Switch to vectors tab
            switchTab('vectors');

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

// ============ HARDWARE TAB ============

let hardwareInfoLoaded = false;

async function loadHardwareInfo() {
  if (hardwareInfoLoaded) return;

  try {
    // Set workspace input values
    document.getElementById('hwWorkspaceWidth').value = workspaceWidth;
    document.getElementById('hwWorkspaceHeight').value = workspaceHeight;
    document.getElementById('hwOutputUnit').value = ejectOutputUnit;

    // Add event listeners for workspace inputs
    document.getElementById('hwWorkspaceWidth').addEventListener('input', (e) => {
      const newWidth = parseFloat(e.target.value);
      if (newWidth > 0) {
        workspaceWidth = newWidth;
        if (renderPaths.length > 0) {
          drawGcode();
        }
      }
    });

    document.getElementById('hwWorkspaceHeight').addEventListener('input', (e) => {
      const newHeight = parseFloat(e.target.value);
      if (newHeight > 0) {
        workspaceHeight = newHeight;
        if (renderPaths.length > 0) {
          drawGcode();
        }
      }
    });

    document.getElementById('hwOutputUnit').addEventListener('change', (e) => {
      ejectOutputUnit = e.target.value;
      debugLog('Output unit changed to:', ejectOutputUnit);
    });

    // Get system information
    const systemInfoResult = await window.electronAPI.getSystemInfo();
    if (systemInfoResult.success) {
      const info = systemInfoResult.data;
      document.getElementById('hwNodeVersion').textContent = info.nodeVersion;
      document.getElementById('hwNpmVersion').textContent = info.npmVersion;
      document.getElementById('hwPythonVersion').textContent = info.pythonVersion;
      document.getElementById('hwPlatform').textContent = info.platform;
    } else {
      document.getElementById('hwNodeVersion').textContent = 'Error loading';
      document.getElementById('hwNpmVersion').textContent = 'Error loading';
      document.getElementById('hwPythonVersion').textContent = 'Error loading';
      document.getElementById('hwPlatform').textContent = 'Error loading';
    }

    // Get vpype information
    const vpypeInfoResult = await window.electronAPI.getVpypeInfo();
    if (vpypeInfoResult.success) {
      const vpypeInfo = vpypeInfoResult.data;

      if (vpypeInfo.installed) {
        document.getElementById('hwVpypeStatus').textContent = '✓ Installed';
        document.getElementById('hwVpypeStatus').style.color = '#4ade80';
        document.getElementById('hwVpypeVersion').textContent = vpypeInfo.version;

        // Display plugins
        const pluginsContainer = document.getElementById('hwVpypePlugins');
        if (vpypeInfo.plugins && vpypeInfo.plugins.length > 0) {
          const pluginsHtml = `
            <div class="hardware-label" style="margin-top: 16px; margin-bottom: 8px;">Commands/Plugins</div>
            <div class="hardware-value" style="opacity: 0.8; font-size: 14px;">${vpypeInfo.plugins.join(', ')}</div>
          `;
          pluginsContainer.innerHTML = pluginsHtml;
        } else {
          pluginsContainer.innerHTML = `
            <div class="hardware-label" style="margin-top: 16px; margin-bottom: 8px;">Plugins</div>
            <div class="hardware-value" style="opacity: 0.5;">No additional plugins detected</div>
          `;
        }
      } else {
        document.getElementById('hwVpypeStatus').textContent = '✗ Not Installed';
        document.getElementById('hwVpypeStatus').style.color = '#f87171';
        document.getElementById('hwVpypeVersion').textContent = '-';
        document.getElementById('hwVpypePlugins').innerHTML = `
          <div class="hardware-label" style="margin-top: 16px; margin-bottom: 8px;">Plugins</div>
          <div class="hardware-value" style="opacity: 0.5;">vpype not installed</div>
        `;
      }
    } else {
      document.getElementById('hwVpypeStatus').textContent = 'Error checking';
      document.getElementById('hwVpypeStatus').style.color = '#f87171';
    }

    hardwareInfoLoaded = true;
  } catch (error) {
    console.error('Error loading hardware info:', error);
  }
}
