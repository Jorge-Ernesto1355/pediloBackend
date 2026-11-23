import { Prisma, type PrismaClient } from '@prisma/client';
import type {
  CardDetail,
  CardListItem,
  ListCardsQuery,
  LoyaltyProgramRecord,
  LoyaltyRepository,
  LoyaltySummary,
  OwnerBusiness,
  PublicCardView,
  PublicProgramView,
  RedeemResult,
  RewardProductInfo,
  RewardQuote,
  StampOrderResult,
  StampResult,
  VoidResult,
} from '../../application/ports/LoyaltyRepository.js';
import {
  LoyaltyCustomerNotFoundError,
  LoyaltyOrderAlreadyHasRewardError,
  LoyaltyOrderNotFoundError,
  LoyaltyRewardNotFoundError,
  LoyaltyRewardOrderMismatchError,
  LoyaltyRewardUnavailableError,
} from '../../domain/errors/LoyaltyErrors.js';
import { readStoredDesign } from '../../domain/loyaltyDesign.js';
import { defaultLoyaltyProgram, type LoyaltyProgramConfig } from '../../domain/loyaltyProgram.js';
import {
  calculateRewardDiscount,
  customerFirstName,
  effectiveRewardStatus,
  REWARD_ITEM_OPTION,
  round2,
  startOfBusinessDay,
  startOfBusinessWeek,
} from '../../domain/loyaltyRules.js';
import { generateCardToken, isWellFormedCardToken } from '../../domain/loyaltyTokens.js';
import {
  addWalkInStampInTx,
  availableRewardProduct,
  businessTimezone,
  ensureCardInTx,
  lockRewardForRedemption,
  markRewardRedeemedInTx,
  stampOrderInTx,
  toRewardSummary,
  voidStampInTx,
} from './loyaltyLedger.js';

const programInclude = {
  rewardProduct: { select: { id: true, name: true, price: true, isAvailable: true } },
} as const;

type ProgramRow = Prisma.LoyaltyProgramGetPayload<{ include: typeof programInclude }>;

const rewardSelect = {
  id: true,
  status: true,
  rewardType: true,
  rewardValue: true,
  rewardLabel: true,
  rewardProductId: true,
  rewardProductName: true,
  expiresAt: true,
  createdAt: true,
} as const;

function availableRewardWhere(now: Date): Prisma.LoyaltyRewardWhereInput {
  return { status: 'AVAILABLE', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
}

function toProgramRecord(row: ProgramRow, business: OwnerBusiness): LoyaltyProgramRecord {
  return {
    exists: true,
    enabled: row.enabled,
    stampsRequired: row.stampsRequired,
    stampMode: row.stampMode,
    minOrderAmount: row.minOrderAmount.toNumber(),
    rewardType: row.rewardType,
    rewardValue: row.rewardValue.toNumber(),
    rewardProductId: row.rewardProductId,
    rewardProduct: row.rewardProduct
      ? { ...row.rewardProduct, price: row.rewardProduct.price.toNumber() }
      : null,
    rewardLabel: row.rewardLabel,
    rewardExpiresDays: row.rewardExpiresDays,
    walkInDailyLimit: row.walkInDailyLimit,
    design: readStoredDesign(row.design, business.name),
    designVersion: row.designVersion,
    updatedAt: row.updatedAt,
  };
}

export class PrismaLoyaltyRepository implements LoyaltyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findOwnerBusiness(ownerUserId: string): Promise<OwnerBusiness | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { business: { select: { id: true, name: true, slug: true, logoUrl: true } } },
    });
    return user?.business ?? null;
  }

  async getProgram(business: OwnerBusiness): Promise<LoyaltyProgramRecord> {
    const row = await this.prisma.loyaltyProgram.findUnique({
      where: { businessId: business.id },
      include: programInclude,
    });
    if (row) return toProgramRecord(row, business);
    // Sin programa: valores por defecto SIN crear nada.
    return {
      ...defaultLoyaltyProgram(business.name),
      exists: false,
      rewardProduct: null,
      updatedAt: null,
    };
  }

  async findProduct(businessId: string, productId: string): Promise<RewardProductInfo | null> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, businessId },
      select: { id: true, name: true, price: true, isAvailable: true },
    });
    return product ? { ...product, price: product.price.toNumber() } : null;
  }

  async saveProgram(
    business: OwnerBusiness,
    config: LoyaltyProgramConfig,
  ): Promise<LoyaltyProgramRecord> {
    const data = {
      enabled: config.enabled,
      stampsRequired: config.stampsRequired,
      stampMode: config.stampMode,
      minOrderAmount: config.minOrderAmount,
      rewardType: config.rewardType,
      rewardValue: config.rewardValue,
      rewardProductId: config.rewardProductId,
      rewardLabel: config.rewardLabel,
      rewardExpiresDays: config.rewardExpiresDays,
      walkInDailyLimit: config.walkInDailyLimit,
      design: config.design as unknown as Prisma.InputJsonValue,
      designVersion: config.designVersion,
    };
    const row = await this.prisma.loyaltyProgram.upsert({
      where: { businessId: business.id },
      create: { businessId: business.id, ...data },
      update: data,
      include: programInclude,
    });
    return toProgramRecord(row, business);
  }

  async listCards(
    businessId: string,
    query: ListCardsQuery,
    now: Date,
  ): Promise<{ cards: CardListItem[]; total: number; stampsRequired: number }> {
    const program = await this.prisma.loyaltyProgram.findUnique({
      where: { businessId },
      select: { stampsRequired: true },
    });
    const stampsRequired = program?.stampsRequired ?? 8;
    const search = query.search?.trim();
    const digits = search?.replace(/\D/g, '') ?? '';
    const where: Prisma.LoyaltyCardWhereInput = {
      businessId,
      ...(query.customerIds ? { customerId: { in: query.customerIds } } : {}),
      ...(search
        ? {
            customer: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
              ],
            },
          }
        : {}),
      // "Cerca del premio": le faltan 1 o 2 sellos.
      ...(query.filter === 'near'
        ? { stampsCount: { gte: Math.max(1, stampsRequired - 2), lt: stampsRequired } }
        : {}),
      ...(query.filter === 'reward' ? { rewards: { some: availableRewardWhere(now) } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.loyaltyCard.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          stampsCount: true,
          cyclesCompleted: true,
          customer: { select: { id: true, name: true, phone: true } },
          _count: { select: { rewards: { where: availableRewardWhere(now) } } },
          stamps: {
            where: { voidedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true },
          },
        },
      }),
      this.prisma.loyaltyCard.count({ where }),
    ]);
    return {
      stampsRequired,
      total,
      cards: rows.map((row) => ({
        id: row.id,
        customer: row.customer,
        stampsCount: row.stampsCount,
        cyclesCompleted: row.cyclesCompleted,
        availableRewards: row._count.rewards,
        lastStampAt: row.stamps[0]?.createdAt ?? null,
      })),
    };
  }

  async summary(businessId: string, now: Date): Promise<LoyaltySummary> {
    const timezone = await businessTimezone(this.prisma, businessId);
    const [activeCards, stampsThisWeek, pendingRewards] = await this.prisma.$transaction([
      this.prisma.loyaltyCard.count({
        where: { businessId, OR: [{ stampsCount: { gt: 0 } }, { cyclesCompleted: { gt: 0 } }] },
      }),
      this.prisma.loyaltyStamp.count({
        where: {
          businessId,
          voidedAt: null,
          createdAt: { gte: startOfBusinessWeek(now, timezone) },
        },
      }),
      this.prisma.loyaltyReward.count({ where: { businessId, ...availableRewardWhere(now) } }),
    ]);
    return { activeCards, stampsThisWeek, pendingRewards };
  }

  async getCardDetail(
    businessId: string,
    customerId: string,
    options: { createIfMissing: boolean },
    now: Date,
  ): Promise<CardDetail | null> {
    let card = await this.prisma.loyaltyCard.findUnique({
      where: { businessId_customerId: { businessId, customerId } },
      select: { id: true },
    });
    if (!card) {
      if (!options.createIfMissing) {
        const customer = await this.prisma.customer.findFirst({
          where: { id: customerId, businessId },
          select: { id: true },
        });
        if (!customer) throw new LoyaltyCustomerNotFoundError();
        return null;
      }
      card = await this.prisma.$transaction((tx) => ensureCardInTx(tx, businessId, customerId));
    }
    const [row, program, timezone] = await Promise.all([
      this.prisma.loyaltyCard.findUniqueOrThrow({
        where: { id: card.id },
        select: {
          id: true,
          customerId: true,
          stampsCount: true,
          cyclesCompleted: true,
          publicToken: true,
          createdAt: true,
          customer: { select: { id: true, name: true, phone: true } },
          stamps: {
            orderBy: { createdAt: 'desc' },
            take: 100,
            select: {
              id: true,
              cycle: true,
              position: true,
              source: true,
              createdAt: true,
              orderId: true,
              note: true,
              voidedAt: true,
              voidedReason: true,
              order: { select: { orderNumber: true } },
              createdBy: { select: { name: true } },
              voidedBy: { select: { name: true } },
            },
          },
          rewards: {
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
              ...rewardSelect,
              redeemedAt: true,
              voidedAt: true,
              redeemedOrder: { select: { orderNumber: true } },
            },
          },
        },
      }),
      this.prisma.loyaltyProgram.findUnique({
        where: { businessId },
        select: { stampsRequired: true },
      }),
      businessTimezone(this.prisma, businessId),
    ]);
    const walkInStampsToday = await this.prisma.loyaltyStamp.count({
      where: {
        cardId: row.id,
        source: 'WALK_IN',
        voidedAt: null,
        createdAt: { gte: startOfBusinessDay(now, timezone) },
      },
    });
    return {
      card: {
        id: row.id,
        customerId: row.customerId,
        customer: row.customer,
        stampsCount: row.stampsCount,
        cyclesCompleted: row.cyclesCompleted,
        stampsRequired: program?.stampsRequired ?? 8,
        cardToken: row.publicToken,
        createdAt: row.createdAt,
      },
      stamps: row.stamps.map((stamp) => ({
        id: stamp.id,
        cycle: stamp.cycle,
        position: stamp.position,
        source: stamp.source,
        createdAt: stamp.createdAt,
        orderId: stamp.orderId,
        orderNumber: stamp.order?.orderNumber ?? null,
        note: stamp.note,
        createdBy: stamp.createdBy?.name ?? null,
        voidedAt: stamp.voidedAt,
        voidedReason: stamp.voidedReason,
        voidedBy: stamp.voidedBy?.name ?? null,
      })),
      rewards: row.rewards.map((reward) => ({
        ...toRewardSummary(reward, now),
        redeemedAt: reward.redeemedAt,
        redeemedOrderNumber: reward.redeemedOrder?.orderNumber ?? null,
        voidedAt: reward.voidedAt,
      })),
      walkInStampsToday,
    };
  }

  stampOrder(input: {
    businessId: string;
    orderId: string;
    userId: string;
    linkCustomer?: { name: string; phone: string };
    now: Date;
  }): Promise<StampOrderResult> {
    return this.prisma.$transaction((tx) =>
      stampOrderInTx(tx, {
        businessId: input.businessId,
        orderId: input.orderId,
        source: 'ORDER_MANUAL',
        createdByUserId: input.userId,
        linkCustomer: input.linkCustomer,
        now: input.now,
      }),
    );
  }

  addWalkInStamp(input: {
    businessId: string;
    customerId: string;
    note: string | null;
    userId: string;
    now: Date;
  }): Promise<StampResult> {
    return this.prisma.$transaction((tx) =>
      addWalkInStampInTx(tx, {
        businessId: input.businessId,
        customerId: input.customerId,
        note: input.note,
        createdByUserId: input.userId,
        now: input.now,
      }),
    );
  }

  voidStamp(input: {
    businessId: string;
    stampId?: string;
    orderId?: string;
    reason: string;
    userId: string;
    now: Date;
  }): Promise<VoidResult> {
    return this.prisma.$transaction((tx) =>
      voidStampInTx(tx, {
        businessId: input.businessId,
        stampId: input.stampId,
        orderId: input.orderId,
        reason: input.reason,
        voidedByUserId: input.userId,
        now: input.now,
      }),
    );
  }

  /**
   * Canje manual del dueño. Sin pedido: se canjea en el local (queda registrado quién).
   * Con pedido: se aplica a un pedido pendiente o en preparación del MISMO cliente,
   * recalculando su total (un premio o descuento de cliente por pedido).
   */
  redeemReward(input: {
    businessId: string;
    rewardId: string;
    orderId: string | null;
    userId: string;
    now: Date;
  }): Promise<RedeemResult> {
    const { businessId, rewardId, orderId, userId, now } = input;
    return this.prisma.$transaction(async (tx) => {
      // Premio de otro restaurante: misma respuesta que uno inexistente.
      const owned = await tx.loyaltyReward.findFirst({
        where: { id: rewardId, businessId },
        select: { id: true },
      });
      if (!owned) throw new LoyaltyRewardNotFoundError();
      if (!orderId) {
        const reward = await lockRewardForRedemption(tx, { businessId, rewardId, now });
        await markRewardRedeemedInTx(tx, { rewardId, orderId: null, userId, now });
        return { reward: redeemedView(reward, now), order: null };
      }

      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Order" WHERE "id" = ${orderId} AND "businessId" = ${businessId} FOR UPDATE`;
      if (locked.length === 0) throw new LoyaltyOrderNotFoundError();
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          version: true,
          customerId: true,
          subtotal: true,
          discountAmount: true,
          total: true,
          loyaltyDiscountAmount: true,
          redeemedReward: { select: { id: true } },
        },
      });
      if (order.status !== 'PENDING' && order.status !== 'PREPARING')
        throw new LoyaltyRewardOrderMismatchError('ORDER_NOT_EDITABLE');
      if (order.redeemedReward || order.discountAmount.toNumber() > 0)
        throw new LoyaltyOrderAlreadyHasRewardError();
      if (!order.customerId) throw new LoyaltyRewardOrderMismatchError('OTHER_CUSTOMER');

      const reward = await lockRewardForRedemption(tx, {
        businessId,
        rewardId,
        customerId: order.customerId,
        now,
      });
      let subtotal = order.subtotal.toNumber();
      let freeProductPrice: number | null = null;
      if (reward.rewardType === 'FREE_PRODUCT') {
        const product = await availableRewardProduct(tx, reward);
        if (!product) throw new LoyaltyRewardUnavailableError('PRODUCT_UNAVAILABLE');
        await tx.orderItem.create({
          data: {
            orderId,
            productId: product.id,
            productName: product.name,
            unitPrice: product.price,
            unitPriceOriginal: product.price,
            unitPriceFinal: product.price,
            discountAmount: 0,
            quantity: 1,
            subtotal: product.price,
            options: { create: [REWARD_ITEM_OPTION] },
          },
        });
        subtotal = round2(subtotal + product.price);
        freeProductPrice = product.price;
      }
      const discountAmount = order.discountAmount.toNumber();
      const loyaltyDiscountAmount = calculateRewardDiscount(
        { type: reward.rewardType, value: reward.rewardValue },
        { base: subtotal - discountAmount, freeProductPrice },
      );
      const total = Math.max(0, round2(subtotal - discountAmount - loyaltyDiscountAmount));
      await tx.order.update({
        where: { id: orderId },
        data: {
          subtotal,
          total,
          loyaltyRewardId: reward.id,
          loyaltyDiscountAmount,
          version: { increment: 1 },
        },
      });
      await tx.orderModification.create({
        data: {
          orderId,
          userId,
          version: order.version + 1,
          changes: {
            before: {
              subtotal: order.subtotal.toNumber(),
              loyaltyDiscountAmount: order.loyaltyDiscountAmount.toNumber(),
              total: order.total.toNumber(),
            },
            after: { subtotal, loyaltyDiscountAmount, total, loyaltyRewardId: reward.id },
          },
        },
      });
      await markRewardRedeemedInTx(tx, { rewardId, orderId, userId, now });
      return {
        reward: redeemedView(reward, now),
        order: { id: orderId, total, loyaltyDiscountAmount },
      };
    });
  }

  async rotateCardToken(
    businessId: string,
    customerId: string,
  ): Promise<{ cardToken: string } | null> {
    const cardToken = generateCardToken();
    const changed = await this.prisma.loyaltyCard.updateMany({
      where: { businessId, customerId },
      data: { publicToken: cardToken },
    });
    return changed.count === 1 ? { cardToken } : null;
  }

  async findPublicCard(token: string, now: Date): Promise<PublicCardView | null> {
    if (!isWellFormedCardToken(token)) return null;
    const card = await this.prisma.loyaltyCard.findUnique({
      where: { publicToken: token },
      select: {
        stampsCount: true,
        cyclesCompleted: true,
        customer: { select: { name: true } },
        business: {
          select: {
            name: true,
            slug: true,
            logoUrl: true,
            loyaltyProgram: {
              select: {
                enabled: true,
                stampsRequired: true,
                rewardLabel: true,
                minOrderAmount: true,
                design: true,
              },
            },
          },
        },
        rewards: {
          where: availableRewardWhere(now),
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            rewardType: true,
            rewardLabel: true,
            rewardProductName: true,
            expiresAt: true,
          },
        },
        stamps: {
          where: { voidedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { createdAt: true },
        },
      },
    });
    if (!card) return null;
    const restaurant = {
      name: card.business.name,
      slug: card.business.slug,
      logoUrl: card.business.logoUrl,
    };
    const program = card.business.loyaltyProgram;
    if (!program?.enabled) return { status: 'PAUSED', restaurant };
    return {
      status: 'ACTIVE',
      restaurant,
      design: readStoredDesign(program.design, card.business.name),
      program: {
        rewardLabel: program.rewardLabel,
        stampsRequired: program.stampsRequired,
        minOrderAmount: program.minOrderAmount.toNumber(),
      },
      card: {
        customerFirstName: customerFirstName(card.customer.name),
        stampsCount: card.stampsCount,
        stampsRequired: program.stampsRequired,
        cyclesCompleted: card.cyclesCompleted,
        rewards: card.rewards.map((reward) => ({
          id: reward.id,
          type: reward.rewardType,
          label: reward.rewardLabel,
          productName: reward.rewardProductName,
          expiresAt: reward.expiresAt,
        })),
        recentStamps: card.stamps,
      },
    };
  }

  async findPublicProgram(slug: string): Promise<PublicProgramView | null> {
    const business = await this.prisma.business.findUnique({
      where: { slug },
      select: {
        name: true,
        logoUrl: true,
        loyaltyProgram: {
          select: {
            enabled: true,
            stampsRequired: true,
            rewardType: true,
            rewardValue: true,
            rewardLabel: true,
            minOrderAmount: true,
            design: true,
          },
        },
      },
    });
    const program = business?.loyaltyProgram;
    if (!business || !program?.enabled) return null;
    return {
      stampsRequired: program.stampsRequired,
      rewardType: program.rewardType,
      rewardValue: program.rewardValue.toNumber(),
      rewardLabel: program.rewardLabel,
      minOrderAmount: program.minOrderAmount.toNumber(),
      design: readStoredDesign(program.design, business.name),
      restaurant: { name: business.name, logoUrl: business.logoUrl },
    };
  }

  async quoteReward(input: {
    slug: string;
    cardToken: string;
    subtotal: number;
    now: Date;
  }): Promise<RewardQuote | null> {
    if (!isWellFormedCardToken(input.cardToken)) return null;
    const card = await this.prisma.loyaltyCard.findUnique({
      where: { publicToken: input.cardToken },
      select: {
        businessId: true,
        stampsCount: true,
        business: {
          select: {
            slug: true,
            loyaltyProgram: { select: { enabled: true, stampsRequired: true } },
          },
        },
        rewards: {
          where: availableRewardWhere(input.now),
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: rewardSelect,
        },
      },
    });
    // Token inexistente o de OTRO restaurante: misma respuesta (null → 404).
    if (!card || card.business.slug !== input.slug) return null;
    const program = card.business.loyaltyProgram;
    const progress = {
      stampsCount: card.stampsCount,
      stampsRequired: program?.stampsRequired ?? 8,
    };
    const row = card.rewards[0];
    if (!program?.enabled || !row)
      return {
        programActive: Boolean(program?.enabled),
        card: progress,
        reward: null,
        discount: 0,
        freeProduct: null,
        unavailableReason: null,
      };
    const reward = toRewardSummary(row, input.now);
    const rewardView = {
      id: reward.id,
      type: reward.type,
      value: reward.value,
      label: reward.label,
      productName: reward.productName,
      expiresAt: reward.expiresAt,
    };
    if (reward.type === 'FREE_PRODUCT') {
      const product = await availableRewardProduct(this.prisma, {
        businessId: card.businessId,
        rewardProductId: reward.productId,
      });
      if (!product)
        return {
          programActive: true,
          card: progress,
          reward: rewardView,
          discount: 0,
          freeProduct: null,
          unavailableReason: 'PRODUCT_UNAVAILABLE',
        };
      // El producto regalado entra al pedido a precio completo y se descuenta completo.
      return {
        programActive: true,
        card: progress,
        reward: rewardView,
        discount: calculateRewardDiscount(reward, {
          base: input.subtotal + product.price,
          freeProductPrice: product.price,
        }),
        freeProduct: product,
        unavailableReason: null,
      };
    }
    return {
      programActive: true,
      card: progress,
      reward: rewardView,
      discount: calculateRewardDiscount(reward, { base: input.subtotal }),
      freeProduct: null,
      unavailableReason: null,
    };
  }
}

function redeemedView(
  reward: {
    id: string;
    rewardType: RedeemResult['reward']['type'];
    rewardValue: number;
    rewardLabel: string;
    rewardProductId: string | null;
    rewardProductName: string | null;
    expiresAt: Date | null;
  },
  now: Date,
): RedeemResult['reward'] {
  return {
    id: reward.id,
    status: effectiveRewardStatus({ status: 'REDEEMED', expiresAt: reward.expiresAt }, now),
    type: reward.rewardType,
    value: reward.rewardValue,
    label: reward.rewardLabel,
    productId: reward.rewardProductId,
    productName: reward.rewardProductName,
    expiresAt: reward.expiresAt,
    createdAt: now,
  };
}
