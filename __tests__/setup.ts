// Test setup file
// Add any global test configuration here

/* global jest */

// Increase timeout for tests that involve file operations
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};
