export interface PublicBusinessCatalog {
  business: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logoUrl: string | null;
    logoBlurUrl: string | null;
    coverUrl: string | null;
    coverBlurUrl: string | null;
    ubication: string | null;
    ubicationMaps: { latitude: number; longitude: number } | null;
    businessSchedule: {
      days: unknown;
      openTime: string;
      closeTime: string;
      isClosed: boolean;
    } | null;
  };
  menus: PublicMenu[];
}

export interface PublicMenu {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  categories: PublicCategory[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicCategory {
  id: string;
  businessId: string;
  menuId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  products: PublicProduct[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicProduct {
  id: string;
  businessId: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  sortOrder: number;
  isAvailable: boolean;
  optionGroups: PublicOptionGroup[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicOptionGroup {
  id: string;
  productId: string;
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  isActive: boolean;
  options: PublicOption[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicOption {
  id: string;
  optionGroupId: string;
  name: string;
  price: number;
  sortOrder: number;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicBusinessRepository {
  getCatalogBySlug(slug: string): Promise<PublicBusinessCatalog | null>;
}
