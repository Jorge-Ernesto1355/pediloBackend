/**
 * Rutas públicas del frontend que comparten el primer segmento de la URL con el menú
 * (pedilo.app/:slug). Un negocio no puede usarlas como slug.
 * - `e`: oferta de entrega para repartidores (/e/:token).
 * - `entrega`: link personal del repartidor (/entrega/:token).
 */
export const RESERVED_BUSINESS_SLUGS: readonly string[] = ['e', 'entrega'];

export function isReservedBusinessSlug(slug: string): boolean {
  return RESERVED_BUSINESS_SLUGS.includes(slug.trim().toLowerCase());
}
