import { Request, Response } from 'express';
import { CreateOrder } from '../../application/useCases/CreateOrder.js';
import { GetOrder } from '../../application/useCases/GetOrder.js';
import { ListOrders } from '../../application/useCases/ListOrders.js';
import { UpdateOrderStatus } from '../../application/useCases/UpdateOrderStatus.js';
import {
  businessIdSchema,
  createOrderSchema,
  orderIdSchema,
  orderListSchema,
  orderStatusSchema,
} from './order.schemas.js';

export class OrderController {
  constructor(
    private readonly createOrder: CreateOrder,
    private readonly getOrder: GetOrder,
    private readonly listOrders: ListOrders,
    private readonly updateOrderStatus: UpdateOrderStatus,
  ) {}
  create = (req: Request, res: Response) => {
    const params = businessIdSchema.safeParse(req.params);
    const body = createOrderSchema.safeParse(req.body);
    if (!params.success) return bad(res, params.error);
    if (!body.success) return bad(res, body.error);
    return this.createOrder
      .execute(params.data.businessId, body.data)
      .then((order) => res.status(201).json({ order: order.toJSON() }))
      .catch((error) => handle(res, error));
  };
  get = (req: Request, res: Response) => {
    const params = orderIdSchema.safeParse(req.params);
    if (!params.success) return bad(res, params.error);
    return this.getOrder
      .execute(req.user!.id, params.data.orderId)
      .then((order) => res.json({ order: order.toJSON() }))
      .catch((error) => handle(res, error));
  };
  list = (req: Request, res: Response) => {
    const params = businessIdSchema.safeParse(req.params);
    const query = orderListSchema.safeParse(req.query);
    if (!params.success) return bad(res, params.error);
    if (!query.success) return bad(res, query.error);
    return this.listOrders
      .execute(req.user!.id, { businessId: params.data.businessId, ...query.data })
      .then(({ orders, total }) =>
        res.json({
          orders: orders.map((order) => order.toJSON()),
          page: query.data.page,
          limit: query.data.limit,
          total,
        }),
      )
      .catch((error) => handle(res, error));
  };
  updateStatus = (req: Request, res: Response) => {
    const params = orderIdSchema.safeParse(req.params);
    const body = orderStatusSchema.safeParse(req.body);
    if (!params.success) return bad(res, params.error);
    if (!body.success) return bad(res, body.error);
    return this.updateOrderStatus
      .execute(req.user!.id, params.data.orderId, body.data.status)
      .then((order) => res.json({ order: order.toJSON() }))
      .catch((error) => handle(res, error));
  };
}
function bad(res: Response, error: { flatten(): unknown }) {
  return res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: error.flatten(),
    },
  });
}
function handle(res: Response, error: unknown) {

  console.log(error)
  const status =
    error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : 500;
  const code =
    error && typeof error === 'object' && 'code' in error ? String(error.code) : 'INTERNAL_ERROR';
  const message =
    error && typeof error === 'object' && 'statusCode' in error
      ? error instanceof Error
        ? error.message
        : 'Unexpected error'
      : 'Unexpected error';
  return res.status(status).json({ error: { code, message } });
}
