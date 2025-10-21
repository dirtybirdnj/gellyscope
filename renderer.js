// renderer.js - Frontend Logic
let currentSVGData = null;
let currentSelectedElement = null;
let serialConnected = false;
let progressInterval = null;
let currentProgress = 0;

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
    const content = await file.text();
    const result = await window.electronAPI.parseSVG(file.path, content);
    
    if (result.success) {
      currentSVGData = result.data;
      displaySVG(result.data);
      renderTree(result.data.tree);
      updateFileInfo(result.data, file);
    } else {
      alert('Error parsing SVG: ' + result.error);
    }
  } catch (error) {
    alert('Error reading file: ' + error.message);
  }
}

function displaySVG(data) {
  canvasContent.innerHTML = `
    <div class="svg-display">
      ${data.content}
    </div>
  `;
}

function renderTree(tree) {
  layersList.innerHTML = '';
  const treeElement = createTreeNode(tree);
  layersList.appendChild(treeElement);
}

function createTreeNode(node) {
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
    
    document.querySelectorAll('.tree-node-content').forEach(el => {
      el.classList.remove('active');
    });
    
    contentDiv.classList.add('active');
    currentSelectedElement = node;
    updateElementInfo(node);
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
  
  let attributesHTML = '';
  if (attrCount > 0) {
    attributesHTML = '<div class="attribute-list">';
    for (const [key, value] of Object.entries(attributes)) {
      attributesHTML += `
        <div class="attribute-item">
          <span class="attr-name">${key}:</span>
          <span class="attr-value">${value}</span>
        </div>
      `;
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

// ============ PHOTOS TAB ============
const photoGrid = document.getElementById('photoGrid');

// Generate jellyfish placeholder gallery
for (let i = 0; i < 12; i++) {
  const photoItem = document.createElement('div');
  photoItem.className = 'photo-item';
  photoItem.textContent = '🪼';
  photoItem.addEventListener('click', () => {
    alert(`Jellyfish photo ${i + 1} clicked!`);
  });
  photoGrid.appendChild(photoItem);
}

// ============ PLOTTER TAB ============
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const refreshPorts = document.getElementById('refreshPorts');
const uploadPlotterFile = document.getElementById('uploadPlotterFile');
const plotterFileInput = document.getElementById('plotterFileInput');
const terminal = document.getElementById('terminal');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const portSelect = document.getElementById('portSelect');
const baudRate = document.getElementById('baudRate');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressInfo = document.getElementById('progressInfo');

// Refresh available ports
refreshPorts.addEventListener('click', async () => {
  addTerminalLine('Scanning for serial ports...');
  const ports = await window.electronAPI.getSerialPorts();
  
  portSelect.innerHTML = '<option value="">Select Port...</option>';
  ports.forEach(port => {
    const option = document.createElement('option');
    option.value = port.path;
    option.textContent = `${port.path}${port.manufacturer ? ' (' + port.manufacturer + ')' : ''}`;
    portSelect.appendChild(option);
  });
  
  addTerminalLine(`Found ${ports.length} port(s)`);
});

// Connect to serial port
connectBtn.addEventListener('click', async () => {
  const port = portSelect.value;
  const baud = parseInt(baudRate.value);
  
  if (!port) {
    alert('Please select a port');
    return;
  }
  
  addTerminalLine(`Connecting to ${port} at ${baud} baud...`);
  
  const result = await window.electronAPI.connectSerial(port, baud);
  
  if (result.success) {
    serialConnected = true;
    statusIndicator.classList.add('connected');
    statusText.textContent = `Connected: ${port}`;
    connectBtn.disabled = true;
    disconnectBtn.disabled = false;
    uploadPlotterFile.disabled = false;
    addTerminalLine('Connection established!');
  } else {
    addTerminalLine(`Connection failed: ${result.error}`);
  }
});

// Disconnect from serial port
disconnectBtn.addEventListener('click', async () => {
  addTerminalLine('Disconnecting...');
  
  const result = await window.electronAPI.disconnectSerial();
  
  if (result.success) {
    serialConnected = false;
    statusIndicator.classList.remove('connected');
    statusText.textContent = 'Disconnected';
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
    uploadPlotterFile.disabled = true;
    addTerminalLine('Disconnected successfully');
  }
});

// Upload file to plotter
uploadPlotterFile.addEventListener('click', () => {
  plotterFileInput.click();
});

plotterFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  addTerminalLine(`Preparing to send: ${file.name}`);
  addTerminalLine(`File size: ${formatBytes(file.size)}`);
  
  const content = await file.text();
  
  progressSection.style.display = 'block';
  currentProgress = 0;
  updateProgress(0);
  
  addTerminalLine('Starting file transfer...');
  
  // Send file to plotter
  const result = await window.electronAPI.sendFileToPlotter(content);
  
  if (result.success) {
    addTerminalLine('File sent successfully!');
    startProgressSimulation();
  } else {
    addTerminalLine(`Error sending file: ${result.error}`);
    progressSection.style.display = 'none';
  }
});

function startProgressSimulation() {
  currentProgress = 0;
  
  if (progressInterval) {
    clearInterval(progressInterval);
  }
  
  progressInterval = setInterval(() => {
    currentProgress += Math.random() * 15;
    
    if (currentProgress >= 100) {
      currentProgress = 100;
      clearInterval(progressInterval);
      addTerminalLine('Processing complete!');
    }
    
    updateProgress(currentProgress);
  }, 2000);
}

function updateProgress(percent) {
  const rounded = Math.round(percent);
  progressFill.style.width = `${rounded}%`;
  progressFill.textContent = `${rounded}%`;
  progressInfo.textContent = `Processing: ${rounded}% complete`;
}

function addTerminalLine(text) {
  const timestamp = new Date().toLocaleTimeString();
  terminal.innerHTML += `[${timestamp}] ${text}\n`;
  terminal.scrollTop = terminal.scrollHeight;
}

// Listen for serial data
if (window.electronAPI.onSerialData) {
  window.electronAPI.onSerialData((data) => {
    addTerminalLine(`< ${data}`);
  });
}

// Initialize ports on load
setTimeout(() => {
  refreshPorts.click();
}, 500);