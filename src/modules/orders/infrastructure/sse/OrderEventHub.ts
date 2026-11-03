import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import type { OrderSource, OrderStatus } from '../../domain/entities/Order.js';

export type OrderStatusUpdatedEvent = {
  eventId: string;
  type: 'order_status_updated';
  orderId: string;
  restaurantId: string;
  orderNumber: number;
  status: OrderStatus;
  updatedAt: string;
  statusRevision: number;
};

export type NewOrderEvent = {
  eventId: string;
  type: 'new_order';
  orderId: string;
  restaurantId: string;
  createdAt: string;
    source: OrderSource;
};

type Connection = {
  id: string;
  userId: string;
  response: Response;
  heartbeat: NodeJS.Timeout;
  maximumLifetime: NodeJS.Timeout;
  cleanup: () => void;
};

const HEARTBEAT_INTERVAL_MS = 25_000;
const MAX_CONNECTIONS_PER_USER = 5;
const MAX_CONNECTIONS_PER_RESTAURANT = 500;
// Re-check the existing session on reconnect within a bounded time, so revoked or
// expired cookies are not allowed to hold an event stream indefinitely.
const MAX_CONNECTION_LIFETIME_MS = 15 * 60_000;
const MAX_RECENT_ORDER_IDS = 10_000;

export class OrderEventHub {
  private readonly connectionsByRestaurant = new Map<string, Map<string, Connection>>();
  private readonly connectionCountsByUser = new Map<string, number>();
  private readonly recentOrderIds = new Set<string>();
  private readonly recentStatusEventIds = new Set<string>();

  getConnectionCounts(restaurantId?: string) {
    if (restaurantId) return this.connectionsByRestaurant.get(restaurantId)?.size ?? 0;
    let total = 0;
    for (const restaurantConnections of this.connectionsByRestaurant.values())
      total += restaurantConnections.size;
    return total;
  }

  getUserConnectionCount(userId: string) {
    return this.connectionCountsByUser.get(userId) ?? 0;
  }

  canAccept(restaurantId: string, userId: string) {
    return (
      this.getConnectionCounts(restaurantId) < MAX_CONNECTIONS_PER_RESTAURANT &&
      this.getUserConnectionCount(userId) < MAX_CONNECTIONS_PER_USER
    );
  }

  add(restaurantId: string, userId: string, response: Response): (() => void) | null {
    const restaurantConnections = this.connectionsByRestaurant.get(restaurantId);
    if ((restaurantConnections?.size ?? 0) >= MAX_CONNECTIONS_PER_RESTAURANT) return null;
    if (this.getUserConnectionCount(userId) >= MAX_CONNECTIONS_PER_USER) return null;

    const id = randomUUID();
    const connections = restaurantConnections ?? new Map<string, Connection>();
    if (!restaurantConnections) this.connectionsByRestaurant.set(restaurantId, connections);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      clearInterval(connection.heartbeat);
      clearTimeout(connection.maximumLifetime);
      response.off('close', cleanup);
      response.off('error', cleanup);
      connections.delete(id);
      if (connections.size === 0) this.connectionsByRestaurant.delete(restaurantId);
      const count = this.getUserConnectionCount(userId) - 1;
      if (count > 0) this.connectionCountsByUser.set(userId, count);
      else this.connectionCountsByUser.delete(userId);
    };

    const connection: Connection = {
      id,
      userId,
      response,
      heartbeat: setInterval(() => {
        if (!this.write(connection, ': heartbeat\n\n')) this.drop(connection);
      }, HEARTBEAT_INTERVAL_MS),
      maximumLifetime: setTimeout(() => {
        try {
          if (!response.writableEnded && !response.destroyed) response.end();
        } catch {
          // The socket may have closed between the state check and end().
        } finally {
          cleanup();
        }
      }, MAX_CONNECTION_LIFETIME_MS),
      cleanup,
    };
    connection.heartbeat.unref?.();
    connection.maximumLifetime.unref?.();
    connections.set(id, connection);
    this.connectionCountsByUser.set(userId, this.getUserConnectionCount(userId) + 1);
    response.once('close', cleanup);
    response.once('error', cleanup);
    return cleanup;
  }

  publishNewOrder(input: {
    orderId: string;
    restaurantId: string;
    createdAt: Date | string;
    source: OrderSource;
  }) {
    if (this.recentOrderIds.has(input.orderId)) return;
    this.recentOrderIds.add(input.orderId);
    if (this.recentOrderIds.size > MAX_RECENT_ORDER_IDS) {
      const oldestOrderId = this.recentOrderIds.values().next().value;
      if (oldestOrderId) this.recentOrderIds.delete(oldestOrderId);
    }
    const connections = this.connectionsByRestaurant.get(input.restaurantId);
    if (!connections?.size) return;
    const event: NewOrderEvent = {
      eventId: randomUUID(),
      type: 'new_order',
      orderId: input.orderId,
      restaurantId: input.restaurantId,
      createdAt: new Date(input.createdAt).toISOString(),
      source: input.source,
    };
    const frame = `id: ${event.eventId}\nevent: new_order\ndata: ${JSON.stringify(event)}\n\n`;
    for (const connection of connections.values()) {
      if (!this.write(connection, frame)) this.drop(connection);
    }
  }

  publishOrderStatusUpdated(input: {
    orderId: string;
    businessId: string;
    orderNumber: number;
    status: OrderStatus;
    updatedAt: Date | string;
    statusRevision: number;
  }): number {
    const dedupeKey = `${input.orderId}:${input.statusRevision}`;
    if (this.recentStatusEventIds.has(dedupeKey)) return 0;
    this.recentStatusEventIds.add(dedupeKey);
    if (this.recentStatusEventIds.size > MAX_RECENT_ORDER_IDS) {
      const oldestKey = this.recentStatusEventIds.values().next().value;
      if (oldestKey) this.recentStatusEventIds.delete(oldestKey);
    }
    const connections = this.connectionsByRestaurant.get(input.businessId);
    if (!connections?.size) return 0;
    const event: OrderStatusUpdatedEvent = {
      eventId: randomUUID(),
      type: 'order_status_updated',
      orderId: input.orderId,
      restaurantId: input.businessId,
      orderNumber: input.orderNumber,
      status: input.status,
      updatedAt: new Date(input.updatedAt).toISOString(),
      statusRevision: input.statusRevision,
    };
    const frame = `id: ${event.eventId}\nevent: order_status_updated\ndata: ${JSON.stringify(event)}\n\n`;
    let delivered = 0;
    for (const connection of connections.values()) {
      if (!this.write(connection, frame)) this.drop(connection);
      else delivered += 1;
    }
    return delivered;
  }

  closeAll() {
    for (const connections of this.connectionsByRestaurant.values()) {
      for (const connection of connections.values()) {
        try {
          if (!connection.response.writableEnded && !connection.response.destroyed)
            connection.response.end();
        } catch {
          // Continue releasing the remaining streams during shutdown.
        } finally {
          connection.cleanup();
        }
      }
    }
    this.connectionsByRestaurant.clear();
    this.connectionCountsByUser.clear();
    this.recentOrderIds.clear();
    this.recentStatusEventIds.clear();
  }

  private drop(connection: Connection) {
    connection.cleanup();
    try {
      if (!connection.response.destroyed) connection.response.destroy();
    } catch {
      // The connection is already being closed; its resources have been released.
    }
  }

  private write(connection: Connection, frame: string) {
    try {
      if (connection.response.writableEnded || connection.response.destroyed) return false;
      // Drop a slow consumer rather than allowing unbounded buffering in memory.
      return connection.response.write(frame);
    } catch {
      return false;
    }
  }
}

export const orderEventHub = new OrderEventHub();
