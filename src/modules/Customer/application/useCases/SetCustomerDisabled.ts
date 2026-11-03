import { Customer } from '../../domain/entities/Customer.js';
import { CustomerNotFoundError } from '../../domain/errors/CustomerErrors.js';
import { CustomerRepository } from '../ports/CustomerRepository.js';

export class SetCustomerDisabled {
  constructor(private readonly repository: CustomerRepository) {}

  async execute(userId: string, customerId: string, disabled: boolean): Promise<Customer> {
    const customer = await this.repository.setDisabled(userId, customerId, disabled);
    if (!customer) throw new CustomerNotFoundError();
    return customer;
  }
}
