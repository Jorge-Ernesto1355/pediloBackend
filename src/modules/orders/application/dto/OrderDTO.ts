import { OrderFulfillmentType, OrderStatus } from '../../domain/entities/Order.js';

export interface CreateOrderDTO {
  customer: { name: string | null; phone: string | null };
  items: { productId: string; quantity: number; optionIds?: string[]; comboChoiceIds?: string[] }[];
  fulfillmentType?: OrderFulfillmentType;
  notes?: string | null;
  ignoreCustomerDiscount?: boolean;
  expectedSubtotal?: number;
  acceptPriceChange?: boolean;
}
export interface ListOrdersDTO {
  businessId: string;
  status?: OrderStatus;
  search?: string;
  period?: 'today' | '7d' | '30d' | 'lastMonth';
  page: number;
  limit: number;
}
