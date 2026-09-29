import { Prisma, PrismaClient } from '@prisma/client';
import {
  BusinessSettingsAlreadyExistsError,
  BusinessSettingsBusinessNotFoundError,
} from '../../domain/errors/BusinessSettingsErrors.js';
import type {
  BusinessSettings,
  BusinessSettingsRepository,
  BusinessSettingsValues,
  UpdateBusinessSettingsInput,
} from '../../domain/ports/BusinessSettingsRepository.js';

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettingsValues = {
  currency: 'MXN',
  phone: null,
  whatsapp: null,
  address: null,
  timezone: 'America/Mazatlan',
};

export class PrismaBusinessSettingsRepository implements BusinessSettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getOrCreateByUserId(userId: string): Promise<BusinessSettings> {
    const businessId = await this.getBusinessId(userId);
    const row = await this.prisma.businessSettings.upsert({
      where: { businessId },
      create: { businessId, ...DEFAULT_BUSINESS_SETTINGS },
      update: {},
    });
    return toBusinessSettings(row);
  }

  async createByUserId(userId: string, values: BusinessSettingsValues): Promise<BusinessSettings> {
    const businessId = await this.getBusinessId(userId);
    try {
      const row = await this.prisma.businessSettings.create({ data: { businessId, ...values } });
      return toBusinessSettings(row);
    } catch (error) {
      if (isUniqueError(error)) throw new BusinessSettingsAlreadyExistsError();
      throw error;
    }
  }

  async updateByUserId(
    userId: string,
    values: UpdateBusinessSettingsInput,
  ): Promise<BusinessSettings> {
    const businessId = await this.getBusinessId(userId);
    const row = await this.prisma.businessSettings.upsert({
      where: { businessId },
      create: { businessId, ...DEFAULT_BUSINESS_SETTINGS, ...values },
      update: values,
    });
    return toBusinessSettings(row);
  }

  private async getBusinessId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { businessId: true },
    });

    if (!user?.businessId) throw new BusinessSettingsBusinessNotFoundError();
    return user.businessId;
  }
}

function toBusinessSettings(row: {
  id: string;
  businessId: string;
  currency: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}): BusinessSettings {
  return row;
}

function isUniqueError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
