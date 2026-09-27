import type {
  BusinessSettings,
  BusinessSettingsRepository,
} from '../../domain/ports/BusinessSettingsRepository.js';

export class GetBusinessSettings {
  constructor(private readonly repository: BusinessSettingsRepository) {}

  execute(userId: string): Promise<BusinessSettings> {
    return this.repository.getOrCreateByUserId(userId);
  }
}
