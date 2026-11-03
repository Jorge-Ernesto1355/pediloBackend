import { OrderRepository } from '../ports/OrderRepository.js';

export class ResolveOrderEventsRestaurant {
  constructor(private readonly repository: OrderRepository) {}

  execute(ownerUserId: string) {
    return this.repository.getEventsRestaurantId(ownerUserId);
  }
}
