import { Router } from 'express';
import { z } from 'zod';
import { DiscountStatus } from '@prisma/client';
import { prisma } from '@/libs/prisma.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { AppError } from '@/shared/errors/app-error.js';
import { priceWithDiscount } from '@/modules/Discount/domain/pricing.js';

const requireAuth = createRequireAuth(authProvider);
const router = Router();
const recentRequests = new Map<string, { at: number; value: unknown }>();

const inputSchema = z.object({
  name: z.string().trim().min(2).max(60),
  type: z.string().transform((value) => value.toUpperCase()).pipe(z.enum(['PERCENT', 'FIXED'])),
  value: z.coerce.number().finite(),
  scope: z.string().transform((value) => value.toUpperCase()).pipe(z.enum(['PRODUCTS', 'CATEGORIES', 'MENU'])),
  endsAt: z.string().datetime().optional(), ends_at: z.string().datetime().optional(),
  productIds: z.array(z.string().min(1)).optional(), product_ids: z.array(z.string().min(1)).optional(),
  categoryIds: z.array(z.string().min(1)).optional(), category_ids: z.array(z.string().min(1)).optional(),
  menuIds: z.array(z.string().min(1)).optional(), menu_ids: z.array(z.string().min(1)).optional(),
}).passthrough();

const businessIdFor = (request: { user?: { id: string } }) => prisma.user.findUnique({ where: { id: request.user!.id }, select: { businessId: true } }).then((user) => user?.businessId ?? null);

function parseInput(body: unknown) {
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) throw new AppError('Los datos del descuento no son válidos', 400, 'VALIDATION_ERROR');
  const endsAt = new Date(parsed.data.endsAt ?? parsed.data.ends_at ?? '');
  if (Number.isNaN(endsAt.getTime())) throw new AppError('La fecha de término no es válida', 400, 'VALIDATION_ERROR');
  const now = Date.now();
  if (endsAt.getTime() <= now + 60_000 || endsAt.getTime() > now + 365 * 24 * 60 * 60 * 1000) throw new AppError('El descuento debe terminar entre 1 minuto y 365 días', 400, 'VALIDATION_ERROR');
  if (parsed.data.type === 'PERCENT' && (!Number.isInteger(parsed.data.value) || parsed.data.value < 1 || parsed.data.value > 100)) throw new AppError('El porcentaje debe ser un entero entre 1 y 100', 400, 'VALIDATION_ERROR');
  if (parsed.data.type === 'FIXED' && (parsed.data.value <= 0 || parsed.data.value > 100000 || Math.round(parsed.data.value * 100) !== parsed.data.value * 100)) throw new AppError('El descuento fijo debe ser mayor a 0 y tener máximo 2 decimales', 400, 'VALIDATION_ERROR');
  const productIds = parsed.data.productIds ?? parsed.data.product_ids ?? [];
  const categoryIds = parsed.data.categoryIds ?? parsed.data.category_ids ?? [];
  const menuIds = parsed.data.menuIds ?? parsed.data.menu_ids ?? [];
  if (parsed.data.scope === 'PRODUCTS' && productIds.length === 0) throw new AppError('Selecciona al menos un producto', 400, 'VALIDATION_ERROR');
  if (parsed.data.scope === 'CATEGORIES' && categoryIds.length === 0) throw new AppError('Selecciona al menos una categoría', 400, 'VALIDATION_ERROR');
  if (parsed.data.scope === 'MENU' && menuIds.length === 0) throw new AppError('Selecciona al menos un menú', 400, 'VALIDATION_ERROR');
  return { name: parsed.data.name, type: parsed.data.type, value: parsed.data.value, scope: parsed.data.scope, endsAt, productIds, categoryIds, menuIds };
}

async function affectedProductIds(businessId: string, input: { scope: string; productIds: string[]; categoryIds: string[]; menuIds: string[] }) {
  if (input.scope === 'MENU') return (await prisma.product.findMany({ where: { businessId, category: { menuId: { in: input.menuIds } } }, select: { id: true } })).map((p) => p.id);
  if (input.scope === 'PRODUCTS') {
    const products = await prisma.product.findMany({ where: { businessId, id: { in: input.productIds } }, select: { id: true } });
    if (products.length !== input.productIds.length) throw new AppError('Uno o más productos no pertenecen al negocio', 400, 'VALIDATION_ERROR');
    return products.map((p) => p.id);
  }
  const categories = await prisma.category.findMany({ where: { businessId, id: { in: input.categoryIds } }, select: { id: true, products: { select: { id: true } } } });
  if (categories.length !== input.categoryIds.length) throw new AppError('Una o más categorías no pertenecen al negocio', 400, 'VALIDATION_ERROR');
  return categories.flatMap((category) => category.products.map((product) => product.id));
}

async function assertNoConflict(businessId: string, ids: string[], excludeId?: string) {
  if (!ids.length) return;
  const current = await prisma.discount.findMany({ where: { businessId, status: DiscountStatus.ACTIVE, startsAt: { lte: new Date() }, endsAt: { gt: new Date() }, ...(excludeId ? { id: { not: excludeId } } : {}) }, include: { products: true, menus: { include: { menu: { include: { categories: { include: { products: { select: { id: true } } } } } } } }, categories: { include: { category: { include: { products: { select: { id: true } } } } } } } });
  const affected = new Set(ids);
  const conflict = current.find((discount) => [...discount.products.map((item) => item.productId), ...discount.menus.flatMap((item) => item.menu.categories.flatMap((category) => category.products.map((product) => product.id))), ...discount.categories.flatMap((item) => item.category.products.map((product) => product.id))].some((id) => affected.has(id)));
  if (conflict) throw new AppError('El descuento se traslapa con otro descuento activo', 409, 'DISCOUNT_CONFLICT');
}

function dto(discount: any) {
  const now = new Date();
  const status = discount.status ?? (discount.endsAt <= now ? 'FINISHED' : 'ACTIVE');
  const targetSummary = discount.scope === 'MENU'
    ? (discount.menus?.length ? `${discount.menus.length} ${discount.menus.length === 1 ? 'menú' : 'menús'}` : 'Todo el menú')
    : discount.scope === 'CATEGORIES'
      ? `${discount.categories?.length ?? 0} ${discount.categories?.length === 1 ? 'categoría' : 'categorías'}`
      : `${discount.products?.length ?? 0} ${discount.products?.length === 1 ? 'producto afectado' : 'productos afectados'}`;
  return { ...discount, value: Number(discount.value), status, product_ids: discount.products?.map((item: any) => item.productId), category_ids: discount.categories?.map((item: any) => item.categoryId), menu_ids: discount.menus?.map((item: any) => item.menuId), target_summary: targetSummary };
}

async function finishExpiredDiscounts(businessId: string) {
  await prisma.discount.updateMany({ where: { businessId, status: DiscountStatus.ACTIVE, endsAt: { lte: new Date() } }, data: { status: DiscountStatus.FINISHED } });
}

router.use('/:businessId/discounts', requireAuth);

router.get('/:businessId/discounts', async (req, res, next) => {
  try {
    const ownerBusinessId = await businessIdFor(req); if (ownerBusinessId !== req.params.businessId) throw new AppError('Negocio no encontrado', 404, 'BUSINESS_NOT_FOUND');
    await finishExpiredDiscounts(ownerBusinessId);
    const discounts = await prisma.discount.findMany({ where: { businessId: ownerBusinessId }, include: { products: true, categories: true, menus: true }, orderBy: { createdAt: 'desc' } });
    const data = discounts.map(dto); return res.json({ discounts: data, data });
  } catch (error) { return next(error); }
});

router.get('/:businessId/discounts/coverage', async (req, res, next) => {
  try {
    const ownerBusinessId = await businessIdFor(req); if (ownerBusinessId !== req.params.businessId) throw new AppError('Negocio no encontrado', 404, 'BUSINESS_NOT_FOUND');
    const products = await prisma.product.findMany({ where: { businessId: ownerBusinessId }, select: { id: true, name: true, price: true, categoryId: true } });
    const discounts = await prisma.discount.findMany({ where: { businessId: ownerBusinessId, status: DiscountStatus.ACTIVE, startsAt: { lte: new Date() }, endsAt: { gt: new Date() } }, include: { products: true, categories: true, menus: { include: { menu: { include: { categories: true } } } } } });
    const covered = products.filter((product) => discounts.some((discount) => (discount.scope === 'MENU' && (discount.menus.length === 0 || discount.menus.some((item) => item.menu.categories.some((category) => category.id === product.categoryId)))) || discount.products.some((item) => item.productId === product.id) || discount.categories.some((item) => item.categoryId === product.categoryId))).map((product) => product.id);
    return res.json({ total: products.length, covered: covered.length, product_ids: covered, products });
  } catch (error) { return next(error); }
});

router.get('/:businessId/discounts/:discountId', async (req, res, next) => {
  try {
    const ownerBusinessId = await businessIdFor(req); if (ownerBusinessId !== req.params.businessId) throw new AppError('Negocio no encontrado', 404, 'BUSINESS_NOT_FOUND');
    await finishExpiredDiscounts(ownerBusinessId);
    const discount = await prisma.discount.findFirst({ where: { id: req.params.discountId, businessId: ownerBusinessId }, include: { products: true, categories: true, menus: true } });
    if (!discount) throw new AppError('Descuento no encontrado', 404, 'DISCOUNT_NOT_FOUND'); return res.json({ discount: dto(discount) });
  } catch (error) { return next(error); }
});

router.get('/:businessId/discounts/:discountId/products', async (req, res, next) => {
  try {
    const ownerBusinessId = await businessIdFor(req); if (ownerBusinessId !== req.params.businessId) throw new AppError('Negocio no encontrado', 404, 'BUSINESS_NOT_FOUND');
    const discount = await prisma.discount.findFirst({ where: { id: req.params.discountId, businessId: ownerBusinessId }, include: { products: { include: { product: true } }, menus: { include: { menu: { include: { categories: { include: { products: true } } } } } }, categories: { include: { category: { include: { products: true } } } } } });
    if (!discount) throw new AppError('Descuento no encontrado', 404, 'DISCOUNT_NOT_FOUND');
    const products = discount.scope === 'MENU' ? (discount.menus.length ? discount.menus.flatMap((item) => item.menu.categories.flatMap((category) => category.products)) : await prisma.product.findMany({ where: { businessId: ownerBusinessId } })) : [...discount.products.map((item) => item.product), ...discount.categories.flatMap((item) => item.category.products)].filter((product, index, all) => all.findIndex((other) => other.id === product.id) === index);
    const productsWithPricing = products.map((product) => {
      const priceOriginal = Number(product.price);
      return {
        id: product.id,
        name: product.name,
        price: priceOriginal,
        priceOriginal,
        priceFinal: priceWithDiscount(priceOriginal, { type: discount.type, value: Number(discount.value) }),
        price_original: priceOriginal,
        price_final: priceWithDiscount(priceOriginal, { type: discount.type, value: Number(discount.value) }),
      };
    });
    return res.json({ products: productsWithPricing, product_ids: productsWithPricing.map((product) => product.id) });
  } catch (error) { return next(error); }
});

router.post('/:businessId/discounts', async (req, res, next) => {
  try {
    const ownerBusinessId = await businessIdFor(req); if (ownerBusinessId !== req.params.businessId) throw new AppError('Negocio no encontrado', 404, 'BUSINESS_NOT_FOUND');
    const input = parseInput(req.body); const key = `${ownerBusinessId}:${JSON.stringify(input)}`; const previous = recentRequests.get(key);
    if (previous && Date.now() - previous.at < 10_000) return res.status(200).json({ discount: previous.value, idempotent: true });
    const menus = input.scope === 'MENU' ? await prisma.menu.findMany({ where: { businessId: ownerBusinessId, id: { in: input.menuIds } }, select: { id: true } }) : [];
    if (input.scope === 'MENU' && menus.length !== input.menuIds.length) throw new AppError('Uno o más menús no pertenecen al negocio', 400, 'VALIDATION_ERROR');
    const discount = await prisma.discount.create({ data: { businessId: ownerBusinessId, name: input.name, type: input.type, value: input.value, scope: input.scope, status: DiscountStatus.ACTIVE, endsAt: input.endsAt, products: { create: input.productIds.map((productId) => ({ productId })) }, categories: { create: input.categoryIds.map((categoryId) => ({ categoryId })) }, menus: { create: input.menuIds.map((menuId) => ({ menuId })) } }, include: { products: true, categories: true, menus: true } });
    const result = dto(discount); recentRequests.set(key, { at: Date.now(), value: result }); return res.status(201).json({ discount: result });
  } catch (error) { return next(error); }
});

router.put('/:businessId/discounts/:discountId', async (req, res, next) => {
  try {
    const ownerBusinessId = await businessIdFor(req); if (ownerBusinessId !== req.params.businessId) throw new AppError('Negocio no encontrado', 404, 'BUSINESS_NOT_FOUND');
    const input = parseInput(req.body); const existing = await prisma.discount.findFirst({ where: { id: req.params.discountId, businessId: ownerBusinessId } });
    if (!existing) throw new AppError('Descuento no encontrado', 404, 'DISCOUNT_NOT_FOUND');
    if (existing.status !== DiscountStatus.ACTIVE) throw new AppError('Solo puedes editar un descuento activo', 409, 'DISCOUNT_NOT_ACTIVE');
    const discount = await prisma.$transaction(async (tx) => { await tx.discountProduct.deleteMany({ where: { discountId: existing.id } }); await tx.discountCategory.deleteMany({ where: { discountId: existing.id } }); await tx.discountMenu.deleteMany({ where: { discountId: existing.id } }); return tx.discount.update({ where: { id: existing.id }, data: { name: input.name, type: input.type, value: input.value, scope: input.scope, endsAt: input.endsAt, products: { create: input.productIds.map((productId) => ({ productId })) }, categories: { create: input.categoryIds.map((categoryId) => ({ categoryId })) }, menus: { create: input.menuIds.map((menuId) => ({ menuId })) } }, include: { products: true, categories: true, menus: true } }); });
    return res.json({ discount: dto(discount) });
  } catch (error) { return next(error); }
});

router.patch('/:businessId/discounts/:discountId/end', async (req, res, next) => {
  try {
    const ownerBusinessId = await businessIdFor(req);
    if (ownerBusinessId !== req.params.businessId) throw new AppError('Negocio no encontrado', 404, 'BUSINESS_NOT_FOUND');
    const result = await prisma.discount.updateMany({ where: { id: req.params.discountId, businessId: ownerBusinessId, status: DiscountStatus.ACTIVE }, data: { status: DiscountStatus.FINISHED, endsAt: new Date() } });
    if (!result.count) {
      const current = await prisma.discount.findFirst({ where: { id: req.params.discountId, businessId: ownerBusinessId }, select: { status: true } });
      if (!current) throw new AppError('Descuento no encontrado', 404, 'DISCOUNT_NOT_FOUND');
      return res.json({ ended: current.status === DiscountStatus.FINISHED, idempotent: true, status: current.status });
    }
    return res.json({ ended: true, status: DiscountStatus.FINISHED });
  } catch (error) { return next(error); }
});

router.delete('/:businessId/discounts/:discountId', async (req, res, next) => {
  try {
    const ownerBusinessId = await businessIdFor(req);
    if (ownerBusinessId !== req.params.businessId) throw new AppError('Negocio no encontrado', 404, 'BUSINESS_NOT_FOUND');
    const result = await prisma.discount.updateMany({ where: { id: req.params.discountId, businessId: ownerBusinessId, status: { not: DiscountStatus.DELETED } }, data: { status: DiscountStatus.DELETED } });
    if (!result.count) {
      const current = await prisma.discount.findFirst({ where: { id: req.params.discountId, businessId: ownerBusinessId }, select: { status: true } });
      if (!current) throw new AppError('Descuento no encontrado', 404, 'DISCOUNT_NOT_FOUND');
    }
    return res.status(204).send();
  } catch (error) { return next(error); }
});

export const discountRouter = router;
