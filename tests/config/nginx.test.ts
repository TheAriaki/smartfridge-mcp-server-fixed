import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import fetch from 'node-fetch';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

describe('Nginx Configuration Tests', () => {
  let serverProcess: ChildProcess | null = null;
  let nginxProcess: ChildProcess | null = null;
  const testPort = 3004;
  const nginxPort = 8080;

  beforeAll(async () => {
    // Check if nginx is available
    try {
      await execAsync('nginx -v');
    } catch (error) {
      console.log('Nginx not available, skipping nginx tests');
      return;
    }

    // Start the SmartFridge server
    serverProcess = spawn('node', ['build/index.js'], {
      env: {
        ...process.env,
        SERVER_MODE: 'http',
        PORT: testPort.toString(),
        LOG_LEVEL: 'error'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait for server to start
    await waitForServer(`http://localhost:${testPort}/health`, 10000);

    // Create nginx test config
    const nginxConfig = `
events {
    worker_connections 1024;
}

http {
    upstream smartfridge_backend {
        server 127.0.0.1:${testPort};
        keepalive 64;
    }

    limit_req_zone \\$binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone \\$binary_remote_addr zone=health:10m rate=1r/s;

    server {
        listen ${nginxPort};
        server_name localhost;

        add_header X-Frame-Options DENY always;
        add_header X-Content-Type-Options nosniff always;
        add_header X-XSS-Protection "1; mode=block" always;

        location = /health {
            limit_req zone=health burst=5 nodelay;
            proxy_pass http://smartfridge_backend;
            proxy_set_header Host \\$host;
            proxy_set_header X-Real-IP \\$remote_addr;
            proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \\$scheme;
        }

        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://smartfridge_backend;
            proxy_set_header Host \\$host;
            proxy_set_header X-Real-IP \\$remote_addr;
            proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \\$scheme;

            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization" always;

            if (\\$request_method = 'OPTIONS') {
                add_header Access-Control-Allow-Origin "*";
                add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
                add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization";
                add_header Access-Control-Max-Age 86400;
                add_header Content-Length 0;
                add_header Content-Type text/plain;
                return 204;
            }
        }

        location ~ ^/(info|ready)\\$ {
            limit_req zone=health burst=10 nodelay;
            proxy_pass http://smartfridge_backend;
            proxy_set_header Host \\$host;
            proxy_set_header X-Real-IP \\$remote_addr;
            proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \\$scheme;
        }

        location / {
            return 302 /health;
        }
    }
}`;

    require('fs').writeFileSync('/tmp/nginx-test.conf', nginxConfig);

    // Start nginx with test config
    nginxProcess = spawn('nginx', ['-c', '/tmp/nginx-test.conf', '-g', 'daemon off;'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait for nginx to start
    await waitForServer(`http://localhost:${nginxPort}/health`, 10000);
  }, 30000);

  afterAll(async () => {
    if (nginxProcess) {
      nginxProcess.kill('SIGTERM');
    }
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }

    // Cleanup test config
    try {
      require('fs').unlinkSync('/tmp/nginx-test.conf');
    } catch (error) {
      // Ignore cleanup errors
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

  const isNginxAvailable = async (): Promise<boolean> => {
    try {
      await execAsync('nginx -v');
      return true;
    } catch (error) {
      return false;
    }
  };

  describe('Nginx Configuration Validation', () => {
    it('should validate nginx config syntax', async () => {
      const available = await isNginxAvailable();
      if (!available) {
        console.log('Skipping test - Nginx not available');
        return;
      }

      // Test the main nginx config file
      const configPath = join(process.cwd(), 'nginx', 'smartfridge.conf');
      if (!existsSync(configPath)) {
        throw new Error('Nginx configuration file not found');
      }

      // Create a temporary nginx.conf that includes our config
      const tempConfig = `
events {
    worker_connections 1024;
}

http {
    include ${configPath};
}`;

      require('fs').writeFileSync('/tmp/nginx-syntax-test.conf', tempConfig);

      try {
        await execAsync('nginx -t -c /tmp/nginx-syntax-test.conf');
      } catch (error) {
        throw new Error(`Nginx configuration syntax error: ${error.message}`);
      } finally {
        try {
          require('fs').unlinkSync('/tmp/nginx-syntax-test.conf');
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe('Nginx Proxy Functionality', () => {
    it('should proxy health check requests', async () => {
      const available = await isNginxAvailable();
      if (!available) {
        console.log('Skipping test - Nginx not available');
        return;
      }

      const response = await fetch(`http://localhost:${nginxPort}/health`);
      expect(response.status).toBe(200);

      const health = await response.json();
      expect(health.status).toBe('healthy');
    });

    it('should proxy API requests', async () => {
      const available = await isNginxAvailable();
      if (!available) {
        console.log('Skipping test - Nginx not available');
        return;
      }

      // Test adding an item through nginx
      const addResponse = await fetch(`http://localhost:${nginxPort}/api/tools/addFoodItem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Nginx Test Item',
          quantity: 1,
          unit: 'piece'
        })
      });

      expect(addResponse.status).toBe(200);
      const addResult = await addResponse.json();
      expect(addResult.success).toBe(true);
    });

    it('should include security headers', async () => {
      const available = await isNginxAvailable();
      if (!available) {
        console.log('Skipping test - Nginx not available');
        return;
      }

      const response = await fetch(`http://localhost:${nginxPort}/health`);
      expect(response.status).toBe(200);

      expect(response.headers.get('x-frame-options')).toBe('DENY');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('x-xss-protection')).toBe('1; mode=block');
    });

    it('should handle CORS for API endpoints', async () => {
      const available = await isNginxAvailable();
      if (!available) {
        console.log('Skipping test - Nginx not available');
        return;
      }

      // Test OPTIONS request
      const optionsResponse = await fetch(`http://localhost:${nginxPort}/api/tools/listFoodItems`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });

      expect(optionsResponse.status).toBe(204);
      expect(optionsResponse.headers.get('access-control-allow-origin')).toBe('*');
      expect(optionsResponse.headers.get('access-control-allow-methods')).toContain('POST');
    });

    it('should redirect root to health check', async () => {
      const available = await isNginxAvailable();
      if (!available) {
        console.log('Skipping test - Nginx not available');
        return;
      }

      const response = await fetch(`http://localhost:${nginxPort}/`, {
        redirect: 'manual'
      });

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/health');
    });
  });

  describe('Nginx Rate Limiting', () => {
    it('should apply rate limiting to API endpoints', async () => {
      const available = await isNginxAvailable();
      if (!available) {
        console.log('Skipping test - Nginx not available');
        return;
      }

      // Make rapid requests to test rate limiting
      const requests = Array.from({ length: 30 }, () =>
        fetch(`http://localhost:${nginxPort}/api/tools/listFoodItems`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      );

      const responses = await Promise.allSettled(requests);
      const rateLimitedResponses = responses.filter(
        result => result.status === 'fulfilled' && result.value.status === 429
      );

      // Should have some rate limited responses
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Nginx Error Handling', () => {
    it('should handle upstream server errors gracefully', async () => {
      const available = await isNginxAvailable();
      if (!available) {
        console.log('Skipping test - Nginx not available');
        return;
      }

      // Stop the backend server
      if (serverProcess) {
        serverProcess.kill('SIGTERM');
        serverProcess = null;
      }

      // Wait a moment for the server to stop
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        const response = await fetch(`http://localhost:${nginxPort}/health`);
        // Should get a 502 Bad Gateway or similar error
        expect([502, 503, 504]).toContain(response.status);
      } catch (error) {
        // Connection errors are also acceptable
        expect(error.message).toContain('ECONNREFUSED');
      }
    });
  });
});