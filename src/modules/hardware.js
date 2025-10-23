import { debugLog } from './shared/debug.js';
import { drawGcode, hasRenderPaths } from './render.js';

// ============ HARDWARE TAB ============

// Page sizes in mm (width × height)
export let PAGE_SIZES = {
  'A0': [841, 1189],
  'A1': [594, 841],
  'A2': [420, 594],
  'A3': [297, 420],
  'A4': [210, 297],
  'A5': [148, 210],
  'A6': [105, 148],
  'A7': [74, 105]
};

// Track which sizes are default (cannot be deleted)
export const DEFAULT_SIZES = new Set(['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7']);

// Track which sizes are locked (predefined sizes start locked)
export let LOCKED_SIZES = new Set(['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7']);

// Current page size selection (shared across tabs)
export let currentPageSize = 'A4';

// Workspace dimensions (used by render tab for drawing boundaries)
export let workspaceWidth = 400;
export let workspaceHeight = 400;
export let ejectOutputUnit = 'in'; // Output unit for G-code generation

// Track if hardware info has been loaded
let hardwareInfoLoaded = false;

/**
 * Initialize the Hardware tab
 * Sets up event listeners for the Hardware tab
 */
export function initHardwareTab() {
  debugLog('Hardware tab initialized');
}

/**
 * Load hardware information when tab is shown
 * Fetches system info, vpype info, and populates paper sizes list
 */
export async function loadHardwareInfo() {
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
        if (hasRenderPaths()) {
          drawGcode();
        }
      }
    });

    document.getElementById('hwWorkspaceHeight').addEventListener('input', (e) => {
      const newHeight = parseFloat(e.target.value);
      if (newHeight > 0) {
        workspaceHeight = newHeight;
        if (hasRenderPaths()) {
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

    // Populate paper sizes list
    populatePaperSizesList();

    // Add event listener for add paper button
    document.getElementById('addPaperBtn').addEventListener('click', addNewPaperSize);

    hardwareInfoLoaded = true;
  } catch (error) {
    console.error('Error loading hardware info:', error);
  }
}

/**
 * Populate the paper sizes list in the UI
 * Creates input fields for each paper size with lock/delete controls
 */
function populatePaperSizesList() {
  const list = document.getElementById('paperSizesList');
  list.innerHTML = '';

  for (const [name, dimensions] of Object.entries(PAGE_SIZES)) {
    const isLocked = LOCKED_SIZES.has(name);
    const isDefault = DEFAULT_SIZES.has(name);
    const item = document.createElement('div');
    item.className = 'paper-size-item';
    item.dataset.sizeName = name;

    item.innerHTML = `
      <input type="text" class="paper-size-name ${isDefault || isLocked ? 'locked' : ''}" value="${name}" ${isDefault || isLocked ? 'readonly' : ''}>
      <div class="paper-dimension-label">
        <input type="number" class="paper-dimension-input ${isLocked ? 'locked' : ''}" data-dimension="width" value="${dimensions[0]}" min="1" step="1" ${isLocked ? 'readonly' : ''}>
      </div>
      <div class="paper-dimension-label">
        <input type="number" class="paper-dimension-input ${isLocked ? 'locked' : ''}" data-dimension="height" value="${dimensions[1]}" min="1" step="1" ${isLocked ? 'readonly' : ''}>
      </div>
      <button class="paper-lock-btn ${isLocked ? 'locked' : ''}" title="${isLocked ? 'Unlock to edit' : 'Lock'}">${isLocked ? '🔒' : '🔓'}</button>
      <button class="paper-delete-btn" title="Delete" style="visibility: ${isDefault ? 'hidden' : 'visible'}">🗑️</button>
    `;

    // Add event listeners
    const nameInput = item.querySelector('.paper-size-name');
    const widthInput = item.querySelector('[data-dimension="width"]');
    const heightInput = item.querySelector('[data-dimension="height"]');
    const lockBtn = item.querySelector('.paper-lock-btn');
    const deleteBtn = item.querySelector('.paper-delete-btn');

    nameInput.addEventListener('change', () => updatePaperSize(name, 'name', nameInput.value));
    widthInput.addEventListener('change', () => updatePaperSize(name, 'width', parseFloat(widthInput.value)));
    heightInput.addEventListener('change', () => updatePaperSize(name, 'height', parseFloat(heightInput.value)));
    lockBtn.addEventListener('click', () => togglePaperLock(name));
    deleteBtn.addEventListener('click', () => deletePaperSize(name));

    list.appendChild(item);
  }
}

/**
 * Add a new custom paper size
 * Creates a new paper size with a unique name and default A4 dimensions
 */
function addNewPaperSize() {
  // Find a unique name
  let counter = 1;
  let newName = 'Custom';
  while (PAGE_SIZES[newName]) {
    newName = `Custom${counter}`;
    counter++;
  }

  // Add new paper size with default dimensions
  PAGE_SIZES[newName] = [210, 297]; // Default to A4 size

  // Refresh the list
  populatePaperSizesList();
  updatePageSizeButtons();
}

/**
 * Update a paper size's name or dimensions
 * @param {string} oldName - The current name of the paper size
 * @param {string} field - The field to update ('name', 'width', or 'height')
 * @param {*} value - The new value for the field
 */
function updatePaperSize(oldName, field, value) {
  if (LOCKED_SIZES.has(oldName)) {
    return; // Don't update locked sizes
  }

  if (field === 'name') {
    // Don't allow renaming default sizes
    if (DEFAULT_SIZES.has(oldName)) {
      populatePaperSizesList();
      return;
    }

    // Rename the paper size
    if (value === oldName || !value.trim()) return;
    if (PAGE_SIZES[value]) {
      alert('A paper size with that name already exists');
      populatePaperSizesList();
      return;
    }

    PAGE_SIZES[value] = PAGE_SIZES[oldName];
    delete PAGE_SIZES[oldName];

    // Update current page size if it was using the old name
    if (currentPageSize === oldName) {
      currentPageSize = value;
    }

    populatePaperSizesList();
    updatePageSizeButtons();
  } else if (field === 'width' || field === 'height') {
    if (value <= 0 || isNaN(value)) {
      populatePaperSizesList();
      return;
    }

    const dimensions = PAGE_SIZES[oldName];
    if (field === 'width') {
      dimensions[0] = value;
    } else {
      dimensions[1] = value;
    }
  }
}

/**
 * Toggle the lock status of a paper size
 * Locked sizes cannot have their dimensions edited
 * @param {string} name - The name of the paper size to toggle
 */
function togglePaperLock(name) {
  if (LOCKED_SIZES.has(name)) {
    LOCKED_SIZES.delete(name);
  } else {
    LOCKED_SIZES.add(name);
  }
  populatePaperSizesList();
}

/**
 * Delete a custom paper size
 * Default sizes cannot be deleted
 * @param {string} name - The name of the paper size to delete
 */
function deletePaperSize(name) {
  if (DEFAULT_SIZES.has(name)) {
    return; // Don't delete default sizes
  }

  const confirmed = confirm(`Delete paper size "${name}"?`);
  if (!confirmed) return;

  delete PAGE_SIZES[name];
  LOCKED_SIZES.delete(name); // Remove from locked set if it was there

  // If this was the current page size, switch to A4
  if (currentPageSize === name) {
    currentPageSize = 'A4';
  }

  populatePaperSizesList();
  updatePageSizeButtons();
}

/**
 * Set the current page size
 * @param {string} size - The page size to set (e.g., 'A4', 'custom')
 */
export function setCurrentPageSize(size) {
  currentPageSize = size;
}

/**
 * Update the page size buttons on Trace and Eject tabs
 * Refreshes the button groups to reflect current paper sizes
 */
export function updatePageSizeButtons() {
  // Update the page size buttons on Trace and Eject tabs
  const traceButtonGroup = document.querySelector('.page-size-group');
  const ejectButtonGroup = document.querySelector('.eject-page-size-btn')?.parentElement;

  if (traceButtonGroup) {
    updateButtonGroup(traceButtonGroup, false);
  }
  if (ejectButtonGroup) {
    updateButtonGroup(ejectButtonGroup, true);
  }
}

/**
 * Update a button group with current paper sizes
 * @param {HTMLElement} group - The button group container
 * @param {boolean} isEject - Whether this is for the Eject tab
 */
function updateButtonGroup(group, isEject) {
  // Get all current buttons except "custom"
  const customBtn = group.querySelector('[data-size="custom"]');
  group.innerHTML = '';

  // Add buttons for each paper size
  for (const name of Object.keys(PAGE_SIZES)) {
    const btn = document.createElement('button');
    btn.className = isEject ? 'page-size-btn eject-page-size-btn' : 'page-size-btn';
    btn.dataset.size = name;
    btn.textContent = name;
    if (currentPageSize === name) {
      btn.classList.add('active');
    }
    group.appendChild(btn);
  }

  // Re-add custom button
  if (customBtn) {
    group.appendChild(customBtn.cloneNode(true));
  }
}
