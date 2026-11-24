import { type DeliverySettings, validateDeliverySettings } from '../../domain/deliverySettings.js';
import {
  DeliveryBusinessNotFoundError,
  DeliverySettingsInvalidError,
} from '../../domain/errors/DeliveryErrors.js';
import type {
  DeliverySettingsRepository,
  SaveDeliverySettingsInput,
} from '../ports/DeliverySettingsRepository.js';

export class UpdateDeliverySettings {
  constructor(private readonly repository: DeliverySettingsRepository) {}

  async execute(userId: string, input: SaveDeliverySettingsInput): Promise<DeliverySettings> {
    const businessId = await this.repository.findBusinessIdByUserId(userId);
    if (!businessId) throw new DeliveryBusinessNotFoundError();
    const current = await this.repository.getByBusinessId(businessId);
    if (!current) throw new DeliveryBusinessNotFoundError();

    const issues = validateDeliverySettings({
      enabled: input.enabled,
      maxDeliveryKm: input.maxDeliveryKm,
      feeConfig: input.feeConfig,
      origin: input.origin ?? current.origin,
    });
    if (issues.length > 0) throw new DeliverySettingsInvalidError(issues);

    return this.repository.save(businessId, input);
  }
}
