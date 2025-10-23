const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

// Import the SVG parsing function from main.js
// Note: This requires refactoring main.js to export the function
// For now, we'll replicate the logic here for testing

/**
 * Parse SVG content and extract structure
 * This is a copy of the logic from main.js:547-630 for testing
 */
async function parseSVGContent(content) {
  const parser = new xml2js.Parser({
    explicitChildren: true,
    preserveChildrenOrder: true,
    charsAsChildren: true
  });

  const result = await parser.parseStringPromise(content);

  if (!result.svg) {
    throw new Error('Invalid SVG: No root svg element found');
  }

  const svgElement = result.svg;
  const attributes = {
    viewBox: svgElement.$.viewBox || null,
    width: svgElement.$.width || null,
    height: svgElement.$.height || null
  };

  // Count total elements
  const countElements = (node) => {
    let count = 1;
    if (node.$$ && Array.isArray(node.$$)) {
      node.$$.forEach(child => {
        if (child['#name']) {
          count += countElements(child);
        }
      });
    }
    return count;
  };

  // Build element tree
  const buildElementTree = (node, tagName = 'svg', depth = 0) => {
    const element = {
      tag: tagName,
      depth: depth,
      attributes: node.$ || {},
      children: []
    };

    if (node.$$ && Array.isArray(node.$$)) {
      node.$$.forEach(child => {
        if (child['#name'] && child['#name'] !== '__text__') {
          element.children.push(buildElementTree(child, child['#name'], depth + 1));
        }
      });
    }

    return element;
  };

  const elementTree = buildElementTree(svgElement, 'svg', 0);
  const totalElements = countElements(svgElement);

  return {
    attributes,
    elementTree,
    totalElements
  };
}

describe('SVG Parser', () => {
  describe('parseSVGContent', () => {
    test('should parse simple SVG with basic shapes', async () => {
      const svgPath = path.join(__dirname, '../fixtures/simple.svg');
      const svgContent = fs.readFileSync(svgPath, 'utf8');

      const result = await parseSVGContent(svgContent);

      expect(result).toBeDefined();
      expect(result.attributes).toBeDefined();
      expect(result.elementTree).toBeDefined();
      expect(result.totalElements).toBeGreaterThan(0);
    });

    test('should extract SVG attributes correctly', async () => {
      const svgPath = path.join(__dirname, '../fixtures/simple.svg');
      const svgContent = fs.readFileSync(svgPath, 'utf8');

      const result = await parseSVGContent(svgContent);

      expect(result.attributes.viewBox).toBe('0 0 100 100');
      expect(result.attributes.width).toBe('100');
      expect(result.attributes.height).toBe('100');
    });

    test('should build element tree with correct depth', async () => {
      const svgPath = path.join(__dirname, '../fixtures/simple.svg');
      const svgContent = fs.readFileSync(svgPath, 'utf8');

      const result = await parseSVGContent(svgContent);

      expect(result.elementTree.tag).toBe('svg');
      expect(result.elementTree.depth).toBe(0);
      expect(result.elementTree.children.length).toBeGreaterThan(0);

      // Check that children have depth 1
      result.elementTree.children.forEach(child => {
        expect(child.depth).toBe(1);
      });
    });

    test('should count total elements correctly', async () => {
      const svgPath = path.join(__dirname, '../fixtures/simple.svg');
      const svgContent = fs.readFileSync(svgPath, 'utf8');

      const result = await parseSVGContent(svgContent);

      // simple.svg has: svg (1) + circle (1) + rect (1) = 3
      expect(result.totalElements).toBe(3);
    });

    test('should parse complex SVG with paths', async () => {
      const svgPath = path.join(__dirname, '../fixtures/simple-gelly.svg');
      const svgContent = fs.readFileSync(svgPath, 'utf8');

      const result = await parseSVGContent(svgContent);

      expect(result).toBeDefined();
      expect(result.totalElements).toBeGreaterThan(3);

      // Check that paths are included in the tree
      const hasPaths = result.elementTree.children.some(child => child.tag === 'path');
      expect(hasPaths).toBe(true);
    });

    test('should throw error for invalid SVG', async () => {
      const invalidSVG = '<notsvg><invalid></invalid></notsvg>';

      await expect(parseSVGContent(invalidSVG)).rejects.toThrow();
    });

    test('should handle SVG with no children', async () => {
      const emptySVG = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>';

      const result = await parseSVGContent(emptySVG);

      expect(result.elementTree.children.length).toBe(0);
      expect(result.totalElements).toBe(1);
    });
  });

  describe('SVG Element Analysis', () => {
    test('should identify all path elements', async () => {
      const svgPath = path.join(__dirname, '../fixtures/simple-gelly.svg');
      const svgContent = fs.readFileSync(svgPath, 'utf8');

      const result = await parseSVGContent(svgContent);

      const paths = result.elementTree.children.filter(child => child.tag === 'path');
      expect(paths.length).toBeGreaterThan(0);

      // Each path should have attributes including 'd'
      paths.forEach(path => {
        expect(path.attributes).toHaveProperty('d');
        expect(path.attributes.d).toBeTruthy();
      });
    });

    test('should extract stroke attributes from paths', async () => {
      const svgPath = path.join(__dirname, '../fixtures/simple-gelly.svg');
      const svgContent = fs.readFileSync(svgPath, 'utf8');

      const result = await parseSVGContent(svgContent);

      const paths = result.elementTree.children.filter(child => child.tag === 'path');

      // simple-gelly.svg has red strokes
      paths.forEach(path => {
        if (path.attributes.stroke) {
          expect(path.attributes.stroke).toBe('#ff0000');
        }
      });
    });
  });
});
