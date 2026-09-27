import { OrderStatus } from '../../domain/entities/Order.js';

export interface CreateOrderDTO {
  customer: { name: string; phone: string };
  items: { productId: string; quantity: number; optionIds?: string[] }[];
  notes?: string | null;
}
export interface ListOrdersDTO {
  businessId: string;
  status?: OrderStatus;
  page: number;
  limit: number;
}
