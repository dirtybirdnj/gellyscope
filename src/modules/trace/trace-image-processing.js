// Trace Image Processing Module
// Handles image scaling, filtering, and dimension calculations

/**
 * Apply image processing filters and return processed image URL
 * @param {string} originalSrc - Source image URL
 * @returns {Promise<string>} Processed image data URL
 */
export function applyImageProcessing(originalSrc) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Get current control values
      const brightness = parseInt(document.getElementById('brightnessSlider').value);
      const contrast = parseInt(document.getElementById('contrastSlider').value);
      const saturation = parseInt(document.getElementById('saturationSlider').value);
      const hue = parseInt(document.getElementById('hueSlider').value);
      const greyscale = document.getElementById('greyscaleToggle').checked;
      const sepia = document.getElementById('sepiaToggle').checked;

      // Build CSS filter string
      let filters = [];

      if (brightness !== 0) {
        filters.push(`brightness(${1 + brightness / 100})`);
      }
      if (contrast !== 0) {
        filters.push(`contrast(${1 + contrast / 100})`);
      }
      if (saturation !== 0) {
        filters.push(`saturate(${1 + saturation / 100})`);
      }
      if (hue !== 0) {
        filters.push(`hue-rotate(${hue}deg)`);
      }
      if (greyscale) {
        filters.push('grayscale(100%)');
      }
      if (sepia) {
        filters.push('sepia(100%)');
      }

      // Apply filters
      if (filters.length > 0) {
        ctx.filter = filters.join(' ');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }

      // Return processed image as data URL
      resolve(canvas.toDataURL());
    };

    img.src = originalSrc;
  });
}

/**
 * Scale image based on percentage
 * @param {string} imageSrc - Source image URL
 * @param {number} scalePercent - Scale percentage (100 = no scaling)
 * @returns {Promise<string>} Scaled image data URL
 */
export function scaleImage(imageSrc, scalePercent) {
  return new Promise((resolve) => {
    if (scalePercent === 100) {
      resolve(imageSrc);
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      const scale = scalePercent / 100;
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL());
    };

    img.src = imageSrc;
  });
}

/**
 * Update dimension display in the UI
 */
export function updateDimensionDisplay() {
  const originalDimensions = document.getElementById('originalDimensions');
  const scaledDimensions = document.getElementById('scaledDimensions');
  const scaledDimensionsGroup = document.getElementById('scaledDimensionsGroup');

  if (window.currentTraceImage) {
    const width = window.currentTraceImage.originalWidth;
    const height = window.currentTraceImage.originalHeight;

    originalDimensions.textContent = `${width} × ${height} px`;

    if (window.currentTraceImage.scale !== 100) {
      const scale = window.currentTraceImage.scale / 100;
      const scaledWidth = Math.round(width * scale);
      const scaledHeight = Math.round(height * scale);

      scaledDimensions.textContent = `${scaledWidth} × ${scaledHeight} px`;
      scaledDimensionsGroup.style.display = 'block';
    } else {
      scaledDimensionsGroup.style.display = 'none';
    }
  }
}
