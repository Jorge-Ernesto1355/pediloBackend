import { CustomerNotFoundError } from '../../domain/errors/CustomerErrors.js';
import { CustomerRepository } from '../ports/CustomerRepository.js';
export class DeleteCustomer {
  constructor(private readonly repository: CustomerRepository) {}
  async execute(userId: string, id: string): Promise<void> {
    if (!(await this.repository.delete(userId, id))) throw new CustomerNotFoundError();
  }
}
