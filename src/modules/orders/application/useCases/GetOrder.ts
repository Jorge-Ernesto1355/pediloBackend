import { Order } from '../../domain/entities/Order.js';
import { OrderNotFoundError } from '../../domain/errors/OrderErrors.js';
import { OrderRepository } from '../ports/OrderRepository.js';

export class GetOrder {
  constructor(private readonly repository: OrderRepository) {}
  async execute(ownerUserId: string, orderId: string): Promise<Order> {
    const order = await this.repository.getById(ownerUserId, orderId);
    if (!order) throw new OrderNotFoundError();
    return order;
  }
}
