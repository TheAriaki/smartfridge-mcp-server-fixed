import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import fetch from 'node-fetch';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

describe('End-to-End Integration Tests', () => {
  let serverProcess: ChildProcess | null = null;
  const testPort = 3002;
  const testDataFile = join(process.cwd(), 'data', 'e2e-test-data.json');

  beforeAll(async () => {
    // Ensure data directory exists
    await execAsync('mkdir -p data');
    
    // Initialize test data file
    const initialData = {
      items: [],
      metadata: {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        totalItems: 0
      }
    };
    writeFileSync(testDataFile, JSON.stringify(initialData, null, 2));

    // Build the project
    await execAsync('npm run build');

    // Start the HTTP server
    serverProcess = spawn('node', ['build/index.js'], {
      env: {
        ...process.env,
        SERVER_MODE: 'http',
        PORT: testPort.toString(),
        DATA_FILE: testDataFile,
        LOG_LEVEL: 'error'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait for server to start
    await waitForServer(`http://localhost:${testPort}/health`, 15000);
  }, 30000);

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise(resolve => {
        if (serverProcess) {
          serverProcess.on('exit', resolve);
          setTimeout(() => {
            if (serverProcess && !serverProcess.killed) {
              serverProcess.kill('SIGKILL');
            }
            resolve(undefined);
          }, 5000);
        } else {
          resolve(undefined);
        }
      });
    }

    // Cleanup test data
    if (existsSync(testDataFile)) {
      try {
        require('fs').unlinkSync(testDataFile);
      } catch (error) {
        console.warn('Failed to cleanup test data file:', error);
      }
    }
  }, 15000);

  const waitForServer = async (url: string, timeout: number): Promise<void> => {
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
  };

  describe('Complete Workflow Tests', () => {
    it('should handle complete food management workflow', async () => {
      // 1. Verify server is healthy
      const healthResponse = await fetch(`http://localhost:${testPort}/health`);
      expect(healthResponse.status).toBe(200);

      // 2. Add multiple food items
      const items = [
        {
          name: 'E2E Test Milk',
          quantity: 2,
          unit: 'liters',
          category: 'dairy',
          expirationDate: '2025-01-15',
          location: 'Main Shelf',
          notes: 'Organic whole milk'
        },
        {
          name: 'E2E Test Bread',
          quantity: 1,
          unit: 'loaf',
          category: 'bakery',
          expirationDate: '2025-01-05',
          location: 'Bread Box'
        },
        {
          name: 'E2E Test Apples',
          quantity: 6,
          unit: 'pieces',
          category: 'fruits',
          expirationDate: '2025-01-20',
          location: 'Crisper Drawer'
        }
      ];

      const addedItems = [];
      for (const item of items) {
        const response = await fetch(`http://localhost:${testPort}/api/tools/addFoodItem`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        });

        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.success).toBe(true);
        addedItems.push(result);
      }

      // 3. List all items
      const listAllResponse = await fetch(`http://localhost:${testPort}/api/tools/listFoodItems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(listAllResponse.status).toBe(200);
      const listAllResult = await listAllResponse.json();
      expect(listAllResult.success).toBe(true);
      expect(listAllResult.result).toContain('Found 3 items');

      // 4. Filter by category
      const filterResponse = await fetch(`http://localhost:${testPort}/api/tools/listFoodItems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'dairy' })
      });

      expect(filterResponse.status).toBe(200);
      const filterResult = await filterResponse.json();
      expect(filterResult.success).toBe(true);
      expect(filterResult.result).toContain('E2E Test Milk');
      expect(filterResult.result).not.toContain('E2E Test Bread');

      // 5. Check expiring items
      const expiringResponse = await fetch(`http://localhost:${testPort}/api/tools/listFoodItems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          showExpiring: true,
          expiringInDays: 30
        })
      });

      expect(expiringResponse.status).toBe(200);
      const expiringResult = await expiringResponse.json();
      expect(expiringResult.success).toBe(true);

      // 6. Sort items by name
      const sortResponse = await fetch(`http://localhost:${testPort}/api/tools/listFoodItems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortBy: 'name' })
      });

      expect(sortResponse.status).toBe(200);
      const sortResult = await sortResponse.json();
      expect(sortResult.success).toBe(true);

      // 7. Verify data persistence
      const dataContent = readFileSync(testDataFile, 'utf-8');
      const data = JSON.parse(dataContent);
      expect(data.items).toHaveLength(3);
      expect(data.metadata.totalItems).toBe(3);

      // 8. Remove an item
      const itemToRemove = data.items.find(item => item.name === 'E2E Test Bread');
      expect(itemToRemove).toBeDefined();

      const removeResponse = await fetch(`http://localhost:${testPort}/api/tools/removeFoodItem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemToRemove.id })
      });

      expect(removeResponse.status).toBe(200);
      const removeResult = await removeResponse.json();
      expect(removeResult.success).toBe(true);

      // 9. Verify removal
      const finalListResponse = await fetch(`http://localhost:${testPort}/api/tools/listFoodItems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(finalListResponse.status).toBe(200);
      const finalListResult = await finalListResponse.json();
      expect(finalListResult.success).toBe(true);
      expect(finalListResult.result).toContain('Found 2 items');
      expect(finalListResult.result).not.toContain('E2E Test Bread');
    });

    it('should handle concurrent requests', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => 
        fetch(`http://localhost:${testPort}/api/tools/addFoodItem`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Concurrent Item ${i}`,
            quantity: 1,
            unit: 'piece'
          })
        })
      );

      const responses = await Promise.all(concurrentRequests);
      
      // All requests should succeed
      for (const response of responses) {
        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.success).toBe(true);
      }

      // Verify all items were added
      const listResponse = await fetch(`http://localhost:${testPort}/api/tools/listFoodItems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const listResult = await listResponse.json();
      expect(listResult.result).toContain('Found 12 items'); // 2 from previous test + 10 concurrent
    });

    it('should handle error recovery', async () => {
      // Try to add an invalid item
      const invalidResponse = await fetch(`http://localhost:${testPort}/api/tools/addFoodItem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Invalid Item',
          quantity: -1 // Invalid quantity
        })
      });

      expect(invalidResponse.status).toBe(400);
      const invalidResult = await invalidResponse.json();
      expect(invalidResult.success).toBe(false);

      // Server should still be functional
      const healthResponse = await fetch(`http://localhost:${testPort}/health`);
      expect(healthResponse.status).toBe(200);

      // Should still be able to add valid items
      const validResponse = await fetch(`http://localhost:${testPort}/api/tools/addFoodItem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Recovery Test Item',
          quantity: 1,
          unit: 'piece'
        })
      });

      expect(validResponse.status).toBe(200);
      const validResult = await validResponse.json();
      expect(validResult.success).toBe(true);
    });
  });

  describe('Resource Management', () => {
    it('should provide data resource', async () => {
      const resourcesResponse = await fetch(`http://localhost:${testPort}/api/resources`);
      expect(resourcesResponse.status).toBe(200);
      
      const resources = await resourcesResponse.json();
      expect(resources.resources).toHaveLength(1);
      expect(resources.resources[0].name).toBe('Smart Fridge Data');
    });

    it('should read resource content', async () => {
      const resourcesResponse = await fetch(`http://localhost:${testPort}/api/resources`);
      const resources = await resourcesResponse.json();
      const resourceUri = resources.resources[0].uri;
      const encodedUri = encodeURIComponent(resourceUri);

      const contentResponse = await fetch(`http://localhost:${testPort}/api/resources/${encodedUri}`);
      expect(contentResponse.status).toBe(200);
      
      const content = await contentResponse.json();
      expect(content.contents).toHaveLength(1);
      expect(content.contents[0].text).toContain('items');
    });
  });

  describe('Server Monitoring', () => {
    it('should provide comprehensive server info', async () => {
      const infoResponse = await fetch(`http://localhost:${testPort}/info`);
      expect(infoResponse.status).toBe(200);
      
      const info = await infoResponse.json();
      expect(info.name).toBe('smartfridge-mcp-server');
      expect(info.version).toBeDefined();
      expect(info.description).toBeDefined();
      expect(info.tools).toHaveLength(3);
      expect(info.resources).toHaveLength(1);
    });

    it('should show ready status', async () => {
      const readyResponse = await fetch(`http://localhost:${testPort}/ready`);
      expect(readyResponse.status).toBe(200);
      
      const ready = await readyResponse.json();
      expect(ready.status).toBe('ready');
      expect(ready.dataFile).toBeDefined();
      expect(ready.itemsCount).toBeGreaterThanOrEqual(0);
    });
  });
});