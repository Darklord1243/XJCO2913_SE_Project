#!/bin/bash

# Exit immediately if any command fails.
set -e

echo "========================================"
echo "Starting CI Pipeline..."
echo "========================================"

# Step 1: Run a read-only formatting check.
# We use Prettier's --check mode so CI does not rewrite files.
echo ""
echo "Step 1: Checking Code Formatting..."
echo "----------------------------------------"
npx --no-install prettier --check .

# Step 2: Run automated tests.
echo ""
echo "Step 2: Running Test Suite..."
echo "----------------------------------------"
npm test

echo ""
echo "========================================"
echo "CI Pipeline Completed Successfully!"
echo "========================================"
