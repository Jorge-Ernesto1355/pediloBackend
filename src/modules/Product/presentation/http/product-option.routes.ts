import { Router } from 'express';
import { prisma } from '@/libs/prisma.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
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
import { PrismaProductOptionRepository } from '../../infrastructure/persistence/PrismaProductOptionRepository.js';
import { ProductOptionController } from './ProductOptionController.js';

const repository = new PrismaProductOptionRepository(prisma);
const controller = new ProductOptionController(
  new CreateOptionGroup(repository),
  new GetOptionGroup(repository),
  new ListOptionGroups(repository),
  new UpdateOptionGroup(repository),
  new DeleteOptionGroup(repository),
  new SetOptionGroupActive(repository),
  new ReorderOptionGroups(repository),
  new CreateOption(repository),
  new GetOption(repository),
  new ListOptions(repository),
  new UpdateOption(repository),
  new DeleteOption(repository),
  new SetOptionAvailable(repository),
  new ReorderOptions(repository),
);
const requireAuth = createRequireAuth(authProvider);

export const productOptionRouter = Router();
productOptionRouter.post('/products/:productId/option-groups', requireAuth, controller.createGroup);
productOptionRouter.get(
  '/products/:productId/option-groups',
  requireAuth,
  controller.listGroupsByProduct,
);
productOptionRouter.post(
  '/products/:productId/option-groups/reorder',
  requireAuth,
  controller.reorderGroupsByProduct,
);
productOptionRouter.get('/option-groups/:optionGroupId', requireAuth, controller.getGroupById);
productOptionRouter.patch('/option-groups/:optionGroupId', requireAuth, controller.updateGroupById);
productOptionRouter.patch(
  '/option-groups/:optionGroupId/status',
  requireAuth,
  controller.setGroupStatus,
);
productOptionRouter.delete(
  '/option-groups/:optionGroupId',
  requireAuth,
  controller.deleteGroupById,
);
productOptionRouter.post(
  '/option-groups/:optionGroupId/options',
  requireAuth,
  controller.createOptionByGroup,
);
productOptionRouter.get(
  '/option-groups/:optionGroupId/options',
  requireAuth,
  controller.listOptionsByGroup,
);
productOptionRouter.post(
  '/option-groups/:optionGroupId/options/reorder',
  requireAuth,
  controller.reorderOptionsByGroup,
);
productOptionRouter.get('/options/:optionId', requireAuth, controller.getOptionById);
productOptionRouter.patch('/options/:optionId', requireAuth, controller.updateOptionById);
productOptionRouter.patch('/options/:optionId/status', requireAuth, controller.setOptionStatus);
productOptionRouter.delete('/options/:optionId', requireAuth, controller.deleteOptionById);
