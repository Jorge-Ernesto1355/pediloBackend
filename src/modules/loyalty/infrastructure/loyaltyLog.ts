/**
 * Registro de errores del servicio de sellado y premios.
 * Solo ids de restaurante, pedido o tarjeta y el tipo de error: nunca teléfonos, nombres,
 * tokens ni el mensaje original (los errores de base pueden incluir valores).
 */
export function logLoyaltyError(
  operation: string,
  context: { businessId?: string | null; orderId?: string | null; cardId?: string | null },
  error: unknown,
): void {
  const details =
    error && typeof error === 'object'
      ? {
          name: error instanceof Error ? error.name : 'UnknownError',
          ...('code' in error && typeof error.code === 'string' ? { code: error.code } : {}),
        }
      : { name: 'UnknownError' };
  console.error(
    JSON.stringify({
      type: 'loyalty_error',
      operation,
      businessId: context.businessId ?? null,
      orderId: context.orderId ?? null,
      cardId: context.cardId ?? null,
      error: details,
    }),
  );
}
