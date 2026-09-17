import { Request, Response } from 'express';
import { CreateCategory } from '../../application/useCases/CreateCategory.js';
import { DeleteCategory } from '../../application/useCases/DeleteCategory.js';
import { GetCategory } from '../../application/useCases/GetCategory.js';
import { MoveAllProductsAndDeleteCategory } from '../../application/useCases/MoveAllProductsAndDeleteCategory.js';
import { ReorderCategories } from '../../application/useCases/ReorderCategories.js';
import { SetCategoryActive } from '../../application/useCases/SetCategoryActive.js';
import { UpdateCategory } from '../../application/useCases/UpdateCategory.js';
import { CategoryError } from '../../domain/errors/CategoryErrors.js';
import {
  businessIdSchema,
  categoryIdSchema,
  categoryStatusSchema,
  createCategorySchema,
  menuIdSchema,
  moveAllProductsSchema,
  reorderCategoriesSchema,
  updateCategorySchema,
} from './validators/category.schemas.js';

export class CategoryController {
  constructor(
    private readonly createCategory: CreateCategory,
    private readonly getCategory: GetCategory,
    private readonly updateCategory: UpdateCategory,
    private readonly deleteCategory: DeleteCategory,
    private readonly setCategoryActive: SetCategoryActive,
    private readonly reorderCategories: ReorderCategories,
    private readonly moveAllProducts: MoveAllProductsAndDeleteCategory,
  ) {}

  create = (request: Request, response: Response) => {
    const params = businessIdSchema.safeParse(request.params);
    const body = createCategorySchema.safeParse(request.body);
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    return this.createCategory
      .execute(request.user!.id, params.data.businessId, body.data)
      .then((category) => response.status(201).json({ category: category.toJSON() }))
      .catch((error) => this.handleError(response, error));
  };

  get = (request: Request, response: Response) => {
    const params = categoryIdSchema.safeParse(request.params);
    if (!params.success) return badRequest(response, params.error);
    return this.getCategory
      .execute(request.user!.id, params.data.id)
      .then((category) => response.json({ category: category.toJSON() }))
      .catch((error) => this.handleError(response, error));
  };

  update = (request: Request, response: Response) => {
    const params = categoryIdSchema.safeParse(request.params);
    const body = updateCategorySchema.safeParse(request.body);
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    return this.updateCategory
      .execute(request.user!.id, params.data.id, body.data)
      .then((category) => response.json({ category: category.toJSON() }))
      .catch((error) => this.handleError(response, error));
  };

  remove = (request: Request, response: Response) => {
    const params = categoryIdSchema.safeParse(request.params);
    if (!params.success) return badRequest(response, params.error);
    return this.deleteCategory
      .execute(request.user!.id, params.data.id)
      .then(() => response.status(204).send())
      .catch((error) => this.handleError(response, error));
  };

  setActive = (request: Request, response: Response) => {
    const params = categoryIdSchema.safeParse(request.params);
    const body = categoryStatusSchema.safeParse(request.body);
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    return this.setCategoryActive
      .execute(request.user!.id, params.data.id, body.data.isActive)
      .then((category) => response.json({ category: category.toJSON() }))
      .catch((error) => this.handleError(response, error));
  };

  reorder = (request: Request, response: Response) => {
    const params = menuIdSchema.safeParse(request.params);
    const body = reorderCategoriesSchema.safeParse(request.body);
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    return this.reorderCategories
      .execute(request.user!.id, params.data.menuId, body.data)
      .then((categories) =>
        response.json({ categories: categories.map((category) => category.toJSON()) }),
      )
      .catch((error) => this.handleError(response, error));
  };

  moveAllAndDelete = (request: Request, response: Response) => {
    const params = categoryIdSchema.safeParse(request.params);
    const body = moveAllProductsSchema.safeParse(request.body);
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    return this.moveAllProducts
      .execute(request.user!.id, params.data.id, body.data.targetCategoryId)
      .then(() => response.status(204).send())
      .catch((error) => this.handleError(response, error));
  };

  private handleError(response: Response, error: unknown) {
    if (error instanceof CategoryError)
      return response
        .status(error.httpStatus)
        .json({ error: { code: error.code, message: error.message } });
    return response
      .status(500)
      .json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' } });
  }
}

function badRequest(response: Response, error: { flatten(): unknown }) {
  return response.status(400).json({ error: error.flatten() });
}
