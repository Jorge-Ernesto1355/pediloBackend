import { Router } from 'express';
import multer from 'multer';
import { prisma } from '@/libs/prisma.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { CreateProduct } from '../../application/useCases/CreateProduct.js';
import { DeleteProduct } from '../../application/useCases/DeleteProduct.js';
import { GetProduct } from '../../application/useCases/GetProduct.js';
import { ListProducts } from '../../application/useCases/ListProducts.js';
import { MoveProductToCategory } from '../../application/useCases/MoveProductToCategory.js';
import { ReorderProducts } from '../../application/useCases/ReorderProducts.js';
import { SetProductAvailable } from '../../application/useCases/SetProductAvailable.js';
import { UpdateProduct } from '../../application/useCases/UpdateProduct.js';
import { ListProductsAdmin } from '../../application/useCases/ListProductsAdmin.js';
import { GetProductStatistics } from '../../application/useCases/GetProductStatistics.js';
import {
  GetBestSellingProducts,
  GetMostRequestedProducts,
} from '../../application/useCases/GetProductAnalytics.js';
import { GetProductAnalyticsSummary } from '../../application/useCases/GetProductAnalyticsSummary.js';
import { PrismaProductRepository } from '../../infrastructure/persistence/PrismaProductRepository.js';
import { CloudinaryProductImageStorage } from '../../infrastructure/storage/CloudinaryProductImageStorage.js';
import { ProductController } from './ProductController.js';

const repository = new PrismaProductRepository(prisma);
const imageStorage = new CloudinaryProductImageStorage();
const uploadProductImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => callback(null, file.mimetype.startsWith('image/')),
});
const controller = new ProductController(
  new CreateProduct(repository, imageStorage),
  new GetProduct(repository),
  new ListProducts(repository),
  new UpdateProduct(repository, imageStorage),
  new DeleteProduct(repository),
  new SetProductAvailable(repository),
  new MoveProductToCategory(repository),
  new ReorderProducts(repository),
  new ListProductsAdmin(repository),
  new GetProductStatistics(repository),
  new GetBestSellingProducts(repository),
  new GetMostRequestedProducts(repository),
  new GetProductAnalyticsSummary(
    new GetProductStatistics(repository),
    new GetBestSellingProducts(repository),
    new GetMostRequestedProducts(repository),
  ),
);
const requireAuth = createRequireAuth(authProvider);

export const productRouter = Router();
productRouter.post(
  '/:businessId/products',
  requireAuth,
  uploadProductImage.single('image'),
  controller.create,
);
productRouter.get('/:businessId/products/stats', requireAuth, controller.stats);
productRouter.get(
  '/:businessId/products/analytics/best-selling',
  requireAuth,
  controller.bestSelling,
);
productRouter.get(
  '/:businessId/products/analytics/most-requested',
  requireAuth,
  controller.mostRequested,
);
productRouter.get('/:businessId/products/analytics/summary', requireAuth, controller.summary);
productRouter.get('/mine/products', requireAuth, controller.list);
productRouter.get('/:businessId/products', requireAuth, controller.list);
productRouter.get('/categories/:categoryId/products', requireAuth, controller.listByCategory);
productRouter.post('/categories/:categoryId/products/reorder', requireAuth, controller.reorder);
productRouter.get('/products/:productId', requireAuth, controller.get);
productRouter.patch(
  '/products/:productId',
  requireAuth,
  uploadProductImage.single('image'),
  controller.update,
);
productRouter.patch('/products/:productId/status', requireAuth, controller.setAvailable);
productRouter.patch('/products/:productId/category', requireAuth, controller.moveToCategory);
productRouter.patch('/products/:productId/move-category', requireAuth, controller.moveToCategory);
productRouter.delete('/products/:productId', requireAuth, controller.remove);
