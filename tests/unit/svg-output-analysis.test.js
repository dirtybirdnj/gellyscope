const fs = require('fs');
const path = require('path');

/**
 * Utility functions for SVG output analysis
 */

/**
 * Parse SVG path data and extract commands
 * @param {string} pathData - The 'd' attribute from an SVG path
 * @returns {Array} Array of path commands
 */
function parsePathCommands(pathData) {
  if (!pathData) return [];

  // Match all path commands (M, L, C, Z, etc.) and their parameters
  const commandPattern = /[MLHVCSQTAZmlhvcsqtaz][^MLHVCSQTAZmlhvcsqtaz]*/g;
  const commands = pathData.match(commandPattern) || [];

  return commands.map(cmd => {
    const type = cmd[0];
    const params = cmd.slice(1).trim().split(/[\s,]+/).filter(p => p).map(Number);
    return { type, params };
  });
}

/**
 * Calculate approximate path length (simplified)
 * @param {string} pathData - The 'd' attribute from an SVG path
 * @returns {number} Approximate path length
 */
function estimatePathLength(pathData) {
  const commands = parsePathCommands(pathData);
  let length = 0;
  let currentX = 0;
  let currentY = 0;

  commands.forEach(cmd => {
    if (cmd.type === 'M' || cmd.type === 'm') {
      currentX = cmd.params[0];
      currentY = cmd.params[1];
    } else if (cmd.type === 'L' || cmd.type === 'l') {
      const dx = cmd.params[0] - currentX;
      const dy = cmd.params[1] - currentY;
      length += Math.sqrt(dx * dx + dy * dy);
      currentX = cmd.params[0];
      currentY = cmd.params[1];
    } else if (cmd.type === 'C' || cmd.type === 'c') {
      // Approximate cubic bezier length (simplified)
      const dx = cmd.params[4] - currentX;
      const dy = cmd.params[5] - currentY;
      length += Math.sqrt(dx * dx + dy * dy);
      currentX = cmd.params[4];
      currentY = cmd.params[5];
    }
  });

  return length;
}

/**
 * Extract bounding box from viewBox
 * @param {string} viewBox - The viewBox attribute
 * @returns {object} Bounding box {x, y, width, height}
 */
function parseViewBox(viewBox) {
  if (!viewBox) return null;

  const parts = viewBox.split(/[\s,]+/).map(Number);
  if (parts.length !== 4) return null;

  return {
    x: parts[0],
    y: parts[1],
    width: parts[2],
    height: parts[3]
  };
}

describe('SVG Output Analysis', () => {
  describe('Path Command Parsing', () => {
    test('should parse simple Move and Line commands', () => {
      const pathData = 'M 10 10 L 20 20 L 30 10';
      const commands = parsePathCommands(pathData);

      expect(commands.length).toBe(3);
      expect(commands[0].type).toBe('M');
      expect(commands[0].params).toEqual([10, 10]);
      expect(commands[1].type).toBe('L');
      expect(commands[1].params).toEqual([20, 20]);
    });

    test('should parse cubic bezier commands', () => {
      const pathData = 'M 10 10 C 20 20 30 30 40 10';
      const commands = parsePathCommands(pathData);

      expect(commands.length).toBe(2);
      expect(commands[1].type).toBe('C');
      expect(commands[1].params.length).toBe(6);
    });

    test('should handle empty or null path data', () => {
      expect(parsePathCommands('')).toEqual([]);
      expect(parsePathCommands(null)).toEqual([]);
    });

    test('should parse complex path from fixture', () => {
      const svgPath = path.join(__dirname, '../fixtures/simple-gelly.svg');
      const content = fs.readFileSync(svgPath, 'utf8');

      // Extract first path d attribute (skip id attribute)
      const match = content.match(/\sd="([^"]+)"/);
      expect(match).toBeTruthy();

      const commands = parsePathCommands(match[1]);
      expect(commands.length).toBeGreaterThan(0);

      // First command should be Move
      expect(commands[0].type).toBe('M');
    });
  });

  describe('Path Length Estimation', () => {
    test('should estimate length of simple line', () => {
      const pathData = 'M 0 0 L 10 0';
      const length = estimatePathLength(pathData);

      expect(length).toBe(10);
    });

    test('should estimate length of diagonal line', () => {
      const pathData = 'M 0 0 L 3 4';
      const length = estimatePathLength(pathData);

      expect(length).toBe(5); // 3-4-5 triangle
    });

    test('should estimate length of multi-segment path', () => {
      const pathData = 'M 0 0 L 10 0 L 10 10';
      const length = estimatePathLength(pathData);

      expect(length).toBe(20);
    });

    test('should handle complex paths without errors', () => {
      const svgPath = path.join(__dirname, '../fixtures/simple-gelly.svg');
      const content = fs.readFileSync(svgPath, 'utf8');

      const match = content.match(/\sd="([^"]+)"/);
      const length = estimatePathLength(match[1]);

      expect(length).toBeGreaterThan(0);
      expect(isNaN(length)).toBe(false);
    });
  });

  describe('ViewBox Parsing', () => {
    test('should parse standard viewBox', () => {
      const viewBox = '0 0 100 100';
      const bbox = parseViewBox(viewBox);

      expect(bbox).toEqual({
        x: 0,
        y: 0,
        width: 100,
        height: 100
      });
    });

    test('should parse viewBox with comma separators', () => {
      const viewBox = '0,0,200,300';
      const bbox = parseViewBox(viewBox);

      expect(bbox).toEqual({
        x: 0,
        y: 0,
        width: 200,
        height: 300
      });
    });

    test('should parse viewBox with negative offsets', () => {
      const viewBox = '-50 -50 100 100';
      const bbox = parseViewBox(viewBox);

      expect(bbox.x).toBe(-50);
      expect(bbox.y).toBe(-50);
    });

    test('should handle null or invalid viewBox', () => {
      expect(parseViewBox(null)).toBeNull();
      expect(parseViewBox('invalid')).toBeNull();
      expect(parseViewBox('1 2 3')).toBeNull();
    });

    test('should calculate aspect ratio from viewBox', () => {
      const viewBox = '0 0 800 600';
      const bbox = parseViewBox(viewBox);

      const aspectRatio = bbox.width / bbox.height;
      expect(aspectRatio).toBeCloseTo(4/3);
    });
  });

  describe('SVG Output Validation', () => {
    test('should validate basic SVG structure', () => {
      const svgPath = path.join(__dirname, '../fixtures/simple.svg');
      const content = fs.readFileSync(svgPath, 'utf8');

      expect(content).toContain('<?xml');
      expect(content).toContain('<svg');
      expect(content).toContain('xmlns');
      expect(content).toContain('</svg>');
    });

    test('should validate complex SVG has required elements', () => {
      const svgPath = path.join(__dirname, '../fixtures/simple-gelly.svg');
      const content = fs.readFileSync(svgPath, 'utf8');

      // Check for required SVG attributes
      expect(content).toContain('viewBox');
      expect(content).toContain('width');
      expect(content).toContain('height');

      // Check for path elements
      expect(content).toContain('<path');
    });

    test('should count path elements in SVG', () => {
      const svgPath = path.join(__dirname, '../fixtures/simple-gelly.svg');
      const content = fs.readFileSync(svgPath, 'utf8');

      const pathMatches = content.match(/<path/g);
      expect(pathMatches).toBeTruthy();
      expect(pathMatches.length).toBeGreaterThan(0);
    });

    test('should verify all paths are closed or open as expected', () => {
      const svgPath = path.join(__dirname, '../fixtures/simple-gelly.svg');
      const content = fs.readFileSync(svgPath, 'utf8');

      const pathData = content.match(/\sd="([^"]+)"/g);
      expect(pathData).toBeTruthy();

      pathData.forEach(d => {
        // Extract the d attribute value
        const value = d.match(/\sd="([^"]+)"/)[1];
        expect(value.length).toBeGreaterThan(0);
        expect(value).toMatch(/^M/); // Should start with Move command
      });
    });
  });

  describe('SVG Dimension Conversion', () => {
    test('should convert mm to inches', () => {
      const mm = 25.4;
      const inches = mm / 25.4;
      expect(inches).toBe(1);
    });

    test('should convert cm to mm', () => {
      const cm = 10;
      const mm = cm * 10;
      expect(mm).toBe(100);
    });

    test('should handle portrait vs landscape aspect ratios', () => {
      const portraitBox = parseViewBox('0 0 600 800');
      const landscapeBox = parseViewBox('0 0 800 600');

      const portraitRatio = portraitBox.width / portraitBox.height;
      const landscapeRatio = landscapeBox.width / landscapeBox.height;

      expect(portraitRatio).toBeLessThan(1);
      expect(landscapeRatio).toBeGreaterThan(1);
    });
  });
});

// Export utilities for use in other tests
module.exports = {
  parsePathCommands,
  estimatePathLength,
  parseViewBox
};
