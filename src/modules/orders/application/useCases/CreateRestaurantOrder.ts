import { CreateOrderDTO } from '../dto/OrderDTO.js';
import { OrderRepository } from '../ports/OrderRepository.js';

export class CreateRestaurantOrder {
  constructor(private readonly repository: OrderRepository) {}

  execute(ownerUserId: string, businessId: string, input: CreateOrderDTO) {
    return this.repository.createForRestaurant(ownerUserId, businessId, input);
  }
}
