import { describe, expect, it } from 'vitest';
import {
  calculateRewardDiscount,
  customerFirstName,
  effectiveRewardStatus,
  isOrderFinished,
  orderStampBlocker,
  planStamp,
  planStampVoid,
  rewardExpiresAt,
  round2,
  stampsRemaining,
  startOfBusinessDay,
  startOfBusinessWeek,
  type StampableOrder,
} from './loyaltyRules.js';

const finishedPickup: StampableOrder = {
  status: 'READY',
  fulfillmentType: 'PICKUP',
  customerId: 'customer-1',
  total: 150,
};

describe('reglas de sellado de pedidos', () => {
  it('un pedido en local o para llevar se sella al estar listo', () => {
    expect(isOrderFinished(finishedPickup)).toBe(true);
    expect(orderStampBlocker(finishedPickup, { minOrderAmount: 0 })).toBeNull();
  });

  it('un pedido a domicilio se sella al entregarse, no al estar listo', () => {
    const delivery = { ...finishedPickup, fulfillmentType: 'DELIVERY' as const };
    expect(orderStampBlocker(delivery, { minOrderAmount: 0 })).toBe('ORDER_NOT_FINISHED');
    expect(
      orderStampBlocker({ ...delivery, status: 'DELIVERED' }, { minOrderAmount: 0 }),
    ).toBeNull();
  });

  it('un pedido cancelado no se sella', () => {
    expect(
      orderStampBlocker({ ...finishedPickup, status: 'CANCELLED' }, { minOrderAmount: 0 }),
    ).toBe('ORDER_CANCELLED');
  });

  it('un pedido en preparación todavía no se sella', () => {
    expect(
      orderStampBlocker({ ...finishedPickup, status: 'PREPARING' }, { minOrderAmount: 0 }),
    ).toBe('ORDER_NOT_FINISHED');
  });

  it('un pedido sin cliente identificado no se sella', () => {
    expect(orderStampBlocker({ ...finishedPickup, customerId: null }, { minOrderAmount: 0 })).toBe(
      'ORDER_WITHOUT_CUSTOMER',
    );
  });

  it('un pedido bajo el monto mínimo no se sella y uno igual al mínimo sí', () => {
    expect(orderStampBlocker({ ...finishedPickup, total: 99.99 }, { minOrderAmount: 100 })).toBe(
      'ORDER_BELOW_MINIMUM',
    );
    expect(
      orderStampBlocker({ ...finishedPickup, total: 100 }, { minOrderAmount: 100 }),
    ).toBeNull();
  });
});

describe('agregar sellos', () => {
  it('suma un sello al ciclo actual', () => {
    expect(planStamp({ stampsCount: 4, cyclesCompleted: 0 }, 8)).toEqual({
      cycle: 0,
      position: 5,
      completes: false,
      next: { stampsCount: 5, cyclesCompleted: 0 },
    });
  });

  it('el sello que llega al total completa la tarjeta y reinicia el conteo', () => {
    expect(planStamp({ stampsCount: 7, cyclesCompleted: 2 }, 8)).toEqual({
      cycle: 2,
      position: 8,
      completes: true,
      next: { stampsCount: 0, cyclesCompleted: 3 },
    });
  });

  it('si el dueño bajó los sellos requeridos, el siguiente sello completa la tarjeta', () => {
    const plan = planStamp({ stampsCount: 7, cyclesCompleted: 0 }, 5);
    expect(plan.completes).toBe(true);
    expect(plan.next).toEqual({ stampsCount: 0, cyclesCompleted: 1 });
  });
});

describe('anular sellos', () => {
  it('un sello del ciclo en curso se anula y baja el conteo', () => {
    expect(
      planStampVoid({
        stampCycle: 1,
        card: { stampsCount: 3, cyclesCompleted: 1 },
        stampsRequired: 8,
        cycleRewardStatus: null,
        remainingInStampCycle: 2,
      }),
    ).toEqual({ kind: 'CURRENT_CYCLE', next: { stampsCount: 2, cyclesCompleted: 1 } });
  });

  it('el sello que completó la tarjeta con premio disponible anula el premio y deja stampsRequired - 1', () => {
    expect(
      planStampVoid({
        stampCycle: 0,
        card: { stampsCount: 0, cyclesCompleted: 1 },
        stampsRequired: 8,
        cycleRewardStatus: 'AVAILABLE',
        remainingInStampCycle: 7,
      }),
    ).toEqual({
      kind: 'COMPLETED_CYCLE',
      voidReward: true,
      next: { stampsCount: 7, cyclesCompleted: 0 },
    });
  });

  it('un premio vencido no impide anular el sello que lo generó', () => {
    const plan = planStampVoid({
      stampCycle: 0,
      card: { stampsCount: 0, cyclesCompleted: 1 },
      stampsRequired: 8,
      cycleRewardStatus: 'EXPIRED',
      remainingInStampCycle: 7,
    });
    expect(plan.kind).toBe('COMPLETED_CYCLE');
  });

  it('no se puede anular si el premio ya se canjeó', () => {
    expect(
      planStampVoid({
        stampCycle: 0,
        card: { stampsCount: 0, cyclesCompleted: 1 },
        stampsRequired: 8,
        cycleRewardStatus: 'REDEEMED',
        remainingInStampCycle: 7,
      }),
    ).toEqual({ kind: 'BLOCKED', reason: 'REWARD_REDEEMED' });
  });

  it('no se puede anular un sello de una tarjeta completada si ya hay sellos nuevos', () => {
    expect(
      planStampVoid({
        stampCycle: 0,
        card: { stampsCount: 2, cyclesCompleted: 1 },
        stampsRequired: 8,
        cycleRewardStatus: 'AVAILABLE',
        remainingInStampCycle: 7,
      }),
    ).toEqual({ kind: 'BLOCKED', reason: 'NEWER_STAMPS' });
  });

  it('no se puede anular un sello de ciclos más viejos', () => {
    expect(
      planStampVoid({
        stampCycle: 0,
        card: { stampsCount: 0, cyclesCompleted: 2 },
        stampsRequired: 8,
        cycleRewardStatus: 'AVAILABLE',
        remainingInStampCycle: 7,
      }),
    ).toEqual({ kind: 'BLOCKED', reason: 'STAMP_TOO_OLD' });
  });
});

describe('premios', () => {
  it('percent descuenta ese porcentaje del subtotal con descuentos, redondeado a centavos', () => {
    expect(calculateRewardDiscount({ type: 'PERCENT', value: 20 }, { base: 255.55 })).toBe(51.11);
  });

  it('fixed descuenta el monto sin pasar del subtotal', () => {
    expect(calculateRewardDiscount({ type: 'FIXED', value: 50 }, { base: 120 })).toBe(50);
    expect(calculateRewardDiscount({ type: 'FIXED', value: 50 }, { base: 30 })).toBe(30);
  });

  it('free_product descuenta el precio del producto regalado', () => {
    expect(
      calculateRewardDiscount(
        { type: 'FREE_PRODUCT', value: 0 },
        { base: 245, freeProductPrice: 45 },
      ),
    ).toBe(45);
  });

  it('sin subtotal no hay descuento', () => {
    expect(calculateRewardDiscount({ type: 'PERCENT', value: 20 }, { base: 0 })).toBe(0);
  });

  it('un premio disponible con fecha vencida se lee como vencido', () => {
    const now = new Date('2026-11-22T12:00:00Z');
    expect(
      effectiveRewardStatus(
        { status: 'AVAILABLE', expiresAt: new Date('2026-11-22T11:59:59Z') },
        now,
      ),
    ).toBe('EXPIRED');
    expect(
      effectiveRewardStatus(
        { status: 'AVAILABLE', expiresAt: new Date('2026-11-23T00:00:00Z') },
        now,
      ),
    ).toBe('AVAILABLE');
    expect(effectiveRewardStatus({ status: 'REDEEMED', expiresAt: null }, now)).toBe('REDEEMED');
  });

  it('sin caducidad el premio no vence', () => {
    expect(rewardExpiresAt(new Date('2026-11-22T00:00:00Z'), null)).toBeNull();
    expect(rewardExpiresAt(new Date('2026-11-22T00:00:00Z'), 30)?.toISOString()).toBe(
      '2026-12-22T00:00:00.000Z',
    );
  });
});

describe('utilidades', () => {
  it('muestra solo el primer nombre del cliente', () => {
    expect(customerFirstName('  Ana   López Pérez ')).toBe('Ana');
    expect(customerFirstName(null)).toBeNull();
  });

  it('cuenta los sellos que faltan sin mostrar más del total', () => {
    expect(stampsRemaining(5, 8)).toBe(3);
    expect(stampsRemaining(9, 8)).toBe(0);
  });

  it('redondea a centavos', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it('el día y la semana del negocio usan su zona horaria (lunes)', () => {
    // Domingo 22 nov 2026 23:30 en Mazatlán (UTC-7) = lunes 23 nov 06:30 UTC.
    const now = new Date('2026-11-23T06:30:00Z');
    expect(startOfBusinessDay(now, 'America/Mazatlan').toISOString()).toBe(
      '2026-11-22T07:00:00.000Z',
    );
    expect(startOfBusinessWeek(now, 'America/Mazatlan').toISOString()).toBe(
      '2026-11-16T07:00:00.000Z',
    );
  });
});
