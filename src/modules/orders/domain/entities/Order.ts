export type OrderStatus =
  'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

export interface OrderItemOptionProps {
  id: string;
  name: string;
  price: number;
}
export interface OrderItemProps {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
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
  subtotal: number;
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
      items: this.props.items.map((item) => ({
        ...item,
        options: item.options.map((option) => ({ ...option })),
      })),
      statusHistory: this.props.statusHistory.map((entry) => ({ ...entry })),
    };
  }
}
