import { Router } from 'express';
import { prisma } from '@/libs/prisma.js';
import { authBaseUrl, env } from '@/shared/config/env.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { GetGoogleReviewLink } from '../../application/useCases/GetGoogleReviewLink.js';
import { GenerateGoogleReviewQr } from '../../application/useCases/GenerateGoogleReviewQr.js';
import { SaveGoogleReviewLink } from '../../application/useCases/SaveGoogleReviewLink.js';
import { PrismaGoogleReviewRepository } from '../../infrastructure/persistence/PrismaGoogleReviewRepository.js';
import { QrcodeGenerator } from '../../infrastructure/qr/QrcodeGenerator.js';
import { GoogleReviewController } from './GoogleReviewController.js';
import { TrackGoogleReviewScan } from '../../application/useCases/TrackGoogleReviewScan.js';
import { GetGoogleReviewStats } from '../../application/useCases/GetGoogleReviewStats.js';
import { HmacAnonymousVisitorHasher } from '../../infrastructure/security/HmacAnonymousVisitorHasher.js';
import { GoogleReviewTrackingController } from './GoogleReviewTrackingController.js';

const repository = new PrismaGoogleReviewRepository(prisma);
const controller = new GoogleReviewController(
  new GetGoogleReviewLink(repository),
  new SaveGoogleReviewLink(repository),
  new GenerateGoogleReviewQr(repository, new QrcodeGenerator(), authBaseUrl),
);
const requireAuth = createRequireAuth(authProvider);
const trackingController = new GoogleReviewTrackingController(
  new TrackGoogleReviewScan(repository, new HmacAnonymousVisitorHasher(env.BETTER_AUTH_SECRET)),
  new GetGoogleReviewStats(repository),
);
export const googleReviewRouter = Router();
googleReviewRouter.get('/google-reviews', requireAuth, controller.get);
googleReviewRouter.put('/google-reviews', requireAuth, controller.save);
googleReviewRouter.get('/google-reviews/qr', requireAuth, controller.qr);
googleReviewRouter.get('/google-reviews/stats', requireAuth, trackingController.stats);
export const googleReviewTrackingRouter = Router();
googleReviewTrackingRouter.get('/:qrCode', trackingController.redirect);
