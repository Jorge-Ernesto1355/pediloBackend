import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Llave del link privado de la tarjeta: 32 bytes de un generador criptográfico (256 bits)
 * en base64url → 43 caracteres. Quien la tiene puede ver la tarjeta y canjear su premio,
 * así que nunca se escribe en logs ni aparece en mensajes de error.
 *
 * Se guarda tal cual (no como hash) porque el dueño necesita volver a compartir el link
 * por WhatsApp; si se filtra, el dueño la regenera y la anterior deja de funcionar.
 */
export function generateCardToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Forma válida de un token generado aquí; evita consultar la base con basura. */
export function isWellFormedCardToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** Comparación en tiempo constante (no filtra por tiempos cuántos caracteres coinciden). */
export function sameCardToken(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Huella corta del token para llaves internas (límite de peticiones); nunca el token. */
export function cardTokenFingerprint(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex').slice(0, 32);
}
