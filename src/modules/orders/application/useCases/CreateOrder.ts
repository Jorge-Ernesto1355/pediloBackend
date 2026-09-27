import { Order } from '../../domain/entities/Order.js';
import { OrderRepository } from '../ports/OrderRepository.js';
import { CreateOrderDTO } from '../dto/OrderDTO.js';

export class CreateOrder {
  constructor(private readonly repository: OrderRepository) {}
  execute(businessId: string, input: CreateOrderDTO): Promise<Order> {
    return this.repository.create(businessId, input);
  }
}
