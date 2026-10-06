import { Order, OrderStatus } from '../../domain/entities/Order.js';
import { CreateOrderDTO, ListOrdersDTO } from '../dto/OrderDTO.js';

export interface OrderRepository {
  create(businessId: string, input: CreateOrderDTO): Promise<Order>;
  createForRestaurant(
    ownerUserId: string,
    businessId: string,
    input: CreateOrderDTO,
  ): Promise<Order>;
  getById(ownerUserId: string, orderId: string): Promise<Order | null>;
  list(ownerUserId: string, input: ListOrdersDTO): Promise<{ orders: Order[]; total: number }>;
  updateStatus(ownerUserId: string, orderId: string, status: OrderStatus): Promise<Order | null>;
}
