import { Request, Response } from 'express';
import { CreateOptionGroup } from '../../application/useCases/CreateOptionGroup.js';
import { CreateOption } from '../../application/useCases/CreateOption.js';
import { DeleteOptionGroup } from '../../application/useCases/DeleteOptionGroup.js';
import { DeleteOption } from '../../application/useCases/DeleteOption.js';
import { GetOptionGroup } from '../../application/useCases/GetOptionGroup.js';
import { GetOption } from '../../application/useCases/GetOption.js';
import { ListOptionGroups } from '../../application/useCases/ListOptionGroups.js';
import { ListOptions } from '../../application/useCases/ListOptions.js';
import { ReorderOptionGroups } from '../../application/useCases/ReorderOptionGroups.js';
import { ReorderOptions } from '../../application/useCases/ReorderOptions.js';
import { SetOptionGroupActive } from '../../application/useCases/SetOptionGroupActive.js';
import { SetOptionAvailable } from '../../application/useCases/SetOptionAvailable.js';
import { UpdateOptionGroup } from '../../application/useCases/UpdateOptionGroup.js';
import { UpdateOption } from '../../application/useCases/UpdateOption.js';
import { ProductOptionError } from '../../domain/errors/ProductOptionErrors.js';
import {
  createOptionGroupSchema,
  createOptionSchema,
  groupStatusSchema,
  optionGroupIdSchema,
  optionIdSchema,
  optionStatusSchema,
  productIdSchema,
  reorderGroupSchema,
  reorderOptionSchema,
  updateOptionGroupSchema,
  updateOptionSchema,
} from './validators/product-option.schemas.js';

export class ProductOptionController {
  constructor(
    private readonly createGroupUseCase: CreateOptionGroup,
    private readonly getGroup: GetOptionGroup,
    private readonly listGroups: ListOptionGroups,
    private readonly updateGroup: UpdateOptionGroup,
    private readonly deleteGroup: DeleteOptionGroup,
    private readonly setGroupActive: SetOptionGroupActive,
    private readonly reorderGroups: ReorderOptionGroups,
    private readonly createOption: CreateOption,
    private readonly getOption: GetOption,
    private readonly listOptions: ListOptions,
    private readonly updateOption: UpdateOption,
    private readonly deleteOption: DeleteOption,
    private readonly setOptionAvailable: SetOptionAvailable,
    private readonly reorderOptions: ReorderOptions,
  ) {}

  createGroup = (request: Request, response: Response) => {
    const params = productIdSchema.safeParse(request.params);
    const body = createOptionGroupSchema.safeParse(request.body);
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    return this.createGroupUseCase
      .execute(request.user!.id, params.data.productId, body.data)
      .then((group) => response.status(201).json({ optionGroup: group }))
      .catch((error) => this.handleError(response, error));
  };

  getGroupById = (request: Request, response: Response) => {
    const params = optionGroupIdSchema.safeParse(request.params);
    if (!params.success) return badRequest(response, params.error);
    return this.getGroup
      .execute(request.user!.id, params.data.optionGroupId)
      .then((group) => response.json({ optionGroup: group }))
      .catch((error) => this.handleError(response, error));
  };

  listGroupsByProduct = (request: Request, response: Response) => {
    const params = productIdSchema.safeParse(request.params);
    if (!params.success) return badRequest(response, params.error);
    return this.listGroups
      .execute(request.user!.id, params.data.productId)
      .then((groups) => response.json({ optionGroups: groups }))
      .catch((error) => this.handleError(response, error));
  };

  updateGroupById = (request: Request, response: Response) => {
    const params = optionGroupIdSchema.safeParse(request.params);
    const body = updateOptionGroupSchema.safeParse(request.body);
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    return this.updateGroup
      .execute(request.user!.id, params.data.optionGroupId, body.data)
      .then((group) => response.json({ optionGroup: group }))
      .catch((error) => this.handleError(response, error));
  };

  deleteGroupById = (request: Request, response: Response) => {
    const params = optionGroupIdSchema.safeParse(request.params);
    if (!params.success) return badRequest(response, params.error);
    return this.deleteGroup
      .execute(request.user!.id, params.data.optionGroupId)
      .then(() => response.status(204).send())
      .catch((error) => this.handleError(response, error));
  };

  setGroupStatus = (request: Request, response: Response) => {
    const params = optionGroupIdSchema.safeParse(request.params);
    const body = groupStatusSchema.safeParse(request.body);
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    return this.setGroupActive
      .execute(request.user!.id, params.data.optionGroupId, body.data.isActive)
      .then((group) => response.json({ optionGroup: group }))
      .catch((error) => this.handleError(response, error));
  };

  reorderGroupsByProduct = (request: Request, response: Response) => {
    const params = productIdSchema.safeParse(request.params);
    const body = reorderGroupSchema.safeParse(request.body);
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    return this.reorderGroups
      .execute(request.user!.id, params.data.productId, body.data.optionGroupIds)
      .then((groups) => response.json({ optionGroups: groups }))
      .catch((error) => this.handleError(response, error));
  };

  createOptionByGroup = (request: Request, response: Response) => {
    const params = optionGroupIdSchema.safeParse(request.params);
    const body = createOptionSchema.safeParse(request.body);
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    return this.createOption
      .execute(request.user!.id, params.data.optionGroupId, body.data)
      .then((option) => response.status(201).json({ option }))
      .catch((error) => this.handleError(response, error));
  };

  getOptionById = (request: Request, response: Response) => {
    const params = optionIdSchema.safeParse(request.params);
    if (!params.success) return badRequest(response, params.error);
    return this.getOption
      .execute(request.user!.id, params.data.optionId)
      .then((option) => response.json({ option }))
      .catch((error) => this.handleError(response, error));
  };

  listOptionsByGroup = (request: Request, response: Response) => {
    const params = optionGroupIdSchema.safeParse(request.params);
    if (!params.success) return badRequest(response, params.error);
    return this.listOptions
      .execute(request.user!.id, params.data.optionGroupId)
      .then((options) => response.json({ options }))
      .catch((error) => this.handleError(response, error));
  };

  updateOptionById = (request: Request, response: Response) => {
    const params = optionIdSchema.safeParse(request.params);
    const body = updateOptionSchema.safeParse(request.body);
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    return this.updateOption
      .execute(request.user!.id, params.data.optionId, body.data)
      .then((option) => response.json({ option }))
      .catch((error) => this.handleError(response, error));
  };

  deleteOptionById = (request: Request, response: Response) => {
    const params = optionIdSchema.safeParse(request.params);
    if (!params.success) return badRequest(response, params.error);
    return this.deleteOption
      .execute(request.user!.id, params.data.optionId)
      .then(() => response.status(204).send())
      .catch((error) => this.handleError(response, error));
  };

  setOptionStatus = (request: Request, response: Response) => {
    const params = optionIdSchema.safeParse(request.params);
    const body = optionStatusSchema.safeParse(request.body);
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    return this.setOptionAvailable
      .execute(request.user!.id, params.data.optionId, body.data.isAvailable)
      .then((option) => response.json({ option }))
      .catch((error) => this.handleError(response, error));
  };

  reorderOptionsByGroup = (request: Request, response: Response) => {
    const params = optionGroupIdSchema.safeParse(request.params);
    const body = reorderOptionSchema.safeParse(request.body);
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    return this.reorderOptions
      .execute(request.user!.id, params.data.optionGroupId, body.data.optionIds)
      .then((options) => response.json({ options }))
      .catch((error) => this.handleError(response, error));
  };

  private handleError(response: Response, error: unknown) {
    if (error instanceof ProductOptionError)
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
