import { z } from 'zod';

// Zod schemas for validation
export const FoodItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  quantity: z.number().int().min(0, 'Quantity must be non-negative'),
  unit: z.string().min(1, 'Unit is required'),
  expirationDate: z.string().datetime().optional(),
  category: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  addedDate: z.string().datetime(),
  lastModified: z.string().datetime()
});

export const AddFoodItemRequestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  quantity: z.number().int().min(1, 'Quantity must be positive'),
  unit: z.string().min(1, 'Unit is required'),
  expirationDate: z.string().datetime().optional(),
  category: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional()
});

export const RemoveFoodItemRequestSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).optional()
}).refine(data => data.id || data.name, {
  message: "Either 'id' or 'name' must be provided"
});

export const ListFoodItemsRequestSchema = z.object({
  category: z.string().optional(),
  location: z.string().optional(),
  expiringSoon: z.boolean().optional(),
  expiringSoonDays: z.number().int().min(1).max(30).default(7).optional()
});

// TypeScript types derived from schemas
export type FoodItem = z.infer<typeof FoodItemSchema>;
export type AddFoodItemRequest = z.infer<typeof AddFoodItemRequestSchema>;
export type RemoveFoodItemRequest = z.infer<typeof RemoveFoodItemRequestSchema>;
export type ListFoodItemsRequest = z.infer<typeof ListFoodItemsRequestSchema>;

// Database structure
export interface FridgeDatabase {
  items: FoodItem[];
  lastModified: string;
  version: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  itemCount: number;
}

// Error types
export class ValidationError extends Error {
  constructor(message: string, public issues?: z.ZodIssue[]) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class DatabaseError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'DatabaseError';
  }
}