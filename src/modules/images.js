// Images Tab Module
import { debugLog } from './shared/debug.js';
import { updateStatusBar } from './shared/statusBar.js';

export function initImagesTab() {
  const uploadImageBtn = document.getElementById('uploadImageBtn');
  const imageUploadInput = document.getElementById('imageUploadInput');

  // Setup upload button
  if (uploadImageBtn && imageUploadInput) {
    uploadImageBtn.addEventListener('click', () => {
      imageUploadInput.click();
    });

    imageUploadInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/bmp'];
      if (!validTypes.includes(file.type)) {
        alert('Please select a valid image file (JPEG, PNG, or BMP)');
        return;
      }

      try {
        // Read file as data URL
        const reader = new FileReader();
        reader.onload = async (event) => {
          const imageData = event.target.result;

          // Save image to gellyroller directory
          const result = await window.electronAPI.saveImage(imageData, file.name);

          if (result.success) {
            debugLog('Image uploaded successfully:', result.filename);
            // Reload images to show the new upload
            await loadImages();
          } else {
            alert(`Failed to upload image: ${result.error}`);
          }
        };

        reader.onerror = () => {
          alert('Failed to read file');
        };

        reader.readAsDataURL(file);
      } catch (error) {
        console.error('Error uploading image:', error);
        alert('Error uploading image: ' + error.message);
      }

      // Clear the input so the same file can be uploaded again if needed
      e.target.value = '';
    });
  }
}

export async function loadImages() {
  const imageGrid = document.getElementById('imageGrid');

  try {
    const result = await window.electronAPI.listImages();

    if (!result.success) {
      imageGrid.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.5;">No images found or directory not accessible</div>';
      return;
    }

    if (result.files.length === 0) {
      imageGrid.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.5;">No images in gellyroller directory</div>';
      return;
    }

    // Clear existing items
    imageGrid.innerHTML = '';

    // Load each image
    for (const file of result.files) {
      const imageItem = document.createElement('div');
      imageItem.className = 'image-item';

      // Create image wrapper
      const imageWrapper = document.createElement('div');
      imageWrapper.className = 'image-wrapper';
      imageWrapper.title = file.name;

      // Read the file as base64
      const fileData = await window.electronAPI.readFileBase64(file.path);

      if (fileData.success) {
        const img = document.createElement('img');
        const imageSrc = `data:${fileData.mimeType};base64,${fileData.data}`;
        img.src = imageSrc;
        img.alt = file.name;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        imageWrapper.appendChild(img);

        // Add click handler to show image in Trace tab
        imageWrapper.addEventListener('click', () => {
          // Import and call trace module function
          import('./trace.js').then(module => {
            module.showImageInTraceTab(imageSrc, file.name);
          });
        });

        // Store imageSrc on the item for button access
        imageItem.dataset.imageSrc = imageSrc;
        imageItem.dataset.fileName = file.name;
      } else {
        imageWrapper.textContent = '❌';
        imageWrapper.title = `Error loading ${file.name}`;
      }

      imageItem.appendChild(imageWrapper);

      // Create buttons container
      const buttonsContainer = document.createElement('div');
      buttonsContainer.className = 'image-actions';

      // Create Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'image-action-btn delete-btn';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await handleDeleteImage(file.path, file.name);
      });

      // Create Trace button
      const traceBtn = document.createElement('button');
      traceBtn.className = 'image-action-btn trace-btn';
      traceBtn.textContent = 'Trace';
      traceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const imageSrc = imageItem.dataset.imageSrc;
        const fileName = imageItem.dataset.fileName;
        if (imageSrc) {
          // Import and call trace module function
          import('./trace.js').then(module => {
            module.showImageInTraceTab(imageSrc, fileName);
          });
        }
      });

      buttonsContainer.appendChild(deleteBtn);
      buttonsContainer.appendChild(traceBtn);
      imageItem.appendChild(buttonsContainer);

      imageGrid.appendChild(imageItem);
    }

    debugLog('Loaded', result.files.length, 'images');

    // Update status bar with image count
    updateStatusBar('images', {
      count: result.files.length
    });
  } catch (error) {
    console.error('Error loading images:', error);
    imageGrid.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.5;">Error loading images</div>';

    // Update status bar to show error state
    updateStatusBar('images', {});
  }
}

async function handleDeleteImage(filePath, fileName) {
  // Confirm deletion
  const confirmed = confirm(`Are you sure you want to delete "${fileName}"?`);

  if (!confirmed) {
    return;
  }

  try {
    const result = await window.electronAPI.deleteFile(filePath);

    if (result.success) {
      debugLog('File deleted successfully:', fileName);
      // Reload the images grid
      await loadImages();
    } else {
      alert(`Failed to delete file: ${result.error}`);
      console.error('Delete error:', result.error);
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    alert('An error occurred while deleting the file.');
  }
}
