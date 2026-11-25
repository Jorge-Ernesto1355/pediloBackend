import {
  OrderSource as PrismaOrderSource,
  OrderPaymentMethod as PrismaOrderPaymentMethod,
  OrderStatus as PrismaOrderStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import {
  Order,
  OrderProps,
  OrderSource,
  OrderStatus,
  OrderPaymentMethod,
} from '../../domain/entities/Order.js';
import { CreateOrderDTO, ListOrdersDTO, UpdateOrderDTO } from '../../application/dto/OrderDTO.js';
import { OrderRepository, OrderStatusTimings } from '../../application/ports/OrderRepository.js';
import {
  OrderBusinessNotFoundError,
  OrderBusinessAccessError,
  OrderInvalidOptionsError,
  OrderInvalidStatusTransitionError,
  OrderProductNotFoundError,
  OrderPriceChangedError,
  OrderTransferUnavailableError,
  OrderNotFoundError,
  OrderNotEditableError,
  OrderDeliveryFulfillmentLockedError,
  OrderVersionConflictError,
  OrderCustomerNotFoundError,
} from '../../domain/errors/OrderErrors.js';
import { normalizePhone } from '@/shared/validation/phone.js';
import { getBusinessPeriodRange } from '@/shared/time/business-period.js';
import { orderEventHub } from '../sse/OrderEventHub.js';
import { calculateCustomerDiscountAmount } from '@/modules/CustomerDiscount/domain/discountMath.js';
import { CustomerDiscountApplicationFailedError } from '@/modules/CustomerDiscount/domain/CustomerDiscountErrors.js';
import { CustomerDisabledError } from '@/modules/Customer/domain/errors/CustomerErrors.js';
import { resolveComboSelections } from '../../domain/comboSelection.js';
import { bestDiscountFor, priceWithDiscount } from '@/modules/Discount/domain/pricing.js';
import {
  assertStockAvailable,
  consumeStockForOrder,
} from '@/modules/inventory/infrastructure/persistence/stockLedger.js';
import type { StockAlertNotice } from '@/modules/inventory/domain/stock.js';
import { publishStockAlerts } from '@/modules/inventory/infrastructure/stockAlertPublisher.js';
import { confirmDeliveryQuote } from '@/modules/delivery/domain/deliverySettings.js';
import { DeliveryDestinationInvalidError } from '@/modules/delivery/domain/errors/DeliveryErrors.js';
import { loadDeliverySettings } from '@/modules/delivery/infrastructure/persistence/PrismaDeliverySettingsRepository.js';
import { OFFER_TTL_MS } from '@/modules/delivery/domain/deliveryTokens.js';
import {
  calculateRewardDiscount,
  orderStampBlocker,
  REWARD_ITEM_OPTION,
  round2,
} from '@/modules/loyalty/domain/loyaltyRules.js';
import { LoyaltyRewardChangedError, LoyaltyRewardUnavailableError } from '@/modules/loyalty/domain/errors/LoyaltyErrors.js';
import {
  autoStampOrderInTx,
  availableRewardProduct,
  ensureCardInTx,
  loadProgramRow,
  lockRewardForRedemption,
  markRewardRedeemedInTx,
  onOrderCancelledInTx,
} from '@/modules/loyalty/infrastructure/persistence/loyaltyLedger.js';
import type { OrderStatusLoyalty } from '../../application/ports/OrderRepository.js';

const orderInclude = {
  items: {
    orderBy: { id: 'asc' as const },
    include: {
      options: { orderBy: { id: 'asc' as const } },
    },
  },
  statusHistory: { orderBy: { createdAt: 'asc' as const } },
  // Estado de la entrega a domicilio para la comanda. Solo el repartidor de ESTA entrega.
  delivery: {
    select: {
      status: true,
      offerExpiresAt: true,
      acceptedAt: true,
      handedOffAt: true,
      deliveredAt: true,
      failedAt: true,
      cancelledAt: true,
      failureReason: true,
      foodTotal: true,
      deliveryFee: true,
      paymentMethod: true,
      amountCourierAdvances: true,
      amountCourierCollects: true,
      courier: { select: { name: true, phone: true } },
    },
  },
  // Tarjeta de lealtad: premio canjeado (copia) y sello vigente de este pedido.
  loyaltyReward: {
    select: {
      id: true,
      rewardType: true,
      rewardValue: true,
      rewardLabel: true,
      rewardProductId: true,
      status: true,
      redeemedOrderId: true,
    },
  },
  loyaltyStamps: {
    where: { voidedAt: null },
    take: 1,
    select: { id: true, position: true, source: true, createdAt: true },
  },
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
    return this.createWithSource(businessId, input, 'RESTAURANT', idempotencyKey, ownerUserId);
  }

  private async createWithSource(
    businessId: string,
    input: CreateOrderDTO,
    source: PrismaOrderSource,
    idempotencyKey?: string,
    actorUserId?: string,
  ): Promise<Order> {
    if (idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { businessId_idempotencyKey: { businessId, idempotencyKey } },
        include: orderInclude,
      });
      if (existing) return await toDomain(existing);
    }
    let created: { id: string; createdAt: Date; loyaltyCardToken: string | null };
    try {
      created = await this.prisma.$transaction(
        async (tx) => {
          const business = await tx.business.findUnique({
            where: { id: businessId },
            select: { id: true, paymentCard: { where: { isActive: true } } },
          });
          if (!business) throw new OrderBusinessNotFoundError();
          if (input.paymentMethod === 'TRANSFER' && !business.paymentCard) {
            throw new OrderTransferUnavailableError();
          }
          const productIds = input.items.map((item) => item.productId);
          const products = await tx.product.findMany({
            where: { id: { in: productIds }, businessId, isAvailable: true },
            include: {
              category: { select: { menuId: true } },
              optionGroups: { include: { options: true } },
              globalOptionGroups: { include: { group: { include: { options: true } } } },
              comboOptionGroups: { include: { products: { include: { product: true } } } },
              comboIncludes: { include: { product: true } },
            },
          });
          const menuDiscounts = tx.discount?.findMany
            ? await tx.discount.findMany({
                where: {
                  businessId,
                  status: 'ACTIVE',
                  startsAt: { lte: new Date() },
                  endsAt: { gt: new Date() },
                },
                include: { products: true, categories: true, menus: true },
              })
            : [];
          const productMap = new Map(products.map((product) => [product.id, product]));
          const items: {
            productId: string;
            productName: string;
            unitPrice: number;
            quantity: number;
            subtotal: number;
            unitPriceOriginal: number;
            unitPriceFinal: number;
            discountAmount: number;
            discountId: string | null;
            discountLabel: string | null;
            options: OrderItemOptionInput[];
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
            const activeGroups = [
              ...product.optionGroups,
              ...(product.globalOptionGroups ?? []).map((link) => ({ ...link.group, productId: product.id, options: link.group.options.map((option) => ({ ...option, optionGroupId: link.group.id })) })),
            ].filter((group) => group.isActive && !('archivedAt' in group && group.archivedAt));
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
            const unitPriceOriginal =
              product.price.toNumber() +
              selected.reduce((sum, option) => sum + option.price.toNumber(), 0);
            const discount = bestDiscountFor(
              {
                id: product.id,
                price: unitPriceOriginal,
                categoryId: product.categoryId,
                menuId: product.category?.menuId,
              },
              menuDiscounts.map((entry) => ({
                id: entry.id,
                name: entry.name,
                type: entry.type,
                value: Number(entry.value),
                startsAt: entry.startsAt,
                endsAt: entry.endsAt,
                createdAt: entry.createdAt,
                target: {
                  scope: entry.scope,
                  productIds: entry.products.map((item) => item.productId),
                  categoryIds: entry.categories.map((item) => item.categoryId),
                  menuIds: entry.menus.map((item) => item.menuId),
                },
              })),
              new Date(),
            );
            const unitPriceFinal = discount
              ? priceWithDiscount(unitPriceOriginal, discount)
              : unitPriceOriginal;
            const globalOptionIds = globalOptionIdsOf(product);
            const groupNameByOptionId = new Map(
              activeGroups.flatMap((group) =>
                group.options.map((option) => [option.id, group.name] as const),
              ),
            );
            const includedComboProducts = (product.comboIncludes ?? []).map((included) => ({
              name: `${included.quantity > 1 ? `${included.quantity}× ` : ''}${included.product.name}`,
              groupName: 'Productos incluidos',
              price: 0,
            }));
            items.push({
              productId: product.id,
              productName: product.name,
              unitPrice: unitPriceFinal,
              unitPriceOriginal,
              unitPriceFinal,
              discountAmount: Math.max(0, unitPriceOriginal - unitPriceFinal),
              discountId: discount?.id ?? null,
              discountLabel: discount
                ? discount.type === 'PERCENT'
                  ? `-${discount.value}%`
                  : `-$${discount.value.toFixed(2)}`
                : null,
              quantity: requested.quantity,
              subtotal: unitPriceFinal * requested.quantity,
              options: [
                ...includedComboProducts,
                ...selected.map((option) => ({
                  name: option.name,
                  groupName: groupNameByOptionId.get(option.id) ?? null,
                  price: option.price.toNumber(),
                  ...optionSource(globalOptionIds, option.id),
                })),
                ...(comboSelections ?? []),
              ],
            });
          }
          if (source === 'PUBLIC')
            await assertStockAvailable(
              tx,
              businessId,
              items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                options: item.options,
              })),
            );
          const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
          if (source === 'PUBLIC' && !input.acceptPriceChange) {
            const expectedItems = input.items.flatMap((requested) => {
              const expected = requested.expectedUnitPrice ?? requested.expected_unit_price;
              return expected === undefined ? [] : [{ expected, quantity: requested.quantity }];
            });
            const hasItemPriceChange = input.items.some((requested, index) => {
              const expected = requested.expectedUnitPrice ?? requested.expected_unit_price;
              const item = items[index];
              return (
                item !== undefined &&
                expected !== undefined &&
                Math.abs(expected - item.unitPriceFinal) >= 0.01
              );
            });
            if (input.expectedSubtotal !== undefined || expectedItems.length > 0) {
              const expectedItemSubtotal = expectedItems.reduce(
                (sum, item) => sum + item.expected * item.quantity,
                0,
              );
              const expectedSubtotal = input.expectedSubtotal ?? expectedItemSubtotal;
              if (hasItemPriceChange || Math.abs(subtotal - expectedSubtotal) >= 0.01) {
                throw new OrderPriceChangedError(expectedSubtotal, subtotal);
              }
            }
          }
          // Envío a domicilio: se recalcula SIEMPRE aquí, con la configuración vigente.
          // Si difiere del que vio el cliente, el pedido no se crea (DELIVERY_FEE_CHANGED).
          const deliveryQuote =
            input.fulfillmentType === 'DELIVERY'
              ? await quoteOrderDelivery(tx, businessId, source, input)
              : null;
          const last = await tx.order.aggregate({
            where: { businessId },
            _max: { orderNumber: true },
          });
          // ¿El pedido crea un cliente NUEVO? Solo entonces se entrega la llave de su
          // tarjeta: nadie obtiene la tarjeta de otra persona escribiendo su teléfono.
          const customerBefore = input.customer.phone
            ? await tx.customer.findUnique({
                where: { businessId_phone: { businessId, phone: input.customer.phone } },
                select: { id: true },
              })
            : null;
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

          // Premio de lealtad (uno por pedido). Se valida y bloquea aquí; si ya no aplica o
          // su descuento cambió, el pedido NO se crea y el cliente confirma el nuevo total.
          const now = new Date();
          const loyaltyReward =
            source === 'PUBLIC' && input.loyalty
              ? await lockRewardForRedemption(tx, {
                  businessId,
                  rewardId: input.loyalty.rewardId,
                  cardToken: input.loyalty.cardToken,
                  expectedDiscount: input.loyalty.expectedDiscount,
                  now,
                })
              : source === 'RESTAURANT' && input.loyaltyRewardId && savedCustomer
                ? await lockRewardForRedemption(tx, {
                    businessId,
                    rewardId: input.loyaltyRewardId,
                    customerId: savedCustomer.id,
                    now,
                  })
                : null;
          let rewardItem: (typeof items)[number] | null = null;
          if (loyaltyReward?.rewardType === 'FREE_PRODUCT') {
            const product = await availableRewardProduct(tx, loyaltyReward);
            if (!product)
              throw new LoyaltyRewardUnavailableError(
                'PRODUCT_UNAVAILABLE',
                input.loyalty?.expectedDiscount,
              );
            // El regalo va a precio completo y se descuenta completo (línea aparte).
            rewardItem = {
              productId: product.id,
              productName: product.name,
              unitPrice: product.price,
              unitPriceOriginal: product.price,
              unitPriceFinal: product.price,
              discountAmount: 0,
              discountId: null,
              discountLabel: null,
              quantity: 1,
              subtotal: product.price,
              options: [REWARD_ITEM_OPTION],
            };
          }
          const orderSubtotal = round2(subtotal + (rewardItem?.subtotal ?? 0));
          const loyaltyDiscountAmount = loyaltyReward
            ? calculateRewardDiscount(
                { type: loyaltyReward.rewardType, value: loyaltyReward.rewardValue },
                { base: orderSubtotal, freeProductPrice: rewardItem?.unitPriceFinal ?? null },
              )
            : 0;
          if (
            input.loyalty &&
            Math.abs(input.loyalty.expectedDiscount - loyaltyDiscountAmount) >= 0.01
          ) {
            throw new LoyaltyRewardChangedError(input.loyalty.expectedDiscount, loyaltyDiscountAmount);
          }

          let appliedDiscountId: string | null = null;
          let discountAmount = 0;
          const hasProductDiscount = items.some((item) => item.discountAmount > 0);
          // Un solo beneficio por cliente: con premio de lealtad no se aplica el descuento
          // de cliente (este se conserva para el siguiente pedido).
          if (
            source === 'PUBLIC' &&
            savedCustomer &&
            !loyaltyReward &&
            !input.ignoreCustomerDiscount &&
            !hasProductDiscount
          ) {
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
              paymentMethod: (input.paymentMethod ?? 'CASH') as PrismaOrderPaymentMethod,
              subtotal: orderSubtotal,
              discountAmount,
              loyaltyRewardId: loyaltyReward?.id ?? null,
              loyaltyDiscountAmount,
              total: Math.max(0, round2(orderSubtotal - discountAmount - loyaltyDiscountAmount)),
              customerName: input.customer.name,
              customerPhone: input.customer.phone,
              idempotencyKey,
              notes: input.notes,
              ...(deliveryQuote && input.delivery
                ? {
                    deliveryAddress: input.delivery.address,
                    deliveryNeighborhood: input.delivery.neighborhood,
                    deliveryReference: input.delivery.reference ?? null,
                    deliveryLatitude: input.delivery.latitude,
                    deliveryLongitude: input.delivery.longitude,
                    deliveryDistanceKm: deliveryQuote.distanceKm,
                    deliveryFee: deliveryQuote.fee,
                  }
                : {}),
              items: {
                create: [...items, ...(rewardItem ? [rewardItem] : [])].map((item) => ({
                  ...item,
                  options: { create: item.options },
                })),
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
          if (loyaltyReward) {
            await markRewardRedeemedInTx(tx, {
              rewardId: loyaltyReward.id,
              orderId: order.id,
              userId: source === 'RESTAURANT' ? (actorUserId ?? null) : null,
              now,
            });
          }
          // Cliente nuevo con programa activo: recibe su tarjeta y la llave para guardarla.
          let loyaltyCardToken: string | null = null;
          if (source === 'PUBLIC' && savedCustomer && !customerBefore) {
            const program = await loadProgramRow(tx, businessId);
            if (program?.enabled) {
              const card = await ensureCardInTx(tx, businessId, savedCustomer.id);
              const row = await tx.loyaltyCard.findUniqueOrThrow({
                where: { id: card.id },
                select: { publicToken: true },
              });
              loyaltyCardToken = row.publicToken;
            }
          }
          return { id: order.id, createdAt: order.createdAt, loyaltyCardToken };
        },
        { timeout: 15_000 },
      );
    } catch (error) {
      if (
        idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
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
    const domain = await toDomain(order);
    const mapped = created.loyaltyCardToken
      ? Order.create({ ...domain.toJSON(), loyaltyCardToken: created.loyaltyCardToken })
      : domain;
    if (mapped.toJSON().paymentMethod === 'TRANSFER') {
      const card = await this.prisma.restaurantPaymentCard.findUnique({
        where: { businessId },
        select: {
          clabe: true,
          beneficiaryName: true,
          bankCode: true,
          bankName: true,
          business: { select: { name: true } },
        },
      });
      if (card) {
        const props = mapped.toJSON();
        return Order.create({
          ...props,
          transferCard: { ...card, restaurantName: card.business.name },
        });
      }
    }
    return mapped;
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

  async update(ownerUserId: string, orderId: string, input: UpdateOrderDTO): Promise<Order> {
    await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.order.findFirst({
          where: { id: orderId, business: { users: { some: { id: ownerUserId } } } },
          include: orderInclude,
        });
        if (!existing) throw new OrderNotFoundError();
        if (existing.status !== 'PENDING' && existing.status !== 'PREPARING')
          throw new OrderNotEditableError(existing.status);
        if (
          existing.fulfillmentType === 'DELIVERY' &&
          input.fulfillmentType !== undefined &&
          input.fulfillmentType !== existing.fulfillmentType
        )
          throw new OrderDeliveryFulfillmentLockedError();

        const productIds = input.items.map((item) => item.productId);
        const products = await tx.product.findMany({
          where: { id: { in: productIds }, businessId: existing.businessId, isAvailable: true },
          include: {
            category: { select: { menuId: true } },
            optionGroups: { include: { options: true } },
              globalOptionGroups: { include: { group: { include: { options: true } } } },
            comboOptionGroups: { include: { products: { include: { product: true } } } },
            comboIncludes: { include: { product: true } },
          },
        });
        const discounts = tx.discount?.findMany
          ? await tx.discount.findMany({
              where: {
                businessId: existing.businessId,
                status: 'ACTIVE',
                startsAt: { lte: new Date() },
                endsAt: { gt: new Date() },
              },
              include: { products: true, categories: true, menus: true },
            })
          : [];
        if (input.paymentMethod === 'TRANSFER') {
          const paymentCard = await tx.restaurantPaymentCard.findFirst({
            where: { businessId: existing.businessId, isActive: true },
            select: { id: true },
          });
          if (!paymentCard) throw new OrderTransferUnavailableError();
        }
        const assignedCustomer =
          input.customerId !== undefined
            ? input.customerId
              ? await tx.customer.findFirst({
                  where: { id: input.customerId, businessId: existing.businessId },
                  select: { id: true, name: true, phone: true },
                })
              : null
            : undefined;
        if (input.customerId && !assignedCustomer) throw new OrderCustomerNotFoundError();
        const productMap = new Map(products.map((product) => [product.id, product]));
        const oldItems = new Map(existing.items.map((item) => [item.id, item]));
        const builtItems: Array<{
          id?: string;
          productId: string;
          productName: string;
          unitPrice: number;
          unitPriceOriginal: number;
          unitPriceFinal: number;
          discountAmount: number;
          discountId: string | null;
          discountLabel: string | null;
          quantity: number;
          subtotal: number;
          options: OrderItemOptionInput[];
        }> = [];

        for (const requested of input.items) {
          const product = productMap.get(requested.productId);
          if (!product) throw new OrderProductNotFoundError(requested.productId);
          const previous = requested.id ? oldItems.get(requested.id) : undefined;
          if (requested.id && !previous) throw new OrderProductNotFoundError(requested.productId);
          if (previous && previous.productId !== product.id)
            throw new OrderProductNotFoundError(requested.productId);

          const preservePreviousOptions = Boolean(previous && requested.optionIds === undefined);
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
          if (
            !preservePreviousOptions &&
            (product.comboOptionGroups ?? []).length > 0 &&
            !comboSelections
          )
            throw new OrderInvalidOptionsError(product.id);
          const selectedCounts = new Map<string, number>();
          for (const optionId of selectedIds)
            selectedCounts.set(optionId, (selectedCounts.get(optionId) ?? 0) + 1);
          const activeGroups = [
            ...product.optionGroups,
            ...(product.globalOptionGroups ?? []).map((link) => ({ ...link.group, productId: product.id, options: link.group.options.map((option) => ({ ...option, optionGroupId: link.group.id })) })),
          ].filter((group) => group.isActive && !('archivedAt' in group && group.archivedAt));
          const availableOptions = activeGroups.flatMap((group) =>
            group.options.filter((option) => option.isAvailable),
          );
          const availableOptionIds = new Set(availableOptions.map((option) => option.id));
          if (
            !preservePreviousOptions &&
            selectedIds.some((optionId) => !availableOptionIds.has(optionId))
          )
            throw new OrderInvalidOptionsError(product.id);
          if (
            !preservePreviousOptions &&
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
          const previousOptionTotal = previous
            ? previous.options.reduce((sum, option) => sum + option.price.toNumber(), 0)
            : 0;
          const optionTotal = preservePreviousOptions
            ? previousOptionTotal
            : selected.reduce((sum, option) => sum + option.price.toNumber(), 0);
          const productBasePrice = previous
            ? Math.max(0, previous.unitPriceOriginal.toNumber() - previousOptionTotal)
            : product.price.toNumber();
          const unitPriceOriginal = productBasePrice + optionTotal;
          const discount = bestDiscountFor(
            {
              id: product.id,
              price: unitPriceOriginal,
              categoryId: product.categoryId,
              menuId: product.category?.menuId,
            },
            discounts.map((entry) => ({
              id: entry.id,
              name: entry.name,
              type: entry.type,
              value: Number(entry.value),
              startsAt: entry.startsAt,
              endsAt: entry.endsAt,
              createdAt: entry.createdAt,
              target: {
                scope: entry.scope,
                productIds: entry.products.map((item) => item.productId),
                categoryIds: entry.categories.map((item) => item.categoryId),
                menuIds: entry.menus.map((item) => item.menuId),
              },
            })),
            new Date(),
          );
          const unitPriceFinal = discount
            ? priceWithDiscount(unitPriceOriginal, discount)
            : unitPriceOriginal;
          const globalOptionIds = globalOptionIdsOf(product);
          const groupNameByOptionId = new Map(
            activeGroups.flatMap((group) =>
              group.options.map((option) => [option.id, group.name] as const),
            ),
          );
          const includedComboProducts = (product.comboIncludes ?? []).map((included) => ({
            name: `${included.quantity > 1 ? `${included.quantity}× ` : ''}${included.product.name}`,
            groupName: 'Productos incluidos',
            price: 0,
          }));
          builtItems.push({
            id: previous?.id,
            productId: product.id,
            productName: product.name,
            unitPrice: unitPriceFinal,
            unitPriceOriginal,
            unitPriceFinal,
            discountAmount: Math.max(0, unitPriceOriginal - unitPriceFinal),
            discountId: discount?.id ?? null,
            discountLabel: discount
              ? discount.type === 'PERCENT'
                ? `-${discount.value}%`
                : `-$${discount.value.toFixed(2)}`
              : null,
            quantity: requested.quantity,
            subtotal: unitPriceFinal * requested.quantity,
            options: preservePreviousOptions
              ? previous!.options.map((option) => ({
                  name: option.name,
                  groupName: option.groupName,
                  price: option.price.toNumber(),
                  productOptionId: option.productOptionId,
                  globalOptionId: option.globalOptionId,
                }))
              : [
                  ...includedComboProducts,
                  ...selected.map((option) => ({
                    name: option.name,
                    groupName: groupNameByOptionId.get(option.id) ?? null,
                    price: option.price.toNumber(),
                    ...optionSource(globalOptionIds, option.id),
                  })),
                  ...(comboSelections ?? []),
                ],
          });
        }

        const subtotal = builtItems.reduce((sum, item) => sum + item.subtotal, 0);
        // Product discounts are already reflected in each item's final unit price.
        // The order-level discount is the persisted customer discount snapshot.
        const discountAmount = existing.discountAmount.toNumber();
        // Premio de lealtad canjeado en este pedido: se recalcula con los productos nuevos
        // (porcentaje sobre el nuevo subtotal, monto fijo sin pasar del subtotal, producto
        // regalado = su renglón si sigue en el pedido).
        const activeReward =
          existing.loyaltyReward &&
          existing.loyaltyReward.status === 'REDEEMED' &&
          existing.loyaltyReward.redeemedOrderId === existing.id
            ? existing.loyaltyReward
            : null;
        const loyaltyDiscountAmount = activeReward
          ? calculateRewardDiscount(
              { type: activeReward.rewardType, value: activeReward.rewardValue.toNumber() },
              {
                base: subtotal - discountAmount,
                freeProductPrice:
                  activeReward.rewardType === 'FREE_PRODUCT'
                    ? (builtItems.find((item) => item.productId === activeReward.rewardProductId)
                        ?.unitPriceFinal ?? 0)
                    : null,
              },
            )
          : 0;
        const total = Math.max(0, round2(subtotal - discountAmount - loyaltyDiscountAmount));
        const before = {
          customerName: existing.customerName,
          customerPhone: existing.customerPhone,
          fulfillmentType: existing.fulfillmentType,
          paymentMethod: existing.paymentMethod,
          notes: existing.notes,
          items: existing.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toNumber(),
            subtotal: item.subtotal.toNumber(),
            options: item.options.map((option) => ({
              name: option.name,
              groupName: option.groupName,
              price: option.price.toNumber(),
            })),
          })),
          subtotal: existing.subtotal.toNumber(),
          discountAmount: existing.discountAmount.toNumber(),
          loyaltyDiscountAmount: existing.loyaltyDiscountAmount.toNumber(),
          total: existing.total.toNumber(),
        };
        const after = {
          customerName:
            assignedCustomer !== undefined
              ? (assignedCustomer?.name ?? null)
              : existing.customerName,
          customerPhone:
            assignedCustomer !== undefined
              ? (assignedCustomer?.phone ?? null)
              : existing.customerPhone,
          fulfillmentType: input.fulfillmentType ?? existing.fulfillmentType,
          paymentMethod: input.paymentMethod ?? existing.paymentMethod,
          notes: existing.notes,
          items: builtItems,
          subtotal,
          discountAmount,
          loyaltyDiscountAmount,
          total,
        };
        const changed = await tx.order.updateMany({
          where: {
            id: orderId,
            version: input.expectedVersion,
            status: { in: ['PENDING', 'PREPARING'] },
            business: { users: { some: { id: ownerUserId } } },
          },
          data: {
            customerId:
              assignedCustomer !== undefined ? (assignedCustomer?.id ?? null) : existing.customerId,
            customerName: after.customerName,
            customerPhone: after.customerPhone,
            fulfillmentType: after.fulfillmentType,
            paymentMethod: after.paymentMethod,
            notes: after.notes,
            subtotal,
            discountAmount,
            loyaltyDiscountAmount,
            total,
            version: { increment: 1 },
          },
        });
        if (changed.count !== 1) {
          const current = await tx.order.findUnique({
            where: { id: orderId },
            select: { version: true, status: true },
          });
          if (!current) throw new OrderNotFoundError();
          if (current.status !== 'PENDING' && current.status !== 'PREPARING')
            throw new OrderNotEditableError(current.status);
          throw new OrderVersionConflictError(input.expectedVersion, current.version);
        }
        const retainedIds = builtItems.flatMap((item) => (item.id ? [item.id] : []));
        await tx.orderItem.deleteMany({
          where: { orderId, ...(retainedIds.length ? { id: { notIn: retainedIds } } : {}) },
        });
        for (const item of builtItems) {
          const data = {
            productId: item.productId,
            productName: item.productName,
            unitPrice: item.unitPrice,
            unitPriceOriginal: item.unitPriceOriginal,
            unitPriceFinal: item.unitPriceFinal,
            discountAmount: item.discountAmount,
            discountId: item.discountId,
            discountLabel: item.discountLabel,
            quantity: item.quantity,
            subtotal: item.subtotal,
          };
          if (item.id) {
            await tx.orderItem.update({ where: { id: item.id }, data });
            await tx.orderItemOption.deleteMany({ where: { orderItemId: item.id } });
            await tx.orderItemOption.createMany({
              data: item.options.map((option) => ({ orderItemId: item.id!, ...option })),
            });
          } else {
            await tx.orderItem.create({
              data: { orderId, ...data, options: { create: item.options } },
            });
          }
        }
        await tx.orderModification.create({
          data: {
            orderId,
            userId: ownerUserId,
            version: input.expectedVersion + 1,
            changes: { before, after },
          },
        });
      },
      { timeout: 20_000 },
    );
    const updated = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });
    if (!updated) throw new OrderNotFoundError();
    return toDomain(updated);
  }

  async updateStatus(
    ownerUserId: string,
    orderId: string,
    status: OrderStatus,
    timings: OrderStatusTimings = {},
  ) {
    const transactionStartedAt = performance.now();
    let stockNotices: StockAlertNotice[] = [];
    let cancelledDeliveryOrderId: string | null = null;
    const update = await this.prisma.$transaction(async (tx) => {
      const lookupStartedAt = performance.now();
      const existing = await tx.order.findFirst({
        where: { id: orderId, business: { users: { some: { id: ownerUserId } } } },
        select: {
          id: true,
          businessId: true,
          orderNumber: true,
          status: true,
          fulfillmentType: true,
          customerId: true,
          total: true,
          delivery: { select: { id: true, status: true } },
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
      if (
        !isStatusChangeAllowed(
          existing.status,
          status,
          existing.fulfillmentType === 'DELIVERY',
          existing.delivery?.status ?? null,
        )
      )
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

      // Cancelar el pedido cancela su entrega pendiente o tomada (en la misma transacción).
      // Si justo la entregaron al repartidor, el cambio condicionado falla y se revierte todo.
      if (
        status === 'CANCELLED' &&
        existing.delivery &&
        (existing.delivery.status === 'PENDING' || existing.delivery.status === 'ACCEPTED')
      ) {
        const cancelled = await tx.delivery.updateMany({
          where: { id: existing.delivery.id, status: { in: ['PENDING', 'ACCEPTED'] } },
          data: { status: 'CANCELLED', cancelledAt: updatedAt },
        });
        if (cancelled.count !== 1) {
          throw new OrderInvalidStatusTransitionError(existing.status, status);
        }
        cancelledDeliveryOrderId = existing.id;
      }

      const historyStartedAt = performance.now();
      await tx.orderStatusHistory.create({
        data: { orderId, status: databaseStatus, createdAt: updatedAt },
      });
      timings.historyMs = performance.now() - historyStartedAt;
      // Ingredients are deducted when the order is READY, in the same transaction
      // as the status change so both succeed or fail together.
      if (status === 'READY') stockNotices = await consumeStockForOrder(tx, orderId);

      // Tarjeta de lealtad, en la MISMA transacción:
      // - Cancelar devuelve el premio canjeado y anula un sello vigente.
      // - Finalizar ("Listo" en local/para llevar) sella solo en modo automático o
      //   informa si se puede dar el sello a mano.
      let loyalty: OrderStatusLoyalty | null = null;
      if (status === 'CANCELLED') {
        await onOrderCancelledInTx(tx, {
          businessId: existing.businessId,
          orderId,
          userId: ownerUserId,
          now: updatedAt,
        });
      } else if (status === 'READY' && existing.fulfillmentType !== 'DELIVERY') {
        const auto = await autoStampOrderInTx(tx, {
          businessId: existing.businessId,
          orderId,
          createdByUserId: ownerUserId,
          now: updatedAt,
        });
        loyalty = statusLoyalty(auto, {
          status,
          fulfillmentType: existing.fulfillmentType,
          customerId: existing.customerId,
          total: existing.total.toNumber(),
        });
      }
      return {
        id: existing.id,
        businessId: existing.businessId,
        orderNumber: existing.orderNumber,
        status,
        updatedAt,
        statusRevision: existing._count.statusHistory + 1,
        loyalty,
      };
    });
    timings.transactionMs = performance.now() - transactionStartedAt;
    publishStockAlerts(stockNotices);

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
      if (cancelledDeliveryOrderId) {
        const businessId = update.businessId;
        const deliveryOrderId = cancelledDeliveryOrderId;
        setImmediate(() => {
          try {
            orderEventHub.publishDeliveryUpdated({
              orderId: deliveryOrderId,
              businessId,
              deliveryStatus: 'CANCELLED',
            });
          } catch {
            // Igual que arriba: el commit no depende del SSE.
          }
        });
      }
    }
    return update;
  }
}

type OrderItemOptionInput = {
  name: string;
  groupName: string | null;
  price: number;
  /** Catalog option the customer picked; inventory uses it to find the option's recipe. */
  productOptionId?: string | null;
  globalOptionId?: string | null;
};

function globalOptionIdsOf(product: {
  globalOptionGroups?: { group: { options: { id: string }[] } }[];
}) {
  return new Set(
    (product.globalOptionGroups ?? []).flatMap((link) =>
      link.group.options.map((option) => option.id),
    ),
  );
}

function optionSource(globalOptionIds: Set<string>, optionId: string) {
  return globalOptionIds.has(optionId)
    ? { globalOptionId: optionId }
    : { productOptionId: optionId };
}

/** Resumen de lealtad para la respuesta de "Listo" (aviso del sello en la comanda). */
function statusLoyalty(
  auto: Awaited<ReturnType<typeof autoStampOrderInTx>>,
  order: Parameters<typeof orderStampBlocker>[0],
): OrderStatusLoyalty | null {
  const { program, outcome } = auto;
  if (!program) return null;
  if (program.stampMode === 'MANUAL') {
    return { mode: 'MANUAL', stamped: null, eligible: orderStampBlocker(order, program) === null };
  }
  const stamped =
    outcome && (outcome.kind === 'STAMPED' || outcome.kind === 'ALREADY_STAMPED')
      ? {
          customerFirstName: outcome.customerFirstName,
          // Al completar, el conteo vuelve a 0: se informa la posición del sello (8 de 8).
          stampsCount: outcome.stamp.position,
          stampsRequired: outcome.card.stampsRequired,
          completed: outcome.reward !== null,
          rewardLabel: outcome.reward?.label ?? null,
        }
      : null;
  return { mode: 'AUTO', stamped, eligible: false };
}

/**
 * Reglas extra de pedidos a domicilio (los demás pedidos no cambian):
 * - "Lista" todavía no es final: se puede cancelar mientras no vaya en camino.
 * - "En camino" solo se cancela si la entrega falló (el dueño decide qué hacer).
 * - Con la entrega en manos del repartidor (PICKED_UP) no se puede cancelar.
 */
function isStatusChangeAllowed(
  from: OrderStatus,
  to: OrderStatus,
  isDeliveryOrder: boolean,
  deliveryStatus: string | null,
): boolean {
  if (to === 'CANCELLED' && deliveryStatus === 'PICKED_UP') return false;
  if (allowedTransitions[from].includes(to)) return true;
  if (!isDeliveryOrder || to !== 'CANCELLED') return false;
  if (from === 'READY') return true;
  if (from === 'OUT_FOR_DELIVERY') return deliveryStatus === 'FAILED';
  return false;
}

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: [],
  // Estados de entrega a domicilio: solo los mueve el flujo de entregas, nunca este endpoint.
  OUT_FOR_DELIVERY: [],
  DELIVERED: [],
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
    paymentMethod: (row.paymentMethod ?? 'CASH') as OrderPaymentMethod,
    subtotal: row.subtotal.toNumber(),
    discountAmount: row.discountAmount?.toNumber() ?? 0,
    total: row.total.toNumber(),
    version: row.version,
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
      unitPriceOriginal: item.unitPriceOriginal?.toNumber?.() ?? item.unitPrice.toNumber(),
      unitPriceFinal: item.unitPriceFinal?.toNumber?.() ?? item.unitPrice.toNumber(),
      discountAmount: item.discountAmount?.toNumber?.() ?? 0,
      discountId: item.discountId,
      discountLabel: item.discountLabel,
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
    deliveryFee: row.deliveryFee?.toNumber?.() ?? 0,
    delivery:
      row.fulfillmentType === 'DELIVERY' &&
      row.deliveryAddress &&
      row.deliveryLatitude &&
      row.deliveryLongitude
        ? {
            address: row.deliveryAddress,
            neighborhood: row.deliveryNeighborhood ?? null,
            reference: row.deliveryReference ?? null,
            latitude: row.deliveryLatitude.toNumber(),
            longitude: row.deliveryLongitude.toNumber(),
            distanceKm: row.deliveryDistanceKm?.toNumber() ?? 0,
          }
        : null,
    transferConfirmedAt: row.transferConfirmedAt ?? null,
    dispatch: row.delivery
      ? {
          status: row.delivery.status,
          offerCreatedAt: new Date(row.delivery.offerExpiresAt.getTime() - OFFER_TTL_MS),
          offerExpiresAt: row.delivery.offerExpiresAt,
          acceptedAt: row.delivery.acceptedAt,
          handedOffAt: row.delivery.handedOffAt,
          deliveredAt: row.delivery.deliveredAt,
          failedAt: row.delivery.failedAt,
          cancelledAt: row.delivery.cancelledAt,
          failureReason: row.delivery.failureReason,
          foodTotal: row.delivery.foodTotal.toNumber(),
          deliveryFee: row.delivery.deliveryFee.toNumber(),
          paymentMethod: row.delivery.paymentMethod,
          amountCourierAdvances: row.delivery.amountCourierAdvances.toNumber(),
          amountCourierCollects: row.delivery.amountCourierCollects.toNumber(),
          courier: row.delivery.courier,
        }
      : null,
    loyaltyDiscountAmount: row.loyaltyDiscountAmount?.toNumber?.() ?? 0,
    loyaltyReward: row.loyaltyReward
      ? {
          id: row.loyaltyReward.id,
          type: row.loyaltyReward.rewardType,
          label: row.loyaltyReward.rewardLabel,
          active:
            row.loyaltyReward.status === 'REDEEMED' && row.loyaltyReward.redeemedOrderId === row.id,
        }
      : null,
    loyaltyStamp: row.loyaltyStamps?.[0] ?? null,
  };
  return Order.create(props);
}

async function quoteOrderDelivery(
  tx: Prisma.TransactionClient,
  businessId: string,
  source: OrderSource,
  input: CreateOrderDTO,
) {
  // El pedido manual del restaurante no maneja domicilio (fuera de alcance).
  if (source !== 'PUBLIC' || !input.delivery || input.expectedDeliveryFee === undefined) {
    throw new DeliveryDestinationInvalidError();
  }
  const settings = await loadDeliverySettings(tx, businessId);
  if (!settings) throw new OrderBusinessNotFoundError();
  return confirmDeliveryQuote(
    settings,
    { latitude: input.delivery.latitude, longitude: input.delivery.longitude },
    input.expectedDeliveryFee,
  );
}
