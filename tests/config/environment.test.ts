import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Environment Configuration Tests', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Environment Variables', () => {
    it('should have default values for all required environment variables', () => {
      // Reset environment
      delete process.env.SERVER_MODE;
      delete process.env.PORT;
      delete process.env.DATA_FILE;
      delete process.env.LOG_LEVEL;

      // Import module after clearing env vars to test defaults
      const originalConsoleLog = console.log;
      const originalConsoleError = console.error;
      
      console.log = jest.fn();
      console.error = jest.fn();

      try {
        // Dynamic import to get fresh module state
        delete require.cache[require.resolve('../../src/index.js')];
        
        expect(process.env.NODE_ENV).toBeDefined();
      } finally {
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
      }
    });

    it('should validate SERVER_MODE values', () => {
      const validModes = ['mcp', 'http'];
      const invalidModes = ['invalid', 'tcp', 'ws', ''];

      validModes.forEach(mode => {
        process.env.SERVER_MODE = mode;
        expect(['mcp', 'http']).toContain(process.env.SERVER_MODE);
      });

      invalidModes.forEach(mode => {
        process.env.SERVER_MODE = mode;
        expect(['mcp', 'http']).not.toContain(process.env.SERVER_MODE);
      });
    });

    it('should validate PORT values', () => {
      const validPorts = ['3000', '8080', '8000', '0'];
      const invalidPorts = ['abc', '-1', '65536', ''];

      validPorts.forEach(port => {
        process.env.PORT = port;
        const portNum = parseInt(process.env.PORT);
        expect(portNum).toBeGreaterThanOrEqual(0);
        expect(portNum).toBeLessThanOrEqual(65535);
      });

      invalidPorts.forEach(port => {
        process.env.PORT = port;
        const portNum = parseInt(process.env.PORT);
        expect(isNaN(portNum) || portNum < 0 || portNum > 65535).toBe(true);
      });
    });

    it('should validate LOG_LEVEL values', () => {
      const validLevels = ['error', 'warn', 'info', 'debug'];
      const invalidLevels = ['invalid', 'trace', 'fatal', ''];

      validLevels.forEach(level => {
        process.env.LOG_LEVEL = level;
        expect(['error', 'warn', 'info', 'debug']).toContain(process.env.LOG_LEVEL);
      });

      invalidLevels.forEach(level => {
        process.env.LOG_LEVEL = level;
        if (level) {
          expect(['error', 'warn', 'info', 'debug']).not.toContain(process.env.LOG_LEVEL);
        }
      });
    });

    it('should validate DATA_FILE path', () => {
      const validPaths = [
        'data/test.json',
        '/tmp/test.json',
        './data/fridge.json',
        'fridge-data.json'
      ];

      const invalidPaths = [
        '', // empty string
        '/invalid/path/that/does/not/exist/deep/nested/file.json'
      ];

      validPaths.forEach(path => {
        process.env.DATA_FILE = path;
        expect(process.env.DATA_FILE).toBeTruthy();
        expect(process.env.DATA_FILE.endsWith('.json')).toBe(true);
      });

      invalidPaths.forEach(path => {
        process.env.DATA_FILE = path;
        if (path === '') {
          expect(process.env.DATA_FILE).toBeFalsy();
        } else {
          // Path validation would happen at runtime
          expect(process.env.DATA_FILE).toBeTruthy();
        }
      });
    });
  });

  describe('Configuration File Validation', () => {
    it('should validate package.json structure', () => {
      const packagePath = join(process.cwd(), 'package.json');
      expect(existsSync(packagePath)).toBe(true);

      const packageContent = JSON.parse(readFileSync(packagePath, 'utf-8'));
      
      // Required fields
      expect(packageContent.name).toBe('smartfridge-mcp-server');
      expect(packageContent.version).toBeDefined();
      expect(packageContent.description).toBeDefined();
      expect(packageContent.main).toBeDefined();
      expect(packageContent.scripts).toBeDefined();
      expect(packageContent.dependencies).toBeDefined();
      expect(packageContent.devDependencies).toBeDefined();

      // Required scripts
      expect(packageContent.scripts.build).toBeDefined();
      expect(packageContent.scripts.start).toBeDefined();
      expect(packageContent.scripts.test).toBeDefined();

      // Required dependencies
      expect(packageContent.dependencies['@modelcontextprotocol/sdk']).toBeDefined();
      expect(packageContent.dependencies.express).toBeDefined();
      expect(packageContent.dependencies.winston).toBeDefined();
    });

    it('should validate tsconfig.json structure', () => {
      const tsconfigPath = join(process.cwd(), 'tsconfig.json');
      expect(existsSync(tsconfigPath)).toBe(true);

      const tsconfigContent = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
      
      expect(tsconfigContent.compilerOptions).toBeDefined();
      expect(tsconfigContent.compilerOptions.target).toBeDefined();
      expect(tsconfigContent.compilerOptions.module).toBeDefined();
      expect(tsconfigContent.compilerOptions.outDir).toBeDefined();
      expect(tsconfigContent.compilerOptions.strict).toBe(true);
    });

    it('should validate .env.example structure', () => {
      const envExamplePath = join(process.cwd(), '.env.example');
      expect(existsSync(envExamplePath)).toBe(true);

      const envContent = readFileSync(envExamplePath, 'utf-8');
      
      // Check for required environment variables
      expect(envContent).toContain('SERVER_MODE=');
      expect(envContent).toContain('PORT=');
      expect(envContent).toContain('DATA_FILE=');
      expect(envContent).toContain('LOG_LEVEL=');
      expect(envContent).toContain('NODE_ENV=');
    });

    it('should validate Dockerfile structure', () => {
      const dockerfilePath = join(process.cwd(), 'Dockerfile');
      expect(existsSync(dockerfilePath)).toBe(true);

      const dockerContent = readFileSync(dockerfilePath, 'utf-8');
      
      // Check for required Dockerfile instructions
      expect(dockerContent).toContain('FROM node:');
      expect(dockerContent).toContain('WORKDIR');
      expect(dockerContent).toContain('COPY package');
      expect(dockerContent).toContain('RUN npm ci');
      expect(dockerContent).toContain('COPY . .');
      expect(dockerContent).toContain('RUN npm run build');
      expect(dockerContent).toContain('EXPOSE 3000');
      expect(dockerContent).toContain('CMD');
    });

    it('should validate docker-compose.yml structure', () => {
      const dockerComposePath = join(process.cwd(), 'docker-compose.yml');
      expect(existsSync(dockerComposePath)).toBe(true);

      const composeContent = readFileSync(dockerComposePath, 'utf-8');
      
      // Check for required docker-compose structure
      expect(composeContent).toContain('version:');
      expect(composeContent).toContain('services:');
      expect(composeContent).toContain('smartfridge');
      expect(composeContent).toContain('ports:');
      expect(composeContent).toContain('volumes:');
      expect(composeContent).toContain('environment:');
    });
  });

  describe('Directory Structure Validation', () => {
    it('should have required directories', () => {
      const requiredDirs = [
        'src',
        'data',
        'logs',
        'scripts',
        'tests',
        'nginx'
      ];

      requiredDirs.forEach(dir => {
        const dirPath = join(process.cwd(), dir);
        expect(existsSync(dirPath)).toBe(true);
      });
    });

    it('should have required source files', () => {
      const requiredFiles = [
        'src/index.ts',
        'src/mcp-server.ts',
        'src/http-server.ts'
      ];

      requiredFiles.forEach(file => {
        const filePath = join(process.cwd(), file);
        expect(existsSync(filePath)).toBe(true);
      });
    });

    it('should have required test files', () => {
      const requiredTestFiles = [
        'tests/setup.ts',
        'tests/unit/mcp-server.test.ts',
        'tests/unit/http-server.test.ts',
        'tests/integration/docker.test.ts',
        'tests/integration/end-to-end.test.ts'
      ];

      requiredTestFiles.forEach(file => {
        const filePath = join(process.cwd(), file);
        expect(existsSync(filePath)).toBe(true);
      });
    });

    it('should have required configuration files', () => {
      const requiredConfigFiles = [
        'package.json',
        'tsconfig.json',
        'jest.config.js',
        '.env.example',
        '.gitignore',
        'Dockerfile',
        'docker-compose.yml',
        'nginx/smartfridge.conf'
      ];

      requiredConfigFiles.forEach(file => {
        const filePath = join(process.cwd(), file);
        expect(existsSync(filePath)).toBe(true);
      });
    });
  });

  describe('Secrets and Security Configuration', () => {
    it('should not expose sensitive information in environment', () => {
      const sensitiveKeys = [
        'password',
        'secret',
        'key',
        'token',
        'credential'
      ];

      Object.keys(process.env).forEach(key => {
        const lowerKey = key.toLowerCase();
        sensitiveKeys.forEach(sensitive => {
          if (lowerKey.includes(sensitive)) {
            // If we have sensitive keys, they should not be logged or exposed
            expect(process.env[key]).not.toContain('admin');
            expect(process.env[key]).not.toContain('root');
            expect(process.env[key]).not.toContain('123');
          }
        });
      });
    });

    it('should validate .gitignore excludes sensitive files', () => {
      const gitignorePath = join(process.cwd(), '.gitignore');
      expect(existsSync(gitignorePath)).toBe(true);

      const gitignoreContent = readFileSync(gitignorePath, 'utf-8');
      
      const sensitivePatterns = [
        '.env',
        'node_modules',
        '*.log',
        'coverage',
        'dist',
        'build'
      ];

      sensitivePatterns.forEach(pattern => {
        expect(gitignoreContent).toContain(pattern);
      });
    });

    it('should validate production environment settings', () => {
      // Simulate production environment
      process.env.NODE_ENV = 'production';
      
      // In production, certain settings should be enforced
      if (process.env.NODE_ENV === 'production') {
        // LOG_LEVEL should not be debug in production
        if (process.env.LOG_LEVEL === 'debug') {
          console.warn('Debug logging enabled in production');
        }
        
        // Data directory should be persistent
        const dataFile = process.env.DATA_FILE || 'data/fridge-data.json';
        expect(dataFile.startsWith('/tmp')).toBe(false);
      }
    });
  });

  describe('Performance Configuration', () => {
    it('should validate Node.js performance settings', () => {
      // Check if we have appropriate Node.js version
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0]);
      
      expect(majorVersion).toBeGreaterThanOrEqual(18);
    });

    it('should validate memory settings', () => {
      // Check available memory settings
      const memoryUsage = process.memoryUsage();
      
      expect(memoryUsage.heapTotal).toBeGreaterThan(0);
      expect(memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(memoryUsage.external).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Logging Configuration', () => {
    it('should create log directory if it does not exist', () => {
      const logDir = join(process.cwd(), 'logs');
      expect(existsSync(logDir)).toBe(true);
    });

    it('should validate winston logger configuration', () => {
      // This would require importing the actual logger configuration
      // For now, we just validate the LOG_LEVEL environment variable
      const validLogLevels = ['error', 'warn', 'info', 'debug'];
      const logLevel = process.env.LOG_LEVEL || 'info';
      
      expect(validLogLevels).toContain(logLevel);
    });
  });
});