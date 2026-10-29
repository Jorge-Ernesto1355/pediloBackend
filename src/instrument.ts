import * as Sentry from '@sentry/node';

const environment = process.env.PEDILO_ENV ?? process.env.NODE_ENV ?? 'local';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment,
  release: process.env.SENTRY_RELEASE,
  integrations: [Sentry.expressIntegration()],
  tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
});
