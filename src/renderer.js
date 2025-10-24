// Main Renderer Entry Point - Modular Version
// This is the new modular entry point that replaces the monolithic renderer.js

// Import shared utilities
import { initializeGellyroller } from './modules/shared/init.js';
import { initTabNavigation, switchTab } from './modules/shared/tabs.js';
import { initArrowButtons, initCollapsibleSections } from './modules/shared/ui-controls.js';
import { updateStatusBar } from './modules/shared/statusBar.js';

// Import tab modules
import { initHomeTab, loadHomeScreen } from './modules/home.js';
import { initCameraTab } from './modules/camera.js';
import { initImagesTab, loadImages } from './modules/images.js';
import { initTraceTab } from './modules/trace.js';
import { initVectorsTab } from './modules/vectors.js';
import { initEjectTab, loadEjectTab } from './modules/eject.js';
import { initRenderTab, loadGcodeFiles } from './modules/render.js';
import { initScopeTab } from './modules/scope.js';
import { initHardwareTab, loadHardwareInfo } from './modules/hardware.js';

// Import module functions that need to be called on tab switch
import { loadVectors } from './modules/vectors.js';

// Store original switchTab function
const baseSwitchTab = switchTab;

// Enhanced switchTab that loads content when switching tabs
window.switchTab = function(tabName) {
  // Call base tab switching logic
  baseSwitchTab(tabName);

  // Update status bar for new tab
  updateStatusBar(tabName, {});

  // Load content for specific tabs
  if (tabName === 'home') {
    loadHomeScreen();
  } else if (tabName === 'images') {
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

// Make switchTab globally available for use in modules
// This allows dynamic imports to call switchTab
if (typeof globalThis !== 'undefined') {
  globalThis.switchTab = window.switchTab;
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', async () => {
  console.log('Initializing Gellyscope (Modular Version)...');

  // Initialize gellyroller directory
  await initializeGellyroller();

  // Initialize tab navigation system
  initTabNavigation();

  // Initialize shared UI controls
  initArrowButtons();
  initCollapsibleSections();

  // Initialize all tab modules
  initHomeTab();
  initCameraTab();
  initImagesTab();
  initTraceTab();
  initVectorsTab();
  initEjectTab();
  initRenderTab();
  initScopeTab();
  initHardwareTab();

  // Load home screen initially since it's the default active tab
  await loadHomeScreen();

  console.log('Gellyscope initialization complete!');
});
