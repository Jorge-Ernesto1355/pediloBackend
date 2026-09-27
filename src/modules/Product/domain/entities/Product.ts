import { InvalidProductDataError } from '../errors/ProductErrors.js';

export interface ProductOptionProps {
  id: string;
  optionGroupId: string;
  name: string;
  price: number;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductOptionGroupProps {
  id: string;
  productId: string;
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  isActive: boolean;
  options: ProductOptionProps[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductProps {
  id: string;
  businessId: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  imageBlurUrl?: string | null;
  sortOrder: number;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
  optionGroups?: ProductOptionGroupProps[];
  category?: { id: string; name: string; description: string | null; menuId: string };
}

export class Product {
  private constructor(private readonly props: ProductProps) {}

  static create(props: ProductProps): Product {
    if (!props.name.trim() || !Number.isFinite(props.price) || props.price < 0) {
      throw new InvalidProductDataError();
    }
    return new Product(props);
  }
  toJSON(): ProductProps {
    return {
      ...this.props,
      optionGroups:
        this.props.optionGroups?.map((group) => ({
          ...group,
          options: group.options.map((option) => ({ ...option })),
        })) ?? [],
    };
  }
}
