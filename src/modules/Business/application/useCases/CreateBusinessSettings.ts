import type {
  BusinessSettings,
  BusinessSettingsRepository,
  BusinessSettingsValues,
} from '../../domain/ports/BusinessSettingsRepository.js';

export class CreateBusinessSettings {
  constructor(private readonly repository: BusinessSettingsRepository) {}

  execute(userId: string, values: BusinessSettingsValues): Promise<BusinessSettings> {
    return this.repository.createByUserId(userId, values);
  }
}
