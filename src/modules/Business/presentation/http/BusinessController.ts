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
  businessImageTypeSchema,
} from './validators/business.schemas.js';
import { BusinessError } from '../../domain/errors/BusinessErrors.js';
import { CreateBusinessDTO, UpdateBusinessDTO } from '../../application/dto/BusinessDTO.js';

type UploadedFiles = { [fieldname: string]: Express.Multer.File[] | undefined };

export class BusinessController {
  constructor(
    private readonly createBusiness: CreateBusiness,
    private readonly getBusiness: GetBusiness,
    private readonly listBusinesses: ListBusinesses,
    private readonly updateBusiness: UpdateBusiness,
    private readonly deleteBusiness: DeleteBusiness,
  ) {}

  create = (request: Request, response: Response) => {
    const filesResult = resolveImageFiles(request);
    if ('error' in filesResult) return response.status(400).json({ error: filesResult.error });
    const parsed = createBusinessSchema.safeParse(parseMultipartBody(request.body));
    if (!parsed.success) return response.status(400).json({ error: parsed.error.flatten() });
    const dto: CreateBusinessDTO = {
      ...parsed.data,
      logoFile: filesResult.files.logo?.[0] && toImageFile(filesResult.files.logo[0]),
      coverFile: filesResult.files.cover?.[0] && toImageFile(filesResult.files.cover[0]),
    };
    return this.createBusiness
      .execute(request.user!.id, dto)
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
    const filesResult = resolveImageFiles(request);
    if ('error' in filesResult) return response.status(400).json({ error: filesResult.error });
    const files = filesResult.files;
    const normalizedBody = parseMultipartBody(request.body);
    const hasFiles = Boolean(files.logo?.length || files.cover?.length);
    const body = updateBusinessSchema.safeParse(normalizedBody);
    if (!params.success) return response.status(400).json({ error: params.error.flatten() });
    if (!body.success) return response.status(400).json({ error: body.error.flatten() });
    if (!hasFiles && Object.keys(body.data).length === 0) {
      return response.status(400).json({ error: 'At least one field is required' });
    }
    const dto: UpdateBusinessDTO = {
      ...body.data,
      logoFile: files.logo?.[0] && toImageFile(files.logo[0]),
      coverFile: files.cover?.[0] && toImageFile(files.cover[0]),
    };
    return this.updateBusiness
      .execute(request.user!.id, params.data.id, dto)
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

function getUploadedFiles(request: Request): UploadedFiles {
  return (request.files ?? {}) as UploadedFiles;
}

function resolveImageFiles(request: Request): { files: UploadedFiles } | { error: string } {
  const files = getUploadedFiles(request);
  const hasSingleImage = Boolean(files.image?.length);
  const type = request.body.type;
  if (hasSingleImage) {
    const parsedType = businessImageTypeSchema.safeParse(type);
    if (!parsedType.success) return { error: 'The type field must be logo or cover' };
    return {
      files: {
        ...files,
        [parsedType.data]: files.image,
      },
    };
  }
  if (type !== undefined) {
    const parsedType = businessImageTypeSchema.safeParse(type);
    if (!parsedType.success) return { error: 'The type field must be logo or cover' };
    const hasLogo = Boolean(files.logo?.length);
    const hasCover = Boolean(files.cover?.length);
    if ((parsedType.data === 'logo' && hasCover) || (parsedType.data === 'cover' && hasLogo)) {
      return { error: 'The type field does not match the uploaded image field' };
    }
  }
  return { files };
}

function toImageFile(file: Express.Multer.File) {
  return { buffer: file.buffer, mimetype: file.mimetype };
}

function parseMultipartBody(body: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...body };
  delete normalized.type;
  for (const field of ['ubicationMaps', 'businessSchedule']) {
    if (typeof normalized[field] !== 'string') continue;
    try {
      normalized[field] = JSON.parse(normalized[field]);
    } catch {
      // Zod will return the appropriate validation error for malformed JSON.
    }
  }
  return normalized;
}
