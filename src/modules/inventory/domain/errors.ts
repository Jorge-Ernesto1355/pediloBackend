import { AppError } from '@/shared/errors/app-error.js';

export class InventoryBusinessAccessError extends AppError {
  constructor() {
    super('You do not have access to this business', 403, 'INVENTORY_BUSINESS_ACCESS_DENIED');
  }
}
export class IngredientNotFoundError extends AppError {
  constructor() {
    super('Ingredient not found', 404, 'INGREDIENT_NOT_FOUND');
  }
}
export class IngredientAlreadyExistsError extends AppError {
  constructor() {
    super('An ingredient with this name already exists', 409, 'INGREDIENT_ALREADY_EXISTS');
  }
}
export class RecipeTargetNotFoundError extends AppError {
  constructor() {
    super('Product or option not found for this business', 404, 'RECIPE_TARGET_NOT_FOUND');
  }
}
export class RecipeIngredientInvalidError extends AppError {
  constructor() {
    super('Recipe uses an ingredient that is not available', 400, 'RECIPE_INGREDIENT_INVALID');
  }
}
export class InsufficientStockError extends AppError {
  constructor(ingredientNames: string[]) {
    super(`Sin stock suficiente de: ${ingredientNames.join(', ')}`, 409, 'INSUFFICIENT_STOCK');
  }
}
