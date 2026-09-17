import { Category } from '../entities/Category.js';

export interface CreateCategoryRepositoryInput {
  ownerUserId: string;
  businessId: string;
  menuId: string;
  name: string;
  description?: string | null;
}

export interface UpdateCategoryRepositoryInput {
  name?: string;
  description?: string | null;
}

export interface ReorderCategoriesRepositoryInput {
  categoryIds: string[];
}

export interface CategoryRepository {
  create(input: CreateCategoryRepositoryInput): Promise<Category>;
  getById(ownerUserId: string, id: string): Promise<Category | null>;
  update(
    ownerUserId: string,
    id: string,
    input: UpdateCategoryRepositoryInput,
  ): Promise<Category | null>;
  delete(ownerUserId: string, id: string): Promise<boolean>;
  setActive(ownerUserId: string, id: string, isActive: boolean): Promise<Category | null>;
  reorder(
    ownerUserId: string,
    menuId: string,
    input: ReorderCategoriesRepositoryInput,
  ): Promise<Category[]>;
  moveAllAndDelete(
    ownerUserId: string,
    sourceCategoryId: string,
    targetCategoryId: string,
  ): Promise<void>;
}
