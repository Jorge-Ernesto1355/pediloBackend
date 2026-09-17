import { Business, BusinessProps } from '../Entities/Business.js';

export interface BusinessRepository {
  create(input: CreateBusinessRepositoryInput): Promise<Business>;
  getById(id: string): Promise<Business | null>;
  getBySlug(slug: string): Promise<Business | null>;
  getByUserId(userId: string): Promise<Business | null>;
  list(skip: number, take: number): Promise<Business[]>;
  update(id: string, input: UpdateBusinessRepositoryInput): Promise<Business | null>;
  delete(id: string): Promise<boolean>;
}

export interface CreateBusinessRepositoryInput extends Omit<
  BusinessProps,
  'id' | 'createdAt' | 'updatedAt'
> {
  ownerUserId: string;
}

export type UpdateBusinessRepositoryInput = {
  [Key in keyof Omit<BusinessProps, 'id' | 'createdAt' | 'updatedAt'>]?:
    Omit<BusinessProps, 'id' | 'createdAt' | 'updatedAt'>[Key] | null;
};
