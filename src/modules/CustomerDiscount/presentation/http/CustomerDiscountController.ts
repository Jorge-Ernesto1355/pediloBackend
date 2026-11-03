import { Request, Response } from 'express';
import { z } from 'zod';
import { phoneSchema } from '@/shared/validation/phone.js';
import {
  MAX_CUSTOMER_DISCOUNT_PERCENTAGE,
  MAX_CUSTOMER_FIXED_DISCOUNT,
} from '../../domain/discountMath.js';
import { PrismaCustomerDiscountRepository } from '../../infrastructure/persistence/PrismaCustomerDiscountRepository.js';

const paramsSchema = z.object({ orderId: z.string().trim().min(1).max(128) }).strict();
const businessParamsSchema = z.object({ businessId: z.string().trim().min(1).max(128) }).strict();
const previewSchema = z.object({ customerPhone: phoneSchema }).strict();
const grantSchema = z
  .object({
    type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
    value: z.number().finite().positive(),
  })
  .strict()
  .superRefine((value, context) => {
    const maximum =
      value.type === 'PERCENTAGE'
        ? MAX_CUSTOMER_DISCOUNT_PERCENTAGE
        : MAX_CUSTOMER_FIXED_DISCOUNT;
    if (value.value > maximum) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: `El valor máximo permitido es ${maximum}.`,
      });
    }
  });
const customerParamsSchema = z.object({ customerId: z.string().trim().min(1).max(128) }).strict();
const customerDiscountParamsSchema = customerParamsSchema.extend({ discountId: z.string().trim().min(1).max(128) }).strict();

export class CustomerDiscountController {
  constructor(private readonly repository: PrismaCustomerDiscountRepository) {}

  getForOrder = (request: Request, response: Response) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return invalid(response, params.error);
    return this.repository
      .getForOrder(request.user!.id, params.data.orderId)
      .then((discount) => response.json({ discount }))
      .catch((error) => handle(response, error));
  };

  grantForOrder = (request: Request, response: Response) => {
    const params = paramsSchema.safeParse(request.params);
    const body = grantSchema.safeParse(request.body);
    if (!params.success) return invalid(response, params.error);
    if (!body.success) return invalid(response, body.error);
    return this.repository
      .grantForOrder(request.user!.id, params.data.orderId, body.data)
      .then((discount) => response.status(201).json({ discount }))
      .catch((error) => handle(response, error));
  };

  previewForCheckout = (request: Request, response: Response) => {
    const params = businessParamsSchema.safeParse(request.params);
    const body = previewSchema.safeParse(request.body);
    if (!params.success) return invalid(response, params.error);
    if (!body.success) return invalid(response, body.error);
    return this.repository
      .getForCheckout(params.data.businessId, body.data.customerPhone)
      .then((discount) => response.json({ discount }))
      .catch((error) => handle(response, error));
  };
  listForCustomer = (request: Request, response: Response) => {
    const params = customerParamsSchema.safeParse(request.params);
    if (!params.success) return invalid(response, params.error);
    return this.repository.listForCustomer(request.user!.id, params.data.customerId)
      .then((discounts) => response.json({ discounts }))
      .catch((error) => handle(response, error));
  };
  grantForCustomer = (request: Request, response: Response) => {
    const params = customerParamsSchema.safeParse(request.params);
    const body = grantSchema.safeParse(request.body);
    if (!params.success) return invalid(response, params.error);
    if (!body.success) return invalid(response, body.error);
    return this.repository.grantForCustomer(request.user!.id, params.data.customerId, body.data)
      .then((discount) => response.status(201).json({ discount }))
      .catch((error) => handle(response, error));
  };
  revokeForCustomer = (request: Request, response: Response) => {
    const params = customerDiscountParamsSchema.safeParse(request.params);
    if (!params.success) return invalid(response, params.error);
    return this.repository.revokeForCustomer(request.user!.id, params.data.customerId, params.data.discountId)
      .then((discount) => response.json({ discount }))
      .catch((error) => handle(response, error));
  };
}

function invalid(response: Response, error: z.ZodError) {
  return response.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: error.flatten(),
    },
  });
}

function handle(response: Response, error: unknown) {
  const status =
    error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : 500;
  const code =
    error && typeof error === 'object' && 'code' in error ? String(error.code) : 'INTERNAL_ERROR';
  const message =
    error && typeof error === 'object' && 'statusCode' in error && error instanceof Error
      ? error.message
      : 'Unexpected error';
  return response.status(status).json({ error: { code, message } });
}
