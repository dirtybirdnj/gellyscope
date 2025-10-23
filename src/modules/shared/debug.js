// Debug utilities

export const DEBUG = typeof localStorage !== 'undefined' && localStorage.getItem('DEBUG') === 'true';

export function debugLog(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}
