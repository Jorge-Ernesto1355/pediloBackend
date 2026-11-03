export interface MenuCategorySummary {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  products: MenuProduct[];
}

export interface MenuProductOption {
  id: string;
  optionGroupId: string;
  name: string;
  price: number;
  minSelections: number;
  maxSelections: number;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MenuProductOptionGroup {
  id: string;
  productId: string;
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  isActive: boolean;
  options: MenuProductOption[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MenuComboComponent {
  id: string;
  productId: string;
  sortOrder: number;
  product: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    imageUrl: string | null;
    categoryId: string;
    isAvailable: boolean;
  };
}

export interface MenuComboOptionGroup {
  id: string;
  comboProductId: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  products: MenuComboComponent[];
}

export interface MenuProduct {
  id: string;
  businessId: string;
  categoryId: string;
  type: 'PRODUCT' | 'COMBO';
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  imageBlurUrl: string | null;
  sortOrder: number;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
  optionGroups: MenuProductOptionGroup[];
  includedProducts: MenuComboComponent[];
  comboOptionGroups: MenuComboOptionGroup[];
}

export interface MenuProps {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  categories: MenuCategorySummary[];
  createdAt: Date;
  updatedAt: Date;
}

export class Menu {
  private constructor(private readonly props: MenuProps) {}

  static create(props: MenuProps): Menu {
    return new Menu(props);
  }

  toJSON(): MenuProps {
    return {
      ...this.props,
      categories: this.props.categories.map((category) => ({
        ...category,
        products: category.products.map((product) => ({
          ...product,
          includedProducts: product.includedProducts.map((included) => ({ ...included })),
          comboOptionGroups: product.comboOptionGroups.map((group) => ({
            ...group,
            products: group.products.map((choice) => ({ ...choice })),
          })),
          optionGroups: product.optionGroups.map((group) => ({
            ...group,
            options: group.options.map((option) => ({ ...option })),
          })),
        })),
      })),
    };
  }
}
