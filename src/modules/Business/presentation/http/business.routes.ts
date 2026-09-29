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
// These legacy public endpoints remain available for frontend compatibility, but
// intentionally return empty payloads and never invoke a repository or use case.
// The supported public business read endpoint is the catalog route.
businessRouter.get('/', (_request, response) => response.status(200).json([]));
businessRouter.get('/slug/:slug', (_request, response) => response.status(200).json({}));
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
businessRouter.get('/:id', (_request, response) => response.status(200).json({}));
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
