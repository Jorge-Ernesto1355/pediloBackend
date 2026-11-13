import { Router, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/libs/prisma.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { invalidatePublicMenuAfterSuccess } from '@/modules/Business/presentation/http/public-menu-invalidation.middleware.js';

const id = z.string().trim().min(1);
const price = z.number().int().min(0).max(10_000);
const option = z.object({
  id: id.optional(), name: z.string().trim().min(1).max(40), price: price.default(0),
  minSelections: z.number().int().min(0).max(10).default(0),
  maxSelections: z.number().int().min(0).max(10).default(1),
  isAvailable: z.boolean().default(true), sortOrder: z.number().int().min(0).optional(),
}).refine((v) => v.maxSelections >= v.minSelections, { message: 'maxSelections must be greater than or equal to minSelections' });
const groupFieldsBase = z.object({
  name: z.string().trim().min(1).max(40), isRequired: z.boolean().default(false),
  minSelections: z.number().int().min(0).max(100).default(0),
  maxSelections: z.number().int().min(0).max(100).default(1),
  isActive: z.boolean().default(true), expectedVersion: z.number().int().positive().optional(),
});
const selectionConfig = <T extends { minSelections?: number; maxSelections?: number; isRequired?: boolean }>(schema: z.ZodType<T>) => schema.refine((v) => v.maxSelections! >= v.minSelections! && (!v.isRequired || v.minSelections! >= 1), { message: 'Invalid selection configuration' });
const create = selectionConfig(groupFieldsBase.extend({ options: z.array(option).max(10).default([]) }));
const update = groupFieldsBase.partial().extend({ expectedVersion: z.number().int().positive().optional() }).refine((v) => Object.keys(v).some((key) => key !== 'expectedVersion'), { message: 'At least one field is required' }).superRefine((v, ctx) => {
  if (v.minSelections !== undefined && v.maxSelections !== undefined && v.maxSelections < v.minSelections) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid selection configuration' });
});
const assignment = z.object({ productIds: z.array(id).max(1000), expectedVersion: z.number().int().positive().optional() });
const optionList = z.object({ options: z.array(option).max(10, 'A global option group can contain at most 10 options') });

type GroupRow = Prisma.GlobalOptionGroupGetPayload<{ include: { options: true; products: { select: { productId: true } } } }>;
function serialize(group: GroupRow) {
  return {
    id: group.id, businessId: group.businessId, name: group.name, isRequired: group.isRequired,
    minSelections: group.minSelections, maxSelections: group.maxSelections, sortOrder: group.sortOrder,
    isActive: group.isActive, archivedAt: group.archivedAt, version: group.version,
    productsCount: group.products.length, productIds: group.products.map((p) => p.productId),
    options: group.options.map((o) => ({ ...o, price: o.price.toNumber() })),
  };
}
function serializeSummary(group: { id: string; businessId: string; name: string; isRequired: boolean; minSelections: number; maxSelections: number; sortOrder: number; isActive: boolean; archivedAt: Date | null; version: number; _count: { products: number } }) {
  return {
    id: group.id, businessId: group.businessId, name: group.name, isRequired: group.isRequired,
    minSelections: group.minSelections, maxSelections: group.maxSelections, sortOrder: group.sortOrder,
    isActive: group.isActive, archivedAt: group.archivedAt, version: group.version,
    productsCount: group._count.products,
  };
}

export const globalOptionRouter = Router();
const requireAuth = createRequireAuth(authProvider);
// This middleware needs request.user to resolve the business and invalidate its public catalog.
globalOptionRouter.use(requireAuth);
globalOptionRouter.use(invalidatePublicMenuAfterSuccess);

async function businessFor(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { businessId: true } });
  return user?.businessId ?? null;
}
function sendError(response: Response, error: unknown) {
  const status = error instanceof Error && error.message === 'VERSION_CONFLICT' ? 409 : 400;
  return response.status(status).json({ error: { code: status === 409 ? 'VERSION_CONFLICT' : 'VALIDATION_ERROR', message: status === 409 ? 'The group was changed by another user' : (error instanceof Error ? error.message : 'Invalid request') } });
}

globalOptionRouter.get('/global-option-groups', requireAuth, async (req, res) => {
  const businessId = await businessFor(req.user!.id);
  if (!businessId) return res.status(403).json({ error: { code: 'BUSINESS_ACCESS_DENIED', message: 'Business access denied' } });
  const groups = await prisma.globalOptionGroup.findMany({ where: { businessId, archivedAt: null }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], include: { _count: { select: { products: true } } } });
  return res.json({ groups: groups.map(serializeSummary) });
});

globalOptionRouter.get('/global-option-groups/:groupId', requireAuth, async (req, res) => {
  const businessId = await businessFor(req.user!.id);
  if (!businessId) return res.status(403).json({ error: { code: 'BUSINESS_ACCESS_DENIED' } });
  const group = await prisma.globalOptionGroup.findFirst({
    where: { id: String(req.params.groupId), businessId, archivedAt: null },
    include: { options: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }, products: { select: { productId: true } } },
  });
  if (!group) return res.status(404).json({ error: { code: 'GLOBAL_OPTION_GROUP_NOT_FOUND', message: 'Global option group not found' } });
  return res.json({ group: serialize(group) });
});

globalOptionRouter.post('/global-option-groups', requireAuth, async (req, res) => {
  const parsed = create.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const businessId = await businessFor(req.user!.id); if (!businessId) return res.status(403).json({ error: { code: 'BUSINESS_ACCESS_DENIED' } });
  try {
    const row = await prisma.$transaction(async (tx) => {
      const max = await tx.globalOptionGroup.aggregate({ where: { businessId }, _max: { sortOrder: true } });
      const group = await tx.globalOptionGroup.create({ data: { businessId, name: parsed.data.name, isRequired: parsed.data.isRequired, minSelections: parsed.data.minSelections, maxSelections: parsed.data.maxSelections, isActive: parsed.data.isActive, sortOrder: (max._max.sortOrder ?? -1) + 1, options: { create: (parsed.data.options ?? []).map((o, i) => ({ name: o.name, price: o.price, minSelections: o.minSelections, maxSelections: o.maxSelections, isAvailable: o.isAvailable, sortOrder: o.sortOrder ?? i })) } }, include: { options: true, products: { select: { productId: true } } } });
      return group;
    });
    return res.status(201).json({ group: serialize(row) });
  } catch (error) { return sendError(res, error); }
});

globalOptionRouter.patch('/global-option-groups/:groupId', requireAuth, async (req, res) => {
  const parsed = update.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const businessId = await businessFor(req.user!.id); if (!businessId) return res.status(403).json({ error: { code: 'BUSINESS_ACCESS_DENIED' } });
  try {
    const row = await prisma.$transaction(async (tx) => {
      const current = await tx.globalOptionGroup.findFirst({ where: { id: String(req.params.groupId), businessId, archivedAt: null } });
      if (!current) throw new Error('Global option group not found');
      if (parsed.data.expectedVersion !== undefined && parsed.data.expectedVersion !== current.version) throw new Error('VERSION_CONFLICT');
      const data = { ...parsed.data };
      delete data.expectedVersion;
      return tx.globalOptionGroup.update({ where: { id: current.id }, data: { ...data, version: { increment: 1 } }, include: { options: { orderBy: { sortOrder: 'asc' } }, products: { select: { productId: true } } } });
    });
    return res.json({ group: serialize(row) });
  } catch (error) { return sendError(res, error); }
});

globalOptionRouter.put('/global-option-groups/:groupId/options', requireAuth, async (req, res) => {
  const parsed = optionList.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const businessId = await businessFor(req.user!.id); if (!businessId) return res.status(403).json({ error: { code: 'BUSINESS_ACCESS_DENIED' } });
  try {
    const row = await prisma.$transaction(async (tx) => {
      const group = await tx.globalOptionGroup.findFirst({ where: { id: String(req.params.groupId), businessId, archivedAt: null }, select: { id: true, version: true } });
      if (!group) throw new Error('Global option group not found');
      const keptIds = parsed.data.options.flatMap((o) => o.id ? [o.id] : []);
      if (new Set(keptIds).size !== keptIds.length) throw new Error('An option cannot be repeated');
      const existing = keptIds.length ? await tx.globalOption.findMany({ where: { id: { in: keptIds }, groupId: group.id }, select: { id: true } }) : [];
      if (existing.length !== keptIds.length) throw new Error('An option does not belong to this group');
      await tx.globalOption.deleteMany({ where: { groupId: group.id, ...(keptIds.length ? { id: { notIn: keptIds } } : {}) } });
      for (const [sortOrder, option] of parsed.data.options.entries()) {
        const data = { name: option.name, price: option.price, minSelections: option.minSelections, maxSelections: option.maxSelections, isAvailable: option.isAvailable, sortOrder: option.sortOrder ?? sortOrder };
        if (option.id) await tx.globalOption.update({ where: { id: option.id }, data });
        else await tx.globalOption.create({ data: { ...data, groupId: group.id } });
      }
      return tx.globalOptionGroup.update({ where: { id: group.id }, data: { version: { increment: 1 } }, include: { options: { orderBy: { sortOrder: 'asc' } }, products: { select: { productId: true } } } });
    });
    return res.json({ group: serialize(row) });
  } catch (error) { return sendError(res, error); }
});

globalOptionRouter.put('/global-option-groups/:groupId/products', requireAuth, async (req, res) => {
  const parsed = assignment.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const businessId = await businessFor(req.user!.id); if (!businessId) return res.status(403).json({ error: { code: 'BUSINESS_ACCESS_DENIED' } });
  try {
    const row = await prisma.$transaction(async (tx) => {
      const group = await tx.globalOptionGroup.findFirst({ where: { id: String(req.params.groupId), businessId, archivedAt: null }, select: { id: true, version: true } });
      if (!group) throw new Error('Global option group not found');
      if (parsed.data.expectedVersion !== undefined && parsed.data.expectedVersion !== group.version) throw new Error('VERSION_CONFLICT');
      const products = await tx.product.findMany({ where: { id: { in: parsed.data.productIds }, businessId }, select: { id: true } });
      if (products.length !== new Set(parsed.data.productIds).size) throw new Error('One or more products do not belong to this business');
      await tx.productGlobalOptionGroup.deleteMany({ where: { groupId: group.id } });
      if (parsed.data.productIds.length) await tx.productGlobalOptionGroup.createMany({ data: parsed.data.productIds.map((productId, sortOrder) => ({ groupId: group.id, productId, sortOrder })), skipDuplicates: true });
      return tx.globalOptionGroup.update({ where: { id: group.id }, data: { version: { increment: 1 } }, include: { options: { orderBy: { sortOrder: 'asc' } }, products: { select: { productId: true } } } });
    });
    return res.json({ group: serialize(row) });
  } catch (error) { return sendError(res, error); }
});

globalOptionRouter.get('/products/:productId/global-option-groups', requireAuth, async (req, res) => {
  const businessId = await businessFor(req.user!.id); if (!businessId) return res.status(403).json({ error: { code: 'BUSINESS_ACCESS_DENIED' } });
  const product = await prisma.product.findFirst({ where: { id: String(req.params.productId), businessId }, select: { id: true } });
  if (!product) return res.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND' } });
  const groups = await prisma.globalOptionGroup.findMany({ where: { businessId, archivedAt: null, products: { some: { productId: product.id } } }, orderBy: { sortOrder: 'asc' }, include: { options: { orderBy: { sortOrder: 'asc' } }, products: { select: { productId: true } } } });
  return res.json({ groups: groups.map(serialize) });
});

globalOptionRouter.delete('/global-option-groups/:groupId', requireAuth, async (req, res) => {
  const businessId = await businessFor(req.user!.id); if (!businessId) return res.status(403).json({ error: { code: 'BUSINESS_ACCESS_DENIED' } });
  const result = await prisma.globalOptionGroup.updateMany({ where: { id: String(req.params.groupId), businessId, archivedAt: null }, data: { archivedAt: new Date(), isActive: false, version: { increment: 1 } } });
  if (!result.count) return res.status(404).json({ error: { code: 'GROUP_NOT_FOUND' } });
  return res.status(204).send();
});
