import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { OrderEventHub } from './OrderEventHub.js';

class FakeResponse extends EventEmitter {
  frames: string[] = [];
  writableEnded = false;
  destroyed = false;
  acceptWrites = true;

  write(frame: string) {
    if (!this.acceptWrites || this.destroyed) return false;
    this.frames.push(frame);
    return true;
  }

  end() {
    this.writableEnded = true;
    this.emit('close');
  }

  destroy() {
    this.destroyed = true;
    this.emit('close');
    return this;
  }
}

describe('OrderEventHub', () => {
  const hub = new OrderEventHub();
  afterEach(() => hub.closeAll());

  it('broadcasts only within the authorized restaurant group with a minimal SSE event', () => {
    const restaurantA = new FakeResponse();
    const restaurantB = new FakeResponse();
    hub.add('restaurant-a', 'owner-a', restaurantA as unknown as Response);
    hub.add('restaurant-b', 'owner-b', restaurantB as unknown as Response);

    hub.publishNewOrder({
      orderId: 'order-a',
      restaurantId: 'restaurant-a',
      createdAt: new Date('2026-10-31T19:30:00.000Z'),
      source: 'PUBLIC',
    });

    expect(restaurantA.frames).toHaveLength(1);
    expect(restaurantB.frames).toHaveLength(0);
    const [frame] = restaurantA.frames;
    expect(frame).toMatch(/^id: [\w-]+\nevent: new_order\ndata: /);
    const data = JSON.parse(frame!.split('data: ')[1]!.trim()) as Record<string, unknown>;
    expect(data).toEqual({
      eventId: expect.any(String),
      type: 'new_order',
      orderId: 'order-a',
      restaurantId: 'restaurant-a',
      createdAt: '2026-10-31T19:30:00.000Z',
      source: 'PUBLIC',
    });
    expect(Object.keys(data).sort()).toEqual([
      'createdAt',
      'eventId',
      'orderId',
      'restaurantId',
      'source',
      'type',
    ]);
  });

  it('does not broadcast the same persisted order twice', () => {
    const response = new FakeResponse();
    hub.add('restaurant-a', 'owner-a', response as unknown as Response);
    const event = {
      orderId: 'order-a',
      restaurantId: 'restaurant-a',
      createdAt: new Date(),
      source: 'PUBLIC' as const,
    };

    hub.publishNewOrder(event);
    hub.publishNewOrder(event);

    expect(response.frames).toHaveLength(1);
  });

  it('removes closed connections and decrements per-user counts', () => {
    const response = new FakeResponse();
    hub.add('restaurant-a', 'owner-a', response as unknown as Response);
    expect(hub.getConnectionCounts('restaurant-a')).toBe(1);
    expect(hub.getUserConnectionCount('owner-a')).toBe(1);

    response.emit('close');

    expect(hub.getConnectionCounts('restaurant-a')).toBe(0);
    expect(hub.getUserConnectionCount('owner-a')).toBe(0);
  });

  it('drops slow or broken consumers instead of retaining buffered connections', () => {
    const response = new FakeResponse();
    hub.add('restaurant-a', 'owner-a', response as unknown as Response);
    response.acceptWrites = false;

    hub.publishNewOrder({
      orderId: 'order-a',
      restaurantId: 'restaurant-a',
      createdAt: new Date(),
      source: 'PUBLIC',
    });

    expect(response.destroyed).toBe(true);
    expect(hub.getConnectionCounts()).toBe(0);
  });

  it('limits duplicate device connections and releases the limit on close', () => {
    const responses = Array.from({ length: 6 }, () => new FakeResponse());
    for (const response of responses.slice(0, 5))
      expect(hub.add('restaurant-a', 'owner-a', response as unknown as Response)).toBeTypeOf(
        'function',
      );
    expect(hub.add('restaurant-a', 'owner-a', responses[5]! as unknown as Response)).toBeNull();

    responses[0]!.emit('close');
    expect(hub.add('restaurant-a', 'owner-a', responses[5]! as unknown as Response)).toBeTypeOf(
      'function',
    );
  });
});
