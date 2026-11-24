import type { Request, Response } from 'express';
import { AppError } from '@/shared/errors/app-error.js';
import type {
  GetLoyaltyCard,
  GetLoyaltySummary,
  GetPublicLoyaltyCard,
  GetPublicLoyaltyProgram,
  ListLoyaltyCards,
  QuoteLoyaltyReward,
  RotateLoyaltyCardToken,
} from '../../application/useCases/cardUseCases.js';
import type {
  GetLoyaltyProgram,
  SaveLoyaltyProgram,
} from '../../application/useCases/programUseCases.js';
import type {
  AddWalkInStamp,
  RedeemLoyaltyReward,
  StampOrder,
  VoidLoyaltyStamp,
  VoidOrderStamp,
} from '../../application/useCases/stampUseCases.js';
import { logLoyaltyError } from '../../infrastructure/loyaltyLog.js';
import {
  customerParamsSchema,
  listCardsQuerySchema,
  loyaltyProgramSchema,
  orderParamsSchema,
  redeemRewardSchema,
  rewardParamsSchema,
  rewardQuoteSchema,
  slugParamsSchema,
  stampOrderSchema,
  stampParamsSchema,
  tokenParamsSchema,
  voidStampSchema,
  walkInStampSchema,
} from './loyalty.schemas.js';

export interface LoyaltyUseCases {
  getProgram: GetLoyaltyProgram;
  saveProgram: SaveLoyaltyProgram;
  listCards: ListLoyaltyCards;
  summary: GetLoyaltySummary;
  getCard: GetLoyaltyCard;
  rotateToken: RotateLoyaltyCardToken;
  stampOrder: StampOrder;
  voidOrderStamp: VoidOrderStamp;
  voidStamp: VoidLoyaltyStamp;
  walkInStamp: AddWalkInStamp;
  redeemReward: RedeemLoyaltyReward;
  publicCard: GetPublicLoyaltyCard;
  publicProgram: GetPublicLoyaltyProgram;
  quoteReward: QuoteLoyaltyReward;
}

function sendValidationError(response: Response, error: { flatten(): unknown }): void {
  response.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Revisa los datos e intenta de nuevo.',
      details: error.flatten(),
    },
  });
}

/** Errores de dominio con su estado; lo inesperado se registra y responde genérico. */
function sendError(
  response: Response,
  error: unknown,
  operation: string,
  context: { orderId?: string } = {},
): void {
  if (error instanceof AppError) {
    const details = 'details' in error ? (error as { details?: unknown }).details : undefined;
    response.status(error.statusCode).json({
      error: { code: error.code, message: error.message, ...(details ? { details } : {}) },
    });
    return;
  }
  logLoyaltyError(operation, { orderId: context.orderId ?? null }, error);
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Algo salió mal. Intenta de nuevo.' },
  });
}

/** Las respuestas con datos de clientes o tokens nunca deben quedar en cachés. */
function noStore(response: Response) {
  response.setHeader('Cache-Control', 'no-store');
}

export class LoyaltyController {
  constructor(private readonly useCases: LoyaltyUseCases) {}

  // ── Dueño (con sesión) ──────────────────────────────────────────────────────────

  getProgram = (request: Request, response: Response): void => {
    noStore(response);
    this.useCases.getProgram
      .execute(request.user!.id)
      .then((program) => response.json({ program }))
      .catch((error: unknown) => sendError(response, error, 'get_program'));
  };

  saveProgram = (request: Request, response: Response): void => {
    const body = loyaltyProgramSchema.safeParse(request.body);
    if (!body.success) return sendValidationError(response, body.error);
    noStore(response);
    this.useCases.saveProgram
      .execute(request.user!.id, body.data)
      .then((program) => response.json({ program }))
      .catch((error: unknown) => sendError(response, error, 'save_program'));
  };

  summary = (request: Request, response: Response): void => {
    noStore(response);
    this.useCases.summary
      .execute(request.user!.id)
      .then((summary) => response.json({ summary }))
      .catch((error: unknown) => sendError(response, error, 'summary'));
  };

  listCards = (request: Request, response: Response): void => {
    const query = listCardsQuerySchema.safeParse(request.query);
    if (!query.success) return sendValidationError(response, query.error);
    noStore(response);
    this.useCases.listCards
      .execute(request.user!.id, query.data)
      .then((result) =>
        response.json({ ...result, page: query.data.page, limit: query.data.limit }),
      )
      .catch((error: unknown) => sendError(response, error, 'list_cards'));
  };

  getCard = (request: Request, response: Response): void => {
    const params = customerParamsSchema.safeParse(request.params);
    if (!params.success) return sendValidationError(response, params.error);
    noStore(response);
    this.useCases.getCard
      .execute(request.user!.id, params.data.customerId)
      .then((detail) => response.json(detail))
      .catch((error: unknown) => sendError(response, error, 'get_card'));
  };

  rotateToken = (request: Request, response: Response): void => {
    const params = customerParamsSchema.safeParse(request.params);
    if (!params.success) return sendValidationError(response, params.error);
    noStore(response);
    this.useCases.rotateToken
      .execute(request.user!.id, params.data.customerId)
      .then((result) => response.json(result))
      .catch((error: unknown) => sendError(response, error, 'rotate_token'));
  };

  stampOrder = (request: Request, response: Response): void => {
    const params = orderParamsSchema.safeParse(request.params);
    const body = stampOrderSchema.safeParse(request.body ?? {});
    if (!params.success) return sendValidationError(response, params.error);
    if (!body.success) return sendValidationError(response, body.error);
    noStore(response);
    this.useCases.stampOrder
      .execute(request.user!.id, params.data.orderId, body.data.customer)
      .then((result) => response.status(result.alreadyStamped ? 200 : 201).json(result))
      .catch((error: unknown) =>
        sendError(response, error, 'stamp_order', { orderId: params.data.orderId }),
      );
  };

  voidOrderStamp = (request: Request, response: Response): void => {
    const params = orderParamsSchema.safeParse(request.params);
    const body = voidStampSchema.safeParse(request.body ?? {});
    if (!params.success) return sendValidationError(response, params.error);
    if (!body.success) return sendValidationError(response, body.error);
    noStore(response);
    this.useCases.voidOrderStamp
      .execute(request.user!.id, params.data.orderId, body.data.reason)
      .then((result) => response.json(result))
      .catch((error: unknown) =>
        sendError(response, error, 'void_order_stamp', { orderId: params.data.orderId }),
      );
  };

  voidStamp = (request: Request, response: Response): void => {
    const params = stampParamsSchema.safeParse(request.params);
    const body = voidStampSchema.safeParse(request.body ?? {});
    if (!params.success) return sendValidationError(response, params.error);
    if (!body.success) return sendValidationError(response, body.error);
    noStore(response);
    this.useCases.voidStamp
      .execute(request.user!.id, params.data.stampId, body.data.reason)
      .then((result) => response.json(result))
      .catch((error: unknown) => sendError(response, error, 'void_stamp'));
  };

  walkInStamp = (request: Request, response: Response): void => {
    const params = customerParamsSchema.safeParse(request.params);
    const body = walkInStampSchema.safeParse(request.body ?? {});
    if (!params.success) return sendValidationError(response, params.error);
    if (!body.success) return sendValidationError(response, body.error);
    noStore(response);
    this.useCases.walkInStamp
      .execute(request.user!.id, params.data.customerId, body.data.note)
      .then((result) => response.status(201).json(result))
      .catch((error: unknown) => sendError(response, error, 'walk_in_stamp'));
  };

  redeemReward = (request: Request, response: Response): void => {
    const params = rewardParamsSchema.safeParse(request.params);
    const body = redeemRewardSchema.safeParse(request.body ?? {});
    if (!params.success) return sendValidationError(response, params.error);
    if (!body.success) return sendValidationError(response, body.error);
    noStore(response);
    this.useCases.redeemReward
      .execute(request.user!.id, params.data.rewardId, body.data.orderId)
      .then((result) => response.json(result))
      .catch((error: unknown) =>
        sendError(response, error, 'redeem_reward', { orderId: body.data.orderId ?? undefined }),
      );
  };

  // ── Público (sin cuenta) ────────────────────────────────────────────────────────

  publicCard = (request: Request, response: Response): void => {
    noStore(response);
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    response.setHeader('Referrer-Policy', 'no-referrer');
    const params = tokenParamsSchema.safeParse(request.params);
    // Token con forma inválida: misma respuesta que uno inexistente.
    if (!params.success) {
      response.status(404).json({
        error: { code: 'LOYALTY_CARD_NOT_FOUND', message: 'No encontramos esta tarjeta.' },
      });
      return;
    }
    this.useCases.publicCard
      .execute(params.data.token)
      .then((card) => response.json(card))
      .catch((error: unknown) => sendError(response, error, 'public_card'));
  };

  publicProgram = (request: Request, response: Response): void => {
    const params = slugParamsSchema.safeParse(request.params);
    if (!params.success) return sendValidationError(response, params.error);
    response.setHeader('Cache-Control', 'public, max-age=60');
    this.useCases.publicProgram
      .execute(params.data.slug)
      .then((program) => response.json({ program }))
      .catch((error: unknown) => sendError(response, error, 'public_program'));
  };

  quoteReward = (request: Request, response: Response): void => {
    noStore(response);
    const params = slugParamsSchema.safeParse(request.params);
    const body = rewardQuoteSchema.safeParse(request.body);
    if (!params.success) return sendValidationError(response, params.error);
    if (!body.success) return sendValidationError(response, body.error);
    this.useCases.quoteReward
      .execute(params.data.slug, body.data.cardToken, body.data.subtotal)
      .then((quote) => response.json({ quote }))
      .catch((error: unknown) => sendError(response, error, 'quote_reward'));
  };
}
