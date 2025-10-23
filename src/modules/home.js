// Home Tab Module
import { debugLog } from './shared/debug.js';
import { switchTab } from './shared/tabs.js';

export async function initHomeTab() {
  // Setup quick action buttons and stat card click handlers
  setupQuickActions();
  setupStatCardClickHandlers();
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

    debugLog('Home screen loaded:', {imageCount, vectorCount, gcodeCount});
  } catch (error) {
    console.error('Error loading home screen:', error);
  }
}

function setupStatCardClickHandlers() {
  // Make stat cards clickable to navigate to their respective tabs
  document.querySelectorAll('.stat-card[data-tab]').forEach(card => {
    card.addEventListener('click', () => {
      const tabName = card.dataset.tab;
      switchTab(tabName);
    });
  });
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
