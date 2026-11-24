export type DeliveryPaymentMethod = 'CASH' | 'TRANSFER';

export interface DeliveryMoney {
  /** Comida con descuentos, SIN envío. */
  foodTotal: number;
  /** Envío: 100% para el repartidor. Pedilo no cobra comisión. */
  deliveryFee: number;
  paymentMethod: DeliveryPaymentMethod;
  /** Lo que el repartidor paga de su bolsillo al restaurante al recoger. */
  amountCourierAdvances: number;
  /** Lo que el repartidor cobra al cliente al entregar. */
  amountCourierCollects: number;
}

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (cents: number) => cents / 100;

/**
 * - Efectivo: adelanta la comida y cobra comida + envío.
 * - Transferencia: el cliente ya pagó la comida al restaurante; adelanta 0 y cobra solo el envío.
 */
export function splitDeliveryMoney(input: {
  foodTotal: number;
  deliveryFee: number;
  paymentMethod: DeliveryPaymentMethod;
}): DeliveryMoney {
  const food = toCents(input.foodTotal);
  const fee = toCents(input.deliveryFee);
  const cash = input.paymentMethod === 'CASH';
  return {
    foodTotal: fromCents(food),
    deliveryFee: fromCents(fee),
    paymentMethod: input.paymentMethod,
    amountCourierAdvances: cash ? fromCents(food) : 0,
    amountCourierCollects: cash ? fromCents(food + fee) : fromCents(fee),
  };
}
