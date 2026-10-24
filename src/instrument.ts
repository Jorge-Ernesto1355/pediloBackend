import * as Sentry from '@sentry/node';

const environment = process.env.NODE_ENV ?? 'development';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment,
  release: process.env.SENTRY_RELEASE,
  tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
});
