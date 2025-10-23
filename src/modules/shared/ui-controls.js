// Shared UI control behaviors
import { debugLog } from './debug.js';

// Initialize arrow button controls for sliders
export function initArrowButtons() {
  // Handle all arrow button clicks for slider adjustments
  document.querySelectorAll('.arrow-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const direction = parseInt(btn.dataset.direction);
      const slider = document.getElementById(targetId);

      if (!slider) return;

      const step = parseFloat(slider.step) || 1;
      const min = parseFloat(slider.min);
      const max = parseFloat(slider.max);
      const currentValue = parseFloat(slider.value);

      // Calculate new value
      const newValue = currentValue + (step * direction);

      // Clamp to min/max range
      slider.value = Math.max(min, Math.min(max, newValue));

      // Trigger input event to update display and trace
      slider.dispatchEvent(new Event('input'));

      debugLog(`Arrow button: ${targetId} ${direction > 0 ? '+' : '-'}${step} = ${slider.value}`);
    });
  });

  // Add keyboard arrow key support for sliders with arrow buttons
  document.querySelectorAll('.control-slider').forEach(slider => {
    slider.addEventListener('keydown', (e) => {
      // Check if left or right arrow key was pressed
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault(); // Prevent default browser behavior

        const step = parseFloat(slider.step) || 1;
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        const currentValue = parseFloat(slider.value);

        // Left arrow decreases, right arrow increases
        const direction = e.key === 'ArrowRight' ? 1 : -1;
        const newValue = currentValue + (step * direction);

        // Clamp to min/max range
        slider.value = Math.max(min, Math.min(max, newValue));

        // Trigger input event to update display and trace
        slider.dispatchEvent(new Event('input'));

        debugLog(`Keyboard arrow: ${slider.id} ${direction > 0 ? '+' : '-'}${step} = ${slider.value}`);
      }
    });
  });
}

// Initialize collapsible section controls
export function initCollapsibleSections() {
  // Handle section collapse/expand
  document.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', () => {
      const sectionName = header.dataset.section;
      const content = document.querySelector(`[data-section-content="${sectionName}"]`);

      if (content) {
        header.classList.toggle('collapsed');
        content.classList.toggle('collapsed');

        debugLog('Section toggled:', sectionName, header.classList.contains('collapsed') ? 'collapsed' : 'expanded');
      }
    });
  });
}
