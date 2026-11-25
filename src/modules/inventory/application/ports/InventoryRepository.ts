import type { LowStockMode, StockAlertNotice, StockBlockMode } from '../../domain/stock.js';

export type IngredientUnit = 'G' | 'ML' | 'UNIT';

export type IngredientRecord = {
  id: string;
  name: string;
  unit: IngredientUnit;
  stock: number;
  parLevel: number;
  lowStockMode: LowStockMode;
  lowStockValue: number | null;
  consumptionAlertPercent: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InventorySettingsRecord = {
  alertsEnabled: boolean;
  defaultLowStockPercent: number;
  consumptionAlertPercent: number;
  consumptionWindowHours: number;
  blockMode: StockBlockMode;
};

export type CreateIngredientInput = {
  name: string;
  unit: IngredientUnit;
  initialStock?: number;
  parLevel?: number;
  lowStockMode?: LowStockMode;
  lowStockValue?: number | null;
  consumptionAlertPercent?: number | null;
};

export type UpdateIngredientInput = Partial<Omit<CreateIngredientInput, 'initialStock' | 'unit'>>;

export type MovementInput = {
  type: 'PURCHASE' | 'WASTE' | 'ADJUSTMENT';
  /** PURCHASE/WASTE: amount to add/remove. ADJUSTMENT: the counted stock. */
  quantity: number;
  note?: string | null;
};

export type MovementRecord = {
  id: string;
  type: 'PURCHASE' | 'CONSUMPTION' | 'WASTE' | 'ADJUSTMENT';
  quantity: number;
  stockAfter: number;
  orderId: string | null;
  note: string | null;
  createdAt: Date;
};

export type RecipeTarget = {
  kind: 'product' | 'product-option' | 'global-option';
  id: string;
};

export type RecipeLineRecord = {
  ingredientId: string;
  ingredientName: string;
  unit: IngredientUnit;
  quantity: number;
};

export type AlertRecord = {
  id: string;
  ingredientId: string;
  ingredientName: string;
  unit: IngredientUnit;
  kind: 'STOCK' | 'CONSUMPTION';
  level: 'LOW' | 'CRITICAL' | 'OUT' | 'HIGH';
  stock: number;
  createdAt: Date;
};

export interface InventoryRepository {
  assertAccess(userId: string, businessId: string): Promise<void>;
  listIngredients(businessId: string, search?: string): Promise<IngredientRecord[]>;
  createIngredient(
    businessId: string,
    userId: string,
    input: CreateIngredientInput,
  ): Promise<{ ingredient: IngredientRecord; notices: StockAlertNotice[] }>;
  updateIngredient(
    businessId: string,
    ingredientId: string,
    input: UpdateIngredientInput,
  ): Promise<{ ingredient: IngredientRecord; notices: StockAlertNotice[] }>;
  archiveIngredient(businessId: string, ingredientId: string): Promise<void>;
  recordMovement(
    businessId: string,
    ingredientId: string,
    userId: string,
    input: MovementInput,
  ): Promise<{
    ingredient: IngredientRecord;
    movement: MovementRecord;
    notices: StockAlertNotice[];
  }>;
  listMovements(
    businessId: string,
    ingredientId: string,
    page: number,
    limit: number,
  ): Promise<{ movements: MovementRecord[]; total: number }>;
  getRecipe(businessId: string, target: RecipeTarget): Promise<RecipeLineRecord[]>;
  setRecipe(
    businessId: string,
    target: RecipeTarget,
    lines: { ingredientId: string; quantity: number }[],
  ): Promise<RecipeLineRecord[]>;
  getSettings(businessId: string): Promise<InventorySettingsRecord>;
  updateSettings(
    businessId: string,
    input: Partial<InventorySettingsRecord>,
  ): Promise<{ settings: InventorySettingsRecord; notices: StockAlertNotice[] }>;
  listOpenAlerts(businessId: string): Promise<AlertRecord[]>;
}
