import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { FridgeDatabaseService } from './services/database.js';
import { 
  AddFoodItemRequestSchema, 
  RemoveFoodItemRequestSchema, 
  ListFoodItemsRequestSchema,
  ValidationError,
  NotFoundError,
  DatabaseError
} from './types/index.js';
import { logInfo, logError, logWarn, logDebug } from './utils/logger.js';

export class SmartFridgeMCPServer {
  private server: Server;
  private database: FridgeDatabaseService;

  constructor(dataDir?: string) {
    this.server = new Server(
      {
        name: 'smartfridge-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.database = new FridgeDatabaseService(dataDir);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logDebug('Received list tools request');
      
      return {
        tools: [
          {
            name: 'addfooditem',
            description: 'Add a new food item to the smart fridge',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Name of the food item',
                  minLength: 1
                },
                quantity: {
                  type: 'number',
                  description: 'Quantity of the food item',
                  minimum: 1
                },
                unit: {
                  type: 'string',
                  description: 'Unit of measurement (e.g., pieces, kg, liters)',
                  minLength: 1
                },
                expirationDate: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Expiration date in ISO 8601 format (optional)'
                },
                category: {
                  type: 'string',
                  description: 'Category of the food item (e.g., dairy, vegetables, meat)'
                },
                location: {
                  type: 'string',
                  description: 'Location in the fridge (e.g., top shelf, crisper drawer)'
                },
                notes: {
                  type: 'string',
                  description: 'Additional notes about the food item'
                }
              },
              required: ['name', 'quantity', 'unit']
            }
          },
          {
            name: 'removefooditem',
            description: 'Remove a food item from the smart fridge',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  format: 'uuid',
                  description: 'Unique identifier of the food item'
                },
                name: {
                  type: 'string',
                  description: 'Name of the food item to remove'
                }
              },
              anyOf: [
                { required: ['id'] },
                { required: ['name'] }
              ]
            }
          },
          {
            name: 'listfooditems',
            description: 'List food items in the smart fridge with optional filtering',
            inputSchema: {
              type: 'object',
              properties: {
                category: {
                  type: 'string',
                  description: 'Filter by category'
                },
                location: {
                  type: 'string',
                  description: 'Filter by location in fridge'
                },
                expiringSoon: {
                  type: 'boolean',
                  description: 'Show only items expiring soon'
                },
                expiringSoonDays: {
                  type: 'number',
                  minimum: 1,
                  maximum: 30,
                  default: 7,
                  description: 'Number of days to consider for expiring soon (default: 7)'
                }
              }
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      logInfo('Received tool call', { toolName: name, arguments: args });

      try {
        switch (name) {
          case 'addfooditem':
            return await this.handleAddFoodItem(args);
          
          case 'removefooditem':
            return await this.handleRemoveFoodItem(args);
          
          case 'listfooditems':
            return await this.handleListFoodItems(args);
          
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        logError('Tool call failed', error as Error, { toolName: name, arguments: args });
        
        if (error instanceof ValidationError) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Validation failed: ${error.message}`,
            { issues: error.issues }
          );
        }
        
        if (error instanceof NotFoundError) {
          throw new McpError(
            ErrorCode.InvalidParams,
            error.message
          );
        }
        
        if (error instanceof DatabaseError) {
          throw new McpError(
            ErrorCode.InternalError,
            `Database error: ${error.message}`
          );
        }
        
        if (error instanceof McpError) {
          throw error;
        }
        
        throw new McpError(
          ErrorCode.InternalError,
          `Internal server error: ${(error as Error).message}`
        );
      }
    });
  }

  private async handleAddFoodItem(args: any) {
    try {
      const validatedArgs = AddFoodItemRequestSchema.parse(args);
      const newItem = await this.database.addFoodItem(validatedArgs);
      
      return {
        content: [
          {
            type: 'text',
            text: `Successfully added food item: ${newItem.name}\\n` +
                  `ID: ${newItem.id}\\n` +
                  `Quantity: ${newItem.quantity} ${newItem.unit}\\n` +
                  `${newItem.expirationDate ? `Expires: ${new Date(newItem.expirationDate).toLocaleDateString()}\\n` : ''}` +
                  `${newItem.category ? `Category: ${newItem.category}\\n` : ''}` +
                  `${newItem.location ? `Location: ${newItem.location}\\n` : ''}` +
                  `Added: ${new Date(newItem.addedDate).toLocaleString()}`
          }
        ]
      };
    } catch (error) {
      if (error.name === 'ZodError') {
        throw new ValidationError('Invalid input parameters', error.issues);
      }
      throw error;
    }
  }

  private async handleRemoveFoodItem(args: any) {
    try {
      const validatedArgs = RemoveFoodItemRequestSchema.parse(args);
      const removedItem = await this.database.removeFoodItem(validatedArgs.id, validatedArgs.name);
      
      return {
        content: [
          {
            type: 'text',
            text: `Successfully removed food item: ${removedItem.name}\\n` +
                  `ID: ${removedItem.id}\\n` +
                  `Quantity removed: ${removedItem.quantity} ${removedItem.unit}\\n` +
                  `${removedItem.category ? `Category: ${removedItem.category}\\n` : ''}` +
                  `Originally added: ${new Date(removedItem.addedDate).toLocaleString()}`
          }
        ]
      };
    } catch (error) {
      if (error.name === 'ZodError') {
        throw new ValidationError('Invalid input parameters', error.issues);
      }
      throw error;
    }
  }

  private async handleListFoodItems(args: any) {
    try {
      const validatedArgs = ListFoodItemsRequestSchema.parse(args || {});
      const items = await this.database.listFoodItems(validatedArgs);
      
      if (items.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No food items found matching the criteria.'
            }
          ]
        };
      }

      const itemsText = items.map(item => {
        const expiration = item.expirationDate 
          ? `Expires: ${new Date(item.expirationDate).toLocaleDateString()}`
          : 'No expiration date';
        
        const category = item.category ? ` | Category: ${item.category}` : '';
        const location = item.location ? ` | Location: ${item.location}` : '';
        const notes = item.notes ? ` | Notes: ${item.notes}` : '';
        
        return `• ${item.name} (${item.quantity} ${item.unit}) - ${expiration}${category}${location}${notes}`;
      }).join('\\n');

      const summary = `Found ${items.length} food item(s):\\n\\n${itemsText}`;
      
      return {
        content: [
          {
            type: 'text',
            text: summary
          }
        ]
      };
    } catch (error) {
      if (error.name === 'ZodError') {
        throw new ValidationError('Invalid input parameters', error.issues);
      }
      throw error;
    }
  }

  async initialize(): Promise<void> {
    try {
      logInfo('Initializing SmartFridge MCP Server');
      await this.database.initialize();
      logInfo('SmartFridge MCP Server initialized successfully');
    } catch (error) {
      logError('Failed to initialize MCP server', error as Error);
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      await this.initialize();
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      logInfo('SmartFridge MCP Server started and listening on stdio');
    } catch (error) {
      logError('Failed to start MCP server', error as Error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      await this.server.close();
      logInfo('SmartFridge MCP Server stopped');
    } catch (error) {
      logError('Error stopping MCP server', error as Error);
      throw error;
    }
  }

  // For HTTP bridge usage
  getServer(): Server {
    return this.server;
  }

  getDatabase(): FridgeDatabaseService {
    return this.database;
  }
}