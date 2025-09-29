import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { FoodItem, FridgeDatabase, AddFoodItemRequest, ListFoodItemsRequest } from '../types/index.js';
import { FoodItemSchema, AddFoodItemRequestSchema } from '../types/index.js';
import { DatabaseError, NotFoundError, ValidationError } from '../types/index.js';
import { logInfo, logError, logDebug } from '../utils/logger.js';

export class FridgeDatabaseService {
  private readonly dataPath: string;
  private readonly backupPath: string;
  private database: FridgeDatabase | null = null;
  private readonly lockFile: string;

  constructor(dataDir: string = './data') {
    this.dataPath = path.join(dataDir, 'fridge.json');
    this.backupPath = path.join(dataDir, 'fridge.backup.json');
    this.lockFile = path.join(dataDir, '.lock');
  }

  /**
   * Initialize the database and ensure data directory exists
   */
  async initialize(): Promise<void> {
    try {
      logInfo('Initializing fridge database service');
      
      // Ensure data directory exists
      const dataDir = path.dirname(this.dataPath);
      await fs.mkdir(dataDir, { recursive: true });
      
      // Load or create database
      await this.loadDatabase();
      
      logInfo('Fridge database service initialized successfully', {
        itemCount: this.database?.items.length || 0,
        version: this.database?.version
      });
    } catch (error) {
      logError('Failed to initialize database service', error as Error);
      throw new DatabaseError('Database initialization failed', error as Error);
    }
  }

  /**
   * Load database from file with backup fallback
   */
  private async loadDatabase(): Promise<void> {
    try {
      // Try to load main database file
      try {
        const data = await fs.readFile(this.dataPath, 'utf-8');
        this.database = JSON.parse(data);
        logDebug('Loaded database from main file');
      } catch (error) {
        logDebug('Main database file not found or corrupted, trying backup');
        
        // Try backup file
        try {
          const backupData = await fs.readFile(this.backupPath, 'utf-8');
          this.database = JSON.parse(backupData);
          logInfo('Loaded database from backup file');
          
          // Restore main file from backup
          await this.saveDatabase();
        } catch (backupError) {
          logDebug('No backup file found, creating new database');
          // Create new database
          this.database = this.createEmptyDatabase();
          await this.saveDatabase();
        }
      }

      // Validate database structure
      if (!this.database || !Array.isArray(this.database.items)) {
        throw new Error('Invalid database structure');
      }

      // Validate each item
      this.database.items = this.database.items.filter((item) => {
        try {
          FoodItemSchema.parse(item);
          return true;
        } catch (error) {
          logError('Invalid food item found, removing from database', error as Error, { item });
          return false;
        }
      });

      // Update version if needed
      if (!this.database.version) {
        this.database.version = '1.0.0';
        await this.saveDatabase();
      }

    } catch (error) {
      logError('Failed to load database', error as Error);
      throw new DatabaseError('Failed to load database', error as Error);
    }
  }

  /**
   * Create empty database structure
   */
  private createEmptyDatabase(): FridgeDatabase {
    return {
      items: [],
      lastModified: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  /**
   * Save database to file with backup
   */
  private async saveDatabase(): Promise<void> {
    if (!this.database) {
      throw new DatabaseError('No database to save');
    }

    try {
      // Create backup if main file exists
      try {
        await fs.access(this.dataPath);
        await fs.copyFile(this.dataPath, this.backupPath);
      } catch {
        // Main file doesn't exist, no backup needed
      }

      // Update last modified timestamp
      this.database.lastModified = new Date().toISOString();

      // Write to temporary file first, then rename (atomic operation)
      const tempPath = `${this.dataPath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(this.database, null, 2), 'utf-8');
      await fs.rename(tempPath, this.dataPath);

      logDebug('Database saved successfully', { itemCount: this.database.items.length });
    } catch (error) {
      logError('Failed to save database', error as Error);
      throw new DatabaseError('Failed to save database', error as Error);
    }
  }

  /**
   * Add a new food item
   */
  async addFoodItem(request: AddFoodItemRequest): Promise<FoodItem> {
    try {
      // Validate request
      const validatedRequest = AddFoodItemRequestSchema.parse(request);
      
      const now = new Date().toISOString();
      const newItem: FoodItem = {
        id: uuidv4(),
        ...validatedRequest,
        addedDate: now,
        lastModified: now
      };

      // Validate the complete item
      const validatedItem = FoodItemSchema.parse(newItem);

      if (!this.database) {
        throw new DatabaseError('Database not initialized');
      }

      this.database.items.push(validatedItem);
      await this.saveDatabase();

      logInfo('Added new food item', { 
        id: validatedItem.id, 
        name: validatedItem.name,
        quantity: validatedItem.quantity,
        unit: validatedItem.unit
      });

      return validatedItem;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logError('Failed to add food item', error as Error, { request });
      throw new DatabaseError('Failed to add food item', error as Error);
    }
  }

  /**
   * Remove food item by id or name
   */
  async removeFoodItem(id?: string, name?: string): Promise<FoodItem> {
    if (!id && !name) {
      throw new ValidationError('Either id or name must be provided');
    }

    if (!this.database) {
      throw new DatabaseError('Database not initialized');
    }

    const itemIndex = this.database.items.findIndex(item => 
      (id && item.id === id) || (name && item.name.toLowerCase() === name.toLowerCase())
    );

    if (itemIndex === -1) {
      throw new NotFoundError(`Food item not found${id ? ` with id: ${id}` : ` with name: ${name}`}`);
    }

    const removedItem = this.database.items[itemIndex];
    this.database.items.splice(itemIndex, 1);
    await this.saveDatabase();

    logInfo('Removed food item', { 
      id: removedItem.id, 
      name: removedItem.name 
    });

    return removedItem;
  }

  /**
   * List food items with optional filtering
   */
  async listFoodItems(request: ListFoodItemsRequest = {}): Promise<FoodItem[]> {
    if (!this.database) {
      throw new DatabaseError('Database not initialized');
    }

    let items = [...this.database.items];

    // Filter by category
    if (request.category) {
      items = items.filter(item => 
        item.category?.toLowerCase().includes(request.category!.toLowerCase())
      );
    }

    // Filter by location
    if (request.location) {
      items = items.filter(item => 
        item.location?.toLowerCase().includes(request.location!.toLowerCase())
      );
    }

    // Filter for expiring soon items
    if (request.expiringSoon) {
      const daysThreshold = request.expiringSoonDays || 7;
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

      items = items.filter(item => {
        if (!item.expirationDate) return false;
        const expirationDate = new Date(item.expirationDate);
        return expirationDate <= thresholdDate && expirationDate >= new Date();
      });
    }

    // Sort by name for consistent ordering
    items.sort((a, b) => a.name.localeCompare(b.name));

    logDebug('Listed food items', { 
      totalItems: this.database.items.length,
      filteredItems: items.length,
      filters: request
    });

    return items;
  }

  /**
   * Get food item by id
   */
  async getFoodItemById(id: string): Promise<FoodItem> {
    if (!this.database) {
      throw new DatabaseError('Database not initialized');
    }

    const item = this.database.items.find(item => item.id === id);
    if (!item) {
      throw new NotFoundError(`Food item not found with id: ${id}`);
    }

    return item;
  }

  /**
   * Update food item
   */
  async updateFoodItem(id: string, updates: Partial<AddFoodItemRequest>): Promise<FoodItem> {
    if (!this.database) {
      throw new DatabaseError('Database not initialized');
    }

    const itemIndex = this.database.items.findIndex(item => item.id === id);
    if (itemIndex === -1) {
      throw new NotFoundError(`Food item not found with id: ${id}`);
    }

    const existingItem = this.database.items[itemIndex];
    const updatedItem: FoodItem = {
      ...existingItem,
      ...updates,
      id: existingItem.id, // Ensure ID cannot be changed
      addedDate: existingItem.addedDate, // Preserve added date
      lastModified: new Date().toISOString()
    };

    // Validate updated item
    const validatedItem = FoodItemSchema.parse(updatedItem);

    this.database.items[itemIndex] = validatedItem;
    await this.saveDatabase();

    logInfo('Updated food item', { 
      id: validatedItem.id, 
      name: validatedItem.name,
      updates 
    });

    return validatedItem;
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalItems: number;
    categories: string[];
    locations: string[];
    expiringCount: number;
    lastModified: string;
    version: string;
  }> {
    if (!this.database) {
      throw new DatabaseError('Database not initialized');
    }

    const categories = [...new Set(this.database.items
      .map(item => item.category)
      .filter(Boolean))] as string[];

    const locations = [...new Set(this.database.items
      .map(item => item.location)
      .filter(Boolean))] as string[];

    // Count items expiring in next 7 days
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    const expiringCount = this.database.items.filter(item => {
      if (!item.expirationDate) return false;
      const expDate = new Date(item.expirationDate);
      return expDate <= sevenDaysFromNow && expDate >= new Date();
    }).length;

    return {
      totalItems: this.database.items.length,
      categories,
      locations,
      expiringCount,
      lastModified: this.database.lastModified,
      version: this.database.version
    };
  }

  /**
   * Clear all data (for testing purposes)
   */
  async clearAllData(): Promise<void> {
    if (!this.database) {
      throw new DatabaseError('Database not initialized');
    }

    this.database.items = [];
    await this.saveDatabase();

    logInfo('Cleared all data from database');
  }
}