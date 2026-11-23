import type { NextFunction, Request, Response } from 'express';
import type { ClaimDelivery } from '../../application/useCases/ClaimDelivery.js';
import type { ConfirmOrderTransfer } from '../../application/useCases/ConfirmOrderTransfer.js';
import type {
  CompleteDelivery,
  FailDelivery,
} from '../../application/useCases/CourierDeliveryActions.js';
import type {
  CreateDeliveryOffer,
  DeliveryOfferResult,
} from '../../application/useCases/CreateDeliveryOffer.js';
import type { GetCourierDelivery } from '../../application/useCases/GetCourierDelivery.js';
import type { GetDeliveryOffer } from '../../application/useCases/GetDeliveryOffer.js';
import type { HandOffDelivery } from '../../application/useCases/HandOffDelivery.js';
import type { ReleaseDelivery } from '../../application/useCases/ReleaseDelivery.js';
import {
  claimDeliverySchema,
  failDeliverySchema,
  orderIdParamsSchema,
  tokenParamsSchema,
} from './deliveryDispatch.schemas.js';
import { sendDeliveryError, sendValidationError } from './delivery-http.js';

export interface DeliveryDispatchUseCases {
  createOffer: CreateDeliveryOffer;
  release: ReleaseDelivery;
  handOff: HandOffDelivery;
  confirmTransfer: ConfirmOrderTransfer;
  getOffer: GetDeliveryOffer;
  claim: ClaimDelivery;
  getCourierDelivery: GetCourierDelivery;
  complete: CompleteDelivery;
  fail: FailDelivery;
}

/** Las respuestas con tokens o datos del cliente nunca deben quedar en cachés. */
function noStore(response: Response) {
  response.setHeader('Cache-Control', 'no-store');
}

function offerResponse(result: DeliveryOfferResult) {
  return { delivery: result.delivery, offerToken: result.offerToken };
}

export class DeliveryDispatchController {
  constructor(private readonly useCases: DeliveryDispatchUseCases) {}

  // ── Dueño (con sesión) ────────────────────────────────────────────────────────

  createOffer = (request: Request, response: Response, next: NextFunction): void => {
    const params = orderIdParamsSchema.safeParse(request.params);
    if (!params.success) return void sendValidationError(response, params.error);
    noStore(response);
    this.useCases.createOffer
      .execute(request.user!.id, params.data.orderId)
      .then((result) => response.status(201).json(offerResponse(result)))
      .catch((error: unknown) => sendDeliveryError(response, error, next));
  };

  release = (request: Request, response: Response, next: NextFunction): void => {
    const params = orderIdParamsSchema.safeParse(request.params);
    if (!params.success) return void sendValidationError(response, params.error);
    noStore(response);
    this.useCases.release
      .execute(request.user!.id, params.data.orderId)
      .then((result) => response.json(offerResponse(result)))
      .catch((error: unknown) => sendDeliveryError(response, error, next));
  };

  handOff = (request: Request, response: Response, next: NextFunction): void => {
    const params = orderIdParamsSchema.safeParse(request.params);
    if (!params.success) return void sendValidationError(response, params.error);
    this.useCases.handOff
      .execute(request.user!.id, params.data.orderId)
      .then((order) => response.json({ order }))
      .catch((error: unknown) => sendDeliveryError(response, error, next));
  };

  confirmTransfer = (request: Request, response: Response, next: NextFunction): void => {
    const params = orderIdParamsSchema.safeParse(request.params);
    if (!params.success) return void sendValidationError(response, params.error);
    this.useCases.confirmTransfer
      .execute(request.user!.id, params.data.orderId)
      .then((result) => response.json(result))
      .catch((error: unknown) => sendDeliveryError(response, error, next));
  };

  // ── Público (sin sesión, con token) ──────────────────────────────────────────

  getOffer = (request: Request, response: Response, next: NextFunction): void => {
    const params = tokenParamsSchema.safeParse(request.params);
    if (!params.success) return void sendValidationError(response, params.error);
    noStore(response);
    this.useCases.getOffer
      .execute(params.data.token)
      .then((offer) => response.json({ offer }))
      .catch((error: unknown) => sendDeliveryError(response, error, next));
  };

  claim = (request: Request, response: Response, next: NextFunction): void => {
    const params = tokenParamsSchema.safeParse(request.params);
    if (!params.success) return void sendValidationError(response, params.error);
    const body = claimDeliverySchema.safeParse(request.body);
    if (!body.success) return void sendValidationError(response, body.error);
    noStore(response);
    this.useCases.claim
      .execute(params.data.token, body.data)
      .then((result) => response.status(201).json(result))
      .catch((error: unknown) => sendDeliveryError(response, error, next));
  };

  getCourierDelivery = (request: Request, response: Response, next: NextFunction): void => {
    const params = tokenParamsSchema.safeParse(request.params);
    if (!params.success) return void sendValidationError(response, params.error);
    noStore(response);
    this.useCases.getCourierDelivery
      .execute(params.data.token)
      .then((delivery) => response.json({ delivery }))
      .catch((error: unknown) => sendDeliveryError(response, error, next));
  };

  complete = (request: Request, response: Response, next: NextFunction): void => {
    const params = tokenParamsSchema.safeParse(request.params);
    if (!params.success) return void sendValidationError(response, params.error);
    noStore(response);
    this.useCases.complete
      .execute(params.data.token)
      .then(() => response.status(204).end())
      .catch((error: unknown) => sendDeliveryError(response, error, next));
  };

  fail = (request: Request, response: Response, next: NextFunction): void => {
    const params = tokenParamsSchema.safeParse(request.params);
    if (!params.success) return void sendValidationError(response, params.error);
    const body = failDeliverySchema.safeParse(request.body);
    if (!body.success) return void sendValidationError(response, body.error);
    noStore(response);
    this.useCases.fail
      .execute(params.data.token, body.data.reason)
      .then(() => response.status(204).end())
      .catch((error: unknown) => sendDeliveryError(response, error, next));
  };
}
