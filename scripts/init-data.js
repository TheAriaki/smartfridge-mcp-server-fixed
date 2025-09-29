#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sample data
const sampleData = {
  items: [
    {
      id: "123e4567-e89b-12d3-a456-426614174000",
      name: "Milk",
      quantity: 1,
      unit: "liter",
      expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      category: "dairy",
      location: "door shelf",
      notes: "Organic whole milk",
      addedDate: new Date().toISOString(),
      lastModified: new Date().toISOString()
    },
    {
      id: "123e4567-e89b-12d3-a456-426614174001",
      name: "Eggs",
      quantity: 12,
      unit: "pieces",
      expirationDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
      category: "dairy",
      location: "main shelf",
      notes: "Free-range eggs",
      addedDate: new Date().toISOString(),
      lastModified: new Date().toISOString()
    },
    {
      id: "123e4567-e89b-12d3-a456-426614174002",
      name: "Apples",
      quantity: 6,
      unit: "pieces",
      expirationDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days from now
      category: "fruits",
      location: "crisper drawer",
      notes: "Gala apples",
      addedDate: new Date().toISOString(),
      lastModified: new Date().toISOString()
    },
    {
      id: "123e4567-e89b-12d3-a456-426614174003",
      name: "Bread",
      quantity: 1,
      unit: "loaf",
      expirationDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now (expiring soon)
      category: "bakery",
      location: "bread box",
      notes: "Whole wheat bread",
      addedDate: new Date().toISOString(),
      lastModified: new Date().toISOString()
    },
    {
      id: "123e4567-e89b-12d3-a456-426614174004",
      name: "Chicken Breast",
      quantity: 500,
      unit: "grams",
      expirationDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now (expiring soon)
      category: "meat",
      location: "meat drawer",
      notes: "Boneless, skinless",
      addedDate: new Date().toISOString(),
      lastModified: new Date().toISOString()
    }
  ],
  lastModified: new Date().toISOString(),
  version: "1.0.0"
};

async function initializeData() {
  try {
    console.log('🚀 Initializing SmartFridge data...');

    // Create data directory
    const dataDir = path.join(process.cwd(), 'data');
    await fs.mkdir(dataDir, { recursive: true });
    console.log(`✅ Created data directory: ${dataDir}`);

    // Create logs directory
    const logsDir = path.join(process.cwd(), 'logs');
    await fs.mkdir(logsDir, { recursive: true });
    console.log(`✅ Created logs directory: ${logsDir}`);

    // Check if database already exists
    const dbPath = path.join(dataDir, 'fridge.json');
    try {
      await fs.access(dbPath);
      console.log('⚠️  Database already exists. Use --force to overwrite.');
      
      if (!process.argv.includes('--force')) {
        console.log('👍 Initialization skipped. Data directory is ready.');
        return;
      }
    } catch {
      // Database doesn't exist, which is fine
    }

    // Write sample data
    await fs.writeFile(dbPath, JSON.stringify(sampleData, null, 2), 'utf-8');
    console.log(`✅ Created database with sample data: ${dbPath}`);

    // Create backup
    const backupPath = path.join(dataDir, 'fridge.backup.json');
    await fs.writeFile(backupPath, JSON.stringify(sampleData, null, 2), 'utf-8');
    console.log(`✅ Created backup file: ${backupPath}`);

    // Create .gitkeep files to ensure directories are tracked
    await fs.writeFile(path.join(dataDir, '.gitkeep'), '', 'utf-8');
    await fs.writeFile(path.join(logsDir, '.gitkeep'), '', 'utf-8');

    console.log('🎉 SmartFridge data initialization completed successfully!');
    console.log('');
    console.log('Sample data includes:');
    sampleData.items.forEach(item => {
      const expirationInfo = item.expirationDate 
        ? ` (expires ${new Date(item.expirationDate).toLocaleDateString()})`
        : '';
      console.log(`  • ${item.name}: ${item.quantity} ${item.unit}${expirationInfo}`);
    });
    console.log('');
    console.log('You can now start the server with:');
    console.log('  npm start          (MCP mode)');
    console.log('  npm run start:http (HTTP mode)');
    console.log('  docker-compose up  (Docker)');

  } catch (error) {
    console.error('❌ Failed to initialize data:', error);
    process.exit(1);
  }
}

// Run initialization
initializeData();