import { Router } from 'express';
import { prisma } from '@/libs/prisma.js';
import { env } from '@/shared/config/env.js';
import { RecordPublicStoreVisit } from '../../application/useCases/RecordPublicStoreVisit.js';
import { PrismaStoreVisitRepository } from '../../infrastructure/persistence/PrismaStoreVisitRepository.js';
import { HmacAnonymousStoreVisitorHasher } from '../../infrastructure/security/HmacAnonymousStoreVisitorHasher.js';
import { GetPublicBusinessCatalog } from '../../application/useCases/GetPublicBusinessCatalog.js';
import { PrismaPublicBusinessRepository } from '../../infrastructure/persistence/PrismaPublicBusinessRepository.js';
import { PublicBusinessController } from './PublicBusinessController.js';

const storeVisitRepository = new PrismaStoreVisitRepository(prisma);
const controller = new PublicBusinessController(
  new GetPublicBusinessCatalog(new PrismaPublicBusinessRepository(prisma)),
  new RecordPublicStoreVisit(
    storeVisitRepository,
    new HmacAnonymousStoreVisitorHasher(env.BETTER_AUTH_SECRET),
  ),
);
export const publicBusinessRouter = Router();
publicBusinessRouter.get('/businesses/:slug/catalog', controller.getCatalog);
