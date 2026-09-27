import { OrderStatus } from '../../domain/entities/Order.js';
import { Order } from '../../domain/entities/Order.js';
import { OrderNotFoundError } from '../../domain/errors/OrderErrors.js';
import { OrderRepository } from '../ports/OrderRepository.js';

export class UpdateOrderStatus {
  constructor(private readonly repository: OrderRepository) {}
  async execute(ownerUserId: string, orderId: string, status: OrderStatus): Promise<Order> {
    const order = await this.repository.updateStatus(ownerUserId, orderId, status);
    if (!order) throw new OrderNotFoundError();
    return order;
  }
}
