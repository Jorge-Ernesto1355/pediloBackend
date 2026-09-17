export interface CreateMenuCategoryDTO {
  name: string;
  description?: string | null;
  isActive?: boolean;
}

export interface CreateMenuDTO {
  name: string;
  description?: string | null;
  isActive?: boolean;
  categories?: CreateMenuCategoryDTO[];
}

export interface UpdateMenuDTO {
  name?: string;
  description?: string | null;
}
