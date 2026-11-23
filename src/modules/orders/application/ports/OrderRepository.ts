import { Order, OrderStatus } from '../../domain/entities/Order.js';
import { CreateOrderDTO, ListOrdersDTO, UpdateOrderDTO } from '../dto/OrderDTO.js';

export type OrderStatusUpdate = {
  id: string;
  businessId: string;
  orderNumber: number;
  status: OrderStatus;
  updatedAt: Date;
  statusRevision: number;
  /** Tarjeta de lealtad al finalizar: sello automático o si se puede dar a mano. */
  loyalty?: OrderStatusLoyalty | null;
};

export type OrderStatusLoyalty = {
  mode: 'MANUAL' | 'AUTO';
  /** Sello dado en esta misma transacción (modo automático). */
  stamped: {
    customerFirstName: string | null;
    stampsCount: number;
    stampsRequired: number;
    /** El sello completó la tarjeta y generó un premio. */
    completed: boolean;
    rewardLabel: string | null;
  } | null;
  /** Modo manual: el pedido cumple las reglas para "Dar sello". */
  eligible: boolean;
};

export type OrderStatusTimings = {
  authMs?: number;
  validationMs?: number;
  lookupMs?: number;
  updateMs?: number;
  historyMs?: number;
  transactionMs?: number;
  eventQueueMs?: number;
  totalMs?: number;
};

export interface OrderRepository {
  create(businessId: string, input: CreateOrderDTO): Promise<Order>;
  getEventsRestaurantId(ownerUserId: string): Promise<string | null>;
  createForRestaurant(
    ownerUserId: string,
    businessId: string,
    input: CreateOrderDTO,
    idempotencyKey?: string,
  ): Promise<Order>;
  getById(ownerUserId: string, orderId: string): Promise<Order | null>;
  list(ownerUserId: string, input: ListOrdersDTO): Promise<{ orders: Order[]; total: number }>;
  updateStatus(
    ownerUserId: string,
    orderId: string,
    status: OrderStatus,
    timings?: OrderStatusTimings,
  ): Promise<OrderStatusUpdate | null>;
  update(ownerUserId: string, orderId: string, input: UpdateOrderDTO): Promise<Order>;
}
