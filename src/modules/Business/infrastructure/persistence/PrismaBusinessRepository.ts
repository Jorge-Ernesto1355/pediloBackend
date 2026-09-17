import { Prisma, PrismaClient } from '@prisma/client';
import { Business, BusinessProps, BusinessScheduleDay } from '../../domain/Entities/Business.js';
import {
  BusinessAlreadyExistsError,
  UserAlreadyHasBusinessError,
} from '../../domain/errors/BusinessErrors.js';
import {
  BusinessRepository,
  CreateBusinessRepositoryInput,
  UpdateBusinessRepositoryInput,
} from '../../domain/ports/BusinessRepository.js';

export class PrismaBusinessRepository implements BusinessRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateBusinessRepositoryInput): Promise<Business> {
    try {
      const row = await this.prisma.$transaction(async (transaction) => {
        const user = await transaction.user.findUnique({ where: { id: input.ownerUserId } });
        if (!user || user.businessId) throw new UserAlreadyHasBusinessError();

        const business = await transaction.business.create({
          data: {
            name: input.name,
            slug: input.slug,
            description: input.description,
            logoUrl: input.logoUrl,
            coverUrl: input.coverUrl,
            ubication: input.ubication,
          },
        });

        if (input.ubicationMaps) {
          const ubicationMapsModel = await transaction.ubicationMaps.create({
            data: {
              businessId: business.id,
              latitude: input.ubicationMaps.latitude,
              longitude: input.ubicationMaps.longitude,
            },
          });

          await transaction.business.update({
            where: { id: business.id },
            data: { ubicationMapsId: ubicationMapsModel.id },
          });
        }

        if (input.businessSchedule) {
          const schedule = await transaction.businessSchedule.create({
            data: {
              businessId: business.id,
              days: toJsonDays(input.businessSchedule.days),
              openTime: input.businessSchedule.openTime,
              closeTime: input.businessSchedule.closeTime,
            },
          });
          await transaction.business.update({
            where: { id: business.id },
            data: { scheduleId: schedule.id },
          });
        }
        await transaction.user.update({
          where: { id: input.ownerUserId },
          data: { businessId: business.id },
        });
        await transaction.businessMember.create({
          data: { businessId: business.id, userId: input.ownerUserId, role: 'OWNER' },
        });
        return transaction.business.findUniqueOrThrow({
          where: { id: business.id },
          include: { businessSchedule: true, ubicationMaps: true },
        });
      });
      return this.toDomain(row);
    } catch (error) {
      if (isUniqueError(error)) throw new BusinessAlreadyExistsError();
      throw error;
    }
  }

  async getById(id: string): Promise<Business | null> {
    const row = await this.prisma.business.findUnique({
      where: { id },
      include: { businessSchedule: true, ubicationMaps: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async getBySlug(slug: string): Promise<Business | null> {
    const row = await this.prisma.business.findUnique({
      where: { slug },
      include: { businessSchedule: true, ubicationMaps: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async getByUserId(userId: string): Promise<Business | null> {
    const row = await this.prisma.business.findFirst({
      where: { users: { some: { id: userId } } },
      include: { businessSchedule: true, ubicationMaps: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async list(skip: number, take: number): Promise<Business[]> {
    const rows = await this.prisma.business.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: { businessSchedule: true, ubicationMaps: true },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async update(id: string, input: UpdateBusinessRepositoryInput): Promise<Business | null> {
    try {
      const row = await this.prisma.$transaction(async (transaction) => {
        const data: Prisma.BusinessUpdateInput = {};
        if (input.name !== undefined && input.name !== null) data.name = input.name;
        if (input.slug !== undefined && input.slug !== null) data.slug = input.slug;
        if (input.description !== undefined) data.description = input.description;
        if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl;
        if (input.coverUrl !== undefined) data.coverUrl = input.coverUrl;
        if (input.ubication !== undefined) data.ubication = input.ubication;
        if (input.ubicationMaps !== undefined) {
          data.ubicationMaps =
            input.ubicationMaps === null
              ? { delete: true }
              : {
                  upsert: {
                    create: {
                      latitude: input.ubicationMaps.latitude,
                      longitude: input.ubicationMaps.longitude,
                    },
                    update: {
                      latitude: input.ubicationMaps.latitude,
                      longitude: input.ubicationMaps.longitude,
                    },
                  },
                };
        }
        await transaction.business.update({ where: { id }, data });

        if (input.businessSchedule) {
          const scheduleData = {
            days: toJsonDays(input.businessSchedule.days),
            openTime: input.businessSchedule.openTime,
            closeTime: input.businessSchedule.closeTime,
          };
          const existingSchedule = await transaction.businessSchedule.findUnique({
            where: { businessId: id },
          });
          if (existingSchedule) {
            await transaction.businessSchedule.update({
              where: { id: existingSchedule.id },
              data: scheduleData,
            });
          } else {
            const schedule = await transaction.businessSchedule.create({
              data: { businessId: id, ...scheduleData },
            });
            await transaction.business.update({
              where: { id },
              data: { scheduleId: schedule.id },
            });
          }
        }

        return transaction.business.findUniqueOrThrow({
          where: { id },
          include: { businessSchedule: true, ubicationMaps: true },
        });
      });
      return this.toDomain(row);
    } catch (error) {
      if (isNotFoundError(error)) return null;
      if (isUniqueError(error)) throw new BusinessAlreadyExistsError();
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.user.updateMany({
          where: { businessId: id },
          data: { businessId: null },
        });
        await transaction.business.delete({ where: { id } });
      });
      return true;
    } catch (error) {
      if (isNotFoundError(error)) return false;
      throw error;
    }
  }

  private toDomain(
    row: Prisma.BusinessGetPayload<{ include: { businessSchedule: true; ubicationMaps: true } }>,
  ): Business {
    const props: BusinessProps = {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      logoUrl: row.logoUrl ?? undefined,
      coverUrl: row.coverUrl ?? undefined,
      ubication: row.ubication,
      ubicationMaps: row.ubicationMaps
        ? {
            latitude: row.ubicationMaps.latitude.toNumber(),
            longitude: row.ubicationMaps.longitude.toNumber(),
          }
        : undefined,
      businessSchedule: row.businessSchedule
        ? {
            days: fromJsonDays(row.businessSchedule.days),
            openTime: row.businessSchedule.openTime,
            closeTime: row.businessSchedule.closeTime,
          }
        : undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    return Business.create(props);
  }
}

function toJsonDays(days: BusinessScheduleDay[]): Prisma.InputJsonValue {
  return days as unknown as Prisma.InputJsonValue;
}

function fromJsonDays(value: Prisma.JsonValue): BusinessScheduleDay[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((day) => {
      if (typeof day !== 'object' || day === null || Array.isArray(day)) return false;
      const candidate = day as Record<string, Prisma.JsonValue>;
      return (
        typeof candidate.key === 'string' &&
        typeof candidate.label === 'string' &&
        typeof candidate.enabled === 'boolean'
      );
    })
    .map((day) => {
      const candidate = day as Record<string, Prisma.JsonValue>;
      return {
        key: candidate.key as string,
        label: candidate.label as string,
        enabled: candidate.enabled as boolean,
      };
    });
}

function isUniqueError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function isNotFoundError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}
