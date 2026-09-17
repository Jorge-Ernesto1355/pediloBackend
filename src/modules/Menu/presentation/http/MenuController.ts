import { Request, Response } from 'express';
import { CreateMenu } from '../../application/useCases/CreateMenu.js';
import { DeleteMenu } from '../../application/useCases/DeleteMenu.js';
import { GetMenu } from '../../application/useCases/GetMenu.js';
import { ListMenus } from '../../application/useCases/ListMenus.js';
import { SetMenuActive } from '../../application/useCases/SetMenuActive.js';
import { UpdateMenu } from '../../application/useCases/UpdateMenu.js';
import { MenuError } from '../../domain/errors/MenuErrors.js';
import {
  businessIdSchema,
  createMenuSchema,
  menuIdSchema,
  menuStatusSchema,
  updateMenuSchema,
} from './validators/menu.schemas.js';

export class MenuController {
  constructor(
    private readonly createMenu: CreateMenu,
    private readonly getMenu: GetMenu,
    private readonly listMenus: ListMenus,
    private readonly updateMenu: UpdateMenu,
    private readonly deleteMenu: DeleteMenu,
    private readonly setMenuActive: SetMenuActive,
  ) {}

  create = (request: Request, response: Response) => {
    const params = businessIdSchema.safeParse(request.params);
    const body = createMenuSchema.safeParse(request.body);
    if (!params.success) return validationError(response, params.error);
    if (!body.success) return validationError(response, body.error);
    return this.createMenu
      .execute(request.user!.id, params.data.businessId, body.data)
      .then((menu) => response.status(201).json({ menu: menu.toJSON() }))
      .catch((error) => this.handleError(response, error));
  };

  list = (request: Request, response: Response) => {
    const params = businessIdSchema.safeParse(request.params);
    if (Object.keys(request.params).length > 0 && !params.success)
      return validationError(response, params.error);
    return this.listMenus
      .execute(request.user!.id, params.success ? params.data.businessId : undefined)
      .then((menus) => response.json({ menus: menus.map((menu) => menu.toJSON()) }))
      .catch((error) => this.handleError(response, error));
  };

  get = (request: Request, response: Response) => {
    const params = menuIdSchema.safeParse(request.params);
    if (!params.success) return validationError(response, params.error);
    return this.getMenu
      .execute(request.user!.id, params.data.id)
      .then((menu) => response.json({ menu: menu.toJSON() }))
      .catch((error) => this.handleError(response, error));
  };

  update = (request: Request, response: Response) => {
    const params = menuIdSchema.safeParse(request.params);
    const body = updateMenuSchema.safeParse(request.body);
    if (!params.success) return validationError(response, params.error);
    if (!body.success) return validationError(response, body.error);
    return this.updateMenu
      .execute(request.user!.id, params.data.id, body.data)
      .then((menu) => response.json({ menu: menu.toJSON() }))
      .catch((error) => this.handleError(response, error));
  };

  remove = (request: Request, response: Response) => {
    const params = menuIdSchema.safeParse(request.params);
    if (!params.success) return validationError(response, params.error);
    return this.deleteMenu
      .execute(request.user!.id, params.data.id)
      .then(() => response.status(204).send())
      .catch((error) => this.handleError(response, error));
  };

  setActive = (request: Request, response: Response) => {
    const params = menuIdSchema.safeParse(request.params);
    const body = menuStatusSchema.safeParse(request.body);
    if (!params.success) return validationError(response, params.error);
    if (!body.success) return validationError(response, body.error);
    return this.setMenuActive
      .execute(request.user!.id, params.data.id, body.data.isActive)
      .then((menu) => response.json({ menu: menu.toJSON() }))
      .catch((error) => this.handleError(response, error));
  };

  private handleError(response: Response, error: unknown) {
    if (error instanceof MenuError) {
      return response
        .status(error.httpStatus)
        .json({ error: { code: error.code, message: error.message } });
    }
    return response
      .status(500)
      .json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' } });
  }
}

function validationError(response: Response, error: { flatten(): unknown }) {
  return response.status(400).json({ error: error.flatten() });
}
