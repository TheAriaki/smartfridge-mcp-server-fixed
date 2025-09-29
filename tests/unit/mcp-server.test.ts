import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { SmartFridgeServer } from '../../src/mcp-server.js';

describe('SmartFridge MCP Server', () => {
  let server: SmartFridgeServer;
  let testDataFile: string;

  beforeEach(() => {
    // Create a unique test data file for each test
    testDataFile = join(process.cwd(), 'data', `test-${Date.now()}.json`);
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
    
    server = new SmartFridgeServer();
  });

  afterEach(() => {
    global.testUtils.cleanupTestData(testDataFile);
  });

  describe('Tool Definitions', () => {
    it('should provide all required MCP tools', async () => {
      const tools = await server.getTools();
      
      expect(tools).toHaveLength(3);
      
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('addFoodItem');
      expect(toolNames).toContain('removeFoodItem');
      expect(toolNames).toContain('listFoodItems');
    });

    it('should have correct tool schemas', async () => {
      const tools = await server.getTools();
      
      const addTool = tools.find(t => t.name === 'addFoodItem');
      expect(addTool).toBeDefined();
      expect(addTool?.inputSchema).toHaveProperty('properties');
      expect(addTool?.inputSchema.properties).toHaveProperty('name');
      expect(addTool?.inputSchema.properties).toHaveProperty('quantity');
      expect(addTool?.inputSchema.properties).toHaveProperty('unit');
      
      const removeTool = tools.find(t => t.name === 'removeFoodItem');
      expect(removeTool).toBeDefined();
      expect(removeTool?.inputSchema.properties).toHaveProperty('id');
      
      const listTool = tools.find(t => t.name === 'listFoodItems');
      expect(listTool).toBeDefined();
    });
  });

  describe('addFoodItem Tool', () => {
    it('should add a new food item successfully', async () => {
      const result = await server.callTool('addFoodItem', {
        name: 'Test Banana',
        quantity: 5,
        unit: 'pieces',
        category: 'fruits',
        expirationDate: '2025-01-15',
        location: 'Counter',
        notes: 'Organic bananas'
      });

      expect(result.isError).toBe(false);
      expect(result.content).toContainEqual(
        expect.objectContaining({
          type: 'text',
          text: expect.stringContaining('Successfully added')
        })
      );

      // Verify item was actually saved
      const data = JSON.parse(readFileSync(testDataFile, 'utf-8'));
      expect(data.items).toHaveLength(1);
      expect(data.items[0]).toMatchObject({
        name: 'Test Banana',
        quantity: 5,
        unit: 'pieces',
        category: 'fruits'
      });
      expect(data.items[0].id).toBeDefined();
    });

    it('should handle missing required fields', async () => {
      const result = await server.callTool('addFoodItem', {
        name: 'Test Item'
        // Missing required fields
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing required fields');
    });

    it('should handle invalid quantity', async () => {
      const result = await server.callTool('addFoodItem', {
        name: 'Test Item',
        quantity: -1,
        unit: 'pieces'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Quantity must be positive');
    });

    it('should handle invalid expiration date', async () => {
      const result = await server.callTool('addFoodItem', {
        name: 'Test Item',
        quantity: 1,
        unit: 'pieces',
        expirationDate: 'invalid-date'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid expiration date');
    });
  });

  describe('listFoodItems Tool', () => {
    beforeEach(async () => {
      // Add some test data
      await server.callTool('addFoodItem', {
        name: 'Test Milk',
        quantity: 1,
        unit: 'liter',
        category: 'dairy',
        expirationDate: '2025-01-15'
      });
      
      await server.callTool('addFoodItem', {
        name: 'Test Bread',
        quantity: 1,
        unit: 'loaf',
        category: 'bakery',
        expirationDate: '2025-01-10'
      });
    });

    it('should list all items when no filters applied', async () => {
      const result = await server.callTool('listFoodItems', {});

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Found 2 items');
      expect(result.content[0].text).toContain('Test Milk');
      expect(result.content[0].text).toContain('Test Bread');
    });

    it('should filter by category', async () => {
      const result = await server.callTool('listFoodItems', {
        category: 'dairy'
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Found 1 items');
      expect(result.content[0].text).toContain('Test Milk');
      expect(result.content[0].text).not.toContain('Test Bread');
    });

    it('should show expiring items', async () => {
      const result = await server.callTool('listFoodItems', {
        showExpiring: true,
        expiringInDays: 30
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('items expiring');
    });

    it('should sort items correctly', async () => {
      const result = await server.callTool('listFoodItems', {
        sortBy: 'name'
      });

      expect(result.isError).toBe(false);
      const textContent = result.content[0].text;
      const milkIndex = textContent.indexOf('Test Milk');
      const breadIndex = textContent.indexOf('Test Bread');
      expect(breadIndex).toBeLessThan(milkIndex); // Bread should come before Milk alphabetically
    });
  });

  describe('removeFoodItem Tool', () => {
    let itemId: string;

    beforeEach(async () => {
      // Add an item to remove
      const result = await server.callTool('addFoodItem', {
        name: 'Test Item to Remove',
        quantity: 1,
        unit: 'piece'
      });
      
      // Extract the ID from the response
      const data = JSON.parse(readFileSync(testDataFile, 'utf-8'));
      itemId = data.items[0].id;
    });

    it('should remove an existing item', async () => {
      const result = await server.callTool('removeFoodItem', {
        id: itemId
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Successfully removed');

      // Verify item was actually removed
      const data = JSON.parse(readFileSync(testDataFile, 'utf-8'));
      expect(data.items).toHaveLength(0);
    });

    it('should handle non-existent item ID', async () => {
      const result = await server.callTool('removeFoodItem', {
        id: 'non-existent-id'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Item not found');
    });

    it('should handle missing ID parameter', async () => {
      const result = await server.callTool('removeFoodItem', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Item ID is required');
    });
  });

  describe('Data Persistence', () => {
    it('should persist data across server instances', async () => {
      // Add an item with first server instance
      await server.callTool('addFoodItem', {
        name: 'Persistent Item',
        quantity: 1,
        unit: 'piece'
      });

      // Create new server instance
      const newServer = new SmartFridgeServer();
      
      // Verify the item still exists
      const result = await newServer.callTool('listFoodItems', {});
      expect(result.content[0].text).toContain('Persistent Item');
    });

    it('should handle corrupted data file gracefully', async () => {
      // Corrupt the data file
      writeFileSync(testDataFile, 'invalid json');
      
      // Create new server instance
      const newServer = new SmartFridgeServer();
      
      // Should initialize with empty data
      const result = await newServer.callTool('listFoodItems', {});
      expect(result.content[0].text).toContain('Found 0 items');
    });

    it('should update metadata correctly', async () => {
      await server.callTool('addFoodItem', {
        name: 'Metadata Test Item',
        quantity: 1,
        unit: 'piece'
      });

      const data = JSON.parse(readFileSync(testDataFile, 'utf-8'));
      expect(data.metadata.totalItems).toBe(1);
      expect(data.metadata.lastUpdated).toBeDefined();
      expect(new Date(data.metadata.lastUpdated)).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown tool calls', async () => {
      const result = await server.callTool('unknownTool', {});
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown tool');
    });

    it('should handle file system errors gracefully', async () => {
      // Set invalid data file path
      process.env.DATA_FILE = '/invalid/path/data.json';
      
      const newServer = new SmartFridgeServer();
      const result = await newServer.callTool('addFoodItem', {
        name: 'Test Item',
        quantity: 1,
        unit: 'piece'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error');
    });
  });

  describe('Resource Support', () => {
    it('should provide data file as resource', async () => {
      const resources = await server.getResources();
      expect(resources).toHaveLength(1);
      expect(resources[0].name).toBe('Smart Fridge Data');
      expect(resources[0].uri).toContain('fridge-data');
    });

    it('should read data file resource', async () => {
      // Add some data first
      await server.callTool('addFoodItem', {
        name: 'Resource Test Item',
        quantity: 1,
        unit: 'piece'
      });

      const resources = await server.getResources();
      const dataResource = resources[0];
      
      const resourceContent = await server.readResource(dataResource.uri);
      expect(resourceContent.contents).toHaveLength(1);
      expect(resourceContent.contents[0].text).toContain('Resource Test Item');
    });
  });
});