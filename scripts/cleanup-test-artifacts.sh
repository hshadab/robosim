#!/bin/bash
# Cleanup script for test artifacts
# Removes generated test files that shouldn't be committed

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Cleaning up test artifacts in $PROJECT_ROOT..."

# Remove test screenshots (keeping directory structure)
if [ -d "$PROJECT_ROOT/test-screenshots" ]; then
    echo "Cleaning test-screenshots/..."
    find "$PROJECT_ROOT/test-screenshots" -type f -name "*.png" -delete
    find "$PROJECT_ROOT/test-screenshots" -type f -name "*.json" -delete
fi

# Remove playwright test results
if [ -d "$PROJECT_ROOT/test-results" ]; then
    echo "Cleaning test-results/..."
    rm -rf "$PROJECT_ROOT/test-results"/*
fi

# Remove playwright report
if [ -d "$PROJECT_ROOT/playwright-report" ]; then
    echo "Removing playwright-report/..."
    rm -rf "$PROJECT_ROOT/playwright-report"
fi

# Remove any e2e screenshots in root (should be in test-screenshots)
echo "Cleaning root e2e screenshots..."
find "$PROJECT_ROOT" -maxdepth 1 -type f -name "e2e-*.png" -delete

# Remove dist directory (can be rebuilt)
if [ -d "$PROJECT_ROOT/dist" ]; then
    echo "Removing dist/..."
    rm -rf "$PROJECT_ROOT/dist"
fi

# Remove TypeScript build info
find "$PROJECT_ROOT" -type f -name "*.tsbuildinfo" -delete

echo ""
echo "Cleanup complete!"
echo ""
echo "To rebuild the project:"
echo "  npm run build"
echo ""
echo "To run tests:"
echo "  npm run test        # Unit tests"
echo "  npm run test:e2e    # E2E tests"
