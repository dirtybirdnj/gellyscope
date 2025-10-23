# Gellyscope Test Suite

This directory contains automated tests for the Gellyscope application.

## Directory Structure

```
tests/
├── unit/           # Unit tests for individual functions
├── integration/    # Integration tests for combined functionality
├── fixtures/       # Test data files (SVG samples, etc.)
└── README.md       # This file
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode (re-runs on file changes)
```bash
npm run test:watch
```

### Run tests with coverage report
```bash
npm run test:coverage
```

### Run tests with verbose output
```bash
npm run test:verbose
```

### Run specific test suites
```bash
npm run test:unit          # Run only unit tests
npm run test:integration   # Run only integration tests
```

## Test Files

### Unit Tests

- **svg-parser.test.js** - Tests for SVG parsing functionality
  - Validates SVG structure parsing
  - Tests element tree building
  - Verifies attribute extraction
  - Tests error handling

- **svg-output-analysis.test.js** - Tests for SVG analysis utilities
  - Path command parsing
  - Path length estimation
  - ViewBox parsing and validation
  - Dimension conversion utilities

### Test Fixtures

- **simple.svg** - Minimal SVG for basic tests (circle + rect)
- **simple-gelly.svg** - Complex SVG with multiple paths (jellyfish drawing)

## Writing New Tests

### Example Test Structure

```javascript
const fs = require('fs');
const path = require('path');

describe('Feature Name', () => {
  describe('Specific Function', () => {
    test('should do something specific', () => {
      // Arrange
      const input = 'test data';

      // Act
      const result = functionToTest(input);

      // Assert
      expect(result).toBe('expected output');
    });
  });
});
```

### Best Practices

1. **Arrange-Act-Assert** - Structure tests clearly
2. **Descriptive names** - Test names should explain what is being tested
3. **One assertion per test** - Keep tests focused (when possible)
4. **Use fixtures** - Put test data in `fixtures/` directory
5. **Test edge cases** - Include tests for error conditions and boundary values

## Coverage Goals

The test suite aims for:
- **Unit tests**: 80%+ code coverage for core parsing and analysis functions
- **Integration tests**: Coverage of main user workflows
- **Edge cases**: All error conditions and invalid inputs

## CI/CD Integration

These tests are designed to run in continuous integration environments. They:
- Run quickly (< 5 seconds for unit tests)
- Don't require network access
- Use local fixtures only
- Have no external dependencies

## Adding Test Fixtures

To add new SVG test fixtures:

1. Create or export your SVG file
2. Place it in `tests/fixtures/`
3. Add tests that reference it using:
   ```javascript
   const svgPath = path.join(__dirname, '../fixtures/your-file.svg');
   const content = fs.readFileSync(svgPath, 'utf8');
   ```

## Debugging Tests

### Run a single test file
```bash
npx jest tests/unit/svg-parser.test.js
```

### Run tests matching a pattern
```bash
npx jest --testNamePattern="parse simple SVG"
```

### Debug with Node inspector
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Future Test Coverage

Areas to expand test coverage:

- [ ] Potrace algorithm testing
- [ ] G-code generation validation
- [ ] IPC handler testing (main.js)
- [ ] File I/O operations
- [ ] Dimension conversion edge cases
- [ ] vpype integration testing
- [ ] Renderer UI testing (if needed)

## Dependencies

- **jest** - Testing framework
- **@types/jest** - TypeScript type definitions
- **xml2js** - Used in SVG parsing tests

## Troubleshooting

### Tests not found
Make sure test files follow the naming pattern:
- `*.test.js`
- `*.spec.js`

### Coverage not accurate
Coverage is collected from:
- `main.js`
- `renderer.js`
- `potrace.js`

See `jest.config.js` for full configuration.
