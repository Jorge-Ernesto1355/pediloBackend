import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeliveryEventPublisher, OrderStatusNotifier } from '../ports/DeliveryEvents.js';
import { ClaimDelivery } from './ClaimDelivery.js';
import { ConfirmOrderTransfer } from './ConfirmOrderTransfer.js';
import { CompleteDelivery, FailDelivery } from './CourierDeliveryActions.js';
import { CreateDeliveryOffer } from './CreateDeliveryOffer.js';
import { GetCourierDelivery } from './GetCourierDelivery.js';
import { GetDeliveryOffer } from './GetDeliveryOffer.js';
import { HandOffDelivery } from './HandOffDelivery.js';
import { InMemoryDeliveryRepository } from './inMemoryDeliveryRepository.js';
import { ReleaseDelivery } from './ReleaseDelivery.js';

const courierAna = { name: 'Ana Repartidora', phone: '6699990001' };
const courierLuis = { name: 'Luis Repartidor', phone: '6699990002' };

function setup() {
  let now = new Date('2026-11-22T20:00:00.000Z');
  const clock = () => now;
  const advance = (ms: number) => {
    now = new Date(now.getTime() + ms);
  };
  const repository = new InMemoryDeliveryRepository();
  const events: DeliveryEventPublisher = {
    deliveryChanged: vi.fn(),
    orderStatusChanged: vi.fn(),
  };
  const notifier: OrderStatusNotifier = { orderOutForDelivery: vi.fn(async () => undefined) };
  return {
    repository,
    events,
    notifier,
    advance,
    createOffer: new CreateDeliveryOffer(repository, events, clock),
    release: new ReleaseDelivery(repository, events, clock),
    handOff: new HandOffDelivery(repository, events, notifier, clock),
    confirmTransfer: new ConfirmOrderTransfer(repository, clock),
    getOffer: new GetDeliveryOffer(repository, clock),
    claim: new ClaimDelivery(repository, events, clock),
    getCourier: new GetCourierDelivery(repository, clock),
    complete: new CompleteDelivery(repository, events, clock),
    fail: new FailDelivery(repository, events, clock),
  };
}

type Setup = ReturnType<typeof setup>;
let t: Setup;

beforeEach(() => {
  t = setup();
});

async function offered(overrides = {}) {
  const order = t.repository.addOrder(overrides);
  const { offerToken } = await t.createOffer.execute('owner-1', order.orderId);
  return { order, offerToken };
}

async function accepted(overrides = {}) {
  const { order, offerToken } = await offered(overrides);
  const { courierToken } = await t.claim.execute(offerToken, courierAna);
  return { order, offerToken, courierToken };
}

async function pickedUp(overrides = {}) {
  const result = await accepted(overrides);
  await t.handOff.execute('owner-1', result.order.orderId);
  return result;
}

describe('crear oferta ("Buscar repartidor")', () => {
  it('crea la entrega PENDING con el snapshot de dinero en efectivo', async () => {
    const { order, offerToken } = await offered();
    expect(offerToken).toHaveLength(43);
    expect(t.repository.deliveryOf(order.orderId)).toMatchObject({
      status: 'PENDING',
      foodTotal: 180,
      deliveryFee: 45,
      paymentMethod: 'CASH',
      amountCourierAdvances: 180,
      amountCourierCollects: 225,
    });
    expect(t.events.deliveryChanged).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: order.orderId, status: 'PENDING' }),
    );
  });

  it('guarda solo el hash del token, nunca el token', async () => {
    const { order, offerToken } = await offered();
    const stored = JSON.stringify(t.repository.deliveryOf(order.orderId));
    expect(stored).not.toContain(offerToken);
  });

  it('solo para pedidos a domicilio', async () => {
    const order = t.repository.addOrder({ isHomeDelivery: false });
    await expect(t.createOffer.execute('owner-1', order.orderId)).rejects.toMatchObject({
      code: 'ORDER_NOT_HOME_DELIVERY',
    });
  });

  it('solo para pedidos aceptados (en preparación o listos)', async () => {
    for (const status of ['PENDING', 'CANCELLED', 'DELIVERED'] as const) {
      const order = t.repository.addOrder({ status });
      await expect(t.createOffer.execute('owner-1', order.orderId)).rejects.toMatchObject({
        code: 'DELIVERY_ORDER_NOT_READY',
      });
    }
    const ready = t.repository.addOrder({ status: 'READY' });
    await expect(t.createOffer.execute('owner-1', ready.orderId)).resolves.toBeDefined();
  });

  it('por transferencia exige la transferencia marcada como recibida', async () => {
    const order = t.repository.addOrder({ paymentMethod: 'TRANSFER' });
    await expect(t.createOffer.execute('owner-1', order.orderId)).rejects.toMatchObject({
      code: 'DELIVERY_TRANSFER_NOT_CONFIRMED',
    });
    await t.confirmTransfer.execute('owner-1', order.orderId);
    await t.createOffer.execute('owner-1', order.orderId);
    expect(t.repository.deliveryOf(order.orderId)).toMatchObject({
      paymentMethod: 'TRANSFER',
      amountCourierAdvances: 0,
      amountCourierCollects: 45,
    });
  });

  it('otro dueño no puede buscar repartidor para el pedido', async () => {
    const order = t.repository.addOrder();
    await expect(t.createOffer.execute('owner-2', order.orderId)).rejects.toMatchObject({
      code: 'ORDER_NOT_FOUND',
    });
  });

  it('"compartir de nuevo" genera un link nuevo y el anterior deja de funcionar', async () => {
    const { order, offerToken } = await offered();
    const again = await t.createOffer.execute('owner-1', order.orderId);
    expect(again.offerToken).not.toBe(offerToken);
    await expect(t.getOffer.execute(offerToken)).rejects.toMatchObject({
      code: 'DELIVERY_LINK_NOT_FOUND',
    });
    await expect(t.getOffer.execute(again.offerToken)).resolves.toMatchObject({
      state: 'AVAILABLE',
    });
  });

  it('no crea otra oferta si ya la tomaron o si ya se cerró', async () => {
    const { order } = await accepted();
    await expect(t.createOffer.execute('owner-1', order.orderId)).rejects.toMatchObject({
      code: 'DELIVERY_ALREADY_ACCEPTED',
    });
  });
});

describe('vista pública de la oferta', () => {
  it('muestra solo restaurante, zona, ganancia, adelanto y artículos', async () => {
    const { offerToken } = await offered();
    const view = await t.getOffer.execute(offerToken);
    expect(view).toEqual({
      state: 'AVAILABLE',
      restaurantName: 'Tacos El Faro',
      zone: expect.stringMatching(/^Col\. Centro · 3\.4 km al \w+ del restaurante$/),
      courierEarnings: 45,
      amountToAdvance: 180,
      itemCount: 3,
    });
  });

  it('pedidos sin colonia (previos al campo) muestran solo la distancia', async () => {
    const { offerToken } = await offered({ neighborhood: null });
    const view = await t.getOffer.execute(offerToken);
    expect(view).toMatchObject({ zone: expect.stringMatching(/^3\.4 km al \w+ del restaurante$/) });
  });

  it('PRIVACIDAD: no filtra dirección, coordenadas, nombre ni teléfono del cliente', async () => {
    const { offerToken } = await offered();
    const json = JSON.stringify(await t.getOffer.execute(offerToken));
    for (const secret of [
      'Av. del Mar',
      'Portón',
      'Ana Cliente',
      '6691112233',
      '23.27',
      '-106.42',
    ]) {
      expect(json).not.toContain(secret);
    }
    for (const key of ['address', 'reference', 'latitude', 'longitude', 'phone', 'customer']) {
      expect(json).not.toContain(`"${key}"`);
    }
  });

  it('caduca a los 60 minutos', async () => {
    const { offerToken } = await offered();
    t.advance(60 * 60 * 1000 - 1);
    await expect(t.getOffer.execute(offerToken)).resolves.toMatchObject({ state: 'AVAILABLE' });
    t.advance(1);
    await expect(t.getOffer.execute(offerToken)).resolves.toEqual({
      state: 'EXPIRED',
      restaurantName: 'Tacos El Faro',
    });
  });

  it('una vez tomada muestra "ya fue tomado" sin datos del pedido', async () => {
    const { offerToken } = await accepted();
    await expect(t.getOffer.execute(offerToken)).resolves.toEqual({
      state: 'TAKEN',
      restaurantName: 'Tacos El Faro',
    });
  });

  it('un token desconocido o mal formado responde link no válido', async () => {
    await expect(t.getOffer.execute('x'.repeat(43))).rejects.toMatchObject({
      code: 'DELIVERY_LINK_NOT_FOUND',
    });
    await expect(t.getOffer.execute('corto')).rejects.toMatchObject({
      code: 'DELIVERY_LINK_NOT_FOUND',
    });
  });
});

describe('tomar la entrega', () => {
  it('la primera persona se la queda y recibe su link personal', async () => {
    const { order, offerToken } = await offered();
    const { courierToken } = await t.claim.execute(offerToken, courierAna);
    expect(courierToken).toHaveLength(43);
    expect(courierToken).not.toBe(offerToken);
    expect(t.repository.deliveryOf(order.orderId)).toMatchObject({
      status: 'ACCEPTED',
      courier: courierAna,
    });
  });

  it('la segunda persona recibe "ya fue tomado"', async () => {
    const { offerToken } = await accepted();
    await expect(t.claim.execute(offerToken, courierLuis)).rejects.toMatchObject({
      code: 'DELIVERY_ALREADY_TAKEN',
      statusCode: 409,
    });
  });

  it('dos tomas simultáneas: solo una gana', async () => {
    const { offerToken } = await offered();
    const results = await Promise.allSettled([
      t.claim.execute(offerToken, courierAna),
      t.claim.execute(offerToken, courierLuis),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });

  it('una oferta caducada no se puede tomar', async () => {
    const { offerToken } = await offered();
    t.advance(60 * 60 * 1000);
    await expect(t.claim.execute(offerToken, courierAna)).rejects.toMatchObject({
      code: 'DELIVERY_LINK_EXPIRED',
    });
  });

  it('busca o crea al repartidor por teléfono', async () => {
    await accepted();
    expect(t.repository.couriers.get(courierAna.phone)).toBe(courierAna.name);
  });
});

describe('detalle del repartidor', () => {
  it('muestra dirección, mapa, teléfono, pedido y montos', async () => {
    const { courierToken } = await accepted();
    const view = await t.getCourier.execute(courierToken);
    expect(view).toMatchObject({
      status: 'ACCEPTED',
      isActive: true,
      address: 'Av. del Mar 100',
      neighborhood: 'Centro',
      reference: 'Portón azul',
      destination: { latitude: 23.27, longitude: -106.42 },
      customer: { name: 'Ana Cliente', phone: '6691112233' },
      money: {
        paymentMethod: 'CASH',
        amountCourierAdvances: 180,
        amountCourierCollects: 225,
        courierEarnings: 45,
      },
    });
  });

  it('oculta el teléfono del cliente cuando la entrega ya no está activa', async () => {
    const { courierToken } = await pickedUp();
    await t.complete.execute(courierToken);
    const view = await t.getCourier.execute(courierToken);
    expect(view.isActive).toBe(false);
    expect(view.customer.phone).toBeNull();
  });

  it('el link personal deja de funcionar 2 horas después de entregar', async () => {
    const { courierToken } = await pickedUp();
    await t.complete.execute(courierToken);
    t.advance(2 * 60 * 60 * 1000);
    await expect(t.getCourier.execute(courierToken)).resolves.toBeDefined();
    t.advance(1);
    await expect(t.getCourier.execute(courierToken)).rejects.toMatchObject({
      code: 'DELIVERY_LINK_EXPIRED',
    });
  });
});

describe('acciones del dueño', () => {
  it('"Entregado al repartidor" pasa a picked_up, el pedido a "En camino" y avisa', async () => {
    const { order } = await accepted();
    const change = await t.handOff.execute('owner-1', order.orderId);
    expect(change.status).toBe('OUT_FOR_DELIVERY');
    expect(t.repository.deliveryOf(order.orderId)?.status).toBe('PICKED_UP');
    expect(t.repository.orders.get(order.orderId)?.status).toBe('OUT_FOR_DELIVERY');
    expect(t.events.orderStatusChanged).toHaveBeenCalledWith(change);
    expect(t.notifier.orderOutForDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: order.orderId }),
    );
  });

  it('no se puede entregar al repartidor si nadie la tomó', async () => {
    const { order } = await offered();
    await expect(t.handOff.execute('owner-1', order.orderId)).rejects.toMatchObject({
      code: 'DELIVERY_INVALID_TRANSITION',
      details: { from: 'PENDING', to: 'PICKED_UP' },
    });
  });

  it('un fallo del aviso al cliente no revierte la entrega', async () => {
    const { order } = await accepted();
    vi.mocked(t.notifier.orderOutForDelivery).mockRejectedValueOnce(new Error('sin proveedor'));
    await expect(t.handOff.execute('owner-1', order.orderId)).resolves.toMatchObject({
      status: 'OUT_FOR_DELIVERY',
    });
  });

  it('liberar devuelve la oferta, invalida el link del repartidor y genera otro link', async () => {
    const { order, offerToken, courierToken } = await accepted();
    const released = await t.release.execute('owner-1', order.orderId);
    expect(released.delivery).toMatchObject({ status: 'PENDING', courier: null });
    await expect(t.getCourier.execute(courierToken)).rejects.toMatchObject({
      code: 'DELIVERY_LINK_NOT_FOUND',
    });
    await expect(t.getOffer.execute(offerToken)).rejects.toMatchObject({
      code: 'DELIVERY_LINK_NOT_FOUND',
    });
    await expect(t.claim.execute(released.offerToken, courierLuis)).resolves.toBeDefined();
  });

  it('no se puede liberar una entrega que ya va en camino', async () => {
    const { order } = await pickedUp();
    await expect(t.release.execute('owner-1', order.orderId)).rejects.toMatchObject({
      code: 'DELIVERY_INVALID_TRANSITION',
    });
  });

  it('marcar transferencia recibida es idempotente y solo aplica a transferencias', async () => {
    const order = t.repository.addOrder({ paymentMethod: 'TRANSFER' });
    const first = await t.confirmTransfer.execute('owner-1', order.orderId);
    t.advance(5000);
    const second = await t.confirmTransfer.execute('owner-1', order.orderId);
    expect(second.transferConfirmedAt).toEqual(first.transferConfirmedAt);
    const cash = t.repository.addOrder();
    await expect(t.confirmTransfer.execute('owner-1', cash.orderId)).rejects.toMatchObject({
      code: 'ORDER_NOT_TRANSFER',
    });
  });
});

describe('acciones del repartidor', () => {
  it('"Entregado" cierra la entrega y el pedido', async () => {
    const { order, courierToken } = await pickedUp();
    await t.complete.execute(courierToken);
    expect(t.repository.deliveryOf(order.orderId)?.status).toBe('DELIVERED');
    expect(t.repository.orders.get(order.orderId)?.status).toBe('DELIVERED');
    expect(t.events.orderStatusChanged).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'DELIVERED' }),
    );
  });

  it('"No se pudo entregar" guarda el motivo y el pedido sigue en camino', async () => {
    const { order, courierToken } = await pickedUp();
    await t.fail.execute(courierToken, 'CUSTOMER_UNREACHABLE');
    expect(t.repository.deliveryOf(order.orderId)).toMatchObject({
      status: 'FAILED',
      failureReason: 'CUSTOMER_UNREACHABLE',
    });
    expect(t.repository.orders.get(order.orderId)?.status).toBe('OUT_FOR_DELIVERY');
  });

  it('no puede marcar entregado antes de recoger el pedido', async () => {
    const { courierToken } = await accepted();
    await expect(t.complete.execute(courierToken)).rejects.toMatchObject({
      code: 'DELIVERY_INVALID_TRANSITION',
      details: { from: 'ACCEPTED', to: 'DELIVERED' },
    });
    await expect(t.fail.execute(courierToken, 'OTHER')).rejects.toMatchObject({
      code: 'DELIVERY_INVALID_TRANSITION',
    });
  });

  it('no puede cambiar una entrega ya cerrada', async () => {
    const { courierToken } = await pickedUp();
    await t.complete.execute(courierToken);
    await expect(t.fail.execute(courierToken, 'OTHER')).rejects.toMatchObject({
      code: 'DELIVERY_INVALID_TRANSITION',
      details: { from: 'DELIVERED', to: 'FAILED' },
    });
  });
});
