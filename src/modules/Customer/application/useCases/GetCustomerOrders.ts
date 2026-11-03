import { CustomerNotFoundError } from '../../domain/errors/CustomerErrors.js';
import { CustomerRepository } from '../ports/CustomerRepository.js';

export class GetCustomerOrders {
  constructor(private readonly repository: CustomerRepository) {}
  async execute(userId: string, customerId: string, page: number, limit: number) {
    const result = await this.repository.listOrders(userId, customerId, page, limit);
    if (!result) throw new CustomerNotFoundError();
    return result;
  }
}
