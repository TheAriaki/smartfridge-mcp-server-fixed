#!/usr/bin/env node

/**
 * SmartFridge MCP Server Deployment Validation Script
 * 
 * This script validates that all components of the SmartFridge MCP server
 * are working correctly in a production-like environment.
 */

import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import fetch from 'node-fetch';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

class DeploymentValidator {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: []
    };
    this.serverProcess = null;
    this.containerId = null;
    this.testPort = process.env.TEST_PORT || 3003;
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      skip: '⏭️'
    }[level] || 'ℹ️';
    
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async test(name, testFn, skip = false) {
    if (skip) {
      this.log(`SKIPPED: ${name}`, 'skip');
      this.results.skipped++;
      this.results.tests.push({ name, status: 'skipped', message: 'Test skipped' });
      return;
    }

    try {
      this.log(`Running: ${name}`);
      const result = await testFn();
      this.log(`PASSED: ${name}`, 'success');
      this.results.passed++;
      this.results.tests.push({ name, status: 'passed', message: result || 'Test passed' });
    } catch (error) {
      this.log(`FAILED: ${name} - ${error.message}`, 'error');
      this.results.failed++;
      this.results.tests.push({ name, status: 'failed', message: error.message });
    }
  }

  async validateEnvironment() {
    await this.test('Node.js version check', async () => {
      const { stdout } = await execAsync('node --version');
      const version = stdout.trim();
      const majorVersion = parseInt(version.replace('v', '').split('.')[0]);
      if (majorVersion < 18) {
        throw new Error(`Node.js ${majorVersion} is not supported. Minimum version is 18.`);
      }
      return `Node.js ${version} is supported`;
    });

    await this.test('NPM availability', async () => {
      await execAsync('npm --version');
      return 'NPM is available';
    });

    await this.test('Docker availability', async () => {
      try {
        await execAsync('docker --version');
        return 'Docker is available';
      } catch (error) {
        throw new Error('Docker is not available or not installed');
      }
    });

    await this.test('Project dependencies', async () => {
      if (!existsSync('package.json')) {
        throw new Error('package.json not found');
      }
      
      if (!existsSync('node_modules')) {
        throw new Error('node_modules not found. Run npm install first.');
      }
      
      return 'Project dependencies are available';
    });
  }

  async validateBuild() {
    await this.test('TypeScript compilation', async () => {
      await execAsync('npm run build');
      
      if (!existsSync('build/index.js')) {
        throw new Error('Build output not found');
      }
      
      return 'TypeScript compilation successful';
    });

    await this.test('Build output validation', async () => {
      const requiredFiles = [
        'build/index.js',
        'build/mcp-server.js',
        'build/http-server.js'
      ];
      
      for (const file of requiredFiles) {
        if (!existsSync(file)) {
          throw new Error(`Required build file missing: ${file}`);
        }
      }
      
      return 'All required build files are present';
    });
  }

  async validateMcpServer() {
    await this.test('MCP server standalone mode', async () => {
      // Start MCP server in standalone mode and test it
      const process = spawn('node', ['build/index.js'], {
        env: { ...process.env, SERVER_MODE: 'mcp' },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      return new Promise((resolve, reject) => {
        let output = '';
        
        process.stdout.on('data', (data) => {
          output += data.toString();
        });

        process.stderr.on('data', (data) => {
          output += data.toString();
        });

        setTimeout(() => {
          process.kill('SIGTERM');
          
          if (output.includes('MCP server running') || output.includes('stdio')) {
            resolve('MCP server starts correctly in standalone mode');
          } else {
            reject(new Error(`MCP server failed to start: ${output}`));
          }
        }, 3000);
      });
    });
  }

  async validateHttpServer() {
    await this.test('HTTP server startup', async () => {
      this.serverProcess = spawn('node', ['build/index.js'], {
        env: {
          ...process.env,
          SERVER_MODE: 'http',
          PORT: this.testPort.toString(),
          LOG_LEVEL: 'error'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Wait for server to start
      await this.waitForServer(`http://localhost:${this.testPort}/health`, 10000);
      return 'HTTP server started successfully';
    });

    await this.test('Health endpoint', async () => {
      const response = await fetch(`http://localhost:${this.testPort}/health`);
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
      
      const health = await response.json();
      if (health.status !== 'healthy') {
        throw new Error('Server reports unhealthy status');
      }
      
      return 'Health endpoint working correctly';
    });

    await this.test('Server info endpoint', async () => {
      const response = await fetch(`http://localhost:${this.testPort}/info`);
      if (!response.ok) {
        throw new Error(`Info endpoint failed: ${response.status}`);
      }
      
      const info = await response.json();
      if (!info.name || !info.version || !info.tools) {
        throw new Error('Server info incomplete');
      }
      
      if (info.tools.length !== 3) {
        throw new Error(`Expected 3 tools, got ${info.tools.length}`);
      }
      
      return 'Server info endpoint working correctly';
    });

    await this.test('API endpoints functionality', async () => {
      // Test add item
      const addResponse = await fetch(`http://localhost:${this.testPort}/api/tools/addFoodItem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Validation Test Item',
          quantity: 1,
          unit: 'piece'
        })
      });

      if (!addResponse.ok) {
        throw new Error(`Add item failed: ${addResponse.status}`);
      }

      const addResult = await addResponse.json();
      if (!addResult.success) {
        throw new Error('Add item returned success: false');
      }

      // Test list items
      const listResponse = await fetch(`http://localhost:${this.testPort}/api/tools/listFoodItems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (!listResponse.ok) {
        throw new Error(`List items failed: ${listResponse.status}`);
      }

      const listResult = await listResponse.json();
      if (!listResult.success || !listResult.result.includes('Validation Test Item')) {
        throw new Error('List items did not return added item');
      }

      return 'API endpoints working correctly';
    });
  }

  async validateDockerDeployment() {
    const dockerAvailable = await this.checkDockerAvailability();
    
    await this.test('Docker image build', async () => {
      await execAsync('docker build -t smartfridge-validation .', { timeout: 120000 });
      return 'Docker image built successfully';
    }, !dockerAvailable);

    await this.test('Docker container deployment', async () => {
      const { stdout } = await execAsync(
        `docker run -d -p ${parseInt(this.testPort) + 1}:3000 -e SERVER_MODE=http smartfridge-validation`
      );
      
      this.containerId = stdout.trim();
      
      // Wait for container to be ready
      await this.waitForServer(`http://localhost:${parseInt(this.testPort) + 1}/health`, 15000);
      
      return 'Docker container deployed and accessible';
    }, !dockerAvailable);

    await this.test('Docker container functionality', async () => {
      const port = parseInt(this.testPort) + 1;
      
      // Test container health
      const healthResponse = await fetch(`http://localhost:${port}/health`);
      if (!healthResponse.ok) {
        throw new Error('Container health check failed');
      }

      // Test container API
      const addResponse = await fetch(`http://localhost:${port}/api/tools/addFoodItem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Docker Test Item',
          quantity: 1,
          unit: 'piece'
        })
      });

      if (!addResponse.ok) {
        throw new Error('Container API test failed');
      }

      return 'Docker container functionality verified';
    }, !dockerAvailable);
  }

  async validateDataPersistence() {
    await this.test('Data file creation and persistence', async () => {
      const testDataFile = 'data/validation-test.json';
      
      // The server should have created a data file
      if (!existsSync('data')) {
        throw new Error('Data directory not created');
      }

      // Test data persistence by adding an item and checking the file
      const addResponse = await fetch(`http://localhost:${this.testPort}/api/tools/addFoodItem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Persistence Test Item',
          quantity: 1,
          unit: 'piece'
        })
      });

      if (!addResponse.ok) {
        throw new Error('Failed to add item for persistence test');
      }

      // Check if data was written to file
      const defaultDataFile = process.env.DATA_FILE || 'data/fridge-data.json';
      if (existsSync(defaultDataFile)) {
        const data = JSON.parse(readFileSync(defaultDataFile, 'utf-8'));
        if (!data.items || data.items.length === 0) {
          throw new Error('Data not persisted to file');
        }
      }

      return 'Data persistence working correctly';
    });
  }

  async checkDockerAvailability() {
    try {
      await execAsync('docker --version');
      return true;
    } catch (error) {
      return false;
    }
  }

  async waitForServer(url, timeout) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          return;
        }
      } catch (error) {
        // Server not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error(`Server not ready within ${timeout}ms`);
  }

  async cleanup() {
    this.log('Cleaning up test resources...');
    
    // Stop HTTP server
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
    }

    // Stop and remove Docker container
    if (this.containerId) {
      try {
        await execAsync(`docker stop ${this.containerId}`);
        await execAsync(`docker rm ${this.containerId}`);
        await execAsync('docker rmi smartfridge-validation');
      } catch (error) {
        this.log(`Cleanup warning: ${error.message}`, 'warning');
      }
    }
  }

  async run() {
    this.log('Starting SmartFridge MCP Server deployment validation...');
    
    try {
      await this.validateEnvironment();
      await this.validateBuild();
      await this.validateMcpServer();
      await this.validateHttpServer();
      await this.validateDataPersistence();
      await this.validateDockerDeployment();
    } catch (error) {
      this.log(`Validation interrupted: ${error.message}`, 'error');
    } finally {
      await this.cleanup();
    }

    // Print summary
    this.log('\\n=== VALIDATION SUMMARY ===');
    this.log(`✅ Passed: ${this.results.passed}`);
    this.log(`❌ Failed: ${this.results.failed}`);
    this.log(`⏭️ Skipped: ${this.results.skipped}`);
    this.log(`📊 Total: ${this.results.tests.length}`);

    // Print detailed results
    if (this.results.failed > 0) {
      this.log('\\n=== FAILED TESTS ===');
      this.results.tests
        .filter(test => test.status === 'failed')
        .forEach(test => {
          this.log(`❌ ${test.name}: ${test.message}`, 'error');
        });
    }

    // Save results to file
    const reportFile = 'deployment-validation-report.json';
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        passed: this.results.passed,
        failed: this.results.failed,
        skipped: this.results.skipped,
        total: this.results.tests.length
      },
      tests: this.results.tests,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };

    writeFileSync(reportFile, JSON.stringify(report, null, 2));
    this.log(`Detailed report saved to ${reportFile}`);

    // Exit with appropriate code
    process.exit(this.results.failed > 0 ? 1 : 0);
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new DeploymentValidator();
  validator.run().catch(console.error);
}

export { DeploymentValidator };