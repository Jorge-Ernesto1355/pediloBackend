import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/libs/prisma.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { detectBank, normalizeClabe, isValidClabe } from '@/shared/validation/clabe.js';

const requireAuth = createRequireAuth(authProvider);
const cardSchema = z.object({
  clabe: z.string().transform(normalizeClabe).refine(isValidClabe, 'CLABE inválida'),
  beneficiaryName: z.string().trim().min(1).max(80).optional(),
  beneficiary_name: z.string().trim().min(1).max(80).optional(),
}).strict();
const statusSchema = z.object({ isActive: z.boolean().optional(), is_active: z.boolean().optional() }).strict().refine((value) => value.isActive !== undefined || value.is_active !== undefined);

async function businessIdFor(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { businessId: true } });
  return user?.businessId ?? null;
}

function dto(card: any) {
  return card ? { ...card, is_active: card.isActive, beneficiary_name: card.beneficiaryName, bank: detectBank(card.clabe) } : null;
}

export const paymentCardRouter = Router();
paymentCardRouter.get('/payment-card', requireAuth, async (req, res, next) => {
  try {
    const businessId = await businessIdFor(req.user!.id);
    if (!businessId) return res.status(404).json({ error: { code: 'BUSINESS_NOT_FOUND', message: 'Business not found' } });
    const card = await prisma.restaurantPaymentCard.findUnique({ where: { businessId } });
    return res.json({ paymentCard: dto(card) });
  } catch (error) { return next(error); }
});

paymentCardRouter.put('/payment-card', requireAuth, async (req, res, next) => {
  try {
    const parsed = cardSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'CLABE or beneficiary name is invalid' } });
    const businessId = await businessIdFor(req.user!.id);
    if (!businessId) return res.status(404).json({ error: { code: 'BUSINESS_NOT_FOUND', message: 'Business not found' } });
    const beneficiaryName = parsed.data.beneficiaryName ?? parsed.data.beneficiary_name;
    if (!beneficiaryName) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Beneficiary name is required' } });
    const bank = detectBank(parsed.data.clabe);
    const card = await prisma.restaurantPaymentCard.upsert({
      where: { businessId },
      create: { businessId, clabe: parsed.data.clabe, beneficiaryName, bankCode: bank.code, bankName: bank.name },
      update: { clabe: parsed.data.clabe, beneficiaryName, bankCode: bank.code, bankName: bank.name },
    });
    return res.json({ paymentCard: dto(card) });
  } catch (error) { return next(error); }
});

paymentCardRouter.patch('/payment-card/status', requireAuth, async (req, res, next) => {
  try {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Status is invalid' } });
    const businessId = await businessIdFor(req.user!.id);
    if (!businessId) return res.status(404).json({ error: { code: 'BUSINESS_NOT_FOUND', message: 'Business not found' } });
    const card = await prisma.restaurantPaymentCard.update({ where: { businessId }, data: { isActive: parsed.data.isActive ?? parsed.data.is_active! } });
    return res.json({ paymentCard: dto(card) });
  } catch (error) { return next(error); }
});

paymentCardRouter.delete('/payment-card', requireAuth, async (req, res, next) => {
  try {
    const businessId = await businessIdFor(req.user!.id);
    if (!businessId) return res.status(404).json({ error: { code: 'BUSINESS_NOT_FOUND', message: 'Business not found' } });
    await prisma.restaurantPaymentCard.deleteMany({ where: { businessId } });
    return res.status(204).send();
  } catch (error) { return next(error); }
});
