// Home Tab Module
import { debugLog } from './shared/debug.js';
import { switchTab } from './shared/tabs.js';

export async function initHomeTab() {
  // Setup quick action buttons
  setupQuickActions();
}

// Export loadHomeScreen so it can be called when switching to home tab
export async function loadHomeScreen() {
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

    // Combine all files for the grid
    const allFiles = [];

    if (imagesResult.success) {
      imagesResult.files.forEach(file => {
        allFiles.push({
          type: 'image',
          name: file.name,
          path: file.path,
          icon: '🖼️'
        });
      });
    }

    if (vectorsResult.success) {
      vectorsResult.files.forEach(file => {
        allFiles.push({
          type: 'vector',
          name: file.name,
          path: file.path,
          icon: '📐'
        });
      });
    }

    if (gcodeResult.success) {
      gcodeResult.files.forEach(file => {
        allFiles.push({
          type: 'gcode',
          name: file.name,
          path: file.path,
          icon: '🎨',
          modified: file.modified
        });
      });
    }

    // Sort by modified date if available (most recent first)
    allFiles.sort((a, b) => {
      if (a.modified && b.modified) {
        return new Date(b.modified) - new Date(a.modified);
      }
      return 0;
    });

    // Limit to 12 most recent files
    const recentFiles = allFiles.slice(0, 12);

    // Display files
    const filesGrid = document.getElementById('homeFilesGrid');

    if (!filesGrid) {
      console.error('homeFilesGrid element not found');
      return;
    }

    if (recentFiles.length === 0) {
      filesGrid.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.5; grid-column: 1 / -1;">No files found in workspace</div>';
    } else {
      filesGrid.innerHTML = '';

      for (const file of recentFiles) {
        const fileItem = document.createElement('div');
        fileItem.className = 'home-file-item';
        fileItem.title = file.name;

        if (file.type === 'image') {
          // Load image thumbnail
          const imageResult = await window.electronAPI.readFileBase64(file.path);
          if (imageResult.success) {
            const img = document.createElement('img');
            img.src = `data:${imageResult.mimeType};base64,${imageResult.data}`;
            img.className = 'home-file-preview';
            fileItem.appendChild(img);
          }
        } else if (file.type === 'vector') {
          // Load SVG thumbnail
          const svgResult = await window.electronAPI.readFileText(file.path);
          if (svgResult.success) {
            const svgContainer = document.createElement('div');
            svgContainer.className = 'home-file-preview';
            svgContainer.innerHTML = svgResult.data;
            fileItem.appendChild(svgContainer);
          }
        } else {
          // Show icon for G-code files
          const iconDiv = document.createElement('div');
          iconDiv.className = 'home-file-icon';
          iconDiv.textContent = file.icon;
          fileItem.appendChild(iconDiv);
        }

        const fileName = document.createElement('div');
        fileName.className = 'home-file-name';
        fileName.textContent = file.name;
        fileItem.appendChild(fileName);

        const fileType = document.createElement('div');
        fileType.className = 'home-file-type';
        fileType.textContent = file.type;
        fileItem.appendChild(fileType);

        // Add click handler to open file in appropriate tab
        fileItem.addEventListener('click', () => {
          if (file.type === 'image') {
            switchTab('images');
          } else if (file.type === 'vector') {
            switchTab('vectors');
          } else if (file.type === 'gcode') {
            switchTab('render');
          }
        });

        filesGrid.appendChild(fileItem);
      }
    }

    debugLog('Home screen loaded:', {imageCount, vectorCount, gcodeCount});
  } catch (error) {
    console.error('Error loading home screen:', error);
    const filesGrid = document.getElementById('homeFilesGrid');
    if (filesGrid) {
      filesGrid.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.5; grid-column: 1 / -1;">Error loading files</div>';
    }
  }
}

function setupQuickActions() {
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
}
