import { ProductOptionGroupProps, ProductOptionProps } from '../entities/Product.js';

export interface CreateOptionGroupRepositoryInput {
  ownerUserId: string;
  productId: string;
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  isActive: boolean;
  options: CreateOptionRepositoryInput[];
}

export interface CreateOptionRepositoryInput {
  name: string;
  price: number;
  isAvailable: boolean;
}

export interface UpdateOptionGroupRepositoryInput {
  name?: string;
  isRequired?: boolean;
  minSelections?: number;
  maxSelections?: number;
}

export interface UpdateOptionRepositoryInput {
  name?: string;
  price?: number;
}

export interface ProductOptionRepository {
  createGroup(input: CreateOptionGroupRepositoryInput): Promise<ProductOptionGroupProps>;
  getGroup(ownerUserId: string, groupId: string): Promise<ProductOptionGroupProps | null>;
  listGroups(ownerUserId: string, productId: string): Promise<ProductOptionGroupProps[]>;
  updateGroup(
    ownerUserId: string,
    groupId: string,
    input: UpdateOptionGroupRepositoryInput,
  ): Promise<ProductOptionGroupProps | null>;
  deleteGroup(ownerUserId: string, groupId: string): Promise<boolean>;
  setGroupActive(
    ownerUserId: string,
    groupId: string,
    isActive: boolean,
  ): Promise<ProductOptionGroupProps | null>;
  reorderGroups(
    ownerUserId: string,
    productId: string,
    groupIds: string[],
  ): Promise<ProductOptionGroupProps[]>;
  createOption(
    ownerUserId: string,
    groupId: string,
    input: CreateOptionRepositoryInput,
  ): Promise<ProductOptionProps>;
  getOption(ownerUserId: string, optionId: string): Promise<ProductOptionProps | null>;
  listOptions(ownerUserId: string, groupId: string): Promise<ProductOptionProps[]>;
  updateOption(
    ownerUserId: string,
    optionId: string,
    input: UpdateOptionRepositoryInput,
  ): Promise<ProductOptionProps | null>;
  deleteOption(ownerUserId: string, optionId: string): Promise<boolean>;
  setOptionAvailable(
    ownerUserId: string,
    optionId: string,
    isAvailable: boolean,
  ): Promise<ProductOptionProps | null>;
  reorderOptions(
    ownerUserId: string,
    groupId: string,
    optionIds: string[],
  ): Promise<ProductOptionProps[]>;
}
