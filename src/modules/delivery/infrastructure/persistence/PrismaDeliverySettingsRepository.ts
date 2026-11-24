import { Prisma, type PrismaClient } from '@prisma/client';
import type {
  DeliverySettingsRepository,
  SaveDeliverySettingsInput,
} from '../../application/ports/DeliverySettingsRepository.js';
import type { DeliverySettings } from '../../domain/deliverySettings.js';
import { parseFeeConfig } from '../../domain/feePolicy.js';

const deliverySelect = {
  ubicationMaps: { select: { latitude: true, longitude: true } },
  settings: {
    select: { deliveryEnabled: true, maxDeliveryKm: true, deliveryFeeConfig: true },
  },
} satisfies Prisma.BusinessSelect;

type DeliveryRow = Prisma.BusinessGetPayload<{ select: typeof deliverySelect }>;

export class PrismaDeliverySettingsRepository implements DeliverySettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findBusinessIdByUserId(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { businessId: true },
    });
    return user?.businessId ?? null;
  }

  async getByBusinessId(businessId: string): Promise<DeliverySettings | null> {
    return loadDeliverySettings(this.prisma, businessId);
  }

  async save(businessId: string, input: SaveDeliverySettingsInput): Promise<DeliverySettings> {
    const deliveryData = {
      deliveryEnabled: input.enabled,
      maxDeliveryKm: input.maxDeliveryKm,
      deliveryFeeConfig: input.feeConfig
        ? (input.feeConfig as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull,
    };
    const row = await this.prisma.$transaction(async (tx) => {
      if (input.origin) {
        // Misma ubicación que edita el perfil del negocio: una sola fuente de verdad.
        const location = await tx.ubicationMaps.upsert({
          where: { businessId },
          create: { businessId, ...input.origin },
          update: input.origin,
          select: { id: true },
        });
        await tx.business.update({
          where: { id: businessId },
          data: { ubicationMapsId: location.id },
        });
      }
      await tx.businessSettings.upsert({
        where: { businessId },
        create: { businessId, ...deliveryData },
        update: deliveryData,
      });
      return tx.business.findUniqueOrThrow({ where: { id: businessId }, select: deliverySelect });
    });
    return toDeliverySettings(row);
  }
}

/**
 * Lee la configuración de envío con el cliente dado. Acepta una transacción para que la
 * creación de pedidos cotice con los mismos datos que confirma. null si el negocio no existe.
 */
export async function loadDeliverySettings(
  client: Prisma.TransactionClient | PrismaClient,
  businessId: string,
): Promise<DeliverySettings | null> {
  const row = await client.business.findUnique({
    where: { id: businessId },
    select: deliverySelect,
  });
  return row ? toDeliverySettings(row) : null;
}

function toDeliverySettings(row: DeliveryRow): DeliverySettings {
  return {
    enabled: row.settings?.deliveryEnabled ?? false,
    origin: row.ubicationMaps
      ? {
          latitude: row.ubicationMaps.latitude.toNumber(),
          longitude: row.ubicationMaps.longitude.toNumber(),
        }
      : null,
    maxDeliveryKm: row.settings?.maxDeliveryKm?.toNumber() ?? null,
    feeConfig: parseFeeConfig(row.settings?.deliveryFeeConfig),
  };
}
