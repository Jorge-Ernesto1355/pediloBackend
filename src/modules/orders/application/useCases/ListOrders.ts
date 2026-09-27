import { OrderRepository } from '../ports/OrderRepository.js';
import { ListOrdersDTO } from '../dto/OrderDTO.js';

export class ListOrders {
  constructor(private readonly repository: OrderRepository) {}
  execute(ownerUserId: string, input: ListOrdersDTO) {
    return this.repository.list(ownerUserId, input);
  }
}
