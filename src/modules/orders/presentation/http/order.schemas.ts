import { z } from 'zod';
import { phoneSchema } from '@/shared/validation/phone.js';
export const orderIdSchema = z.object({ orderId: z.string().trim().min(1) });
export const businessIdSchema = z.object({ businessId: z.string().trim().min(1) });
const itemSchema = z
  .object({
    productId: z.string().trim().min(1),
    quantity: z.number().int().min(1).max(100),
    optionIds: z.array(z.string().trim().min(1)).max(50).optional(),
    comboChoiceIds: z.array(z.string().trim().min(1)).max(50).optional(),
    expectedUnitPrice: z.number().finite().nonnegative().optional(),
    expected_unit_price: z.number().finite().nonnegative().optional(),
  })
  .strict();
// Entrega a domicilio. La distancia y el envío NUNCA vienen del cliente: el servidor
// los calcula con el pin; `expectedDeliveryFee` es solo el envío que el cliente vio.
export const DELIVERY_ADDRESS_MAX_LENGTH = 200;
export const DELIVERY_NEIGHBORHOOD_MAX_LENGTH = 100;
const deliveryAddressSchema = z
  .object({
    address: z.string().trim().min(5).max(DELIVERY_ADDRESS_MAX_LENGTH),
    // Colonia: se muestra al repartidor como zona aproximada antes de tomar la entrega.
    neighborhood: z.string().trim().min(2).max(DELIVERY_NEIGHBORHOOD_MAX_LENGTH),
    reference: z
      .string()
      .trim()
      .max(DELIVERY_ADDRESS_MAX_LENGTH)
      .transform((value) => value || null)
      .nullable()
      .optional(),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  })
  .strict();
export const createOrderSchema = z
  .object({
    customer: z.object({ name: z.string().trim().min(1).max(20), phone: phoneSchema }).strict(),
    items: z.array(itemSchema).min(1).max(100),
    fulfillmentType: z.enum(['DINE_IN', 'PICKUP', 'DELIVERY']).optional(),
    // Notas del cliente del checkout público (el front limita a 200 caracteres).
    notes: z.string().trim().max(200).nullable().optional(),
    paymentMethod: z.enum(['CASH', 'TRANSFER']).optional(),
    payment_method: z.enum(['cash', 'transfer']).optional(),
    ignoreCustomerDiscount: z.boolean().optional(),
    expectedSubtotal: z.number().finite().nonnegative().optional(),
    expected_total: z.number().finite().nonnegative().optional(),
    expectedTotal: z.number().finite().nonnegative().optional(),
    acceptPriceChange: z.boolean().optional(),
    delivery: deliveryAddressSchema.optional(),
    expectedDeliveryFee: z.number().finite().nonnegative().optional(),
    // Premio de lealtad: se identifica con la llave de la tarjeta, nunca con el teléfono.
    loyalty: z
      .object({
        cardToken: z.string().min(1).max(64),
        rewardId: z.string().trim().min(1).max(128),
        expectedDiscount: z.number().finite().nonnegative(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.fulfillmentType === 'DELIVERY') {
      if (!value.delivery) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['delivery'],
          message: 'Delivery address and location are required',
        });
      }
      if (value.expectedDeliveryFee === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['expectedDeliveryFee'],
          message: 'The delivery fee shown to the customer is required',
        });
      }
    } else if (value.delivery || value.expectedDeliveryFee !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fulfillmentType'],
        message: 'Delivery data is only allowed for home delivery orders',
      });
    }
  });
export const createRestaurantOrderSchema = z
  .object({
    customerName: z.string().trim().min(1).max(120).nullable().optional(),
    customerPhone: phoneSchema.nullable().optional(),
    items: z.array(itemSchema).min(1).max(100),
    fulfillmentType: z.enum(['DINE_IN', 'PICKUP']).optional(),
    notes: z.string().trim().max(200).nullable().optional(),
    /** "Aplicar premio": premio disponible del cliente del pedido (por teléfono). */
    loyaltyRewardId: z.string().trim().min(1).max(128).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.loyaltyRewardId && !value.customerPhone) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['loyaltyRewardId'],
        message: 'Elige al cliente para aplicar su premio.',
      });
    }
  });
export const orderStatusSchema = z
  .object({
    status: z.enum(['PENDING', 'PREPARING', 'READY', 'CANCELLED']),
  })
  .strict();
const updateItemSchema = itemSchema
  .extend({ id: z.string().trim().min(1).optional() })
  .omit({ expectedUnitPrice: true, expected_unit_price: true });
export const updateOrderSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    customerId: z.string().trim().min(1).nullable().optional(),
    fulfillmentType: z.enum(['DINE_IN', 'PICKUP']).optional(),
    paymentMethod: z.enum(['CASH', 'TRANSFER']).optional(),
    items: z.array(updateItemSchema).min(1).max(100),
  })
  .strict();
export const orderListSchema = z
  .object({
    period: z.enum(['today', '7d', '30d', 'lastMonth']).optional(),
    status: z
      .enum(['PENDING', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'])
      .optional(),
    search: z
      .string()
      .trim()
      .max(120)
      .transform((value) => value || undefined)
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    summary: z.coerce.boolean().default(false),
  })
  .strict();
