import type {
  CreateIngredientInput,
  IngredientRecord,
  InventoryRepository,
  InventorySettingsRecord,
  MovementInput,
  RecipeTarget,
  UpdateIngredientInput,
} from '../ports/InventoryRepository.js';
import { computeStockLevel, lowStockThreshold, type StockAlertNotice } from '../../domain/stock.js';
import type { StockLevel } from '../../domain/stock.js';

export interface StockAlertPublisher {
  publish(notices: StockAlertNotice[]): void;
}

export type IngredientView = IngredientRecord & { threshold: number; level: StockLevel };

export class InventoryService {
  constructor(
    private readonly repository: InventoryRepository,
    private readonly publisher: StockAlertPublisher,
  ) {}

  async listIngredients(
    userId: string,
    businessId: string,
    filters: { search?: string; status?: 'ALERTS' | StockLevel },
  ) {
    await this.repository.assertAccess(userId, businessId);
    const [ingredients, settings] = await Promise.all([
      this.repository.listIngredients(businessId, filters.search),
      this.repository.getSettings(businessId),
    ]);
    const views = ingredients.map((ingredient) => toView(ingredient, settings));
    const counts = { OK: 0, LOW: 0, CRITICAL: 0, OUT: 0 } satisfies Record<StockLevel, number>;
    for (const view of views) counts[view.level] += 1;
    const filtered = views.filter((view) => {
      if (!filters.status) return true;
      return filters.status === 'ALERTS' ? view.level !== 'OK' : view.level === filters.status;
    });
    // Most urgent first, so the screen opens on what needs attention.
    const order: Record<StockLevel, number> = { OUT: 0, CRITICAL: 1, LOW: 2, OK: 3 };
    filtered.sort((a, b) => order[a.level] - order[b.level] || a.name.localeCompare(b.name));
    return { ingredients: filtered, counts };
  }

  async createIngredient(userId: string, businessId: string, input: CreateIngredientInput) {
    await this.repository.assertAccess(userId, businessId);
    const { ingredient, notices } = await this.repository.createIngredient(
      businessId,
      userId,
      input,
    );
    this.publisher.publish(notices);
    return toView(ingredient, await this.repository.getSettings(businessId));
  }

  async updateIngredient(
    userId: string,
    businessId: string,
    ingredientId: string,
    input: UpdateIngredientInput,
  ) {
    await this.repository.assertAccess(userId, businessId);
    const { ingredient, notices } = await this.repository.updateIngredient(
      businessId,
      ingredientId,
      input,
    );
    this.publisher.publish(notices);
    return toView(ingredient, await this.repository.getSettings(businessId));
  }

  async archiveIngredient(userId: string, businessId: string, ingredientId: string) {
    await this.repository.assertAccess(userId, businessId);
    await this.repository.archiveIngredient(businessId, ingredientId);
  }

  async recordMovement(
    userId: string,
    businessId: string,
    ingredientId: string,
    input: MovementInput,
  ) {
    await this.repository.assertAccess(userId, businessId);
    const { ingredient, movement, notices } = await this.repository.recordMovement(
      businessId,
      ingredientId,
      userId,
      input,
    );
    this.publisher.publish(notices);
    return {
      ingredient: toView(ingredient, await this.repository.getSettings(businessId)),
      movement,
    };
  }

  async listMovements(
    userId: string,
    businessId: string,
    ingredientId: string,
    page: number,
    limit: number,
  ) {
    await this.repository.assertAccess(userId, businessId);
    return this.repository.listMovements(businessId, ingredientId, page, limit);
  }

  async getRecipe(userId: string, businessId: string, target: RecipeTarget) {
    await this.repository.assertAccess(userId, businessId);
    return this.repository.getRecipe(businessId, target);
  }

  async setRecipe(
    userId: string,
    businessId: string,
    target: RecipeTarget,
    lines: { ingredientId: string; quantity: number }[],
  ) {
    await this.repository.assertAccess(userId, businessId);
    return this.repository.setRecipe(businessId, target, lines);
  }

  async getSettings(userId: string, businessId: string) {
    await this.repository.assertAccess(userId, businessId);
    return this.repository.getSettings(businessId);
  }

  async updateSettings(
    userId: string,
    businessId: string,
    input: Partial<InventorySettingsRecord>,
  ) {
    await this.repository.assertAccess(userId, businessId);
    const { settings, notices } = await this.repository.updateSettings(businessId, input);
    this.publisher.publish(notices);
    return settings;
  }

  async listAlerts(userId: string, businessId: string) {
    await this.repository.assertAccess(userId, businessId);
    return this.repository.listOpenAlerts(businessId);
  }
}

function toView(ingredient: IngredientRecord, settings: InventorySettingsRecord): IngredientView {
  const threshold = lowStockThreshold({
    parLevel: ingredient.parLevel,
    mode: ingredient.lowStockMode,
    value: ingredient.lowStockValue,
    defaultPercent: settings.defaultLowStockPercent,
  });
  return { ...ingredient, threshold, level: computeStockLevel(ingredient.stock, threshold) };
}
