export interface ComboOptionProductView {
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
    category: { id: string; name: string; menuId: string };
  };
}

export interface ComboOptionGroupView {
  id: string;
  businessId: string;
  comboProductId: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  products: ComboOptionProductView[];
}

export interface ComboIncludedProductView {
  id: string;
  productId: string;
  sortOrder: number;
  product: ComboOptionProductView['product'];
}

export interface ComboProductView {
  id: string;
  businessId: string;
  categoryId: string;
  type: 'COMBO';
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  category: { id: string; name: string; menuId: string };
  optionGroups: ComboOptionGroupView[];
  includedProducts: ComboIncludedProductView[];
}

export interface CreateComboOptionGroupInput {
  name: string;
  minSelections: number;
  maxSelections: number;
  productIds: string[];
}

export interface UpdateComboOptionGroupInput {
  name?: string;
  minSelections?: number;
  maxSelections?: number;
}

export interface ComboOptionRepository {
  createGroup(
    ownerUserId: string,
    comboProductId: string,
    input: CreateComboOptionGroupInput,
  ): Promise<ComboOptionGroupView>;
  getCombo(ownerUserId: string, comboProductId: string): Promise<ComboProductView | null>;
  updateGroup(
    ownerUserId: string,
    comboProductId: string,
    groupId: string,
    input: UpdateComboOptionGroupInput,
  ): Promise<ComboOptionGroupView | null>;
  addProduct(
    ownerUserId: string,
    comboProductId: string,
    groupId: string,
    productId: string,
  ): Promise<ComboOptionProductView>;
  removeProduct(
    ownerUserId: string,
    comboProductId: string,
    groupId: string,
    productId: string,
  ): Promise<boolean>;
  deleteGroup(ownerUserId: string, comboProductId: string, groupId: string): Promise<boolean>;
  addIncludedProduct(
    ownerUserId: string,
    comboProductId: string,
    productId: string,
  ): Promise<ComboIncludedProductView>;
  removeIncludedProduct(
    ownerUserId: string,
    comboProductId: string,
    includedProductId: string,
  ): Promise<boolean>;
}
