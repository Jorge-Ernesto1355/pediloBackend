import { Prisma, type PrismaClient } from '@prisma/client';
import type {
  CourierLookup,
  DeliveryOrderStatus,
  DeliveryRecord,
  DeliveryRepository,
  DispatchOrder,
  NewOffer,
  OfferLookup,
  OrderStatusChange,
} from '../../application/ports/DeliveryRepository.js';
import type { DeliveryFailureReason } from '../../domain/deliveryStateMachine.js';
import type { Coordinates } from '../../domain/distance.js';
import { DeliveryInvalidTransitionError } from '../../domain/errors/DeliveryErrors.js';
import { autoStampOrderInTx } from '@/modules/loyalty/infrastructure/persistence/loyaltyLedger.js';

export const deliveryRecordSelect = {
  id: true,
  businessId: true,
  orderId: true,
  status: true,
  offerExpiresAt: true,
  foodTotal: true,
  deliveryFee: true,
  paymentMethod: true,
  amountCourierAdvances: true,
  amountCourierCollects: true,
  failureReason: true,
  createdAt: true,
  acceptedAt: true,
  handedOffAt: true,
  deliveredAt: true,
  failedAt: true,
  cancelledAt: true,
  courier: { select: { name: true, phone: true } },
} satisfies Prisma.DeliverySelect;

type DeliveryRow = Prisma.DeliveryGetPayload<{ select: typeof deliveryRecordSelect }>;

export function toDeliveryRecord(row: DeliveryRow): DeliveryRecord {
  return {
    id: row.id,
    businessId: row.businessId,
    orderId: row.orderId,
    status: row.status,
    offerExpiresAt: row.offerExpiresAt,
    foodTotal: row.foodTotal.toNumber(),
    deliveryFee: row.deliveryFee.toNumber(),
    paymentMethod: row.paymentMethod,
    amountCourierAdvances: row.amountCourierAdvances.toNumber(),
    amountCourierCollects: row.amountCourierCollects.toNumber(),
    failureReason: row.failureReason,
    createdAt: row.createdAt,
    acceptedAt: row.acceptedAt,
    handedOffAt: row.handedOffAt,
    deliveredAt: row.deliveredAt,
    failedAt: row.failedAt,
    cancelledAt: row.cancelledAt,
    courier: row.courier,
  };
}

function toCoordinates(
  latitude: Prisma.Decimal | null | undefined,
  longitude: Prisma.Decimal | null | undefined,
): Coordinates | null {
  return latitude && longitude
    ? { latitude: latitude.toNumber(), longitude: longitude.toNumber() }
    : null;
}

const ownedBy = (ownerUserId: string) => ({ business: { users: { some: { id: ownerUserId } } } });

export class PrismaDeliveryRepository implements DeliveryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findOrderForOwner(ownerUserId: string, orderId: string): Promise<DispatchOrder | null> {
    const row = await this.prisma.order.findFirst({
      where: { id: orderId, ...ownedBy(ownerUserId) },
      select: {
        id: true,
        businessId: true,
        orderNumber: true,
        status: true,
        fulfillmentType: true,
        paymentMethod: true,
        total: true,
        deliveryFee: true,
        transferConfirmedAt: true,
        delivery: { select: deliveryRecordSelect },
      },
    });
    if (!row) return null;
    return {
      orderId: row.id,
      businessId: row.businessId,
      orderNumber: row.orderNumber,
      status: row.status,
      isHomeDelivery: row.fulfillmentType === 'DELIVERY',
      paymentMethod: row.paymentMethod,
      foodTotal: row.total.toNumber(),
      deliveryFee: row.deliveryFee.toNumber(),
      transferConfirmedAt: row.transferConfirmedAt,
      delivery: row.delivery ? toDeliveryRecord(row.delivery) : null,
    };
  }

  async createOffer(order: DispatchOrder, offer: NewOffer): Promise<DeliveryRecord | null> {
    try {
      const row = await this.prisma.delivery.create({
        data: {
          businessId: order.businessId,
          orderId: order.orderId,
          status: 'PENDING',
          offerTokenHash: offer.offerTokenHash,
          offerExpiresAt: offer.offerExpiresAt,
          ...offer.money,
        },
        select: deliveryRecordSelect,
      });
      return toDeliveryRecord(row);
    } catch (error) {
      // orderId es único: otra petición creó la entrega al mismo tiempo.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return null;
      }
      throw error;
    }
  }

  async renewOffer(deliveryId: string, offer: NewOffer): Promise<DeliveryRecord | null> {
    const changed = await this.prisma.delivery.updateMany({
      where: { id: deliveryId, status: 'PENDING' },
      data: {
        offerTokenHash: offer.offerTokenHash,
        offerExpiresAt: offer.offerExpiresAt,
        ...offer.money,
      },
    });
    return changed.count === 1 ? this.findRecord(deliveryId) : null;
  }

  async findByOfferTokenHash(hash: string): Promise<OfferLookup | null> {
    const row = await this.prisma.delivery.findUnique({
      where: { offerTokenHash: hash },
      select: {
        ...deliveryRecordSelect,
        business: {
          select: { name: true, ubicationMaps: { select: { latitude: true, longitude: true } } },
        },
        order: {
          select: {
            deliveryNeighborhood: true,
            deliveryLatitude: true,
            deliveryLongitude: true,
            deliveryDistanceKm: true,
            items: { select: { quantity: true } },
          },
        },
      },
    });
    if (!row) return null;
    return {
      delivery: toDeliveryRecord(row),
      restaurantName: row.business.name,
      restaurantLocation: toCoordinates(
        row.business.ubicationMaps?.latitude,
        row.business.ubicationMaps?.longitude,
      ),
      neighborhood: row.order.deliveryNeighborhood,
      destination: toCoordinates(row.order.deliveryLatitude, row.order.deliveryLongitude),
      distanceKm: row.order.deliveryDistanceKm?.toNumber() ?? 0,
      itemCount: row.order.items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }

  async claim(input: {
    offerTokenHash: string;
    courier: { name: string; phone: string };
    courierTokenHash: string;
    now: Date;
  }): Promise<DeliveryRecord | null> {
    const claimedId = await this.prisma.$transaction(async (tx) => {
      const courier = await tx.courier.upsert({
        where: { phone: input.courier.phone },
        create: { phone: input.courier.phone, name: input.courier.name },
        update: { name: input.courier.name },
        select: { id: true },
      });
      // Las columnas son TIMESTAMP sin zona en UTC (convención de Prisma). En SQL crudo el
      // Date llega como timestamptz: se convierte explícitamente a UTC para no depender de la
      // zona horaria de la sesión de PostgreSQL.
      const nowUtc = Prisma.sql`(${input.now}::timestamptz AT TIME ZONE 'UTC')`;
      // Toma atómica: una sola sentencia. Si dos personas toman a la vez, PostgreSQL
      // serializa sobre la fila y vuelve a evaluar el WHERE: solo una obtiene la fila.
      const rows = await tx.$queryRaw<{ id: string }[]>`
        UPDATE "deliveries"
        SET "courierId" = ${courier.id},
            "status" = 'ACCEPTED'::"DeliveryStatus",
            "acceptedAt" = ${nowUtc},
            "courierTokenHash" = ${input.courierTokenHash}
        WHERE "offerTokenHash" = ${input.offerTokenHash}
          AND "status" = 'PENDING'::"DeliveryStatus"
          AND "courierId" IS NULL
          AND "offerExpiresAt" > ${nowUtc}
        RETURNING "id"`;
      return rows[0]?.id ?? null;
    });
    return claimedId ? this.findRecord(claimedId) : null;
  }

  async findByCourierTokenHash(hash: string): Promise<CourierLookup | null> {
    const row = await this.prisma.delivery.findUnique({
      where: { courierTokenHash: hash },
      select: {
        ...deliveryRecordSelect,
        business: {
          select: {
            name: true,
            ubication: true,
            ubicationMaps: { select: { latitude: true, longitude: true } },
          },
        },
        order: {
          select: {
            orderNumber: true,
            status: true,
            customerName: true,
            customerPhone: true,
            deliveryAddress: true,
            deliveryNeighborhood: true,
            deliveryReference: true,
            deliveryLatitude: true,
            deliveryLongitude: true,
            deliveryDistanceKm: true,
            notes: true,
            items: {
              orderBy: { id: 'asc' },
              select: {
                quantity: true,
                productName: true,
                options: { orderBy: { id: 'asc' }, select: { name: true } },
              },
            },
          },
        },
      },
    });
    const destination = row
      ? toCoordinates(row.order.deliveryLatitude, row.order.deliveryLongitude)
      : null;
    if (!row || !destination) return null;
    return {
      delivery: toDeliveryRecord(row),
      orderNumber: row.order.orderNumber,
      orderStatus: row.order.status,
      restaurant: {
        name: row.business.name,
        address: row.business.ubication,
        location: toCoordinates(
          row.business.ubicationMaps?.latitude,
          row.business.ubicationMaps?.longitude,
        ),
      },
      customer: { name: row.order.customerName, phone: row.order.customerPhone },
      address: row.order.deliveryAddress ?? '',
      neighborhood: row.order.deliveryNeighborhood,
      reference: row.order.deliveryReference,
      destination,
      distanceKm: row.order.deliveryDistanceKm?.toNumber() ?? 0,
      notes: row.order.notes,
      items: row.order.items.map((item) => ({
        quantity: item.quantity,
        name: item.productName,
        options: item.options.map((option) => option.name),
      })),
    };
  }

  async release(
    deliveryId: string,
    offer: Omit<NewOffer, 'money'>,
  ): Promise<DeliveryRecord | null> {
    const changed = await this.prisma.delivery.updateMany({
      where: { id: deliveryId, status: 'ACCEPTED' },
      data: {
        status: 'PENDING',
        courierId: null,
        courierTokenHash: null,
        acceptedAt: null,
        offerTokenHash: offer.offerTokenHash,
        offerExpiresAt: offer.offerExpiresAt,
      },
    });
    return changed.count === 1 ? this.findRecord(deliveryId) : null;
  }

  handOff(deliveryId: string, now: Date): Promise<OrderStatusChange | null> {
    return this.moveWithOrder(deliveryId, now, {
      from: 'ACCEPTED',
      to: 'PICKED_UP',
      data: { handedOffAt: now },
      orderFrom: ['PREPARING', 'READY'],
      orderTo: 'OUT_FOR_DELIVERY',
    });
  }

  markDelivered(deliveryId: string, now: Date): Promise<OrderStatusChange | null> {
    return this.moveWithOrder(deliveryId, now, {
      from: 'PICKED_UP',
      to: 'DELIVERED',
      data: { deliveredAt: now },
      orderFrom: ['OUT_FOR_DELIVERY'],
      orderTo: 'DELIVERED',
    });
  }

  async markFailed(deliveryId: string, reason: DeliveryFailureReason, now: Date): Promise<boolean> {
    const changed = await this.prisma.delivery.updateMany({
      where: { id: deliveryId, status: 'PICKED_UP' },
      data: { status: 'FAILED', failedAt: now, failureReason: reason },
    });
    return changed.count === 1;
  }

  async confirmTransfer(ownerUserId: string, orderId: string, now: Date): Promise<Date | null> {
    await this.prisma.order.updateMany({
      where: {
        id: orderId,
        paymentMethod: 'TRANSFER',
        transferConfirmedAt: null,
        ...ownedBy(ownerUserId),
      },
      data: { transferConfirmedAt: now },
    });
    const row = await this.prisma.order.findFirst({
      where: { id: orderId, paymentMethod: 'TRANSFER', ...ownedBy(ownerUserId) },
      select: { transferConfirmedAt: true },
    });
    return row?.transferConfirmedAt ?? null;
  }

  private async findRecord(deliveryId: string): Promise<DeliveryRecord | null> {
    const row = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      select: deliveryRecordSelect,
    });
    return row ? toDeliveryRecord(row) : null;
  }

  /**
   * Cambia la entrega y el pedido en UNA transacción, con actualizaciones condicionadas
   * al estado esperado (si otra petición se adelantó, no cambia nada y devuelve null).
   */
  private async moveWithOrder(
    deliveryId: string,
    now: Date,
    move: {
      from: 'ACCEPTED' | 'PICKED_UP';
      to: 'PICKED_UP' | 'DELIVERED';
      data: Prisma.DeliveryUpdateManyMutationInput;
      orderFrom: DeliveryOrderStatus[];
      orderTo: 'OUT_FOR_DELIVERY' | 'DELIVERED';
    },
  ): Promise<OrderStatusChange | null> {
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.delivery.updateMany({
        where: { id: deliveryId, status: move.from },
        data: { status: move.to, ...move.data },
      });
      if (changed.count !== 1) return null;

      const delivery = await tx.delivery.findUniqueOrThrow({
        where: { id: deliveryId },
        select: {
          order: {
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
          },
        },
      });
      const order = delivery.order;
      const previousAt = order.statusHistory[0]?.createdAt.getTime() ?? 0;
      const updatedAt = new Date(Math.max(now.getTime(), previousAt + 1));
      const orderChanged = await tx.order.updateMany({
        where: { id: order.id, status: { in: move.orderFrom } },
        data: { status: move.orderTo, updatedAt },
      });
      // Revierte la transacción: entrega y pedido no deben quedar desalineados.
      if (orderChanged.count !== 1) {
        throw new DeliveryInvalidTransitionError(order.status, move.orderTo);
      }
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, status: move.orderTo, createdAt: updatedAt },
      });
      // Entregado = estado final del pedido a domicilio: sello automático de lealtad
      // (solo en modo automático; con SAVEPOINT, nunca bloquea la entrega).
      if (move.orderTo === 'DELIVERED') {
        await autoStampOrderInTx(tx, {
          businessId: order.businessId,
          orderId: order.id,
          createdByUserId: null,
          now: updatedAt,
        });
      }
      return {
        orderId: order.id,
        businessId: order.businessId,
        orderNumber: order.orderNumber,
        status: move.orderTo,
        updatedAt,
        statusRevision: order._count.statusHistory + 1,
      };
    });
  }
}
