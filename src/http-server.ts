import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { SmartFridgeMCPServer } from './mcp-server.js';
import type { ApiResponse, HealthCheckResponse } from './types/index.js';
import { ValidationError, NotFoundError, DatabaseError } from './types/index.js';
import { logInfo, logError, logRequest } from './utils/logger.js';

export class SmartFridgeHTTPServer {
  private app: express.Application;
  private mcpServer: SmartFridgeMCPServer;
  private server: any;
  private startTime: Date;

  constructor(dataDir?: string) {
    this.app = express();
    this.mcpServer = new SmartFridgeMCPServer(dataDir);
    this.startTime = new Date();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging middleware
    this.app.use((req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        logRequest(req.method, req.path, duration, {
          statusCode: res.statusCode,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
      });
      
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      try {
        const stats = await this.mcpServer.getDatabase().getStats();
        const response: HealthCheckResponse = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          uptime: Date.now() - this.startTime.getTime(),
          itemCount: stats.totalItems
        };
        
        res.json(response);
      } catch (error) {
        logError('Health check failed', error as Error);
        const response: HealthCheckResponse = {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          uptime: Date.now() - this.startTime.getTime(),
          itemCount: 0
        };
        
        res.status(503).json(response);
      }
    });

    // Get statistics
    this.app.get('/api/stats', async (req, res) => {
      try {
        const stats = await this.mcpServer.getDatabase().getStats();
        const response: ApiResponse = {
          success: true,
          data: stats,
          timestamp: new Date().toISOString()
        };
        
        res.json(response);
      } catch (error) {
        this.handleError(res, error as Error);
      }
    });

    // Add food item
    this.app.post('/api/food-items', async (req, res) => {
      try {
        const newItem = await this.mcpServer.getDatabase().addFoodItem(req.body);
        const response: ApiResponse = {
          success: true,
          data: newItem,
          timestamp: new Date().toISOString()
        };
        
        res.status(201).json(response);
      } catch (error) {
        this.handleError(res, error as Error);
      }
    });

    // List food items
    this.app.get('/api/food-items', async (req, res) => {
      try {
        const filters = {
          category: req.query.category as string,
          location: req.query.location as string,
          expiringSoon: req.query.expiringSoon === 'true',
          expiringSoonDays: req.query.expiringSoonDays ? parseInt(req.query.expiringSoonDays as string) : undefined
        };

        // Remove undefined values
        Object.keys(filters).forEach(key => {
          if (filters[key as keyof typeof filters] === undefined) {
            delete filters[key as keyof typeof filters];
          }
        });

        const items = await this.mcpServer.getDatabase().listFoodItems(filters);
        const response: ApiResponse = {
          success: true,
          data: items,
          timestamp: new Date().toISOString()
        };
        
        res.json(response);
      } catch (error) {
        this.handleError(res, error as Error);
      }
    });

    // Get food item by ID
    this.app.get('/api/food-items/:id', async (req, res) => {
      try {
        const item = await this.mcpServer.getDatabase().getFoodItemById(req.params.id);
        const response: ApiResponse = {
          success: true,
          data: item,
          timestamp: new Date().toISOString()
        };
        
        res.json(response);
      } catch (error) {
        this.handleError(res, error as Error);
      }
    });

    // Update food item
    this.app.put('/api/food-items/:id', async (req, res) => {
      try {
        const updatedItem = await this.mcpServer.getDatabase().updateFoodItem(req.params.id, req.body);
        const response: ApiResponse = {
          success: true,
          data: updatedItem,
          timestamp: new Date().toISOString()
        };
        
        res.json(response);
      } catch (error) {
        this.handleError(res, error as Error);
      }
    });

    // Remove food item
    this.app.delete('/api/food-items/:id', async (req, res) => {
      try {
        const removedItem = await this.mcpServer.getDatabase().removeFoodItem(req.params.id);
        const response: ApiResponse = {
          success: true,
          data: removedItem,
          timestamp: new Date().toISOString()
        };
        
        res.json(response);
      } catch (error) {
        this.handleError(res, error as Error);
      }
    });

    // Remove food item by name
    this.app.delete('/api/food-items', async (req, res) => {
      try {
        const { name } = req.body;
        if (!name) {
          throw new ValidationError('Name is required when removing by name');
        }

        const removedItem = await this.mcpServer.getDatabase().removeFoodItem(undefined, name);
        const response: ApiResponse = {
          success: true,
          data: removedItem,
          timestamp: new Date().toISOString()
        };
        
        res.json(response);
      } catch (error) {
        this.handleError(res, error as Error);
      }
    });

    // Serve API documentation
    this.app.get('/api/docs', (req, res) => {
      res.json({
        title: 'SmartFridge MCP Server API',
        version: '1.0.0',
        description: 'REST API for the SmartFridge MCP Server',
        endpoints: {
          'GET /health': 'Health check endpoint',
          'GET /api/stats': 'Get database statistics',
          'GET /api/food-items': 'List food items with optional filtering',
          'POST /api/food-items': 'Add a new food item',
          'GET /api/food-items/:id': 'Get food item by ID',
          'PUT /api/food-items/:id': 'Update food item by ID',
          'DELETE /api/food-items/:id': 'Remove food item by ID',
          'DELETE /api/food-items': 'Remove food item by name (provide name in body)',
          'GET /api/docs': 'This documentation'
        },
        examples: {
          addFoodItem: {
            method: 'POST',
            url: '/api/food-items',
            body: {
              name: 'Milk',
              quantity: 1,
              unit: 'liter',
              expirationDate: '2024-01-15T00:00:00Z',
              category: 'dairy',
              location: 'door shelf'
            }
          },
          listFoodItems: {
            method: 'GET',
            url: '/api/food-items?category=dairy&expiringSoon=true'
          }
        }
      });
    });

    // Default route
    this.app.get('/', (req, res) => {
      res.json({
        message: 'SmartFridge MCP Server is running',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          api: '/api/docs'
        }
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        timestamp: new Date().toISOString()
      });
    });
  }

  private setupErrorHandling(): void {
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logError('Express error handler caught error', error, {
        method: req.method,
        path: req.path,
        body: req.body
      });

      this.handleError(res, error);
    });
  }

  private handleError(res: express.Response, error: Error): void {
    let statusCode = 500;
    let message = 'Internal server error';

    if (error instanceof ValidationError) {
      statusCode = 400;
      message = error.message;
    } else if (error instanceof NotFoundError) {
      statusCode = 404;
      message = error.message;
    } else if (error instanceof DatabaseError) {
      statusCode = 500;
      message = 'Database error occurred';
    } else if (error.message.includes('ENOENT')) {
      statusCode = 500;
      message = 'File system error';
    }

    const response: ApiResponse = {
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    };

    res.status(statusCode).json(response);
  }

  async start(port: number = 3000, host: string = '0.0.0.0'): Promise<void> {
    try {
      // Initialize MCP server
      await this.mcpServer.initialize();

      // Start HTTP server
      return new Promise((resolve, reject) => {
        this.server = this.app.listen(port, host, () => {
          logInfo(`SmartFridge HTTP Server started`, {
            port,
            host,
            environment: process.env.NODE_ENV || 'development'
          });
          resolve();
        });

        this.server.on('error', (error: Error) => {
          logError('Failed to start HTTP server', error);
          reject(error);
        });
      });
    } catch (error) {
      logError('Failed to initialize HTTP server', error as Error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      if (this.server) {
        await new Promise<void>((resolve, reject) => {
          this.server.close((error: Error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
      }

      await this.mcpServer.stop();
      logInfo('SmartFridge HTTP Server stopped');
    } catch (error) {
      logError('Error stopping HTTP server', error as Error);
      throw error;
    }
  }

  getMCPServer(): SmartFridgeMCPServer {
    return this.mcpServer;
  }
}