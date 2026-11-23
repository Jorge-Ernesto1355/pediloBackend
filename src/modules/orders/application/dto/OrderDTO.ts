import {
  OrderFulfillmentType,
  OrderPaymentMethod,
  OrderStatus,
} from '../../domain/entities/Order.js';

export interface CreateOrderDTO {
  customer: { name: string | null; phone: string | null };
  items: {
    productId: string;
    quantity: number;
    optionIds?: string[];
    comboChoiceIds?: string[];
    expectedUnitPrice?: number;
    expected_unit_price?: number;
  }[];
  fulfillmentType?: OrderFulfillmentType;
  notes?: string | null;
  ignoreCustomerDiscount?: boolean;
  expectedSubtotal?: number;
  expected_total?: number;
  expectedTotal?: number;
  acceptPriceChange?: boolean;
  paymentMethod?: OrderPaymentMethod;
  /** Solo pedidos públicos a domicilio. */
  delivery?: {
    address: string;
    neighborhood: string;
    reference?: string | null;
    latitude: number;
    longitude: number;
  };
  /** Envío que vio el cliente; el servidor lo recalcula y debe coincidir. */
  expectedDeliveryFee?: number;
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

export interface UpdateOrderDTO {
  expectedVersion: number;
  customerId?: string | null;
  fulfillmentType?: OrderFulfillmentType;
  paymentMethod?: OrderPaymentMethod;
  items: {
    id?: string;
    productId: string;
    quantity: number;
    optionIds?: string[];
    comboChoiceIds?: string[];
  }[];
}
