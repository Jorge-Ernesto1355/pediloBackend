import { Router } from 'express';
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
import { PrismaProductRepository } from '../../infrastructure/persistence/PrismaProductRepository.js';
import { ProductController } from './ProductController.js';

const repository = new PrismaProductRepository(prisma);
const controller = new ProductController(
  new CreateProduct(repository),
  new GetProduct(repository),
  new ListProducts(repository),
  new UpdateProduct(repository),
  new DeleteProduct(repository),
  new SetProductAvailable(repository),
  new MoveProductToCategory(repository),
  new ReorderProducts(repository),
);
const requireAuth = createRequireAuth(authProvider);

export const productRouter = Router();
productRouter.post('/:businessId/products', requireAuth, controller.create);
productRouter.get('/mine/products', requireAuth, controller.list);
productRouter.get('/:businessId/products', requireAuth, controller.list);
productRouter.get('/categories/:categoryId/products', requireAuth, controller.listByCategory);
productRouter.post('/categories/:categoryId/products/reorder', requireAuth, controller.reorder);
productRouter.get('/products/:productId', requireAuth, controller.get);
productRouter.patch('/products/:productId', requireAuth, controller.update);
productRouter.patch('/products/:productId/status', requireAuth, controller.setAvailable);
productRouter.patch('/products/:productId/category', requireAuth, controller.moveToCategory);
productRouter.patch('/products/:productId/move-category', requireAuth, controller.moveToCategory);
productRouter.delete('/products/:productId', requireAuth, controller.remove);
