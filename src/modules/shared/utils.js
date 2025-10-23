// Shared utility functions

export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Unit conversion helpers
export function toMm(value, unit) {
  switch(unit) {
    case 'mm': return value;
    case 'cm': return value * 10;
    case 'in': return value * 25.4;
    default: return value;
  }
}

export function fromMm(mm, unit) {
  switch(unit) {
    case 'mm': return mm;
    case 'cm': return mm / 10;
    case 'in': return mm / 25.4;
    default: return mm;
  }
}

export function mmToInches(mm) {
  return mm / 25.4;
}

export function mmToCm(mm) {
  return mm / 10;
}

// Page size constants
export const PAGE_SIZES = {
  A0: { width: 841, height: 1189 },
  A1: { width: 594, height: 841 },
  A2: { width: 420, height: 594 },
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  A6: { width: 105, height: 148 },
  A7: { width: 74, height: 105 }
};
