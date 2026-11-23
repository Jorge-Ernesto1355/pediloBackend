import type { Coordinates } from '../../domain/distance.js';
import { type DeliveryQuote, quoteDelivery } from '../../domain/deliverySettings.js';
import { DeliveryBusinessNotFoundError } from '../../domain/errors/DeliveryErrors.js';
import type { DeliverySettingsRepository } from '../ports/DeliverySettingsRepository.js';

/** Cotización pública para el checkout. La distancia y el envío siempre se calculan aquí. */
export class QuoteDelivery {
  constructor(private readonly repository: DeliverySettingsRepository) {}

  async execute(businessId: string, destination: Coordinates): Promise<DeliveryQuote> {
    const settings = await this.repository.getByBusinessId(businessId);
    if (!settings) throw new DeliveryBusinessNotFoundError();
    return quoteDelivery(settings, destination);
  }
}
