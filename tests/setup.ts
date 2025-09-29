import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Global test setup
beforeAll(() => {
  // Ensure test directories exist
  const testDirs = ['data', 'logs', 'tests/fixtures'];
  testDirs.forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATA_FILE = 'data/fridge-data-test.json';
  process.env.PORT = '0'; // Use random port for testing
  process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
});

afterAll(() => {
  // Clean up test files if needed
  // Note: We keep test data for inspection in CI/debugging
});

// Mock console methods if needed for cleaner test output
const originalConsole = { ...console };

beforeEach(() => {
  // Reset any global state before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Restore console if it was mocked
  Object.assign(console, originalConsole);
});

// Global test utilities
declare global {
  namespace NodeJS {
    interface Global {
      testUtils: {
        createTestDataFile: (data: any) => string;
        cleanupTestData: (filePath: string) => void;
        waitForCondition: (condition: () => boolean, timeout?: number) => Promise<void>;
      };
    }
  }
}

global.testUtils = {
  createTestDataFile: (data: any): string => {
    const testDataPath = join(process.cwd(), 'data', `test-${Date.now()}.json`);
    writeFileSync(testDataPath, JSON.stringify(data, null, 2));
    return testDataPath;
  },

  cleanupTestData: (filePath: string): void => {
    if (existsSync(filePath)) {
      try {
        require('fs').unlinkSync(filePath);
      } catch (error) {
        console.warn(`Failed to cleanup test file ${filePath}:`, error);
      }
    }
  },

  waitForCondition: async (condition: () => boolean, timeout = 5000): Promise<void> => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  }
};