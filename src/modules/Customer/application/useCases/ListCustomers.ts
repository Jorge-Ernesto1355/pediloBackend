import { CustomerRepository } from '../ports/CustomerRepository.js';
import { ListCustomersDTO } from '../dto/CustomerDTO.js';
export class ListCustomers {
  constructor(private readonly repository: CustomerRepository) {}
  execute(userId: string, input: ListCustomersDTO) {
    return this.repository.list(userId, input);
  }
}
