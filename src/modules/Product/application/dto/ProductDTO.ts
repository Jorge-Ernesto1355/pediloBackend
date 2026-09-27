export interface CreateProductDTO {
  categoryId: string;
  name: string;
  description?: string | null;
  price: number;
  isAvailable?: boolean;
  imageUrl?: string | null;
  imageFile?: import('../../domain/entities/ProductImage.js').ProductImageFile;
}

export interface UpdateProductDTO {
  name?: string;
  description?: string | null;
  price?: number;
  imageUrl?: string | null;
  categoryId?: string;
  isAvailable?: boolean;
  imageFile?: import('../../domain/entities/ProductImage.js').ProductImageFile;
  sortOrder?: number;
}

export interface ProductListDTO {
  businessId?: string;
  categoryId?: string;
  isAvailable?: boolean;
}
