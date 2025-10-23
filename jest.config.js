module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'main.js',
    'renderer.js',
    'potrace.js',
    '!node_modules/**',
    '!dist/**',
    '!coverage/**'
  ],

  // Coverage thresholds (optional - can be adjusted)
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0
    }
  },

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],

  // Setup files
  setupFilesAfterEnv: [],

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Reset mocks between tests
  resetMocks: true,

  // Restore mocks between tests
  restoreMocks: true,

  // Maximum number of concurrent workers
  maxWorkers: '50%',

  // Test timeout (5 seconds default)
  testTimeout: 5000
};
