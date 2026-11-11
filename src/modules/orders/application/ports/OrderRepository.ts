import { Order, OrderStatus } from '../../domain/entities/Order.js';
import { CreateOrderDTO, ListOrdersDTO, UpdateOrderDTO } from '../dto/OrderDTO.js';

export type OrderStatusUpdate = {
  id: string;
  businessId: string;
  orderNumber: number;
  status: OrderStatus;
  updatedAt: Date;
  statusRevision: number;
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
