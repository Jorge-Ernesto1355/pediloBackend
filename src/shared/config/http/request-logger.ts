import type { ErrorRequestHandler, RequestHandler, Response } from 'express';

const SENSITIVE_KEY = /password|token|secret|authorization|cookie|api[-_]?key/i;
const MAX_VALUE_LENGTH = 2_000;

function sanitize(value: unknown, key?: string): unknown {
  if (key && SENSITIVE_KEY.test(key)) return '[REDACTED]';

  if (typeof value === 'string') {
    return value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH)}…` : value;
  }

  if (Array.isArray(value)) return value.map((item) => sanitize(item));

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitize(entryValue, entryKey),
      ]),
    );
  }

  return value;
}

function responseBodyFrom(value: unknown): unknown {
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  return value;
}

function logRequest(
  request: Parameters<RequestHandler>[0],
  response: Response,
  startedAt: number,
  body: unknown,
) {
  const entry = {
    type: 'http',
    method: request.method,
    path: request.originalUrl,
    route: request.route?.path ?? null,
    request: {
      query: sanitize(request.query),
      params: sanitize(request.params),
      body: sanitize(request.body),
    },
    response: {
      statusCode: response.statusCode,
      result: sanitize(responseBodyFrom(body)),
    },
    durationMs: Date.now() - startedAt,
    ...(response.locals.requestLoggerError
      ? {
          error:
            response.locals.requestLoggerError instanceof Error
              ? {
                  name: response.locals.requestLoggerError.name,
                  message: response.locals.requestLoggerError.message,
                }
              : sanitize(response.locals.requestLoggerError),
        }
      : {}),
  };

  const formattedEntry =
    process.env.NODE_ENV !== 'production' ? JSON.stringify(entry, null, 2) : JSON.stringify(entry);

  console.log(formattedEntry);
}

export const requestLogger: RequestHandler = (request, response, next) => {
  if (process.env.REQUEST_LOGGING === 'false') return next();

  const startedAt = Date.now();
  let responseBody: unknown;

  const originalJson = response.json.bind(response);
  const originalSend = response.send.bind(response);
  const originalEnd = response.end.bind(response);

  response.json = ((body: unknown) => {
    responseBody = body;
    return originalJson(body);
  }) as Response['json'];

  response.send = ((body?: unknown) => {
    responseBody = body;
    return originalSend(body);
  }) as Response['send'];

  response.end = ((chunk?: unknown, ...args: unknown[]) => {
    if (chunk !== undefined) responseBody = chunk;
    return originalEnd(chunk as never, ...(args as [never]));
  }) as Response['end'];

  response.once('finish', () => {
    logRequest(request, response, startedAt, responseBody);
  });

  next();
};

export const requestLoggerErrorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  // The final response is logged by requestLogger on `finish`.
  response.locals.requestLoggerError = error;
  next(error);
};
