import {
  OrderSource as PrismaOrderSource,
  OrderStatus as PrismaOrderStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { Order, OrderProps, OrderSource, OrderStatus } from '../../domain/entities/Order.js';
import { CreateOrderDTO, ListOrdersDTO } from '../../application/dto/OrderDTO.js';
import { OrderRepository, OrderStatusTimings } from '../../application/ports/OrderRepository.js';
import {
  OrderBusinessNotFoundError,
  OrderBusinessAccessError,
  OrderInvalidOptionsError,
  OrderInvalidStatusTransitionError,
  OrderProductNotFoundError,
  OrderPriceChangedError,
} from '../../domain/errors/OrderErrors.js';
import { normalizePhone } from '@/shared/validation/phone.js';
import { getBusinessPeriodRange } from '@/shared/time/business-period.js';
import { orderEventHub } from '../sse/OrderEventHub.js';
import { calculateCustomerDiscountAmount } from '@/modules/CustomerDiscount/domain/discountMath.js';
import { CustomerDiscountApplicationFailedError } from '@/modules/CustomerDiscount/domain/CustomerDiscountErrors.js';
import { CustomerDisabledError } from '@/modules/Customer/domain/errors/CustomerErrors.js';
import { resolveComboSelections } from '../../domain/comboSelection.js';

const orderInclude = {
  items: {
    orderBy: { id: 'asc' as const },
    include: {
      options: { orderBy: { id: 'asc' as const } },
    },
  },
  statusHistory: { orderBy: { createdAt: 'asc' as const } },
};

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getEventsRestaurantId(ownerUserId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: ownerUserId },
      select: {
        businessId: true,
        business: {
          select: {
            members: {
              where: { userId: ownerUserId, role: 'OWNER' },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });
    if (!user?.businessId || !user.business?.members.length) return null;
    return user.businessId;
  }

  async create(businessId: string, input: CreateOrderDTO): Promise<Order> {
    return this.createWithSource(businessId, input, 'PUBLIC');
  }

  async createForRestaurant(
    ownerUserId: string,
    businessId: string,
    input: CreateOrderDTO,
    idempotencyKey?: string,
  ): Promise<Order> {
    const user = await this.prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { businessId: true },
    });
    if (!user?.businessId) throw new OrderBusinessNotFoundError();
    if (user.businessId !== businessId) throw new OrderBusinessAccessError();
    return this.createWithSource(businessId, input, 'RESTAURANT', idempotencyKey);
  }

  private async createWithSource(
    businessId: string,
    input: CreateOrderDTO,
    source: PrismaOrderSource,
    idempotencyKey?: string,
  ): Promise<Order> {
    if (idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { businessId_idempotencyKey: { businessId, idempotencyKey } },
        include: orderInclude,
      });
      if (existing) return await toDomain(existing);
    }
    let created: { id: string; createdAt: Date };
    try {
      created = await this.prisma.$transaction(
      async (tx) => {
        const business = await tx.business.findUnique({
          where: { id: businessId },
          select: { id: true },
        });
        if (!business) throw new OrderBusinessNotFoundError();
        const productIds = input.items.map((item) => item.productId);
        const products = await tx.product.findMany({
          where: { id: { in: productIds }, businessId, isAvailable: true },
          include: {
            optionGroups: { include: { options: true } },
            comboOptionGroups: { include: { products: { include: { product: true } } } },
            comboIncludes: { include: { product: true } },
          },
        });
        const productMap = new Map(products.map((product) => [product.id, product]));
        const items: {
          productId: string;
          productName: string;
          unitPrice: number;
          quantity: number;
          subtotal: number;
          options: { name: string; groupName: string | null; price: number }[];
        }[] = [];
        for (const requested of input.items) {
          const product = productMap.get(requested.productId);
          if (!product) throw new OrderProductNotFoundError(requested.productId);
          const selectedIds = requested.optionIds ?? [];
          const comboSelections = resolveComboSelections(
            (product.comboOptionGroups ?? []).map((group) => ({
              id: group.id,
              name: group.name,
              minSelections: group.minSelections,
              maxSelections: group.maxSelections,
              products: group.products.map((choice) => ({
                id: choice.id,
                productId: choice.productId,
                name: choice.product.name,
                isAvailable: choice.product.isAvailable,
              })),
            })),
            requested.comboChoiceIds ?? [],
          );
          if ((product.comboOptionGroups ?? []).length > 0 && !comboSelections)
            throw new OrderInvalidOptionsError(product.id);
          const selectedCounts = new Map<string, number>();
          for (const optionId of selectedIds)
            selectedCounts.set(optionId, (selectedCounts.get(optionId) ?? 0) + 1);
          const activeGroups = product.optionGroups.filter((group) => group.isActive);
          const availableOptions = activeGroups.flatMap((group) =>
            group.options.filter((option) => option.isAvailable),
          );
          const availableOptionIds = new Set(availableOptions.map((option) => option.id));
          if (selectedIds.some((optionId) => !availableOptionIds.has(optionId)))
            throw new OrderInvalidOptionsError(product.id);
          if (
            activeGroups.some((group) => {
              const groupCount = group.options.reduce(
                (total, option) => total + (selectedCounts.get(option.id) ?? 0),
                0,
              );
              if (group.isRequired && groupCount === 0) return true;
              return group.options.some((option) => {
                const quantity = selectedCounts.get(option.id) ?? 0;
                return quantity < option.minSelections || quantity > option.maxSelections;
              });
            })
          )
            throw new OrderInvalidOptionsError(product.id);
          const selected = selectedIds
            .map((optionId) => availableOptions.find((option) => option.id === optionId))
            .filter((option): option is (typeof availableOptions)[number] => Boolean(option));
          const unitPrice =
            product.price.toNumber() +
            selected.reduce((sum, option) => sum + option.price.toNumber(), 0);
          const groupNameByOptionId = new Map(
            activeGroups.flatMap((group) =>
              group.options.map((option) => [option.id, group.name] as const),
            ),
          );
          const includedComboProducts = (product.comboIncludes ?? []).map((included) => ({
            name: included.product.name,
            groupName: 'Productos incluidos',
            price: 0,
          }));
          items.push({
            productId: product.id,
            productName: product.name,
            unitPrice,
            quantity: requested.quantity,
            subtotal: unitPrice * requested.quantity,
            options: [
              ...includedComboProducts,
              ...selected.map((option) => ({
                name: option.name,
                groupName: groupNameByOptionId.get(option.id) ?? null,
                price: option.price.toNumber(),
              })),
              ...(comboSelections ?? []),
            ],
          });
        }
        const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
        if (
          source === 'PUBLIC' &&
          input.expectedSubtotal !== undefined &&
          !input.acceptPriceChange &&
          Math.abs(subtotal - input.expectedSubtotal) >= 0.01
        ) {
          throw new OrderPriceChangedError(input.expectedSubtotal, subtotal);
        }
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
        if (source === 'PUBLIC' && savedCustomer?.isDisabled) throw new CustomerDisabledError();
        let appliedDiscountId: string | null = null;
        let discountAmount = 0;
        if (source === 'PUBLIC' && savedCustomer && !input.ignoreCustomerDiscount) {
          const now = new Date();
          await tx.customerDiscount.updateMany({
            where: {
              businessId,
              customerId: savedCustomer.id,
              status: 'AVAILABLE',
              expiresAt: { lte: now },
            },
            data: { status: 'EXPIRED' },
          });
          const candidate = await tx.customerDiscount.findFirst({
            where: {
              businessId,
              customerId: savedCustomer.id,
              status: 'AVAILABLE',
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
            orderBy: { createdAt: 'asc' },
          });
          if (candidate) {
            const calculatedAmount = calculateCustomerDiscountAmount(
              candidate.type,
              candidate.value.toNumber(),
              subtotal,
            );
            if (calculatedAmount > 0) {
              const claimed = await tx.customerDiscount.updateMany({
                where: {
                  id: candidate.id,
                  status: 'AVAILABLE',
                  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
                },
                data: { status: 'USED', usedAt: now },
              });
              if (claimed.count === 1) {
                appliedDiscountId = candidate.id;
                discountAmount = calculatedAmount;
              } else {
                throw new CustomerDiscountApplicationFailedError();
              }
            }
          }
        }
        const order = await tx.order.create({
          data: {
            businessId,
            customerId: savedCustomer?.id,
            orderNumber: (last._max.orderNumber ?? 0) + 1,
            status: 'PENDING',
            source,
            fulfillmentType: input.fulfillmentType ?? 'DINE_IN',
            subtotal,
            discountAmount,
            total: Math.max(0, subtotal - discountAmount),
            customerName: input.customer.name,
            customerPhone: input.customer.phone,
            idempotencyKey,
            notes: input.notes,
            items: {
              create: items.map((item) => ({ ...item, options: { create: item.options } })),
            },
            statusHistory: { create: { status: 'PENDING' } },
          },
        });
        if (appliedDiscountId) {
          await tx.customerDiscount.update({
            where: { id: appliedDiscountId },
            data: { usedOrderId: order.id },
          });
        }
        return { id: order.id, createdAt: order.createdAt };
        },
        { timeout: 15_000 },
      );
    } catch (error) {
      if (idempotencyKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.order.findUnique({
          where: { businessId_idempotencyKey: { businessId, idempotencyKey } },
          include: orderInclude,
        });
        if (existing) return await toDomain(existing);
      }
      throw error;
    }

    // The Prisma transaction has committed before any live notification is published.
    // SSE delivery failures must never change the outcome of an already-saved order.
    try {
      orderEventHub.publishNewOrder({
        orderId: created.id,
        restaurantId: businessId,
        createdAt: created.createdAt,
        source,
      });
    } catch {
      // Live notifications are best effort; the order remains persisted.
    }

    const order = await this.prisma.order.findUnique({
      where: { id: created.id },
      include: orderInclude,
    });
    if (!order) throw new Error('Created order could not be loaded');
    return await toDomain(order);
  }

  async getById(ownerUserId: string, orderId: string): Promise<Order | null> {
    const row = await this.prisma.order.findFirst({
      where: { id: orderId, business: { users: { some: { id: ownerUserId } } } },
      include: orderInclude,
    });
    return row ? await toDomain(row) : null;
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
    const numericSearch = search && /^\d+$/.test(search);
    const searchPhone = numericSearch
      ? normalizedSearchPhone
      : /^\d{10}$/.test(normalizedSearchPhone)
        ? normalizedSearchPhone
        : '';
    const searchPhoneSuffix = Boolean(numericSearch && normalizedSearchPhone.length < 10);
    // Prisma Int values are 32-bit. Do not add an out-of-range numeric search
    // as an orderNumber predicate (for example, a 10-digit customer phone).
    const parsedOrderNumber = numericSearch ? Number(search) : undefined;
    const searchOrderNumber =
      parsedOrderNumber !== undefined &&
      Number.isInteger(parsedOrderNumber) &&
      parsedOrderNumber >= -2147483648 &&
      parsedOrderNumber <= 2147483647
        ? parsedOrderNumber
        : undefined;
    const searchByNumber =
      searchOrderNumber !== undefined && Number.isSafeInteger(searchOrderNumber)
        ? { orderNumber: searchOrderNumber }
        : undefined;
    const numericOrderIds =
      search && /^\d+$/.test(search) && typeof this.prisma.$queryRaw === 'function'
        ? (
            await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
              SELECT "id"
              FROM "Order"
              WHERE "businessId" = ${input.businessId}
                AND CAST("orderNumber" AS TEXT) LIKE ${`%${search}`}
            `)
          ).map((row) => row.id)
        : [];
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
              ...(numericOrderIds.length > 0 ? [{ id: { in: numericOrderIds } }] : []),
              { customerName: { contains: search, mode: 'insensitive' as const } },
              ...(searchPhone
                ? [
                    {
                      customerPhone: searchPhoneSuffix
                        ? { endsWith: searchPhone }
                        : { contains: searchPhone },
                    },
                  ]
                : []),
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
    return { orders: await Promise.all(rows.map(toDomain)), total };
  }

  async updateStatus(
    ownerUserId: string,
    orderId: string,
    status: OrderStatus,
    timings: OrderStatusTimings = {},
  ) {
    const transactionStartedAt = performance.now();
    const update = await this.prisma.$transaction(async (tx) => {
      const lookupStartedAt = performance.now();
      const existing = await tx.order.findFirst({
        where: { id: orderId, business: { users: { some: { id: ownerUserId } } } },
        select: {
          id: true,
          businessId: true,
          orderNumber: true,
          status: true,
          _count: { select: { statusHistory: true } },
          statusHistory: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true },
          },
        },
      });
      timings.lookupMs = performance.now() - lookupStartedAt;
      if (!existing) return null;
      if (!allowedTransitions[existing.status].includes(status))
        throw new OrderInvalidStatusTransitionError(existing.status, status);

      const databaseStatus = status as PrismaOrderStatus;
      const previousStatusAt = existing.statusHistory[0]?.createdAt.getTime() ?? 0;
      const updatedAt = new Date(Math.max(Date.now(), previousStatusAt + 1));
      const updateStartedAt = performance.now();
      const changed = await tx.order.updateMany({
        where: {
          id: orderId,
          status: existing.status,
          business: { users: { some: { id: ownerUserId } } },
        },
        data: { status: databaseStatus, updatedAt },
      });
      timings.updateMs = performance.now() - updateStartedAt;
      if (changed.count !== 1) {
        const current = await tx.order.findFirst({
          where: { id: orderId, business: { users: { some: { id: ownerUserId } } } },
          select: { status: true },
        });
        if (!current) return null;
        throw new OrderInvalidStatusTransitionError(current.status, status);
      }

      const historyStartedAt = performance.now();
      await tx.orderStatusHistory.create({
        data: { orderId, status: databaseStatus, createdAt: updatedAt },
      });
      timings.historyMs = performance.now() - historyStartedAt;
      return {
        id: existing.id,
        businessId: existing.businessId,
        orderNumber: existing.orderNumber,
        status,
        updatedAt,
        statusRevision: existing._count.statusHistory + 1,
      };
    });
    timings.transactionMs = performance.now() - transactionStartedAt;

    if (update) {
      const queueStartedAt = performance.now();
      setImmediate(() => {
        const deliveryStartedAt = performance.now();
        let connections = 0;
        try {
          connections = orderEventHub.publishOrderStatusUpdated({
            orderId: update.id,
            businessId: update.businessId,
            orderNumber: update.orderNumber,
            status: update.status,
            updatedAt: update.updatedAt,
            statusRevision: update.statusRevision,
          });
        } catch {
          // The database commit remains successful if an SSE consumer disconnects.
        } finally {
          console.info(
            JSON.stringify({
              type: 'order_status_sse_delivery',
              orderId: update.id,
              statusRevision: update.statusRevision,
              connections,
              deliveryMs: Number((performance.now() - deliveryStartedAt).toFixed(2)),
            }),
          );
        }
      });
      timings.eventQueueMs = performance.now() - queueStartedAt;
    }
    return update;
  }
}

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: [],
  CANCELLED: [],
};

async function toDomain(
  row: Prisma.OrderGetPayload<{ include: typeof orderInclude }>,
): Promise<Order> {
  const props: OrderProps = {
    id: row.id,
    businessId: row.businessId,
    customerId: row.customerId,
    orderNumber: row.orderNumber,
    status: row.status as OrderStatus,
    source: row.source as OrderSource,
    fulfillmentType: row.fulfillmentType ?? 'DINE_IN',
    subtotal: row.subtotal.toNumber(),
    discountAmount: row.discountAmount?.toNumber() ?? 0,
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
        groupName: option.groupName,
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
