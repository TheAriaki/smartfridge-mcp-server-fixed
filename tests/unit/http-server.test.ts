import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import { Application } from 'express';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createHttpServer } from '../../src/http-server.js';

describe('HTTP Server', () => {
  let app: Application;
  let testDataFile: string;

  beforeEach(() => {
    // Create a unique test data file for each test
    testDataFile = join(process.cwd(), 'data', `test-http-${Date.now()}.json`);
    process.env.DATA_FILE = testDataFile;
    
    // Initialize with empty data
    const initialData = {
      items: [],
      metadata: {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        totalItems: 0
      }
    };
    writeFileSync(testDataFile, JSON.stringify(initialData, null, 2));
    
    app = createHttpServer();
  });

  afterEach(() => {
    global.testUtils.cleanupTestData(testDataFile);
  });

  describe('Health Check Endpoints', () => {
    it('should respond to health check', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        version: '1.0.0'
      });
    });

    it('should provide server info', async () => {
      const response = await request(app)
        .get('/info')
        .expect(200);

      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('description');
      expect(response.body.tools).toHaveLength(3);
    });

    it('should respond to ready check', async () => {
      const response = await request(app)
        .get('/ready')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ready',
        dataFile: expect.stringContaining('test-http-'),
        itemsCount: 0
      });
    });
  });

  describe('CORS and Security Headers', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should handle preflight requests', async () => {
      await request(app)
        .options('/api/tools/addFoodItem')
        .expect(200);
    });

    it('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
    });
  });

  describe('Tool Endpoints', () => {
    describe('GET /api/tools', () => {
      it('should list all available tools', async () => {
        const response = await request(app)
          .get('/api/tools')
          .expect(200);

        expect(response.body.tools).toHaveLength(3);
        expect(response.body.tools.map(t => t.name)).toEqual(
          expect.arrayContaining(['addFoodItem', 'removeFoodItem', 'listFoodItems'])
        );
      });
    });

    describe('POST /api/tools/addFoodItem', () => {
      it('should add a new food item', async () => {
        const newItem = {
          name: 'HTTP Test Banana',
          quantity: 3,
          unit: 'pieces',
          category: 'fruits',
          expirationDate: '2025-01-20',
          location: 'Counter',
          notes: 'Yellow bananas'
        };

        const response = await request(app)
          .post('/api/tools/addFoodItem')
          .send(newItem)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.result).toContain('Successfully added');

        // Verify data was saved
        const data = JSON.parse(readFileSync(testDataFile, 'utf-8'));
        expect(data.items).toHaveLength(1);
        expect(data.items[0].name).toBe('HTTP Test Banana');
      });

      it('should handle invalid data', async () => {
        const invalidItem = {
          name: 'Test Item',
          quantity: -1 // Invalid quantity
        };

        const response = await request(app)
          .post('/api/tools/addFoodItem')
          .send(invalidItem)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Quantity must be positive');
      });

      it('should handle missing required fields', async () => {
        const incompleteItem = {
          name: 'Test Item'
          // Missing required fields
        };

        const response = await request(app)
          .post('/api/tools/addFoodItem')
          .send(incompleteItem)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Missing required fields');
      });
    });

    describe('POST /api/tools/listFoodItems', () => {
      beforeEach(async () => {
        // Add test data
        await request(app)
          .post('/api/tools/addFoodItem')
          .send({
            name: 'HTTP Test Milk',
            quantity: 1,
            unit: 'liter',
            category: 'dairy',
            expirationDate: '2025-01-15'
          });

        await request(app)
          .post('/api/tools/addFoodItem')
          .send({
            name: 'HTTP Test Bread',
            quantity: 1,
            unit: 'loaf',
            category: 'bakery',
            expirationDate: '2025-01-10'
          });
      });

      it('should list all items', async () => {
        const response = await request(app)
          .post('/api/tools/listFoodItems')
          .send({})
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.result).toContain('Found 2 items');
        expect(response.body.result).toContain('HTTP Test Milk');
        expect(response.body.result).toContain('HTTP Test Bread');
      });

      it('should filter by category', async () => {
        const response = await request(app)
          .post('/api/tools/listFoodItems')
          .send({ category: 'dairy' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.result).toContain('Found 1 items');
        expect(response.body.result).toContain('HTTP Test Milk');
        expect(response.body.result).not.toContain('HTTP Test Bread');
      });

      it('should sort items', async () => {
        const response = await request(app)
          .post('/api/tools/listFoodItems')
          .send({ sortBy: 'name' })
          .expect(200);

        expect(response.body.success).toBe(true);
        const result = response.body.result;
        const milkIndex = result.indexOf('HTTP Test Milk');
        const breadIndex = result.indexOf('HTTP Test Bread');
        expect(breadIndex).toBeLessThan(milkIndex);
      });
    });

    describe('POST /api/tools/removeFoodItem', () => {
      let itemId: string;

      beforeEach(async () => {
        // Add an item to remove
        await request(app)
          .post('/api/tools/addFoodItem')
          .send({
            name: 'HTTP Item to Remove',
            quantity: 1,
            unit: 'piece'
          });

        // Get the item ID
        const data = JSON.parse(readFileSync(testDataFile, 'utf-8'));
        itemId = data.items[0].id;
      });

      it('should remove an existing item', async () => {
        const response = await request(app)
          .post('/api/tools/removeFoodItem')
          .send({ id: itemId })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.result).toContain('Successfully removed');

        // Verify item was removed
        const data = JSON.parse(readFileSync(testDataFile, 'utf-8'));
        expect(data.items).toHaveLength(0);
      });

      it('should handle non-existent item', async () => {
        const response = await request(app)
          .post('/api/tools/removeFoodItem')
          .send({ id: 'non-existent-id' })
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Item not found');
      });

      it('should handle missing ID', async () => {
        const response = await request(app)
          .post('/api/tools/removeFoodItem')
          .send({})
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Item ID is required');
      });
    });
  });

  describe('Resource Endpoints', () => {
    beforeEach(async () => {
      // Add some test data
      await request(app)
        .post('/api/tools/addFoodItem')
        .send({
          name: 'Resource Test Item',
          quantity: 1,
          unit: 'piece',
          category: 'test'
        });
    });

    it('should list available resources', async () => {
      const response = await request(app)
        .get('/api/resources')
        .expect(200);

      expect(response.body.resources).toHaveLength(1);
      expect(response.body.resources[0].name).toBe('Smart Fridge Data');
    });

    it('should read resource content', async () => {
      const resourcesResponse = await request(app)
        .get('/api/resources')
        .expect(200);

      const resourceUri = resourcesResponse.body.resources[0].uri;
      const encodedUri = encodeURIComponent(resourceUri);

      const response = await request(app)
        .get(`/api/resources/${encodedUri}`)
        .expect(200);

      expect(response.body.contents).toHaveLength(1);
      expect(response.body.contents[0].text).toContain('Resource Test Item');
    });

    it('should handle invalid resource URI', async () => {
      const response = await request(app)
        .get('/api/resources/invalid-uri')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Resource not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown tool calls', async () => {
      const response = await request(app)
        .post('/api/tools/unknownTool')
        .send({})
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Tool not found');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/tools/addFoodItem')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle 404 for unknown endpoints', async () => {
      const response = await request(app)
        .get('/api/unknown')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Content-Type Handling', () => {
    it('should accept application/json', async () => {
      const response = await request(app)
        .post('/api/tools/listFoodItems')
        .set('Content-Type', 'application/json')
        .send('{}')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject unsupported content types', async () => {
      const response = await request(app)
        .post('/api/tools/listFoodItems')
        .set('Content-Type', 'text/plain')
        .send('test')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});