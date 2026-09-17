import { Request, Response } from 'express';
import { CreateProduct } from '../../application/useCases/CreateProduct.js';
import { DeleteProduct } from '../../application/useCases/DeleteProduct.js';
import { GetProduct } from '../../application/useCases/GetProduct.js';
import { ListProducts } from '../../application/useCases/ListProducts.js';
import { MoveProductToCategory } from '../../application/useCases/MoveProductToCategory.js';
import { ReorderProducts } from '../../application/useCases/ReorderProducts.js';
import { SetProductAvailable } from '../../application/useCases/SetProductAvailable.js';
import { UpdateProduct } from '../../application/useCases/UpdateProduct.js';
import { ProductError } from '../../domain/errors/ProductErrors.js';
import {
  businessIdSchema,
  categoryIdSchema,
  createProductSchema,
  moveProductSchema,
  productIdSchema,
  productListQuerySchema,
  productStatusSchema,
  reorderProductsSchema,
  updateProductSchema,
} from './validators/product.schemas.js';

export class ProductController {
  constructor(
    private readonly createProduct: CreateProduct,
    private readonly getProduct: GetProduct,
    private readonly listProducts: ListProducts,
    private readonly updateProduct: UpdateProduct,
    private readonly deleteProduct: DeleteProduct,
    private readonly setProductAvailable: SetProductAvailable,
    private readonly moveProduct: MoveProductToCategory,
    private readonly reorderProducts: ReorderProducts,
  ) {}

  create = (request: Request, response: Response) => {
    const params = businessIdSchema.safeParse(request.params);
    const body = createProductSchema.safeParse(request.body);
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    return this.createProduct
      .execute(request.user!.id, params.data.businessId, body.data)
      .then((product) => response.status(201).json({ product: product.toJSON() }))
      .catch((error) => this.handleError(response, error));
  };

  get = (request: Request, response: Response) => {
    const params = productIdSchema.safeParse(request.params);
    if (!params.success) return badRequest(response, params.error);
    return this.getProduct
      .execute(request.user!.id, params.data.productId)
      .then((product) => response.json({ product: product.toJSON() }))
      .catch((error) => this.handleError(response, error));
  };

  list = (request: Request, response: Response) => {
    const params = businessIdSchema.safeParse(request.params);
    const query = productListQuerySchema.safeParse(request.query);
    if (Object.keys(request.params).length > 0 && !params.success)
      return badRequest(response, params.error);
    if (!query.success) return badRequest(response, query.error);
    return this.listProducts
      .execute(request.user!.id, {
        businessId: params.success ? params.data.businessId : undefined,
        ...query.data,
      })
      .then((products) => response.json({ products: products.map((product) => product.toJSON()) }))
      .catch((error) => this.handleError(response, error));
  };

  listByCategory = (request: Request, response: Response) => {
    const params = categoryIdSchema.safeParse(request.params);
    const query = productListQuerySchema.safeParse(request.query);
    if (!params.success) return badRequest(response, params.error);
    if (!query.success) return badRequest(response, query.error);
    return this.listProducts
      .execute(request.user!.id, { categoryId: params.data.categoryId, ...query.data })
      .then((products) => response.json({ products: products.map((product) => product.toJSON()) }))
      .catch((error) => this.handleError(response, error));
  };

  update = (request: Request, response: Response) => {
    const params = productIdSchema.safeParse(request.params);
    const body = updateProductSchema.safeParse(request.body);
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    return this.updateProduct
      .execute(request.user!.id, params.data.productId, body.data)
      .then((product) => response.json({ product: product.toJSON() }))
      .catch((error) => this.handleError(response, error));
  };

  remove = (request: Request, response: Response) => {
    const params = productIdSchema.safeParse(request.params);
    if (!params.success) return badRequest(response, params.error);
    return this.deleteProduct
      .execute(request.user!.id, params.data.productId)
      .then(() => response.status(204).send())
      .catch((error) => this.handleError(response, error));
  };

  setAvailable = (request: Request, response: Response) => {
    const params = productIdSchema.safeParse(request.params);
    const body = productStatusSchema.safeParse(request.body);
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    return this.setProductAvailable
      .execute(request.user!.id, params.data.productId, body.data.isAvailable)
      .then((product) => response.json({ product: product.toJSON() }))
      .catch((error) => this.handleError(response, error));
  };

  moveToCategory = (request: Request, response: Response) => {
    const params = productIdSchema.safeParse(request.params);
    const body = moveProductSchema.safeParse(request.body);
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    return this.moveProduct
      .execute(request.user!.id, params.data.productId, body.data.targetCategoryId)
      .then((product) => response.json({ product: product.toJSON() }))
      .catch((error) => this.handleError(response, error));
  };

  reorder = (request: Request, response: Response) => {
    const params = categoryIdSchema.safeParse(request.params);
    const body = reorderProductsSchema.safeParse(request.body);
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    return this.reorderProducts
      .execute(request.user!.id, params.data.categoryId, body.data.productIds)
      .then((products) => response.json({ products: products.map((product) => product.toJSON()) }))
      .catch((error) => this.handleError(response, error));
  };

  private handleError(response: Response, error: unknown) {
    console.log(error);
    if (error instanceof ProductError)
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
