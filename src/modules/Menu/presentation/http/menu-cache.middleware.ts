import type { RequestHandler } from 'express';

/** The authenticated catalog must always be delivered, even after a conditional request. */
export const noConditionalCatalogCache: RequestHandler = (request, response, next) => {
  request.headers['if-none-match'] = '';
  request.headers['if-modified-since'] = '';
  response.setHeader('Cache-Control', 'no-store');
  next();
};
