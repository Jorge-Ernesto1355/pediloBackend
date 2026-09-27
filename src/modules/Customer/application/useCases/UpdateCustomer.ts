import { Customer } from '../../domain/entities/Customer.js';
import { CustomerNotFoundError } from '../../domain/errors/CustomerErrors.js';
import { UpdateCustomerDTO } from '../dto/CustomerDTO.js';
import { CustomerRepository } from '../ports/CustomerRepository.js';
export class UpdateCustomer {
  constructor(private readonly repository: CustomerRepository) {}
  async execute(userId: string, id: string, input: UpdateCustomerDTO): Promise<Customer> {
    const customer = await this.repository.update(userId, id, input);
    if (!customer) throw new CustomerNotFoundError();
    return customer;
  }
}
