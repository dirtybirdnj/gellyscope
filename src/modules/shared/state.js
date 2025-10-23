// Global application state

export const state = {
  // SVG/Scope tab state
  currentSVGData: null,
  currentSelectedElement: null,
  zoomLevel: 1,
  isPanning: false,
  startX: 0,
  startY: 0,
  scrollLeft: 0,
  scrollTop: 0,
  viewMode: 'fit', // 'fit' or 'full'
  isCropping: false,
  cropTop: 0.25,
  cropBottom: 0.75,
  cropLeft: 0.25,
  cropRight: 0.75,
  flipH: false,
  flipV: false,
};

// Export getters and setters for controlled access
export function setState(updates) {
  Object.assign(state, updates);
}

export function getState(key) {
  return key ? state[key] : state;
}
