import type {
  BusinessSettings,
  BusinessSettingsRepository,
  UpdateBusinessSettingsInput,
} from '../../domain/ports/BusinessSettingsRepository.js';

export class UpdateBusinessSettings {
  constructor(private readonly repository: BusinessSettingsRepository) {}

  execute(userId: string, values: UpdateBusinessSettingsInput): Promise<BusinessSettings> {
    return this.repository.updateByUserId(userId, values);
  }
}
