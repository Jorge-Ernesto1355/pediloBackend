import { Router } from 'express';
import { prisma } from '@/libs/prisma.js';
import { GetPublicBusinessCatalog } from '../../application/useCases/GetPublicBusinessCatalog.js';
import { PrismaPublicBusinessRepository } from '../../infrastructure/persistence/PrismaPublicBusinessRepository.js';
import { PublicBusinessController } from './PublicBusinessController.js';

const controller = new PublicBusinessController(
  new GetPublicBusinessCatalog(new PrismaPublicBusinessRepository(prisma)),
);

export const publicBusinessRouter = Router();
publicBusinessRouter.get('/businesses/:slug/catalog', controller.getCatalog);
