// Repositorio en memoria SOLO para pruebas de casos de uso. Reproduce las condiciones
// de las actualizaciones atómicas del repositorio Prisma (estado esperado, expiración).
import type {
  CourierLookup,
  DeliveryOrderStatus,
  DeliveryRecord,
  DeliveryRepository,
  DispatchOrder,
  NewOffer,
  OfferLookup,
  OrderStatusChange,
} from '../ports/DeliveryRepository.js';
import type { DeliveryFailureReason } from '../../domain/deliveryStateMachine.js';

type StoredDelivery = DeliveryRecord & {
  offerTokenHash: string;
  courierTokenHash: string | null;
};

export interface TestOrder {
  orderId: string;
  businessId: string;
  ownerUserId: string;
  orderNumber: number;
  status: DeliveryOrderStatus;
  isHomeDelivery: boolean;
  paymentMethod: 'CASH' | 'TRANSFER';
  foodTotal: number;
  deliveryFee: number;
  transferConfirmedAt: Date | null;
  customerName: string;
  customerPhone: string;
  address: string;
  neighborhood: string | null;
  reference: string | null;
  destination: { latitude: number; longitude: number };
  distanceKm: number;
  itemCount: number;
  statusRevision: number;
}

export class InMemoryDeliveryRepository implements DeliveryRepository {
  readonly orders = new Map<string, TestOrder>();
  readonly deliveries = new Map<string, StoredDelivery>();
  readonly couriers = new Map<string, string>();
  private sequence = 0;

  addOrder(order: Partial<TestOrder> = {}): TestOrder {
    const value: TestOrder = {
      orderId: `order-${++this.sequence}`,
      businessId: 'business-1',
      ownerUserId: 'owner-1',
      orderNumber: this.sequence,
      status: 'PREPARING',
      isHomeDelivery: true,
      paymentMethod: 'CASH',
      foodTotal: 180,
      deliveryFee: 45,
      transferConfirmedAt: null,
      customerName: 'Ana Cliente',
      customerPhone: '6691112233',
      address: 'Av. del Mar 100',
      neighborhood: 'Centro',
      reference: 'Portón azul',
      destination: { latitude: 23.27, longitude: -106.42 },
      distanceKm: 3.4,
      itemCount: 3,
      statusRevision: 2,
      ...order,
    };
    this.orders.set(value.orderId, value);
    return value;
  }

  deliveryOf(orderId: string): StoredDelivery | undefined {
    return [...this.deliveries.values()].find((delivery) => delivery.orderId === orderId);
  }

  async findOrderForOwner(ownerUserId: string, orderId: string): Promise<DispatchOrder | null> {
    const order = this.orders.get(orderId);
    if (!order || order.ownerUserId !== ownerUserId) return null;
    const delivery = this.deliveryOf(orderId);
    return {
      orderId: order.orderId,
      businessId: order.businessId,
      orderNumber: order.orderNumber,
      status: order.status,
      isHomeDelivery: order.isHomeDelivery,
      paymentMethod: order.paymentMethod,
      foodTotal: order.foodTotal,
      deliveryFee: order.deliveryFee,
      transferConfirmedAt: order.transferConfirmedAt,
      delivery: delivery ? this.record(delivery) : null,
    };
  }

  async createOffer(order: DispatchOrder, offer: NewOffer): Promise<DeliveryRecord | null> {
    if (this.deliveryOf(order.orderId)) return null;
    const delivery: StoredDelivery = {
      id: `delivery-${++this.sequence}`,
      businessId: order.businessId,
      orderId: order.orderId,
      status: 'PENDING',
      offerExpiresAt: offer.offerExpiresAt,
      offerTokenHash: offer.offerTokenHash,
      courierTokenHash: null,
      ...offer.money,
      failureReason: null,
      createdAt: new Date(),
      acceptedAt: null,
      handedOffAt: null,
      deliveredAt: null,
      failedAt: null,
      cancelledAt: null,
      courier: null,
    };
    this.deliveries.set(delivery.id, delivery);
    return this.record(delivery);
  }

  async renewOffer(deliveryId: string, offer: NewOffer): Promise<DeliveryRecord | null> {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery || delivery.status !== 'PENDING') return null;
    Object.assign(delivery, {
      offerTokenHash: offer.offerTokenHash,
      offerExpiresAt: offer.offerExpiresAt,
      ...offer.money,
    });
    return this.record(delivery);
  }

  async findByOfferTokenHash(hash: string): Promise<OfferLookup | null> {
    const delivery = [...this.deliveries.values()].find((item) => item.offerTokenHash === hash);
    if (!delivery) return null;
    const order = this.orders.get(delivery.orderId)!;
    return {
      delivery: this.record(delivery),
      restaurantName: 'Tacos El Faro',
      restaurantLocation: { latitude: 23.2494, longitude: -106.4111 },
      neighborhood: order.neighborhood,
      destination: order.destination,
      distanceKm: order.distanceKm,
      itemCount: order.itemCount,
    };
  }

  async claim(input: {
    offerTokenHash: string;
    courier: { name: string; phone: string };
    courierTokenHash: string;
    now: Date;
  }): Promise<DeliveryRecord | null> {
    this.couriers.set(input.courier.phone, input.courier.name);
    const delivery = [...this.deliveries.values()].find(
      (item) =>
        item.offerTokenHash === input.offerTokenHash &&
        item.status === 'PENDING' &&
        item.courier === null &&
        item.offerExpiresAt.getTime() > input.now.getTime(),
    );
    if (!delivery) return null;
    Object.assign(delivery, {
      status: 'ACCEPTED',
      acceptedAt: input.now,
      courierTokenHash: input.courierTokenHash,
      courier: { ...input.courier },
    });
    return this.record(delivery);
  }

  async findByCourierTokenHash(hash: string): Promise<CourierLookup | null> {
    const delivery = [...this.deliveries.values()].find((item) => item.courierTokenHash === hash);
    if (!delivery) return null;
    const order = this.orders.get(delivery.orderId)!;
    return {
      delivery: this.record(delivery),
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      restaurant: { name: 'Tacos El Faro', address: 'Centro', location: null },
      customer: { name: order.customerName, phone: order.customerPhone },
      address: order.address,
      neighborhood: order.neighborhood,
      reference: order.reference,
      destination: order.destination,
      distanceKm: order.distanceKm,
      notes: null,
      items: [{ quantity: 3, name: 'Taco', options: [] }],
    };
  }

  async release(deliveryId: string, offer: Omit<NewOffer, 'money'>) {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery || delivery.status !== 'ACCEPTED') return null;
    Object.assign(delivery, {
      status: 'PENDING',
      courier: null,
      courierTokenHash: null,
      acceptedAt: null,
      offerTokenHash: offer.offerTokenHash,
      offerExpiresAt: offer.offerExpiresAt,
    });
    return this.record(delivery);
  }

  async handOff(deliveryId: string, now: Date): Promise<OrderStatusChange | null> {
    return this.move(
      deliveryId,
      now,
      'ACCEPTED',
      'PICKED_UP',
      ['PREPARING', 'READY'],
      'OUT_FOR_DELIVERY',
      {
        handedOffAt: now,
      },
    );
  }

  async markDelivered(deliveryId: string, now: Date): Promise<OrderStatusChange | null> {
    return this.move(deliveryId, now, 'PICKED_UP', 'DELIVERED', ['OUT_FOR_DELIVERY'], 'DELIVERED', {
      deliveredAt: now,
    });
  }

  async markFailed(deliveryId: string, reason: DeliveryFailureReason, now: Date) {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery || delivery.status !== 'PICKED_UP') return false;
    Object.assign(delivery, { status: 'FAILED', failedAt: now, failureReason: reason });
    return true;
  }

  async confirmTransfer(ownerUserId: string, orderId: string, now: Date) {
    const order = this.orders.get(orderId);
    if (!order || order.ownerUserId !== ownerUserId || order.paymentMethod !== 'TRANSFER') {
      return null;
    }
    order.transferConfirmedAt ??= now;
    return order.transferConfirmedAt;
  }

  private move(
    deliveryId: string,
    now: Date,
    from: DeliveryRecord['status'],
    to: DeliveryRecord['status'],
    orderFrom: DeliveryOrderStatus[],
    orderTo: DeliveryOrderStatus,
    data: Partial<DeliveryRecord>,
  ): OrderStatusChange | null {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery || delivery.status !== from) return null;
    const order = this.orders.get(delivery.orderId)!;
    if (!orderFrom.includes(order.status)) return null;
    Object.assign(delivery, { status: to, ...data });
    order.status = orderTo;
    order.statusRevision += 1;
    return {
      orderId: order.orderId,
      businessId: order.businessId,
      orderNumber: order.orderNumber,
      status: orderTo,
      updatedAt: now,
      statusRevision: order.statusRevision,
    };
  }

  /** Copia sin los hashes de tokens, igual que el repositorio real. */
  private record(delivery: StoredDelivery): DeliveryRecord {
    const record: Record<string, unknown> = { ...delivery };
    delete record.offerTokenHash;
    delete record.courierTokenHash;
    return {
      ...(record as unknown as DeliveryRecord),
      courier: delivery.courier ? { ...delivery.courier } : null,
    };
  }
}
