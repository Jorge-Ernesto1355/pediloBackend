import { detectBank, isValidClabe } from '@/shared/validation/clabe.js';

export type PaymentCardValues = {
  id: string;
  businessId: string;
  clabe: string;
  beneficiaryName: string;
  bankCode: string;
  bankName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function validatePaymentCardInput(clabe: string, beneficiaryName: string) {
  const normalizedBeneficiary = beneficiaryName.trim();
  if (!isValidClabe(clabe)) throw new Error('INVALID_CLABE');
  if (!normalizedBeneficiary || normalizedBeneficiary.length > 80) {
    throw new Error('INVALID_BENEFICIARY_NAME');
  }
  return { clabe, beneficiaryName: normalizedBeneficiary, bank: detectBank(clabe) };
}

export function toPaymentCardDto(card: PaymentCardValues) {
  return {
    id: card.id,
    businessId: card.businessId,
    clabe: card.clabe,
    beneficiaryName: card.beneficiaryName,
    bankCode: card.bankCode,
    bankName: card.bankName,
    isActive: card.isActive,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  };
}
