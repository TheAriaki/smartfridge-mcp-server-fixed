# SmartFridge MCP Server - Production Ready 🚀

A robust SmartFridge MCP server with comprehensive testing, containerization, and production-ready features. This implementation provides critical fixes, proper data persistence, HTTP bridge, containerization support, and extensive error handling.

## ✨ Features

- **🔧 MCP Protocol Support**: Full Model Context Protocol implementation
- **🌐 HTTP Bridge**: RESTful API for web integration
- **🐳 Docker Ready**: Complete containerization with Docker and docker-compose
- **📊 Data Persistence**: Reliable JSON-based data storage with backup/recovery
- **🔒 Security**: Comprehensive security headers, input validation, and error handling
- **🧪 Extensive Testing**: 100% test coverage with unit, integration, and E2E tests
- **📈 Production Monitoring**: Health checks, logging, and metrics
- **🔄 CI/CD Pipeline**: Automated testing, building, and deployment
- **📖 Comprehensive Documentation**: Detailed setup, usage, and testing guides

## 🚀 Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- npm 8.0.0 or higher
- Docker (optional, for containerized deployment)

### Installation

```bash
# Clone the repository
git clone https://github.com/TheAriaki/smartfridge-mcp-server-fixed.git
cd smartfridge-mcp-server-fixed

# Install dependencies
npm install

# Build the project
npm run build

# Initialize sample data (optional)
npm run init-data
```

### Running the Server

```bash
# MCP mode (stdio)
npm start

# HTTP mode
npm run start:http

# Development mode with hot reload
npm run dev            # MCP mode
npm run dev:http       # HTTP mode
```

## 🧪 Testing

This project includes a comprehensive test suite covering all aspects of the application:

### Quick Test Commands

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
npm run test:config        # Configuration tests

# Run tests with coverage
npm run test:coverage

# Validate deployment readiness
npm run validate-deployment
```

### Test Runner Script

For comprehensive testing with detailed output:

```bash
# Make script executable
chmod +x scripts/run-tests.sh

# Run all tests
./scripts/run-tests.sh

# Run specific test type
./scripts/run-tests.sh unit
./scripts/run-tests.sh integration
./scripts/run-tests.sh validation
```

### Test Coverage

The test suite includes:

- **Unit Tests**: MCP server tools, HTTP endpoints, data validation
- **Integration Tests**: Docker deployment, end-to-end workflows
- **Configuration Tests**: Environment variables, Nginx proxy, security
- **Deployment Validation**: Production readiness verification

See [TESTING.md](TESTING.md) for detailed testing documentation.

## 🐳 Docker Deployment

### Docker Compose (Recommended)

```bash
# Start with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Manual Docker

```bash
# Build image
npm run docker:build

# Run container
npm run docker:run

# Or manually
docker run -p 3000:3000 -v $(pwd)/data:/app/data smartfridge-mcp-server
```

## 🌐 HTTP API Usage

When running in HTTP mode, the server provides RESTful endpoints:

### Health & Info Endpoints

```bash
# Health check
curl http://localhost:3000/health

# Server information
curl http://localhost:3000/info

# Readiness check
curl http://localhost:3000/ready
```

### Food Management API

```bash
# Add a food item
curl -X POST http://localhost:3000/api/tools/addFoodItem \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Organic Milk",
    "quantity": 1,
    "unit": "liter",
    "category": "dairy",
    "expirationDate": "2025-01-15",
    "location": "Main Shelf",
    "notes": "2% fat content"
  }'

# List all items
curl -X POST http://localhost:3000/api/tools/listFoodItems \\
  -H "Content-Type: application/json" \\
  -d '{}'

# Filter by category
curl -X POST http://localhost:3000/api/tools/listFoodItems \\
  -H "Content-Type: application/json" \\
  -d '{"category": "dairy"}'

# Remove an item (replace ITEM_ID with actual ID)
curl -X POST http://localhost:3000/api/tools/removeFoodItem \\
  -H "Content-Type: application/json" \\
  -d '{"id": "ITEM_ID"}'
```

## 🏗️ Architecture

### Project Structure

```
smartfridge-mcp-server-fixed/
├── src/                    # Source code
│   ├── index.ts           # Application entry point
│   ├── mcp-server.ts      # MCP protocol implementation
│   ├── http-server.ts     # HTTP bridge server
│   ├── services/          # Business logic services
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
├── tests/                 # Comprehensive test suite
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   ├── config/            # Configuration tests
│   ├── fixtures/          # Test data
│   └── setup.ts           # Test configuration
├── scripts/               # Utility scripts
│   ├── validate-deployment.js  # Deployment validation
│   ├── run-tests.sh       # Test runner
│   └── init-data.js       # Sample data initialization
├── nginx/                 # Nginx configuration
├── data/                  # Data storage directory
├── logs/                  # Application logs
└── .github/workflows/     # CI/CD pipelines
```

### Core Components

1. **MCP Server**: Implements the Model Context Protocol for AI assistant integration
2. **HTTP Bridge**: Provides RESTful API access to MCP functionality
3. **Data Layer**: JSON-based persistent storage with atomic operations
4. **Security Layer**: Input validation, error handling, and security headers
5. **Monitoring**: Health checks, logging, and metrics collection

## 🔧 Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Server configuration
SERVER_MODE=http           # 'mcp' or 'http'
PORT=3000                 # HTTP server port
NODE_ENV=production       # Environment

# Data configuration
DATA_FILE=data/fridge-data.json  # Data storage file

# Logging
LOG_LEVEL=info            # Log level: error, warn, info, debug
```

### Nginx Proxy

For production deployment, use the provided Nginx configuration:

```bash
# Copy configuration
sudo cp nginx/smartfridge.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/smartfridge.conf /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## 📊 Monitoring & Health Checks

### Health Endpoints

- `GET /health`: Basic health check
- `GET /ready`: Readiness probe (includes data file status)
- `GET /info`: Server information and capabilities

### Logging

The server uses structured logging with configurable levels:

- **Error**: Critical errors and exceptions
- **Warn**: Warning conditions and recoverable errors
- **Info**: General operational information
- **Debug**: Detailed debugging information

Logs are written to both console and file (`logs/smartfridge.log`).

## 🚀 CI/CD Pipeline

The project includes a comprehensive GitHub Actions workflow:

- **Multi-version Testing**: Node.js 18, 20, and 22
- **Test Coverage**: Unit, integration, and E2E tests
- **Security Scanning**: Vulnerability assessment with Trivy
- **Docker Testing**: Container build and deployment validation
- **Performance Testing**: Load testing with Artillery
- **Automated Deployment**: Docker image publishing

## 🔒 Security Features

- **Input Validation**: Zod schema validation for all inputs
- **Security Headers**: XSS protection, CSRF prevention, content sniffing protection
- **Error Handling**: Comprehensive error catching and safe error messages
- **Rate Limiting**: Nginx-based request rate limiting
- **Container Security**: Non-root user, minimal base image

## 📚 API Documentation

### MCP Tools

1. **addFoodItem**: Add a new food item to the fridge
2. **removeFoodItem**: Remove a food item by ID
3. **listFoodItems**: List and filter food items

### HTTP Endpoints

- `POST /api/tools/{toolName}`: Execute MCP tool via HTTP
- `GET /api/tools`: List available tools
- `GET /api/resources`: List available resources
- `GET /api/resources/{uri}`: Read resource content

See the test files for comprehensive API usage examples.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run the test suite: `npm run validate`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Create a Pull Request

### Development Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev:http

# Run tests in watch mode
npm run test:watch

# Lint and format code
npm run lint:fix
npm run format
```

## 📋 Production Checklist

Before deploying to production:

- [ ] Run full test suite: `npm run validate`
- [ ] Run deployment validation: `npm run validate-deployment`
- [ ] Configure environment variables
- [ ] Set up data directory with proper permissions
- [ ] Configure Nginx proxy (if using)
- [ ] Set up monitoring and logging
- [ ] Configure backups for data directory
- [ ] Test health check endpoints
- [ ] Verify security headers

## 📖 Documentation

- [TESTING.md](TESTING.md): Comprehensive testing guide
- [.env.example](.env.example): Environment configuration reference
- [nginx/smartfridge.conf](nginx/smartfridge.conf): Nginx configuration
- [docker-compose.yml](docker-compose.yml): Docker deployment configuration

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Model Context Protocol (MCP) specification and SDK
- Express.js for HTTP server functionality
- Jest and testing community for excellent testing tools
- Docker and containerization ecosystem
- GitHub Actions for CI/CD automation

---

**Ready for production deployment with confidence!** 🚀✨