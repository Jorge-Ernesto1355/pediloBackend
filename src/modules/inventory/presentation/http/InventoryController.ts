import type { Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import type { InventoryService } from '../../application/services/InventoryService.js';
import type { RecipeTarget } from '../../application/ports/InventoryRepository.js';
import {
  businessParamsSchema,
  createIngredientSchema,
  ingredientParamsSchema,
  listIngredientsQuerySchema,
  movementSchema,
  movementsQuerySchema,
  recipeSchema,
  recipeTargetParamsSchema,
  settingsSchema,
  updateIngredientSchema,
} from './inventory.schemas.js';

const targetKinds = {
  products: 'product',
  'product-options': 'product-option',
  'global-options': 'global-option',
} as const satisfies Record<string, RecipeTarget['kind']>;

export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  listIngredients = this.route(async (req, res) => {
    const { businessId } = parse(businessParamsSchema, req.params);
    const query = parse(listIngredientsQuerySchema, req.query);
    res.json(await this.service.listIngredients(userId(req), businessId, query));
  });

  createIngredient = this.route(async (req, res) => {
    const { businessId } = parse(businessParamsSchema, req.params);
    const body = parse(createIngredientSchema, req.body);
    res
      .status(201)
      .json({ ingredient: await this.service.createIngredient(userId(req), businessId, body) });
  });

  updateIngredient = this.route(async (req, res) => {
    const { businessId, ingredientId } = parse(ingredientParamsSchema, req.params);
    const body = parse(updateIngredientSchema, req.body);
    res.json({
      ingredient: await this.service.updateIngredient(userId(req), businessId, ingredientId, body),
    });
  });

  archiveIngredient = this.route(async (req, res) => {
    const { businessId, ingredientId } = parse(ingredientParamsSchema, req.params);
    await this.service.archiveIngredient(userId(req), businessId, ingredientId);
    res.status(204).send();
  });

  recordMovement = this.route(async (req, res) => {
    const { businessId, ingredientId } = parse(ingredientParamsSchema, req.params);
    const body = parse(movementSchema, req.body);
    res
      .status(201)
      .json(await this.service.recordMovement(userId(req), businessId, ingredientId, body));
  });

  listMovements = this.route(async (req, res) => {
    const { businessId, ingredientId } = parse(ingredientParamsSchema, req.params);
    const { page, limit } = parse(movementsQuerySchema, req.query);
    const result = await this.service.listMovements(
      userId(req),
      businessId,
      ingredientId,
      page,
      limit,
    );
    res.json({ ...result, page, limit });
  });

  getRecipe = this.route(async (req, res) => {
    const { businessId, kind, targetId } = parse(recipeTargetParamsSchema, req.params);
    const lines = await this.service.getRecipe(userId(req), businessId, {
      kind: targetKinds[kind],
      id: targetId,
    });
    res.json({ lines });
  });

  setRecipe = this.route(async (req, res) => {
    const { businessId, kind, targetId } = parse(recipeTargetParamsSchema, req.params);
    const body = parse(recipeSchema, req.body);
    const lines = await this.service.setRecipe(
      userId(req),
      businessId,
      { kind: targetKinds[kind], id: targetId },
      body.lines,
    );
    res.json({ lines });
  });

  getSettings = this.route(async (req, res) => {
    const { businessId } = parse(businessParamsSchema, req.params);
    res.json({ settings: await this.service.getSettings(userId(req), businessId) });
  });

  updateSettings = this.route(async (req, res) => {
    const { businessId } = parse(businessParamsSchema, req.params);
    const body = parse(settingsSchema, req.body);
    res.json({ settings: await this.service.updateSettings(userId(req), businessId, body) });
  });

  listAlerts = this.route(async (req, res) => {
    const { businessId } = parse(businessParamsSchema, req.params);
    res.json({ alerts: await this.service.listAlerts(userId(req), businessId) });
  });

  private route(handler: (req: Request, res: Response) => Promise<void>) {
    return (req: Request, res: Response) => {
      handler(req, res).catch((error: unknown) => handleError(res, error));
    };
  }
}

const userId = (req: Request) => req.user!.id;

class ValidationFailure extends Error {
  constructor(readonly details: unknown) {
    super('Request validation failed');
  }
}

function parse<S extends ZodTypeAny>(schema: S, value: unknown): ReturnType<S['parse']> {
  const result = schema.safeParse(value);
  if (!result.success) throw new ValidationFailure(result.error.flatten());
  return result.data;
}

function handleError(res: Response, error: unknown) {
  if (error instanceof ValidationFailure)
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: error.message, details: error.details },
    });
  if (error && typeof error === 'object' && 'statusCode' in error && error instanceof Error)
    return res.status(Number(error.statusCode)).json({
      error: { code: 'code' in error ? String(error.code) : 'APP_ERROR', message: error.message },
    });
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' } });
}
