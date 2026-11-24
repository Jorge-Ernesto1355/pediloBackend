import { createHash, randomBytes } from 'node:crypto';

/** La oferta pública caduca a los 60 minutos (o antes, al tomarse o cancelarse). */
export const OFFER_TTL_MS = 60 * 60 * 1000;
/** El link personal del repartidor deja de funcionar 2 horas después de cerrar la entrega. */
export const COURIER_LINK_GRACE_MS = 2 * 60 * 60 * 1000;

/** Token aleatorio de 32 bytes (base64url). Solo se devuelve una vez; se guarda su hash. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 en hex (64 caracteres), lo único que se guarda en la base. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Forma válida de un token generado aquí; evita consultar la base con basura. */
export function isWellFormedToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function offerExpiresAt(now: Date): Date {
  return new Date(now.getTime() + OFFER_TTL_MS);
}

/** Momento en que se cerró la entrega (entregada, fallida o cancelada), si ya se cerró. */
export function closedAt(timestamps: {
  deliveredAt: Date | null;
  failedAt: Date | null;
  cancelledAt: Date | null;
}): Date | null {
  return timestamps.deliveredAt ?? timestamps.failedAt ?? timestamps.cancelledAt ?? null;
}

export function isCourierLinkExpired(closed: Date | null, now: Date): boolean {
  return closed !== null && now.getTime() > closed.getTime() + COURIER_LINK_GRACE_MS;
}
