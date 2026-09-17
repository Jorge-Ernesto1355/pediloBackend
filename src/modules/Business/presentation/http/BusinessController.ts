import { NextFunction, Request, Response } from 'express';
import { CreateBusiness } from '../../application/useCases/CreateBusiness.js';
import { DeleteBusiness } from '../../application/useCases/DeleteBusiness.js';
import { GetBusiness } from '../../application/useCases/GetBusiness.js';
import { ListBusinesses } from '../../application/useCases/ListBusinesses.js';
import { UpdateBusiness } from '../../application/useCases/UpdateBusiness.js';
import {
  businessIdSchema,
  businessSlugSchema,
  createBusinessSchema,
  paginationSchema,
  updateBusinessSchema,
} from './validators/business.schemas.js';
import { BusinessError } from '../../domain/errors/BusinessErrors.js';

export class BusinessController {
  constructor(
    private readonly createBusiness: CreateBusiness,
    private readonly getBusiness: GetBusiness,
    private readonly listBusinesses: ListBusinesses,
    private readonly updateBusiness: UpdateBusiness,
    private readonly deleteBusiness: DeleteBusiness,
  ) {}

  create = (request: Request, response: Response) => {
    const parsed = createBusinessSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: parsed.error.flatten() });
    return this.createBusiness
      .execute(request.user!.id, parsed.data)
      .then((business) => response.status(201).json({ business: business.toJSON() }))
      .catch((error) => this.handleError(response, error));
  };

  getMine = (request: Request, response: Response, next: NextFunction) =>
    this.getBusiness
      .execute(request.user!.id)
      .then((business) => response.json({ business: business?.toJSON() ?? null }))
      .catch(next);

  getById = (request: Request, response: Response, next: NextFunction) => {
    const parsed = businessIdSchema.safeParse(request.params);
    if (!parsed.success) return response.status(400).json({ error: parsed.error.flatten() });
    return this.getBusiness
      .byId(parsed.data.id)
      .then((business) => response.json({ business: business.toJSON() }))
      .catch(next);
  };

  getBySlug = (request: Request, response: Response, next: NextFunction) => {
    const parsed = businessSlugSchema.safeParse(request.params);
    if (!parsed.success) return response.status(400).json({ error: parsed.error.flatten() });
    return this.getBusiness
      .bySlug(parsed.data.slug)
      .then((business) => response.json({ business: business.toJSON() }))
      .catch(next);
  };

  list = (request: Request, response: Response, next: NextFunction) => {
    const parsed = paginationSchema.safeParse(request.query);
    if (!parsed.success) return response.status(400).json({ error: parsed.error.flatten() });
    return this.listBusinesses
      .execute(parsed.data.page, parsed.data.limit)
      .then((businesses) =>
        response.json({
          businesses: businesses.map((business) => business.toJSON()),
          page: parsed.data.page,
          limit: parsed.data.limit,
        }),
      )
      .catch(next);
  };

  update = (request: Request, response: Response, next: NextFunction) => {
    const params = businessIdSchema.safeParse(request.params);
    const body = updateBusinessSchema.safeParse(request.body);
    if (!params.success) return response.status(400).json({ error: params.error.flatten() });
    if (!body.success) return response.status(400).json({ error: body.error.flatten() });
    return this.updateBusiness
      .execute(request.user!.id, params.data.id, body.data)
      .then((business) => response.json({ business: business.toJSON() }))
      .catch(next);
  };

  delete = (request: Request, response: Response, next: NextFunction) => {
    const parsed = businessIdSchema.safeParse(request.params);
    if (!parsed.success) return response.status(400).json({ error: parsed.error.flatten() });
    return this.deleteBusiness
      .execute(request.user!.id, parsed.data.id)
      .then(() => response.status(204).send())
      .catch(next);
  };

  private handleError(res: Response, error: unknown) {
    if (error instanceof BusinessError) {
      return res
        .status(error.httpStatus)
        .json({ error: { code: error.code, message: error.message } });
    }
    console.log(error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' } });
  }
}
