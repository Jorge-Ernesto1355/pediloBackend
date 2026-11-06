import {
  ComboOptionGroupView,
  ComboOptionRepository,
  ComboProductView,
  CreateComboOptionGroupInput,
  UpdateComboOptionGroupInput,
} from '../ports/ComboOptionRepository.js';

export class ManageComboOptions {
  constructor(private readonly repository: ComboOptionRepository) {}

  createGroup(ownerUserId: string, productId: string, input: CreateComboOptionGroupInput) {
    return this.repository.createGroup(ownerUserId, productId, input);
  }

  getCombo(ownerUserId: string, productId: string): Promise<ComboProductView | null> {
    return this.repository.getCombo(ownerUserId, productId);
  }

  updateGroup(
    ownerUserId: string,
    productId: string,
    groupId: string,
    input: UpdateComboOptionGroupInput,
  ): Promise<ComboOptionGroupView | null> {
    return this.repository.updateGroup(ownerUserId, productId, groupId, input);
  }

  addProduct(ownerUserId: string, productId: string, groupId: string, choiceProductId: string) {
    return this.repository.addProduct(ownerUserId, productId, groupId, choiceProductId);
  }

  addIncludedProduct(ownerUserId: string, comboProductId: string, productId: string) {
    return this.repository.addIncludedProduct(ownerUserId, comboProductId, productId);
  }

  updateIncludedProductQuantity(
    ownerUserId: string,
    comboProductId: string,
    includedProductId: string,
    quantity: number,
  ) {
    return this.repository.updateIncludedProductQuantity(
      ownerUserId,
      comboProductId,
      includedProductId,
      quantity,
    );
  }

  removeIncludedProduct(ownerUserId: string, comboProductId: string, productId: string) {
    return this.repository.removeIncludedProduct(ownerUserId, comboProductId, productId);
  }

  removeProduct(
    ownerUserId: string,
    productId: string,
    groupId: string,
    choiceProductId: string,
  ): Promise<boolean> {
    return this.repository.removeProduct(ownerUserId, productId, groupId, choiceProductId);
  }

  deleteGroup(ownerUserId: string, productId: string, groupId: string): Promise<boolean> {
    return this.repository.deleteGroup(ownerUserId, productId, groupId);
  }
}
