import type { DeliverySettings } from '../../domain/deliverySettings.js';
import { DeliveryBusinessNotFoundError } from '../../domain/errors/DeliveryErrors.js';
import type { DeliverySettingsRepository } from '../ports/DeliverySettingsRepository.js';

export class GetDeliverySettings {
  constructor(private readonly repository: DeliverySettingsRepository) {}

  async execute(userId: string): Promise<DeliverySettings> {
    const businessId = await this.repository.findBusinessIdByUserId(userId);
    if (!businessId) throw new DeliveryBusinessNotFoundError();
    const settings = await this.repository.getByBusinessId(businessId);
    if (!settings) throw new DeliveryBusinessNotFoundError();
    return settings;
  }
}
