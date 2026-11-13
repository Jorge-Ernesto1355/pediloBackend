import type { RequestHandler } from 'express';
import { prisma } from '@/libs/prisma.js';
import { publicMenuCache } from '../../infrastructure/cache/PublicMenuCache.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Invalidates only catalog-affecting routers after their database response succeeds. */
export const invalidatePublicMenuAfterSuccess: RequestHandler = (request, response, next) => {
  if (!MUTATING_METHODS.has(request.method)) return next();

  void resolveBusinessId(request).then((businessId) => {
    if (!businessId) return next();
    let invalidated = false;
    response.once('finish', () => {
      if (invalidated || response.statusCode < 200 || response.statusCode >= 300) return;
      invalidated = true;
      void publicMenuCache.invalidateBusiness(businessId);
    });
    next();
  }).catch(() => next());
};

async function resolveBusinessId(request: Parameters<RequestHandler>[0]): Promise<string | null> {
  const path = request.originalUrl.split('?')[0] ?? '';
  const segments = path.split('/').filter(Boolean);
  const apiIndex = segments.indexOf('businesses');
  const resource = apiIndex >= 0 ? segments.slice(apiIndex + 1) : [];
  const first = resource[0];
  const second = resource[1];

  if (!first) return null;
  if (second === 'menus' || second === 'categories' || second === 'products' || second === 'discounts') {
    return first;
  }
  if (first === 'settings' || first === 'payment-card') {
    return businessForUser(request);
  }
  if (first === 'menus') return businessFromMenu(resource[1]);
  if (first === 'categories') return businessFromCategory(resource[1]);
  if (first === 'products') return businessFromProduct(resource[1]);
  if (first === 'option-groups') return businessFromOptionGroup(resource[1]);
  if (first === 'global-option-groups') return businessForUser(request);
  if (first === 'options') return businessFromOption(resource[1]);
  if (first === 'businesses') return first;
  return businessFromBusiness(first);
}

async function businessForUser(request: Parameters<RequestHandler>[0]): Promise<string | null> {
  if (!request.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: request.user.id }, select: { businessId: true } });
  return user?.businessId ?? null;
}

async function businessFromBusiness(id: string): Promise<string | null> {
  const row = await prisma.business.findUnique({ where: { id }, select: { id: true } });
  return row?.id ?? null;
}

async function businessFromMenu(id: string | undefined): Promise<string | null> {
  if (!id) return null;
  const row = await prisma.menu.findUnique({ where: { id }, select: { businessId: true } });
  return row?.businessId ?? null;
}

async function businessFromCategory(id: string | undefined): Promise<string | null> {
  if (!id) return null;
  const row = await prisma.category.findUnique({ where: { id }, select: { businessId: true } });
  return row?.businessId ?? null;
}

async function businessFromProduct(id: string | undefined): Promise<string | null> {
  if (!id) return null;
  const row = await prisma.product.findUnique({ where: { id }, select: { businessId: true } });
  return row?.businessId ?? null;
}

async function businessFromOptionGroup(id: string | undefined): Promise<string | null> {
  if (!id) return null;
  const row = await prisma.productOptionGroup.findUnique({
    where: { id },
    select: { product: { select: { businessId: true } } },
  });
  return row?.product.businessId ?? null;
}

async function businessFromOption(id: string | undefined): Promise<string | null> {
  if (!id) return null;
  const row = await prisma.productOption.findUnique({
    where: { id },
    select: { optionGroup: { select: { product: { select: { businessId: true } } } } },
  });
  return row?.optionGroup.product.businessId ?? null;
}
