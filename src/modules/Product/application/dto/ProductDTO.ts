export interface CreateProductDTO {
  categoryId: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
}

export interface UpdateProductDTO {
  name?: string;
  description?: string | null;
  price?: number;
  imageUrl?: string | null;
  sortOrder?: number;
}

export interface ProductListDTO {
  businessId?: string;
  categoryId?: string;
  isAvailable?: boolean;
}
