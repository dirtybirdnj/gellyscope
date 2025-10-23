// Shared initialization tasks
import { debugLog } from './debug.js';

// Ensure gellyroller directory exists on app startup
export async function initializeGellyroller() {
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
