import {
  OrderSource as PrismaOrderSource,
  OrderStatus as PrismaOrderStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { Order, OrderProps, OrderSource, OrderStatus } from '../../domain/entities/Order.js';
import { CreateOrderDTO, ListOrdersDTO } from '../../application/dto/OrderDTO.js';
import { OrderRepository } from '../../application/ports/OrderRepository.js';
import {
  OrderBusinessNotFoundError,
  OrderBusinessAccessError,
  OrderInvalidOptionsError,
  OrderInvalidStatusTransitionError,
  OrderProductNotFoundError,
} from '../../domain/errors/OrderErrors.js';
import { normalizePhone } from '@/shared/validation/phone.js';
import { getBusinessPeriodRange } from '@/shared/time/business-period.js';

const orderInclude = {
  items: {
    orderBy: { id: 'asc' as const },
    include: { options: { orderBy: { id: 'asc' as const } } },
  },
  statusHistory: { orderBy: { createdAt: 'asc' as const } },
};

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(businessId: string, input: CreateOrderDTO): Promise<Order> {
    return this.createWithSource(businessId, input, 'PUBLIC');
  }

  async createForRestaurant(
    ownerUserId: string,
    businessId: string,
    input: CreateOrderDTO,
  ): Promise<Order> {
    const user = await this.prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { businessId: true },
    });
    if (!user?.businessId) throw new OrderBusinessNotFoundError();
    if (user.businessId !== businessId) throw new OrderBusinessAccessError();
    return this.createWithSource(businessId, input, 'RESTAURANT');
  }

  private async createWithSource(
    businessId: string,
    input: CreateOrderDTO,
    source: PrismaOrderSource,
  ): Promise<Order> {
    const orderId = await this.prisma.$transaction(
      async (tx) => {
        const business = await tx.business.findUnique({
          where: { id: businessId },
          select: { id: true },
        });
        if (!business) throw new OrderBusinessNotFoundError();
        const productIds = input.items.map((item) => item.productId);
        const products = await tx.product.findMany({
          where: { id: { in: productIds }, businessId, isAvailable: true },
          include: { optionGroups: { include: { options: true } } },
        });
        const productMap = new Map(products.map((product) => [product.id, product]));
        const items: {
          productId: string;
          productName: string;
          unitPrice: number;
          quantity: number;
          subtotal: number;
          options: { name: string; price: number }[];
        }[] = [];
        for (const requested of input.items) {
          const product = productMap.get(requested.productId);
          if (!product) throw new OrderProductNotFoundError(requested.productId);
          const selectedIds = new Set(requested.optionIds ?? []);
          if (selectedIds.size !== (requested.optionIds ?? []).length)
            throw new OrderInvalidOptionsError(product.id);
          const activeGroups = product.optionGroups.filter((group) => group.isActive);
          const selected = activeGroups.flatMap((group) =>
            group.options.filter((option) => option.isAvailable && selectedIds.has(option.id)),
          );
          if (
            selected.length !== selectedIds.size ||
            activeGroups.some((group) => {
              const count = group.options.filter((option) => selectedIds.has(option.id)).length;
              return (
                (group.isRequired && count === 0) ||
                count < group.minSelections ||
                count > group.maxSelections
              );
            })
          )
            throw new OrderInvalidOptionsError(product.id);
          const unitPrice =
            product.price.toNumber() +
            selected.reduce((sum, option) => sum + option.price.toNumber(), 0);
          items.push({
            productId: product.id,
            productName: product.name,
            unitPrice,
            quantity: requested.quantity,
            subtotal: unitPrice * requested.quantity,
            options: selected.map((option) => ({
              name: option.name,
              price: option.price.toNumber(),
            })),
          });
        }
        const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
        const last = await tx.order.aggregate({
          where: { businessId },
          _max: { orderNumber: true },
        });
        const savedCustomer = input.customer.phone
          ? await tx.customer.upsert({
              where: {
                businessId_phone: { businessId, phone: input.customer.phone },
              },
              create: { businessId, name: input.customer.name, phone: input.customer.phone },
              update: {},
            })
          : null;
        const order = await tx.order.create({
          data: {
            businessId,
            customerId: savedCustomer?.id,
            orderNumber: (last._max.orderNumber ?? 0) + 1,
            status: 'PENDING',
            source,
            subtotal,
            total: subtotal,
            customerName: input.customer.name,
            customerPhone: input.customer.phone,
            notes: input.notes,
            items: {
              create: items.map((item) => ({ ...item, options: { create: item.options } })),
            },
            statusHistory: { create: { status: 'PENDING' } },
          },
        });
        return order.id;
      },
      { timeout: 15_000 },
    );

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });
    if (!order) throw new Error('Created order could not be loaded');
    return toDomain(order);
  }

  async getById(ownerUserId: string, orderId: string): Promise<Order | null> {
    const row = await this.prisma.order.findFirst({
      where: { id: orderId, business: { users: { some: { id: ownerUserId } } } },
      include: orderInclude,
    });
    return row ? toDomain(row) : null;
  }

  async list(
    ownerUserId: string,
    input: ListOrdersDTO,
  ): Promise<{ orders: Order[]; total: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: ownerUserId },
      select: {
        businessId: true,
        business: { select: { settings: { select: { timezone: true } } } },
      },
    });
    if (!user?.businessId) throw new OrderBusinessNotFoundError();
    if (user.businessId !== input.businessId) throw new OrderBusinessAccessError();
    const timezone = user.business?.settings?.timezone || 'America/Mazatlan';
    const periodRange = input.period
      ? getBusinessPeriodRange(input.period, timezone, new Date())
      : undefined;
    const search = input.search?.trim();
    const normalizedSearchPhone = search ? normalizePhone(search) : '';
    // Short numeric searches must remain exact order-number searches. Otherwise
    // search=9 would also match every customer phone containing the digit 9.
    const searchPhone = /^\d{10}$/.test(normalizedSearchPhone) ? normalizedSearchPhone : '';
    const searchOrderNumber = search && /^\d+$/.test(search) ? Number(search) : undefined;
    const searchByNumber =
      searchOrderNumber !== undefined && Number.isSafeInteger(searchOrderNumber)
        ? { orderNumber: searchOrderNumber }
        : undefined;
    const where = {
      businessId: input.businessId,
      business: { users: { some: { id: ownerUserId } } },
      ...(periodRange ? { createdAt: { gte: periodRange.start, lt: periodRange.end } } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(search
        ? {
            OR: [
              { id: search },
              ...(searchByNumber ? [searchByNumber] : []),
              { customerName: { contains: search, mode: 'insensitive' as const } },
              ...(searchPhone ? [{ customerPhone: { contains: searchPhone } }] : []),
            ],
          }
        : {}),
    } satisfies Prisma.OrderWhereInput;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        include: orderInclude,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { orders: rows.map(toDomain), total };
  }

  async updateStatus(
    ownerUserId: string,
    orderId: string,
    status: OrderStatus,
  ): Promise<Order | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.order.findFirst({
        where: { id: orderId, business: { users: { some: { id: ownerUserId } } } },
        select: { id: true, status: true },
      });
      if (!existing) return null;
      if (!allowedTransitions[existing.status].includes(status))
        throw new OrderInvalidStatusTransitionError(existing.status, status);
      const databaseStatus = status as PrismaOrderStatus;
      const row = await tx.order.update({
        where: { id: orderId },
        data: { status: databaseStatus, statusHistory: { create: { status: databaseStatus } } },
        include: orderInclude,
      });
      return toDomain(row);
    });
  }
}

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: [],
  CANCELLED: [],
};

function toDomain(row: Prisma.OrderGetPayload<{ include: typeof orderInclude }>): Order {
  const props: OrderProps = {
    id: row.id,
    businessId: row.businessId,
    customerId: row.customerId,
    orderNumber: row.orderNumber,
    status: row.status as OrderStatus,
    source: row.source as OrderSource,
    subtotal: row.subtotal.toNumber(),
    total: row.total.toNumber(),
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    items: row.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      unitPrice: item.unitPrice.toNumber(),
      quantity: item.quantity,
      subtotal: item.subtotal.toNumber(),
      options: item.options.map((option) => ({
        id: option.id,
        name: option.name,
        price: option.price.toNumber(),
      })),
    })),
    statusHistory: row.statusHistory.map((entry) => ({
      status: entry.status as OrderStatus,
      createdAt: entry.createdAt,
    })),
  };
  return Order.create(props);
}
