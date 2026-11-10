import 'reflect-metadata';

import 'dotenv/config';
import './instrument.js';
import { createServer } from 'node:http';
import { createApp } from './app';
import { prisma } from './libs/prisma.js';
import { orderEventHub } from './modules/orders/infrastructure/sse/OrderEventHub.js';
import { redisConnection } from './shared/cache/RedisConnection.js';

const port = Number(process.env.PORT ?? 3001);
void redisConnection.connect();
const app = createApp();
const server = createServer(app);

server.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Recibida señal ${signal}; cerrando conexiones HTTP.`);
  orderEventHub.closeAll();
  server.close(async (error) => {
    if (error) console.error('Error al cerrar el servidor HTTP:', error);
    await prisma.$disconnect();
    await redisConnection.close();
    process.exit(error ? 1 : 0);
  });
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
