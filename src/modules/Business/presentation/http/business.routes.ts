import { Router } from 'express';
import multer from 'multer';
import { prisma } from '@/libs/prisma.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { CreateBusiness } from '../../application/useCases/CreateBusiness.js';
import { DeleteBusiness } from '../../application/useCases/DeleteBusiness.js';
import { GetBusiness } from '../../application/useCases/GetBusiness.js';
import { ListBusinesses } from '../../application/useCases/ListBusinesses.js';
import { UpdateBusiness } from '../../application/useCases/UpdateBusiness.js';
import { PrismaBusinessRepository } from '../../infrastructure/persistence/PrismaBusinessRepository.js';
import { BusinessController } from './BusinessController.js';
import { CloudinaryImageStorage } from '../../infrastructure/storage/CloudinaryImageStorage.js';

const repository = new PrismaBusinessRepository(prisma);
const imageStorage = new CloudinaryImageStorage();
const uploadBusinessImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 2 },
  fileFilter: (_request, file, callback) => {
    callback(null, file.mimetype.startsWith('image/'));
  },
});
const controller = new BusinessController(
  new CreateBusiness(repository, imageStorage),
  new GetBusiness(repository),
  new ListBusinesses(repository),
  new UpdateBusiness(repository, imageStorage),
  new DeleteBusiness(repository, imageStorage),
);
const requireAuth = createRequireAuth(authProvider);

export const businessRouter = Router();
businessRouter.get('/', controller.list);
businessRouter.get('/slug/:slug', controller.getBySlug);
businessRouter.get('/mine', requireAuth, controller.getMine);
businessRouter.post(
  '/',
  requireAuth,
  uploadBusinessImages.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
    { name: 'image', maxCount: 1 },
  ]),
  controller.create,
);
businessRouter.get('/:id', controller.getById);
businessRouter.patch(
  '/:id',
  requireAuth,
  uploadBusinessImages.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
    { name: 'image', maxCount: 1 },
  ]),
  controller.update,
);
businessRouter.delete('/:id', requireAuth, controller.delete);
