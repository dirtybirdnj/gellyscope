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

  // Eject tab state
  eject: {
    pageSize: 'A4',
    layout: 'portrait',
    pageBackgroundElement: null,
    originalAspectRatio: 1,
    previousUnit: 'in'
  },

  // Render tab state
  render: {
    currentGcodeFile: null,
    zoom: 1,
    panX: 0,
    panY: 0,
    panStartX: 0,
    panStartY: 0,
    baseScale: 1,
    bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 },
    paths: [],
    isPanning: false
  }
};

// Export getters and setters for controlled access
export function setState(updates) {
  Object.assign(state, updates);
}

export function getState(key) {
  return key ? state[key] : state;
}
