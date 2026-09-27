export interface BusinessSettingsValues {
  currency: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  timezone: string;
}

export interface BusinessSettings extends BusinessSettingsValues {
  id: string;
  businessId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UpdateBusinessSettingsInput = Partial<BusinessSettingsValues>;

export interface BusinessSettingsRepository {
  getOrCreateByUserId(userId: string): Promise<BusinessSettings>;
  createByUserId(userId: string, values: BusinessSettingsValues): Promise<BusinessSettings>;
  updateByUserId(userId: string, values: UpdateBusinessSettingsInput): Promise<BusinessSettings>;
}
