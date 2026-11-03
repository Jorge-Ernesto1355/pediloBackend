import { OrderStatus } from '../../domain/entities/Order.js';
import { OrderNotFoundError } from '../../domain/errors/OrderErrors.js';
import {
  OrderRepository,
  OrderStatusTimings,
  OrderStatusUpdate,
} from '../ports/OrderRepository.js';

export class UpdateOrderStatus {
  constructor(private readonly repository: OrderRepository) {}
  async execute(
    ownerUserId: string,
    orderId: string,
    status: OrderStatus,
    timings?: OrderStatusTimings,
  ): Promise<OrderStatusUpdate> {
    const order = await this.repository.updateStatus(ownerUserId, orderId, status, timings);
    if (!order) throw new OrderNotFoundError();
    return order;
  }
}
