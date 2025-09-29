# SmartFridge MCP Server - Testing Guide

This document provides comprehensive information about testing the SmartFridge MCP server implementation.

## 🧪 Test Suite Overview

The test suite is designed to verify that all components work correctly in isolation and together:

### Test Categories

1. **Unit Tests** (`tests/unit/`)
   - MCP server functionality
   - HTTP server endpoints
   - Individual component validation

2. **Integration Tests** (`tests/integration/`)
   - Docker container deployment
   - End-to-end workflows
   - Cross-component interactions

3. **Configuration Tests** (`tests/config/`)
   - Environment variable validation
   - Configuration file structure
   - Nginx proxy configuration

## 🚀 Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- npm 8.0.0 or higher
- Docker (for Docker-related tests)
- Nginx (for Nginx configuration tests, optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/TheAriaki/smartfridge-mcp-server-fixed.git
cd smartfridge-mcp-server-fixed

# Install dependencies
npm install

# Build the project
npm run build
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:config        # Configuration tests only

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode (for development)
npm run test:watch

# Run tests in CI mode
npm run test:ci
```

## 📋 Test Details

### Unit Tests

#### MCP Server Tests (`tests/unit/mcp-server.test.ts`)

Tests the core MCP server functionality:

- **Tool Definitions**: Validates all three tools are available with correct schemas
- **addFoodItem Tool**: Tests adding items with validation and error handling
- **listFoodItems Tool**: Tests filtering, sorting, and display options
- **removeFoodItem Tool**: Tests item removal and error cases
- **Data Persistence**: Verifies data is saved and loaded correctly
- **Resource Support**: Tests MCP resource functionality

**Key Test Cases:**
```bash
✅ Tool schema validation
✅ Required field validation
✅ Data type validation (quantity, dates)
✅ Category filtering
✅ Expiration date handling
✅ Sorting functionality
✅ Error handling for invalid inputs
✅ Data persistence across server restarts
✅ Corrupted data recovery
```

#### HTTP Server Tests (`tests/unit/http-server.test.ts`)

Tests the HTTP bridge functionality:

- **Health Endpoints**: `/health`, `/info`, `/ready`
- **Security Headers**: CORS, XSS protection, content type options
- **API Endpoints**: Tool execution via HTTP
- **Error Handling**: Invalid requests, malformed JSON
- **Resource Management**: HTTP resource access

**Key Test Cases:**
```bash
✅ Health check responses
✅ CORS header validation
✅ Security header presence
✅ API request/response handling
✅ Content-Type validation
✅ Rate limiting (where applicable)
✅ Error response formatting
✅ Resource endpoint functionality
```

### Integration Tests

#### Docker Tests (`tests/integration/docker.test.ts`)

Tests Docker containerization:

- **Image Building**: Validates Docker image creation
- **Container Startup**: Tests container deployment
- **Network Access**: Verifies port exposure and connectivity
- **Data Persistence**: Tests volume mounting and data survival
- **Environment Variables**: Validates container configuration

**Requirements:**
- Docker must be installed and running
- Tests will build and run containers automatically

**Key Test Cases:**
```bash
✅ Docker image builds successfully
✅ Container starts and responds to health checks
✅ API functionality works in container
✅ Data persists across container restarts
✅ Environment variables are properly set
✅ Port mapping works correctly
```

#### End-to-End Tests (`tests/integration/end-to-end.test.ts`)

Tests complete workflows:

- **Full Workflow**: Add → List → Filter → Remove items
- **Concurrent Operations**: Multiple simultaneous requests
- **Error Recovery**: System stability after errors
- **Resource Management**: Complete resource lifecycle

**Key Test Cases:**
```bash
✅ Complete food management workflow
✅ Multi-item operations
✅ Category filtering and sorting
✅ Expiration date handling
✅ Concurrent request handling
✅ Error recovery and system stability
✅ Resource access and management
```

### Configuration Tests

#### Environment Tests (`tests/config/environment.test.ts`)

Tests environment and configuration:

- **Environment Variables**: Validation of all env vars
- **Configuration Files**: package.json, tsconfig.json, etc.
- **Directory Structure**: Required files and folders
- **Security Configuration**: Secrets handling, .gitignore
- **Performance Settings**: Memory, logging configuration

**Key Test Cases:**
```bash
✅ Environment variable validation
✅ Configuration file structure
✅ Required directory presence
✅ Security best practices
✅ Logging configuration
✅ Performance settings
```

#### Nginx Tests (`tests/config/nginx.test.ts`)

Tests Nginx proxy configuration:

- **Configuration Syntax**: Nginx config validation
- **Proxy Functionality**: Request forwarding
- **Security Headers**: HTTP security headers
- **Rate Limiting**: API rate limiting
- **CORS Handling**: Cross-origin request support

**Requirements:**
- Nginx must be installed (tests will be skipped if not available)

**Key Test Cases:**
```bash
✅ Nginx configuration syntax validation
✅ Proxy functionality
✅ Security header injection
✅ CORS preflight handling
✅ Rate limiting enforcement
✅ Error handling
```

## 🔧 Deployment Validation

### Validation Script

The deployment validation script (`scripts/validate-deployment.js`) provides comprehensive deployment verification:

```bash
# Run deployment validation
npm run validate-deployment

# Or run directly
node scripts/validate-deployment.js
```

**Validation Categories:**
- Environment validation (Node.js, dependencies)
- Build process validation
- MCP server standalone mode
- HTTP server functionality
- Docker deployment (if available)
- Data persistence

## 📊 Coverage Requirements

The test suite aims for high code coverage:

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 85%
- **Lines**: > 80%

Coverage reports are generated in the `coverage/` directory and can be viewed in HTML format.

## 🔄 Continuous Integration

### GitHub Actions Workflow

The CI/CD pipeline (`.github/workflows/ci-cd.yml`) runs:

1. **Test Suite**: All test categories across Node.js versions
2. **Docker Tests**: Container build and functionality
3. **End-to-End Tests**: Complete workflow validation
4. **Deployment Validation**: Production readiness check
5. **Security Scanning**: Vulnerability assessment
6. **Performance Testing**: Load testing with Artillery

### Test Matrix

Tests run on multiple Node.js versions:
- Node.js 18.x (LTS)
- Node.js 20.x (LTS)
- Node.js 22.x (Current)

## 📝 Test Data

### Test Fixtures

Test data is provided in `tests/fixtures/`:
- `test-data.json`: Sample food items for testing

### Temporary Data

Tests create temporary data files that are automatically cleaned up:
- Pattern: `data/test-*.json`
- Location: `data/` directory
- Cleanup: Automatic after each test

## 🐛 Debugging Tests

### Running Individual Tests

```bash
# Run a specific test file
npm test -- tests/unit/mcp-server.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="should add a new food item"

# Run with verbose output
npm test -- --verbose

# Run with debugging
npm test -- --detectOpenHandles --forceExit
```

### Test Environment Variables

Set these environment variables for debugging:

```bash
export NODE_ENV=test
export LOG_LEVEL=debug
export TEST_TIMEOUT=30000
```

### Common Issues

1. **Port Conflicts**: Tests use dynamic ports, but conflicts can occur
   - Solution: Set `TEST_PORT` environment variable

2. **Docker Not Available**: Docker tests will be skipped automatically
   - Solution: Install Docker or ignore Docker-specific tests

3. **Nginx Not Available**: Nginx tests will be skipped automatically
   - Solution: Install Nginx or ignore Nginx-specific tests

4. **File Permission Issues**: Tests create temporary files
   - Solution: Ensure write permissions to `data/` and `logs/` directories

## 📈 Performance Testing

### Load Testing

Performance tests use Artillery for load testing:

```bash
# Install Artillery globally
npm install -g artillery@latest

# Run performance tests (done automatically in CI)
# This is handled by the GitHub Actions workflow
```

### Metrics Collected

- Response times
- Request rates
- Error rates
- Resource utilization

## 🔒 Security Testing

### Vulnerability Scanning

- **npm audit**: Dependency vulnerability scanning
- **Trivy**: Container and filesystem scanning
- **CodeQL**: Code analysis (in GitHub Actions)

### Security Test Cases

- Input validation
- SQL injection prevention (not applicable, using JSON files)
- XSS protection
- CSRF protection
- Header security

## 📋 Test Checklist

Before deploying to production, ensure all these tests pass:

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All configuration tests pass
- [ ] Docker deployment validation passes
- [ ] End-to-end workflows work correctly
- [ ] Security scans show no critical vulnerabilities
- [ ] Performance tests meet requirements
- [ ] Deployment validation script succeeds

## 🆘 Getting Help

If you encounter issues with the tests:

1. Check the test output for specific error messages
2. Verify all prerequisites are installed
3. Check environment variable configuration
4. Review the GitHub Actions logs for CI failures
5. Create an issue with detailed error information

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Docker Testing Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Node.js Testing Best Practices](https://github.com/goldbergyoni/nodebestpractices#-6-testing-and-overall-quality-practices)