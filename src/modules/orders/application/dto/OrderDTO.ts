import { OrderFulfillmentType, OrderPaymentMethod, OrderStatus } from '../../domain/entities/Order.js';

export interface CreateOrderDTO {
  customer: { name: string | null; phone: string | null };
  items: { productId: string; quantity: number; optionIds?: string[]; comboChoiceIds?: string[]; expectedUnitPrice?: number; expected_unit_price?: number }[];
  fulfillmentType?: OrderFulfillmentType;
  notes?: string | null;
  ignoreCustomerDiscount?: boolean;
  expectedSubtotal?: number;
  expected_total?: number;
  expectedTotal?: number;
  acceptPriceChange?: boolean;
  paymentMethod?: OrderPaymentMethod;
}
export interface ListOrdersDTO {
  businessId: string;
  status?: OrderStatus;
  search?: string;
  period?: 'today' | '7d' | '30d' | 'lastMonth';
  page: number;
  limit: number;
  summary?: boolean;
}
