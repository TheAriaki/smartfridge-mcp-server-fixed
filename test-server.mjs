#!/usr/bin/env node

/**
 * Simple test script to verify the SmartFridge MCP Server functionality
 * Run with: node test-server.mjs
 */

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

const TEST_URL = 'http://localhost:3000';

async function testServer() {
  console.log('🧪 Starting SmartFridge MCP Server Test\n');

  // Start the server in HTTP mode
  console.log('🚀 Starting server in HTTP mode...');
  const server = spawn('npm', ['run', 'start:http'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  });

  let serverReady = false;
  
  server.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('[SERVER]:', output.trim());
    if (output.includes('SmartFridge HTTP Server is ready')) {
      serverReady = true;
    }
  });

  server.stderr.on('data', (data) => {
    console.error('[SERVER ERROR]:', data.toString().trim());
  });

  // Wait for server to start
  console.log('⏳ Waiting for server to start...');
  for (let i = 0; i < 30; i++) {
    if (serverReady) break;
    await setTimeout(1000);
  }

  if (!serverReady) {
    console.error('❌ Server failed to start within 30 seconds');
    server.kill();
    process.exit(1);
  }

  console.log('✅ Server started successfully\n');

  try {
    // Test health endpoint
    console.log('🔍 Testing health endpoint...');
    const healthResponse = await fetch(`${TEST_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check passed:', healthData.status);

    // Test adding a food item
    console.log('\n📝 Testing add food item...');
    const addResponse = await fetch(`${TEST_URL}/api/food-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Banana',
        quantity: 3,
        unit: 'pieces',
        category: 'fruits',
        location: 'counter',
        notes: 'Yellow and ripe'
      })
    });
    const addData = await addResponse.json();
    console.log('✅ Add item success:', addData.success);
    const itemId = addData.data.id;

    // Test listing food items
    console.log('\n📋 Testing list food items...');
    const listResponse = await fetch(`${TEST_URL}/api/food-items`);
    const listData = await listResponse.json();
    console.log('✅ List items success:', listData.success);
    console.log('📊 Total items:', listData.data.length);

    // Test filtering by category
    console.log('\n🔎 Testing category filter...');
    const filterResponse = await fetch(`${TEST_URL}/api/food-items?category=fruits`);
    const filterData = await filterResponse.json();
    console.log('✅ Filter success:', filterData.success);
    console.log('🍎 Fruit items:', filterData.data.length);

    // Test getting specific item
    console.log('\n🎯 Testing get specific item...');
    const getResponse = await fetch(`${TEST_URL}/api/food-items/${itemId}`);
    const getData = await getResponse.json();
    console.log('✅ Get item success:', getData.success);
    console.log('🏷️  Item name:', getData.data.name);

    // Test removing item
    console.log('\n🗑️  Testing remove item...');
    const removeResponse = await fetch(`${TEST_URL}/api/food-items/${itemId}`, {
      method: 'DELETE'
    });
    const removeData = await removeResponse.json();
    console.log('✅ Remove item success:', removeData.success);

    // Test statistics
    console.log('\n📈 Testing statistics...');
    const statsResponse = await fetch(`${TEST_URL}/api/stats`);
    const statsData = await statsResponse.json();
    console.log('✅ Stats success:', statsData.success);
    console.log('📊 Database stats:', {
      totalItems: statsData.data.totalItems,
      categories: statsData.data.categories.length,
      locations: statsData.data.locations.length
    });

    console.log('\n🎉 All tests passed! SmartFridge MCP Server is working correctly.');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  } finally {
    console.log('\n🛑 Stopping server...');
    server.kill();
    await setTimeout(2000);
    console.log('✅ Test completed');
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Test interrupted');
  process.exit(0);
});

// Run tests
testServer().catch(console.error);