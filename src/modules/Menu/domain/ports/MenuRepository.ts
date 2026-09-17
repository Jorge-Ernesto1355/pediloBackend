import { Menu } from '../entities/Menu.js';

export interface CreateMenuCategoryRepositoryInput {
  name: string;
  description?: string | null;
  isActive?: boolean;
}

export interface CreateMenuRepositoryInput {
  ownerUserId: string;
  businessId: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  categories?: CreateMenuCategoryRepositoryInput[];
}

export interface UpdateMenuRepositoryInput {
  name?: string;
  description?: string | null;
}

export interface MenuRepository {
  create(input: CreateMenuRepositoryInput): Promise<Menu>;
  getById(ownerUserId: string, id: string): Promise<Menu | null>;
  list(ownerUserId: string, businessId?: string): Promise<Menu[]>;
  update(ownerUserId: string, id: string, input: UpdateMenuRepositoryInput): Promise<Menu | null>;
  delete(ownerUserId: string, id: string): Promise<boolean>;
  setActive(ownerUserId: string, id: string, isActive: boolean): Promise<Menu | null>;
}
