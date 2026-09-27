import { Product } from '../entities/Product.js';

export interface CreateProductRepositoryInput {
  ownerUserId: string;
  businessId: string;
  categoryId: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  imageBlurUrl?: string | null;
  imagePublicId?: string | null;
  isAvailable?: boolean;
}

export interface ProductListFilters {
  businessId?: string;
  categoryId?: string;
  isAvailable?: boolean;
}

export interface UpdateProductRepositoryInput {
  name?: string;
  description?: string | null;
  price?: number;
  imageUrl?: string | null;
  imageBlurUrl?: string | null;
  imagePublicId?: string | null;
  categoryId?: string;
  isAvailable?: boolean;
  sortOrder?: number;
}

export interface ProductRepository {
  create(input: CreateProductRepositoryInput): Promise<Product>;
  getById(ownerUserId: string, productId: string): Promise<Product | null>;
  list(ownerUserId: string, filters: ProductListFilters): Promise<Product[]>;
  getImage?: (ownerUserId: string, productId: string) => Promise<{ publicId: string } | null>;
  saveImage?: (
    ownerUserId: string,
    productId: string,
    image: { url: string; publicId: string; blurUrl: string },
  ) => Promise<void>;
  update(
    ownerUserId: string,
    productId: string,
    input: UpdateProductRepositoryInput,
  ): Promise<Product | null>;
  delete(ownerUserId: string, productId: string): Promise<boolean>;
  setAvailable(
    ownerUserId: string,
    productId: string,
    isAvailable: boolean,
  ): Promise<Product | null>;
  moveToCategory(
    ownerUserId: string,
    productId: string,
    targetCategoryId: string,
  ): Promise<Product>;
  reorder(ownerUserId: string, categoryId: string, productIds: string[]): Promise<Product[]>;
}
