export type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'CANCELLED';
export type OrderSource = 'PUBLIC' | 'RESTAURANT';
export type OrderFulfillmentType = 'DINE_IN' | 'PICKUP';
export type OrderPaymentMethod = 'CASH' | 'TRANSFER';
export interface TransferCardSnapshot {
  clabe: string;
  beneficiaryName: string;
  bankCode: string;
  bankName: string;
  restaurantName: string;
}

export interface OrderItemOptionProps {
  id: string;
  name: string;
  groupName?: string | null;
  price: number;
}
export interface OrderItemProps {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  unitPriceOriginal?: number;
  unitPriceFinal?: number;
  discountAmount?: number;
  discountId?: string | null;
  discountLabel?: string | null;
  quantity: number;
  subtotal: number;
  options: OrderItemOptionProps[];
}
export interface OrderProps {
  id: string;
  businessId: string;
  customerId: string | null;
  orderNumber: number;
  status: OrderStatus;
  source: OrderSource;
  fulfillmentType: OrderFulfillmentType;
  paymentMethod: OrderPaymentMethod;
  payment_method?: 'cash' | 'transfer';
  transferCard?: TransferCardSnapshot;
  subtotal: number;
  discountAmount: number;
  total: number;
  customerName: string | null;
  customerPhone: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItemProps[];
  statusHistory: { status: OrderStatus; createdAt: Date }[];
}

export class Order {
  private constructor(private readonly props: OrderProps) {}
  static create(props: OrderProps): Order {
    return new Order(props);
  }
  toJSON(): OrderProps {
    return {
      ...this.props,
      payment_method: this.props.paymentMethod.toLowerCase() as 'cash' | 'transfer',
      items: this.props.items.map((item) => ({
        ...item,
        options: item.options.map((option) => ({ ...option })),
      })),
      statusHistory: this.props.statusHistory.map((entry) => ({ ...entry })),
    };
  }
}
