import { Prisma, PrismaClient } from '@prisma/client';
import { Customer, CustomerProps } from '../../domain/entities/Customer.js';
import { CustomerRepository } from '../../application/ports/CustomerRepository.js';
import {
  CreateCustomerDTO,
  ListCustomersDTO,
  UpdateCustomerDTO,
} from '../../application/dto/CustomerDTO.js';
import {
  CustomerBusinessAccessError,
  CustomerBusinessNotFoundError,
  CustomerHasOrdersError,
  CustomerPhoneAlreadyExistsError,
} from '../../domain/errors/CustomerErrors.js';

export class PrismaCustomerRepository implements CustomerRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async create(
    ownerUserId: string,
    businessId: string,
    input: CreateCustomerDTO,
  ): Promise<Customer> {
    await this.assertAccess(ownerUserId, businessId);
    try {
      const existing = await this.prisma.customer.findFirst({
        where: { businessId, phone: input.phone },
      });
      if (existing) throw new CustomerPhoneAlreadyExistsError();
      const row = await this.prisma.customer.create({
        data: { businessId, name: input.name, phone: input.phone },
      });
      return toDomain(row);
    } catch (error) {
      if (isUniqueError(error)) throw new CustomerPhoneAlreadyExistsError();
      throw error;
    }
  }
  async getById(ownerUserId: string, customerId: string): Promise<Customer | null> {
    const row = await this.prisma.customer.findFirst({
      where: { id: customerId, business: { users: { some: { id: ownerUserId } } } },
      include: { _count: { select: { orders: true } } },
    });
    return row ? toDomain(row) : null;
  }
  async list(
    ownerUserId: string,
    input: ListCustomersDTO,
  ): Promise<{ customers: Customer[]; total: number }> {
    await this.assertAccess(ownerUserId, input.businessId);
    const where = {
      businessId: input.businessId,
      business: { users: { some: { id: ownerUserId } } },
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: 'insensitive' as const } },
              { phone: { contains: input.search } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        include: { _count: { select: { orders: true } } },
        orderBy: { updatedAt: 'desc' },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { customers: rows.map(toDomain), total };
  }
  async update(
    ownerUserId: string,
    customerId: string,
    input: UpdateCustomerDTO,
  ): Promise<Customer | null> {
    const existing = await this.getById(ownerUserId, customerId);
    if (!existing) return null;
    if (input.phone && input.phone !== existing.toJSON().phone) {
      const conflict = await this.prisma.customer.findFirst({
        where: {
          businessId: existing.toJSON().businessId,
          phone: input.phone,
          NOT: { id: customerId },
        },
        select: { id: true },
      });
      if (conflict) throw new CustomerPhoneAlreadyExistsError();
    }
    try {
      const row = await this.prisma.customer.update({
        where: { id: customerId },
        data: input,
        include: { _count: { select: { orders: true } } },
      });
      return toDomain(row);
    } catch (error) {
      if (isUniqueError(error)) throw new CustomerPhoneAlreadyExistsError();
      throw error;
    }
  }
  async delete(ownerUserId: string, customerId: string): Promise<boolean> {
    const existing = await this.getById(ownerUserId, customerId);
    if (!existing) return false;
    if ((existing.toJSON().orderCount ?? 0) > 0) throw new CustomerHasOrdersError();
    await this.prisma.customer.delete({ where: { id: customerId } });
    return true;
  }
  private async assertAccess(ownerUserId: string, businessId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { businessId: true },
    });
    if (!user?.businessId) throw new CustomerBusinessNotFoundError();
    if (user.businessId !== businessId) throw new CustomerBusinessAccessError();
  }
}

function isUniqueError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function toDomain(row: {
  id: string;
  businessId: string;
  name: string | null;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { orders: number };
}): Customer {
  const props: CustomerProps = {
    id: row.id,
    businessId: row.businessId,
    name: row.name ?? '',
    phone: row.phone,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    orderCount: row._count?.orders,
  };
  return Customer.create(props);
}
