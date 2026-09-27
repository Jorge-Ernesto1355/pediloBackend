import { Request, Response } from 'express';
import { CreateCustomer } from '../../application/useCases/CreateCustomer.js';
import { DeleteCustomer } from '../../application/useCases/DeleteCustomer.js';
import { GetCustomer } from '../../application/useCases/GetCustomer.js';
import { ListCustomers } from '../../application/useCases/ListCustomers.js';
import { UpdateCustomer } from '../../application/useCases/UpdateCustomer.js';
import {
  businessIdSchema,
  customerIdSchema,
  customerListSchema,
  customerSchema,
  updateCustomerSchema,
} from './customer.schemas.js';

export class CustomerController {
  constructor(
    private readonly createCustomer: CreateCustomer,
    private readonly getCustomer: GetCustomer,
    private readonly listCustomers: ListCustomers,
    private readonly updateCustomer: UpdateCustomer,
    private readonly deleteCustomer: DeleteCustomer,
  ) {}
  create = (req: Request, res: Response) => {
    const params = businessIdSchema.safeParse(req.params);
    const body = customerSchema.safeParse(req.body);
    if (!params.success) return bad(res, params.error);
    if (!body.success) return bad(res, body.error);
    return this.createCustomer
      .execute(req.user!.id, params.data.businessId, body.data)
      .then((customer) => res.status(201).json({ customer: customer.toJSON() }))
      .catch((error) => handle(res, error));
  };
  get = (req: Request, res: Response) => {
    const params = customerIdSchema.safeParse(req.params);
    if (!params.success) return bad(res, params.error);
    return this.getCustomer
      .execute(req.user!.id, params.data.customerId)
      .then((customer) => res.json({ customer: customer.toJSON() }))
      .catch((error) => handle(res, error));
  };
  list = (req: Request, res: Response) => {
    const params = businessIdSchema.safeParse(req.params);
    const query = customerListSchema.safeParse(req.query);
    if (!params.success) return bad(res, params.error);
    if (!query.success) return bad(res, query.error);
    return this.listCustomers
      .execute(req.user!.id, { businessId: params.data.businessId, ...query.data })
      .then(({ customers, total }) =>
        res.json({
          customers: customers.map((customer) => customer.toJSON()),
          page: query.data.page,
          limit: query.data.limit,
          total,
        }),
      )
      .catch((error) => handle(res, error));
  };
  update = (req: Request, res: Response) => {
    const params = customerIdSchema.safeParse(req.params);
    const body = updateCustomerSchema.safeParse(req.body);
    if (!params.success) return bad(res, params.error);
    if (!body.success) return bad(res, body.error);
    return this.updateCustomer
      .execute(req.user!.id, params.data.customerId, body.data)
      .then((customer) => res.json({ customer: customer.toJSON() }))
      .catch((error) => handle(res, error));
  };
  remove = (req: Request, res: Response) => {
    const params = customerIdSchema.safeParse(req.params);
    if (!params.success) return bad(res, params.error);
    return this.deleteCustomer
      .execute(req.user!.id, params.data.customerId)
      .then(() => res.status(204).send())
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
  const status =
    error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : 500;
  const code =
    error && typeof error === 'object' && 'code' in error ? String(error.code) : 'INTERNAL_ERROR';
  const message = error instanceof Error ? error.message : 'Unexpected error';
  return res.status(status).json({ error: { code, message } });
}
