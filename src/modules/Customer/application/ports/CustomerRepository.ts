import { Customer } from '../../domain/entities/Customer.js';
import { CreateCustomerDTO, ListCustomersDTO, UpdateCustomerDTO } from '../dto/CustomerDTO.js';

export interface CustomerRepository {
  create(ownerUserId: string, businessId: string, input: CreateCustomerDTO): Promise<Customer>;
  getById(ownerUserId: string, customerId: string): Promise<Customer | null>;
  list(
    ownerUserId: string,
    input: ListCustomersDTO,
  ): Promise<{ customers: Customer[]; total: number }>;
  update(
    ownerUserId: string,
    customerId: string,
    input: UpdateCustomerDTO,
  ): Promise<Customer | null>;
  delete(ownerUserId: string, customerId: string): Promise<boolean>;
}
