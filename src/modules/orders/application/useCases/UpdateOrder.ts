import { Order } from '../../domain/entities/Order.js';
import { UpdateOrderDTO } from '../dto/OrderDTO.js';
import { OrderRepository } from '../ports/OrderRepository.js';

export class UpdateOrder {
  constructor(private readonly repository: OrderRepository) {}

  async execute(ownerUserId: string, orderId: string, input: UpdateOrderDTO): Promise<Order> {
    return this.repository.update(ownerUserId, orderId, input);
  }
}
