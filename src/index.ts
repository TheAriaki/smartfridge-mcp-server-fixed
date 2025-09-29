#!/usr/bin/env node

import { SmartFridgeMCPServer } from './mcp-server.js';
import { SmartFridgeHTTPServer } from './http-server.js';
import { logInfo, logError } from './utils/logger.js';

// Environment configuration
const SERVER_MODE = process.env.SERVER_MODE || 'mcp'; // 'mcp' or 'http'
const HTTP_PORT = parseInt(process.env.PORT || '3000');
const HTTP_HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || './data';

// Graceful shutdown handler
let server: SmartFridgeMCPServer | SmartFridgeHTTPServer | null = null;

async function gracefulShutdown(signal: string): Promise<void> {
  logInfo(`Received ${signal}, shutting down gracefully`);
  
  try {
    if (server) {
      await server.stop();
    }
    logInfo('Server shutdown completed');
    process.exit(0);
  } catch (error) {
    logError('Error during shutdown', error as Error);
    process.exit(1);
  }
}

// Setup signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logError('Uncaught exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logError('Unhandled rejection', new Error(String(reason)), {
    promise: promise.toString()
  });
  process.exit(1);
});

async function main(): Promise<void> {
  try {
    logInfo('Starting SmartFridge Server', {
      mode: SERVER_MODE,
      dataDir: DATA_DIR,
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid
    });

    if (SERVER_MODE === 'http') {
      // Start HTTP server mode
      server = new SmartFridgeHTTPServer(DATA_DIR);
      await server.start(HTTP_PORT, HTTP_HOST);
      
      logInfo('SmartFridge HTTP Server is ready', {
        port: HTTP_PORT,
        host: HTTP_HOST,
        endpoints: {
          health: `http://${HTTP_HOST}:${HTTP_PORT}/health`,
          api: `http://${HTTP_HOST}:${HTTP_PORT}/api/docs`,
          root: `http://${HTTP_HOST}:${HTTP_PORT}/`
        }
      });
    } else {
      // Start MCP server mode (default)
      server = new SmartFridgeMCPServer(DATA_DIR);
      await server.start();
      
      logInfo('SmartFridge MCP Server is ready and listening on stdio');
    }

  } catch (error) {
    logError('Failed to start server', error as Error);
    process.exit(1);
  }
}

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logError('Fatal error during startup', error);
    process.exit(1);
  });
}