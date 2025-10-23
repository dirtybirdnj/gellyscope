// Camera Tab Module
import { debugLog } from './shared/debug.js';

let cameraStream = null;

export function initCameraTab() {
  const cameraVideo = document.getElementById('cameraVideo');
  const captureCanvas = document.getElementById('captureCanvas');
  const cameraMessage = document.getElementById('cameraMessage');
  const startCameraBtn = document.getElementById('startCamera');
  const capturePhotoBtn = document.getElementById('capturePhoto');
  const stopCameraBtn = document.getElementById('stopCamera');

  // Start camera
  startCameraBtn.addEventListener('click', async () => {
    try {
      cameraMessage.textContent = 'Requesting camera access...';

      // Request camera access
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      // Set video source
      cameraVideo.srcObject = cameraStream;
      cameraVideo.classList.add('active');
      cameraMessage.classList.add('hidden');

      // Enable/disable buttons
      startCameraBtn.disabled = true;
      capturePhotoBtn.disabled = false;
      stopCameraBtn.disabled = false;

      debugLog('Camera started successfully');
    } catch (error) {
      console.error('Error accessing camera:', error);
      cameraMessage.textContent = 'Error: Unable to access camera. Please check permissions.';
      cameraMessage.classList.remove('hidden');
    }
  });

  // Capture photo
  capturePhotoBtn.addEventListener('click', async () => {
    try {
      if (!cameraStream) {
        alert('Camera is not active');
        return;
      }

      // Set canvas size to match video
      captureCanvas.width = cameraVideo.videoWidth;
      captureCanvas.height = cameraVideo.videoHeight;

      // Draw video frame to canvas
      const ctx = captureCanvas.getContext('2d');
      ctx.drawImage(cameraVideo, 0, 0, captureCanvas.width, captureCanvas.height);

      // Convert to base64
      const imageData = captureCanvas.toDataURL('image/png');

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `capture_${timestamp}.png`;

      // Save to gellyroller directory
      const result = await window.electronAPI.saveImage(imageData, filename);

      if (result.success) {
        debugLog('Photo saved:', result.path);

        // Show success message
        const originalText = capturePhotoBtn.textContent;
        capturePhotoBtn.textContent = '✓ Photo Saved!';
        capturePhotoBtn.style.background = '#4caf50';

        setTimeout(() => {
          capturePhotoBtn.textContent = originalText;
          capturePhotoBtn.style.background = '';
        }, 2000);
      } else {
        console.error('Error saving photo:', result.error);
        alert('Error saving photo: ' + result.error);
      }
    } catch (error) {
      console.error('Error capturing photo:', error);
      alert('Error capturing photo: ' + error.message);
    }
  });

  // Stop camera
  stopCameraBtn.addEventListener('click', () => {
    if (cameraStream) {
      // Stop all tracks
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;

      // Reset UI
      cameraVideo.srcObject = null;
      cameraVideo.classList.remove('active');
      cameraMessage.textContent = 'Click "Start Camera" to begin';
      cameraMessage.classList.remove('hidden');

      // Enable/disable buttons
      startCameraBtn.disabled = false;
      capturePhotoBtn.disabled = true;
      stopCameraBtn.disabled = true;

      debugLog('Camera stopped');
    }
  });
}
