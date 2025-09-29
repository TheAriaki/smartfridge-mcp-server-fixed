import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import fetch from 'node-fetch';

const execAsync = promisify(exec);

describe('Docker Integration Tests', () => {
  let containerProcess: ChildProcess | null = null;
  let containerId: string | null = null;
  const testPort = 3001;

  beforeAll(async () => {
    // Skip tests if Docker is not available
    try {
      await execAsync('docker --version');
    } catch (error) {
      console.log('Docker not available, skipping Docker integration tests');
      return;
    }

    // Build the Docker image
    console.log('Building Docker image...');
    try {
      await execAsync('docker build -t smartfridge-test .', { 
        cwd: process.cwd(),
        timeout: 120000 // 2 minutes timeout
      });
    } catch (error) {
      console.error('Failed to build Docker image:', error);
      throw error;
    }

    // Start the container
    console.log('Starting Docker container...');
    try {
      const { stdout } = await execAsync(
        `docker run -d -p ${testPort}:3000 -e SERVER_MODE=http smartfridge-test`,
        { timeout: 30000 }
      );
      containerId = stdout.trim();
      console.log(`Container started with ID: ${containerId}`);

      // Wait for the server to be ready
      await waitForServer(`http://localhost:${testPort}/health`, 30000);
    } catch (error) {
      console.error('Failed to start Docker container:', error);
      throw error;
    }
  }, 180000); // 3 minutes timeout for setup

  afterAll(async () => {
    if (containerId) {
      try {
        console.log('Stopping Docker container...');
        await execAsync(`docker stop ${containerId}`);
        await execAsync(`docker rm ${containerId}`);
      } catch (error) {
        console.error('Failed to cleanup Docker container:', error);
      }
    }

    // Clean up test image
    try {
      await execAsync('docker rmi smartfridge-test');
    } catch (error) {
      // Ignore cleanup errors
    }
  }, 60000);

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
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error(`Server not ready within ${timeout}ms`);
  };

  it('should build Docker image successfully', async () => {
    // This test passes if beforeAll completed successfully
    expect(containerId).toBeTruthy();
  });

  it('should respond to health check', async () => {
    if (!containerId) {
      console.log('Skipping test - Docker not available');
      return;
    }

    const response = await fetch(`http://localhost:${testPort}/health`);
    expect(response.status).toBe(200);
    
    const health = await response.json();
    expect(health.status).toBe('healthy');
  });

  it('should have correct server info', async () => {
    if (!containerId) {
      console.log('Skipping test - Docker not available');
      return;
    }

    const response = await fetch(`http://localhost:${testPort}/info`);
    expect(response.status).toBe(200);
    
    const info = await response.json();
    expect(info.name).toBe('smartfridge-mcp-server');
    expect(info.tools).toHaveLength(3);
  });

  it('should handle API requests', async () => {
    if (!containerId) {
      console.log('Skipping test - Docker not available');
      return;
    }

    // Add an item
    const addResponse = await fetch(`http://localhost:${testPort}/api/tools/addFoodItem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Docker Test Item',
        quantity: 1,
        unit: 'piece'
      })
    });

    expect(addResponse.status).toBe(200);
    const addResult = await addResponse.json();
    expect(addResult.success).toBe(true);

    // List items
    const listResponse = await fetch(`http://localhost:${testPort}/api/tools/listFoodItems`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    expect(listResponse.status).toBe(200);
    const listResult = await listResponse.json();
    expect(listResult.success).toBe(true);
    expect(listResult.result).toContain('Docker Test Item');
  });

  it('should persist data in container', async () => {
    if (!containerId) {
      console.log('Skipping test - Docker not available');
      return;
    }

    // Add an item
    await fetch(`http://localhost:${testPort}/api/tools/addFoodItem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Persistence Test Item',
        quantity: 2,
        unit: 'pieces'
      })
    });

    // Restart the container (simulate restart)
    console.log('Restarting container to test persistence...');
    await execAsync(`docker restart ${containerId}`);
    
    // Wait for server to be ready again
    await waitForServer(`http://localhost:${testPort}/health`, 30000);

    // Check if data persisted
    const listResponse = await fetch(`http://localhost:${testPort}/api/tools/listFoodItems`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const listResult = await listResponse.json();
    expect(listResult.success).toBe(true);
    expect(listResult.result).toContain('Persistence Test Item');
  });

  it('should handle container logs', async () => {
    if (!containerId) {
      console.log('Skipping test - Docker not available');
      return;
    }

    const { stdout } = await execAsync(`docker logs ${containerId}`);
    expect(stdout).toContain('Server running'); // Assuming this is logged on startup
  });

  it('should expose correct port', async () => {
    if (!containerId) {
      console.log('Skipping test - Docker not available');
      return;
    }

    const { stdout } = await execAsync(`docker port ${containerId}`);
    expect(stdout).toContain(`3000/tcp -> 0.0.0.0:${testPort}`);
  });

  it('should have correct environment variables', async () => {
    if (!containerId) {
      console.log('Skipping test - Docker not available');
      return;
    }

    const { stdout } = await execAsync(`docker exec ${containerId} env`);
    expect(stdout).toContain('SERVER_MODE=http');
    expect(stdout).toContain('NODE_ENV=production');
  });
});