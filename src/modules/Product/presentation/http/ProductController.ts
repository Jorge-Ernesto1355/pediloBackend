import { Request, Response } from 'express';
import { CreateProduct } from '../../application/useCases/CreateProduct.js';
import { DeleteProduct } from '../../application/useCases/DeleteProduct.js';
import { GetProduct } from '../../application/useCases/GetProduct.js';
import { ListProducts } from '../../application/useCases/ListProducts.js';
import { MoveProductToCategory } from '../../application/useCases/MoveProductToCategory.js';
import { ReorderProducts } from '../../application/useCases/ReorderProducts.js';
import { SetProductAvailable } from '../../application/useCases/SetProductAvailable.js';
import { UpdateProduct } from '../../application/useCases/UpdateProduct.js';
import { ListProductsAdmin } from '../../application/useCases/ListProductsAdmin.js';
import { GetProductStatistics } from '../../application/useCases/GetProductStatistics.js';
import {
  GetBestSellingProducts,
  GetMostRequestedProducts,
} from '../../application/useCases/GetProductAnalytics.js';
import { GetProductAnalyticsSummary } from '../../application/useCases/GetProductAnalyticsSummary.js';
import { ProductError } from '../../domain/errors/ProductErrors.js';
import { Product } from '../../domain/entities/Product.js';
import { isSupportedImageFile } from '@/shared/validation/image-file.js';
import {
  businessIdSchema,
  categoryIdSchema,
  createProductSchema,
  moveProductSchema,
  productIdSchema,
  productListQuerySchema,
  productStatusSchema,
  productAdminQuerySchema,
  productAnalyticsQuerySchema,
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
    private readonly listProductsAdmin: ListProductsAdmin,
    private readonly getProductStatistics: GetProductStatistics,
    private readonly getBestSellingProducts: GetBestSellingProducts,
    private readonly getMostRequestedProducts: GetMostRequestedProducts,
    private readonly getProductAnalyticsSummary: GetProductAnalyticsSummary,
  ) {}

  create = (request: Request, response: Response) => {
    if (request.file && !isSupportedImageFile(request.file)) {
      return response.status(400).json({ error: 'Unsupported or invalid image file' });
    }
    const params = businessIdSchema.safeParse(request.params);
    const body = createProductSchema.safeParse(parseMultipartBody(request.body));
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    const { active, isAvailable, ...fields } = body.data;
    return this.createProduct
      .execute(request.user!.id, params.data.businessId, {
        ...fields,
        isAvailable: active ?? isAvailable,
        imageFile: request.file && toImageFile(request.file),
      })
      .then((product) => response.status(201).json({ product: serializeProduct(product) }))
      .catch((error) => this.handleError(response, error));
  };

  get = (request: Request, response: Response) => {
    const params = productIdSchema.safeParse(request.params);
    if (!params.success) return badRequest(response, params.error);
    return this.getProduct
      .execute(request.user!.id, params.data.productId)
      .then((product) => response.json({ product: serializeProduct(product) }))
      .catch((error) => this.handleError(response, error));
  };

  list = (request: Request, response: Response) => {
    const params = businessIdSchema.safeParse(request.params);
    if (Object.keys(request.params).length > 0 && !params.success)
      return badRequest(response, params.error);
    if (params.success) {
      const query = productAdminQuerySchema.safeParse(request.query);
      if (!query.success) return badRequest(response, query.error);
      return this.listProductsAdmin
        .execute(request.user!.id, { businessId: params.data.businessId, ...query.data })
        .then(({ products, total }) =>
          response.json({
            products: products.map(serializeProduct),
            pagination: {
              page: query.data.page,
              limit: query.data.limit,
              total,
              totalPages: Math.ceil(total / query.data.limit),
            },
          }),
        )
        .catch((error) => this.handleError(response, error));
    }
    const query = productListQuerySchema.safeParse(request.query);
    if (!query.success) return badRequest(response, query.error);
    return this.listProducts
      .execute(request.user!.id, {
        ...query.data,
      })
      .then((products) => response.json({ products: products.map(serializeProduct) }))
      .catch((error) => this.handleError(response, error));
  };

  listByCategory = (request: Request, response: Response) => {
    const params = categoryIdSchema.safeParse(request.params);
    const query = productListQuerySchema.safeParse(request.query);
    if (!params.success) return badRequest(response, params.error);
    if (!query.success) return badRequest(response, query.error);
    return this.listProducts
      .execute(request.user!.id, { categoryId: params.data.categoryId, ...query.data })
      .then((products) => response.json({ products: products.map(serializeProduct) }))
      .catch((error) => this.handleError(response, error));
  };

  update = (request: Request, response: Response) => {
    if (request.file && !isSupportedImageFile(request.file)) {
      return response.status(400).json({ error: 'Unsupported or invalid image file' });
    }
    const params = productIdSchema.safeParse(request.params);
    const body = updateProductSchema.safeParse(parseMultipartBody(request.body));
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    if (!request.file && Object.keys(body.data).length === 0)
      return response.status(400).json({ error: 'At least one field is required' });
    const { active, isAvailable, ...fields } = body.data;
    return this.updateProduct
      .execute(request.user!.id, params.data.productId, {
        ...fields,
        ...(active === undefined && isAvailable === undefined
          ? {}
          : { isAvailable: active ?? isAvailable }),
        imageFile: request.file && toImageFile(request.file),
      })
      .then((product) => response.json({ product: serializeProduct(product) }))
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
      .then((product) => response.json({ product: serializeProduct(product) }))
      .catch((error) => this.handleError(response, error));
  };

  stats = (request: Request, response: Response) => {
    const params = businessIdSchema.safeParse(request.params);
    if (!params.success) return badRequest(response, params.error);
    return this.getProductStatistics
      .execute(request.user!.id, params.data.businessId)
      .then((stats) => response.json({ stats }))
      .catch((error) => this.handleError(response, error));
  };

  bestSelling = (request: Request, response: Response) =>
    this.analytics(request, response, (filters) =>
      this.getBestSellingProducts.execute(request.user!.id, filters),
    );

  mostRequested = (request: Request, response: Response) =>
    this.analytics(request, response, (filters) =>
      this.getMostRequestedProducts.execute(request.user!.id, filters),
    );

  summary = (request: Request, response: Response) => {
    const params = businessIdSchema.safeParse(request.params);
    const query = productAnalyticsQuerySchema.safeParse(request.query);
    if (!params.success) return badRequest(response, params.error);
    if (!query.success) return badRequest(response, query.error);
    return this.getProductAnalyticsSummary
      .execute(request.user!.id, { businessId: params.data.businessId, ...query.data })
      .then((summary) => response.json({ summary }))
      .catch((error) => this.handleError(response, error));
  };

  private analytics(
    request: Request,
    response: Response,
    execute: (filters: {
      businessId: string;
      from?: Date;
      to?: Date;
      categoryId?: string;
      limit: number;
    }) => Promise<unknown[]>,
  ) {
    const params = businessIdSchema.safeParse(request.params);
    const query = productAnalyticsQuerySchema.safeParse(request.query);
    if (!params.success) return badRequest(response, params.error);
    if (!query.success) return badRequest(response, query.error);
    return execute({ businessId: params.data.businessId, ...query.data })
      .then((products) => response.json({ products }))
      .catch((error) => this.handleError(response, error));
  }

  moveToCategory = (request: Request, response: Response) => {
    const params = productIdSchema.safeParse(request.params);
    const body = moveProductSchema.safeParse(request.body);
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    return this.moveProduct
      .execute(request.user!.id, params.data.productId, body.data.targetCategoryId)
      .then((product) => response.json({ product: serializeProduct(product) }))
      .catch((error) => this.handleError(response, error));
  };

  reorder = (request: Request, response: Response) => {
    const params = categoryIdSchema.safeParse(request.params);
    const body = reorderProductsSchema.safeParse(request.body);
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    return this.reorderProducts
      .execute(request.user!.id, params.data.categoryId, body.data.productIds)
      .then((products) => response.json({ products: products.map(serializeProduct) }))
      .catch((error) => this.handleError(response, error));
  };

  private handleError(response: Response, error: unknown) {
    console.log(error)
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
  return response.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: error.flatten(),
    },
  });
}

function toImageFile(file: Express.Multer.File) {
  return { buffer: file.buffer, mimetype: file.mimetype };
}

function parseMultipartBody(body: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...body };
  for (const field of ['price', 'sortOrder']) {
    if (typeof normalized[field] === 'string' && normalized[field].trim() !== '') {
      const value = Number(normalized[field]);
      if (Number.isFinite(value)) normalized[field] = value;
    }
  }
  for (const field of ['active', 'isAvailable']) {
    if (normalized[field] === 'true') normalized[field] = true;
    if (normalized[field] === 'false') normalized[field] = false;
  }
  return normalized;
}

function serializeProduct(product: Product) {
  const data = product.toJSON();
  return { ...data, active: data.isAvailable };
}
