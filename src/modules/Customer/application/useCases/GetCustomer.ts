import { Customer } from '../../domain/entities/Customer.js';
import { CustomerNotFoundError } from '../../domain/errors/CustomerErrors.js';
import { CustomerRepository } from '../ports/CustomerRepository.js';
export class GetCustomer {
  constructor(private readonly repository: CustomerRepository) {}
  async execute(userId: string, id: string): Promise<Customer> {
    const customer = await this.repository.getById(userId, id);
    if (!customer) throw new CustomerNotFoundError();
    return customer;
  }
}
