export interface CreateCategoryDTO {
  name: string;
  menuId: string;
  description?: string | null;
}

export interface UpdateCategoryDTO {
  name?: string;
  description?: string | null;
}

export interface ReorderCategoriesDTO {
  categoryIds: string[];
}
