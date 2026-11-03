import { Customer } from '../../domain/entities/Customer.js';
import { CreateCustomerDTO, ListCustomersDTO, UpdateCustomerDTO } from '../dto/CustomerDTO.js';

export type CustomerOrderHistory = {
  id: string;
  orderNumber: number;
  status: string;
  total: number;
  subtotal: number;
  discountAmount: number;
  notes: string | null;
  fulfillmentType: string;
  createdAt: Date;
  items: Array<{ id: string; productName: string; quantity: number; unitPrice: number; subtotal: number; options: Array<{ name: string; groupName: string | null; price: number }> }>;
};

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
  setDisabled(ownerUserId: string, customerId: string, disabled: boolean): Promise<Customer | null>;
  listOrders(ownerUserId: string, customerId: string, page: number, limit: number): Promise<{ orders: CustomerOrderHistory[]; total: number } | null>;
}
