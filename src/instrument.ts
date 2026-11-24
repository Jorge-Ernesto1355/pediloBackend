import * as Sentry from '@sentry/node';
import { redactUrlTokens } from './shared/config/security/redact-url-tokens.js';

const environment = process.env.PEDILO_ENV ?? process.env.NODE_ENV ?? 'local';

/** Los links privados (tarjetas de lealtad, entregas) llevan su llave en la URL. */
function scrubUrls<T extends Sentry.Event>(event: T): T {
  if (event.request?.url) event.request.url = redactUrlTokens(event.request.url);
  if (event.transaction) event.transaction = redactUrlTokens(event.transaction);
  for (const breadcrumb of event.breadcrumbs ?? []) {
    if (typeof breadcrumb.data?.url === 'string')
      breadcrumb.data.url = redactUrlTokens(breadcrumb.data.url);
  }
  return event;
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment,
  release: process.env.SENTRY_RELEASE,
  integrations: [Sentry.expressIntegration()],
  tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
  beforeSend: (event) => scrubUrls(event),
  beforeSendTransaction: (event) => scrubUrls(event),
});
