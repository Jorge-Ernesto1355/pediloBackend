import { Customer } from '../../domain/entities/Customer.js';
import { CreateCustomerDTO } from '../dto/CustomerDTO.js';
import { CustomerRepository } from '../ports/CustomerRepository.js';
export class CreateCustomer {
  constructor(private readonly repository: CustomerRepository) {}
  execute(userId: string, businessId: string, input: CreateCustomerDTO): Promise<Customer> {
    return this.repository.create(userId, businessId, input);
  }
}
