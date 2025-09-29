#!/bin/bash

# SmartFridge MCP Server Test Runner
# This script runs comprehensive tests for the SmartFridge MCP server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js version
    if ! command -v node >/dev/null 2>&1; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | sed 's/v//')
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1)
    
    if [ $MAJOR_VERSION -lt 18 ]; then
        log_error "Node.js version $NODE_VERSION is not supported. Minimum version is 18."
        exit 1
    fi
    
    log_success "Node.js version $NODE_VERSION is supported"
    
    # Check npm
    if ! command -v npm >/dev/null 2>&1; then
        log_error "npm is not installed"
        exit 1
    fi
    
    log_success "npm is available"
    
    # Check if dependencies are installed
    if [ ! -d "node_modules" ]; then
        log_warning "Dependencies not found. Installing..."
        npm install
    fi
    
    log_success "Prerequisites check completed"
}

# Build the project
build_project() {
    log_info "Building the project..."
    
    if npm run build; then
        log_success "Build completed successfully"
    else
        log_error "Build failed"
        exit 1
    fi
}

# Run linting
run_linting() {
    log_info "Running linting..."
    
    if npm run lint; then
        log_success "Linting passed"
    else
        log_warning "Linting found issues"
        read -p "Continue with tests? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Run unit tests
run_unit_tests() {
    log_info "Running unit tests..."
    
    if npm run test:unit; then
        log_success "Unit tests passed"
        return 0
    else
        log_error "Unit tests failed"
        return 1
    fi
}

# Run integration tests
run_integration_tests() {
    log_info "Running integration tests..."
    
    # Check if Docker is available
    if command -v docker >/dev/null 2>&1; then
        log_info "Docker is available - running Docker integration tests"
        if npm run test:integration; then
            log_success "Integration tests passed"
            return 0
        else
            log_error "Integration tests failed"
            return 1
        fi
    else
        log_warning "Docker not available - skipping Docker integration tests"
        if npm test -- --testPathPattern="tests/integration" --testNamePattern="^(?!.*Docker)"; then
            log_success "Integration tests (non-Docker) passed"
            return 0
        else
            log_error "Integration tests (non-Docker) failed"
            return 1
        fi
    fi
}

# Run configuration tests
run_config_tests() {
    log_info "Running configuration tests..."
    
    if npm run test:config; then
        log_success "Configuration tests passed"
        return 0
    else
        log_error "Configuration tests failed"
        return 1
    fi
}

# Run coverage tests
run_coverage_tests() {
    log_info "Running tests with coverage..."
    
    if npm run test:coverage; then
        log_success "Coverage tests completed"
        log_info "Coverage report available in coverage/ directory"
        return 0
    else
        log_error "Coverage tests failed"
        return 1
    fi
}

# Run deployment validation
run_deployment_validation() {
    log_info "Running deployment validation..."
    
    if node scripts/validate-deployment.js; then
        log_success "Deployment validation passed"
        return 0
    else
        log_error "Deployment validation failed"
        return 1
    fi
}

# Main test execution
main() {
    local test_type="${1:-all}"
    local skip_build="${2:-false}"
    local exit_code=0
    
    echo "===================="
    echo "SmartFridge MCP Server Test Runner"
    echo "===================="
    echo
    
    # Check prerequisites
    check_prerequisites
    
    # Build project (unless skipped)
    if [ "$skip_build" != "true" ]; then
        build_project
    fi
    
    # Run linting
    run_linting
    
    case $test_type in
        "unit")
            log_info "Running unit tests only..."
            run_unit_tests || exit_code=1
            ;;
        "integration")
            log_info "Running integration tests only..."
            run_integration_tests || exit_code=1
            ;;
        "config")
            log_info "Running configuration tests only..."
            run_config_tests || exit_code=1
            ;;
        "coverage")
            log_info "Running coverage tests..."
            run_coverage_tests || exit_code=1
            ;;
        "validation")
            log_info "Running deployment validation..."
            run_deployment_validation || exit_code=1
            ;;
        "all")
            log_info "Running all tests..."
            
            # Run all test types
            run_unit_tests || exit_code=1
            run_integration_tests || exit_code=1
            run_config_tests || exit_code=1
            run_coverage_tests || exit_code=1
            run_deployment_validation || exit_code=1
            ;;
        *)
            log_error "Unknown test type: $test_type"
            echo "Usage: $0 [unit|integration|config|coverage|validation|all] [skip-build]"
            exit 1
            ;;
    esac
    
    echo
    echo "===================="
    if [ $exit_code -eq 0 ]; then
        log_success "All tests completed successfully!"
        echo "🎉 SmartFridge MCP Server is ready for deployment!"
    else
        log_error "Some tests failed!"
        echo "❌ Please fix the failing tests before deployment."
    fi
    echo "===================="
    
    exit $exit_code
}

# Parse command line arguments
if [ $# -eq 0 ]; then
    main "all"
elif [ $# -eq 1 ]; then
    main "$1"
elif [ $# -eq 2 ]; then
    main "$1" "$2"
else
    echo "Usage: $0 [unit|integration|config|coverage|validation|all] [skip-build]"
    exit 1
fi