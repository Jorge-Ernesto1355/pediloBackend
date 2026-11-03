import { Request, Response } from 'express';
import { ManageComboOptions } from '../../application/useCases/ManageComboOptions.js';
import {
  comboChoiceProductParamsSchema,
  comboIncludedProductParamsSchema,
  comboOptionGroupParamsSchema,
  comboProductParamsSchema,
  createComboOptionGroupSchema,
  updateComboOptionGroupSchema,
  addComboChoiceProductSchema,
} from './validators/combo-option.schemas.js';
import { ComboOptionError } from '../../domain/errors/ComboOptionErrors.js';

export class ComboOptionController {
  constructor(private readonly manageComboOptions: ManageComboOptions) {}

  getCombo = (request: Request, response: Response) => {
    const params = comboProductParamsSchema.safeParse(request.params);
    if (!params.success) return badRequest(response, params.error);
    return this.manageComboOptions
      .getCombo(request.user!.id, params.data.productId)
      .then((combo) =>
        combo
          ? response.json({ combo })
          : response.status(404).json({ error: { code: 'COMBO_PRODUCT_NOT_FOUND' } }),
      )
      .catch((error) => this.handleError(response, error));
  };

  createGroup = (request: Request, response: Response) => {
    const params = comboProductParamsSchema.safeParse(request.params);
    const body = createComboOptionGroupSchema.safeParse(request.body);
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    if (body.data.productIds.includes(params.data.productId)) {
      return response.status(400).json({
        error: { code: 'INVALID_COMBO_CHOICE', message: 'Un combo no puede incluirse a sí mismo.' },
      });
    }
    return this.manageComboOptions
      .createGroup(request.user!.id, params.data.productId, body.data)
      .then((group) => response.status(201).json({ group }))
      .catch((error) => this.handleError(response, error));
  };

  updateGroup = (request: Request, response: Response) => {
    const params = comboOptionGroupParamsSchema.safeParse(request.params);
    const body = updateComboOptionGroupSchema.safeParse(request.body);
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    return this.manageComboOptions
      .updateGroup(request.user!.id, params.data.productId, params.data.groupId, body.data)
      .then((group) =>
        group
          ? response.json({ group })
          : response.status(404).json({ error: { code: 'COMBO_OPTION_GROUP_NOT_FOUND' } }),
      )
      .catch((error) => this.handleError(response, error));
  };

  addProduct = (request: Request, response: Response) => {
    const params = comboOptionGroupParamsSchema.safeParse(request.params);
    const body = addComboChoiceProductSchema.safeParse(request.body);
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    if (body.data.productId === params.data.productId) {
      return response.status(400).json({
        error: { code: 'INVALID_COMBO_CHOICE', message: 'Un combo no puede incluirse a sí mismo.' },
      });
    }
    return this.manageComboOptions
      .addProduct(request.user!.id, params.data.productId, params.data.groupId, body.data.productId)
      .then((option) => response.status(201).json({ option }))
      .catch((error) => this.handleError(response, error));
  };

  removeProduct = (request: Request, response: Response) => {
    const params = comboChoiceProductParamsSchema.safeParse(request.params);
    if (!params.success) return badRequest(response, params.error);
    return this.manageComboOptions
      .removeProduct(
        request.user!.id,
        params.data.productId,
        params.data.groupId,
        params.data.choiceProductId,
      )
      .then((removed) =>
        removed
          ? response.status(204).send()
          : response.status(404).json({ error: { code: 'COMBO_OPTION_GROUP_NOT_FOUND' } }),
      )
      .catch((error) => this.handleError(response, error));
  };

  deleteGroup = (request: Request, response: Response) => {
    const params = comboOptionGroupParamsSchema.safeParse(request.params);
    if (!params.success) return badRequest(response, params.error);
    return this.manageComboOptions
      .deleteGroup(request.user!.id, params.data.productId, params.data.groupId)
      .then((removed) =>
        removed
          ? response.status(204).send()
          : response.status(404).json({ error: { code: 'COMBO_OPTION_GROUP_NOT_FOUND' } }),
      )
      .catch((error) => this.handleError(response, error));
  };

  addIncludedProduct = (request: Request, response: Response) => {
    const params = comboProductParamsSchema.safeParse(request.params);
    const body = addComboChoiceProductSchema.safeParse(request.body);
    if (!params.success) return badRequest(response, params.error);
    if (!body.success) return badRequest(response, body.error);
    if (body.data.productId === params.data.productId) {
      return response.status(400).json({
        error: { code: 'INVALID_COMBO_CHOICE', message: 'Un combo no puede incluirse a sí mismo.' },
      });
    }
    return this.manageComboOptions
      .addIncludedProduct(request.user!.id, params.data.productId, body.data.productId)
      .then((includedProduct) => response.status(201).json({ includedProduct }))
      .catch((error) => this.handleError(response, error));
  };

  removeIncludedProduct = (request: Request, response: Response) => {
    const params = comboIncludedProductParamsSchema.safeParse(request.params);
    if (!params.success) return badRequest(response, params.error);
    return this.manageComboOptions
      .removeIncludedProduct(request.user!.id, params.data.productId, params.data.includedProductId)
      .then((removed) =>
        removed
          ? response.status(204).send()
          : response.status(404).json({ error: { code: 'COMBO_INCLUDED_PRODUCT_NOT_FOUND' } }),
      )
      .catch((error) => this.handleError(response, error));
  };

  private handleError(response: Response, error: unknown) {
    if (error instanceof ComboOptionError) {
      return response
        .status(error.httpStatus)
        .json({ error: { code: error.code, message: error.message } });
    }
    return response
      .status(500)
      .json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' } });
  }
}

function badRequest(response: Response, error: { flatten(): unknown }) {
  return response.status(400).json({ error: error.flatten() });
}
