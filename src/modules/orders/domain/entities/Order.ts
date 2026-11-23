export type OrderStatus =
  'PENDING' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
export type OrderSource = 'PUBLIC' | 'RESTAURANT';
export type OrderFulfillmentType = 'DINE_IN' | 'PICKUP' | 'DELIVERY';
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
  /** Comida con descuentos, SIN envío. */
  total: number;
  version: number;
  customerName: string | null;
  customerPhone: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItemProps[];
  statusHistory: { status: OrderStatus; createdAt: Date }[];
  /** Envío (100% del repartidor). 0 si no es a domicilio. */
  deliveryFee?: number;
  /** Snapshot de la entrega; solo en pedidos a domicilio. */
  delivery?: OrderDeliverySnapshot | null;
  transferConfirmedAt?: Date | null;
  /** Estado de la entrega con repartidor (null si todavía no se buscó repartidor). */
  dispatch?: OrderDispatch | null;
  /** Descuento del premio de lealtad canjeado (va aparte de discountAmount). */
  loyaltyDiscountAmount?: number;
  /** Premio de lealtad aplicado a este pedido (copia histórica, aunque se cancele). */
  loyaltyReward?: OrderLoyaltyReward | null;
  /** Sello vigente que dio este pedido (null si todavía no se sella). */
  loyaltyStamp?: OrderLoyaltyStamp | null;
  /**
   * Solo en la respuesta de creación de un pedido público que creó un cliente NUEVO:
   * la llave de su tarjeta para guardarla en el navegador. Nunca para clientes existentes.
   */
  loyaltyCardToken?: string;
}

export interface OrderLoyaltyReward {
  id: string;
  type: 'PERCENT' | 'FIXED' | 'FREE_PRODUCT';
  label: string;
  /** true si el premio sigue canjeado en este pedido (false si se devolvió al cancelar). */
  active: boolean;
}

export interface OrderLoyaltyStamp {
  id: string;
  position: number;
  source: 'ORDER_MANUAL' | 'ORDER_AUTO' | 'WALK_IN';
  createdAt: Date;
}

export interface OrderDispatch {
  status: 'PENDING' | 'ACCEPTED' | 'PICKED_UP' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
  /** Cuándo se publicó la oferta vigente (para el aviso de "sin tomar" en la comanda). */
  offerCreatedAt: Date;
  offerExpiresAt: Date;
  acceptedAt: Date | null;
  handedOffAt: Date | null;
  deliveredAt: Date | null;
  failedAt: Date | null;
  cancelledAt: Date | null;
  failureReason: string | null;
  foodTotal: number;
  deliveryFee: number;
  paymentMethod: 'CASH' | 'TRANSFER';
  amountCourierAdvances: number;
  amountCourierCollects: number;
  courier: { name: string; phone: string } | null;
}

export interface OrderDeliverySnapshot {
  address: string;
  /** Null solo en pedidos creados antes de existir el campo. */
  neighborhood: string | null;
  reference: string | null;
  latitude: number;
  longitude: number;
  distanceKm: number;
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
