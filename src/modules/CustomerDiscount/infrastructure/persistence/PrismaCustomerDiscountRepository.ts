import { CustomerDiscountStatus, Prisma, PrismaClient } from '@prisma/client';
import {
  DEFAULT_CUSTOMER_DISCOUNT_EXPIRY_DAYS,
  MAX_CUSTOMER_DISCOUNT_PERCENTAGE,
  MAX_CUSTOMER_FIXED_DISCOUNT,
} from '../../domain/discountMath.js';
import {
  CustomerDiscountAlreadyActiveError,
  CustomerDiscountCustomerRequiredError,
  CustomerDiscountInvalidValueError,
  CustomerDiscountOrderNotFoundError,
  CustomerDiscountCustomerNotFoundError,
  CustomerDiscountNotFoundError,
  CustomerDiscountAlreadyUsedError,
} from '../../domain/CustomerDiscountErrors.js';

export type CreateCustomerDiscountInput = {
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: number;
};

export class PrismaCustomerDiscountRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async grantForOrder(ownerUserId: string, orderId: string, input: CreateCustomerDiscountInput) {
    validateValue(input);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + DEFAULT_CUSTOMER_DISCOUNT_EXPIRY_DAYS * 86_400_000);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.findFirst({
          where: {
            id: orderId,
            business: {
              members: { some: { userId: ownerUserId, role: { in: ['OWNER', 'ADMIN'] } } },
            },
          },
          select: { id: true, businessId: true, customerId: true },
        });
        if (!order) throw new CustomerDiscountOrderNotFoundError();
        if (!order.customerId) throw new CustomerDiscountCustomerRequiredError();

        await tx.customerDiscount.updateMany({
          where: {
            businessId: order.businessId,
            customerId: order.customerId,
            status: { in: [CustomerDiscountStatus.AVAILABLE, CustomerDiscountStatus.RESERVED] },
            expiresAt: { lte: now },
          },
          data: { status: CustomerDiscountStatus.EXPIRED },
        });

        const existing = await tx.customerDiscount.findFirst({
          where: {
            businessId: order.businessId,
            customerId: order.customerId,
            status: { in: [CustomerDiscountStatus.AVAILABLE, CustomerDiscountStatus.RESERVED] },
          },
          select: { id: true },
        });
        if (existing) throw new CustomerDiscountAlreadyActiveError();

        const discount = await tx.customerDiscount.create({
          data: {
            businessId: order.businessId,
            customerId: order.customerId,
            grantedFromOrderId: order.id,
            type: input.type,
            value: new Prisma.Decimal(input.value),
            status: CustomerDiscountStatus.AVAILABLE,
            expiresAt,
          },
        });
        return toDiscountDto(discount);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new CustomerDiscountAlreadyActiveError();
      }
      throw error;
    }
  }

  async getForOrder(ownerUserId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        business: {
          members: { some: { userId: ownerUserId, role: { in: ['OWNER', 'ADMIN'] } } },
        },
      },
      select: { businessId: true, customerId: true },
    });
    if (!order) throw new CustomerDiscountOrderNotFoundError();
    if (!order.customerId) return null;

    const now = new Date();
    await this.prisma.customerDiscount.updateMany({
      where: {
        businessId: order.businessId,
        customerId: order.customerId,
        status: { in: [CustomerDiscountStatus.AVAILABLE, CustomerDiscountStatus.RESERVED] },
        expiresAt: { lte: now },
      },
      data: { status: CustomerDiscountStatus.EXPIRED },
    });

    const discount = await this.prisma.customerDiscount.findFirst({
      where: {
        businessId: order.businessId,
        customerId: order.customerId,
        status: { in: [CustomerDiscountStatus.AVAILABLE, CustomerDiscountStatus.RESERVED] },
      },
      orderBy: { createdAt: 'desc' },
    });
    return discount ? toDiscountDto(discount) : null;
  }

  async getForCheckout(businessId: string, customerPhone: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { businessId_phone: { businessId, phone: customerPhone } },
      select: { id: true },
    });
    if (!customer) return null;

    const now = new Date();
    await this.prisma.customerDiscount.updateMany({
      where: {
        businessId,
        customerId: customer.id,
        status: { in: [CustomerDiscountStatus.AVAILABLE, CustomerDiscountStatus.RESERVED] },
        expiresAt: { lte: now },
      },
      data: { status: CustomerDiscountStatus.EXPIRED },
    });

    const discount = await this.prisma.customerDiscount.findFirst({
      where: {
        businessId,
        customerId: customer.id,
        status: CustomerDiscountStatus.AVAILABLE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: 'asc' },
    });
    return discount ? toDiscountDto(discount) : null;
  }

  async listForCustomer(ownerUserId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, business: { users: { some: { id: ownerUserId } } } },
      select: { businessId: true },
    });
    if (!customer) throw new CustomerDiscountCustomerNotFoundError();
    const now = new Date();
    await this.prisma.customerDiscount.updateMany({
      where: { businessId: customer.businessId, customerId, status: { in: [CustomerDiscountStatus.AVAILABLE, CustomerDiscountStatus.RESERVED] }, expiresAt: { lte: now } },
      data: { status: CustomerDiscountStatus.EXPIRED },
    });
    const rows = await this.prisma.customerDiscount.findMany({
      where: { businessId: customer.businessId, customerId },
      orderBy: { createdAt: 'desc' },
      include: { usedOrder: { select: { id: true, orderNumber: true } } },
    });
    return rows.map((row) => toDiscountDto(row));
  }

  async grantForCustomer(ownerUserId: string, customerId: string, input: CreateCustomerDiscountInput) {
    validateValue(input);
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, business: { members: { some: { userId: ownerUserId, role: { in: ['OWNER', 'ADMIN'] } } } } },
      select: { id: true, businessId: true },
    });
    if (!customer) throw new CustomerDiscountCustomerNotFoundError();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + DEFAULT_CUSTOMER_DISCOUNT_EXPIRY_DAYS * 86_400_000);
    return this.prisma.$transaction(async (tx) => {
      await tx.customerDiscount.updateMany({
        where: { businessId: customer.businessId, customerId, status: { in: [CustomerDiscountStatus.AVAILABLE, CustomerDiscountStatus.RESERVED] }, expiresAt: { lte: now } },
        data: { status: CustomerDiscountStatus.EXPIRED },
      });
      const existing = await tx.customerDiscount.findFirst({
        where: { businessId: customer.businessId, customerId, status: { in: [CustomerDiscountStatus.AVAILABLE, CustomerDiscountStatus.RESERVED] } },
        select: { id: true },
      });
      if (existing) throw new CustomerDiscountAlreadyActiveError();
      const discount = await tx.customerDiscount.create({
        data: { businessId: customer.businessId, customerId, type: input.type, value: new Prisma.Decimal(input.value), status: CustomerDiscountStatus.AVAILABLE, expiresAt },
      });
      return toDiscountDto(discount);
    });
  }

  async revokeForCustomer(ownerUserId: string, customerId: string, discountId: string) {
    const discount = await this.prisma.customerDiscount.findFirst({
      where: { id: discountId, customerId, customer: { business: { members: { some: { userId: ownerUserId, role: { in: ['OWNER', 'ADMIN'] } } } } } },
    });
    if (!discount) throw new CustomerDiscountNotFoundError();
    if (discount.status === CustomerDiscountStatus.USED) throw new CustomerDiscountAlreadyUsedError();
    if (discount.status !== CustomerDiscountStatus.AVAILABLE && discount.status !== CustomerDiscountStatus.RESERVED) return toDiscountDto(discount);
    return toDiscountDto(await this.prisma.customerDiscount.update({ where: { id: discountId }, data: { status: CustomerDiscountStatus.CANCELLED } }));
  }
}

function validateValue(input: CreateCustomerDiscountInput) {
  const valid =
    Number.isFinite(input.value) &&
    input.value > 0 &&
    (input.type === 'PERCENTAGE'
      ? input.value <= MAX_CUSTOMER_DISCOUNT_PERCENTAGE
      : input.value <= MAX_CUSTOMER_FIXED_DISCOUNT);
  if (!valid) throw new CustomerDiscountInvalidValueError();
}

function toDiscountDto(discount: {
  id: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: Prisma.Decimal;
  status: 'AVAILABLE' | 'RESERVED' | 'USED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: Date | null;
  createdAt: Date;
  usedAt: Date | null;
  usedOrder?: { id: string; orderNumber: number } | null;
}) {
  return {
    id: discount.id,
    type: discount.type,
    value: discount.value.toNumber(),
    status: discount.status,
    expiresAt: discount.expiresAt,
    createdAt: discount.createdAt,
    usedAt: discount.usedAt,
    usedOrder: discount.usedOrder ?? null,
  };
}
