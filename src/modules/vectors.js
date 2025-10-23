// Vectors Tab Module
import { debugLog } from './shared/debug.js';
import { switchTab } from './shared/tabs.js';
import { setState } from './shared/state.js';

export function initVectorsTab() {
  // Load vectors when tab is shown
  // This will be called from the main switchTab wrapper
}

export async function loadVectors() {
  const vectorGrid = document.getElementById('vectorGrid');

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
      const svgData = {
        ...result.data,
        content: fileContent.data, // Store the raw SVG content
        path: filePath // Store the file path
      };
      setState({ currentSVGData: svgData });
      debugLog('Vector loaded for eject:', svgData);

      // Switch to eject tab and trigger load
      switchTab('eject');

      // Dynamically import and call eject module's load function
      import('./eject.js').then(module => {
        module.loadEjectTab();
      });
    } else {
      alert('Error parsing SVG: ' + result.error);
    }
  } catch (error) {
    console.error('Error ejecting vector:', error);
    alert('Error loading vector: ' + error.message);
  }
}

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
