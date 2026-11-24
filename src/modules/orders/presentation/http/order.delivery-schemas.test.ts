import { describe, expect, it } from 'vitest';
import { createOrderSchema, createRestaurantOrderSchema } from './order.schemas.js';

const base = {
  customer: { name: 'Ana', phone: '6691234567' },
  items: [{ productId: 'product-1', quantity: 1 }],
};
const delivery = {
  address: 'Av. del Mar 100',
  neighborhood: 'Centro',
  reference: 'Portón azul',
  latitude: 23.25,
  longitude: -106.41,
};

describe('createOrderSchema · domicilio', () => {
  it('acepta un pedido a domicilio con dirección, pin y envío mostrado', () => {
    const parsed = createOrderSchema.safeParse({
      ...base,
      fulfillmentType: 'DELIVERY',
      delivery,
      expectedDeliveryFee: 45,
    });
    expect(parsed.success).toBe(true);
  });

  it('sin pin no se puede crear', () => {
    const withoutPin = { address: delivery.address, reference: delivery.reference };
    const parsed = createOrderSchema.safeParse({
      ...base,
      fulfillmentType: 'DELIVERY',
      delivery: withoutPin,
      expectedDeliveryFee: 45,
    });
    expect(parsed.success).toBe(false);
  });

  it('exige dirección y el envío que vio el cliente', () => {
    expect(
      createOrderSchema.safeParse({ ...base, fulfillmentType: 'DELIVERY', expectedDeliveryFee: 45 })
        .success,
    ).toBe(false);
    expect(
      createOrderSchema.safeParse({ ...base, fulfillmentType: 'DELIVERY', delivery }).success,
    ).toBe(false);
  });

  it('rechaza direcciones demasiado cortas o largas', () => {
    for (const address of ['Ca 1', 'x'.repeat(201)]) {
      expect(
        createOrderSchema.safeParse({
          ...base,
          fulfillmentType: 'DELIVERY',
          delivery: { ...delivery, address },
          expectedDeliveryFee: 45,
        }).success,
      ).toBe(false);
    }
  });

  it('no acepta distancia ni envío calculados por el cliente', () => {
    const parsed = createOrderSchema.safeParse({
      ...base,
      fulfillmentType: 'DELIVERY',
      delivery: { ...delivery, distanceKm: 0.1 },
      expectedDeliveryFee: 45,
    });
    expect(parsed.success).toBe(false);
  });

  it('no permite datos de entrega en pedidos que no son a domicilio', () => {
    expect(
      createOrderSchema.safeParse({ ...base, fulfillmentType: 'PICKUP', delivery }).success,
    ).toBe(false);
    expect(createOrderSchema.safeParse({ ...base, expectedDeliveryFee: 30 }).success).toBe(false);
  });

  it('exige la colonia (mínimo 2 y máximo 100 caracteres)', () => {
    const { address, reference, latitude, longitude } = delivery;
    const withoutNeighborhood = { address, reference, latitude, longitude };
    for (const value of [
      withoutNeighborhood,
      { ...delivery, neighborhood: ' C ' },
      { ...delivery, neighborhood: 'x'.repeat(101) },
    ]) {
      expect(
        createOrderSchema.safeParse({
          ...base,
          fulfillmentType: 'DELIVERY',
          delivery: value,
          expectedDeliveryFee: 45,
        }).success,
      ).toBe(false);
    }
  });

  it('recorta espacios de la colonia', () => {
    const parsed = createOrderSchema.parse({
      ...base,
      fulfillmentType: 'DELIVERY',
      delivery: { ...delivery, neighborhood: '  Centro  ' },
      expectedDeliveryFee: 45,
    });
    expect(parsed.delivery?.neighborhood).toBe('Centro');
  });

  it('la referencia vacía se guarda como null', () => {
    const parsed = createOrderSchema.parse({
      ...base,
      fulfillmentType: 'DELIVERY',
      delivery: { ...delivery, reference: '   ' },
      expectedDeliveryFee: 45,
    });
    expect(parsed.delivery?.reference).toBeNull();
  });

  it('los pedidos sin domicilio siguen funcionando igual', () => {
    expect(createOrderSchema.safeParse(base).success).toBe(true);
    expect(createOrderSchema.safeParse({ ...base, fulfillmentType: 'DINE_IN' }).success).toBe(true);
  });
});

describe('createRestaurantOrderSchema', () => {
  it('el pedido manual no admite domicilio', () => {
    expect(
      createRestaurantOrderSchema.safeParse({
        items: base.items,
        fulfillmentType: 'DELIVERY',
      }).success,
    ).toBe(false);
  });
});
