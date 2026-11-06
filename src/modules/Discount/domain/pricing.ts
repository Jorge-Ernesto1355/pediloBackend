export type PricingDiscount = { id: string; name?: string; type: 'PERCENT' | 'FIXED'; value: number; startsAt: Date; endsAt: Date; createdAt: Date };
export type PricingProduct = { id: string; price: number; categoryId: string; menuId?: string };
export type PricingTarget = { scope: 'PRODUCTS' | 'CATEGORIES' | 'MENU'; productIds?: string[]; categoryIds?: string[]; menuIds?: string[] };
export function isActive(discount: PricingDiscount, now: Date, hasTargets = true) { return hasTargets && discount.startsAt.getTime() <= now.getTime() && now.getTime() < discount.endsAt.getTime(); }
export function resolveAffectedProducts(products: PricingProduct[], target: PricingTarget) { const productIds = new Set(target.productIds ?? []); const categoryIds = new Set(target.categoryIds ?? []); const menuIds = new Set(target.menuIds ?? []); return products.filter((product) => target.scope === 'MENU' ? (menuIds.size === 0 || (product.menuId !== undefined && menuIds.has(product.menuId))) : target.scope === 'PRODUCTS' ? productIds.has(product.id) : categoryIds.has(product.categoryId)); }
export function appliesTo(product: PricingProduct, target: PricingTarget) { return target.scope === 'MENU' ? (target.menuIds?.length ? Boolean(product.menuId && target.menuIds.includes(product.menuId)) : true) : (target.scope === 'PRODUCTS' ? target.productIds?.includes(product.id) : target.categoryIds?.includes(product.categoryId)) === true; }
export function priceWithDiscount(price: number, discount: Pick<PricingDiscount, 'type' | 'value'>) {
  const cents = Math.max(0, Math.round(price * 100));
  if (discount.type === 'PERCENT') {
    const percent = Math.min(100, Math.max(0, Math.round(discount.value)));
    return Math.round((cents * (100 - percent)) / 100) / 100;
  }
  const fixedCents = Math.max(0, Math.round(discount.value * 100));
  return Math.max(0, cents - fixedCents) / 100;
}
export function bestDiscountFor(product: PricingProduct, discounts: Array<PricingDiscount & { target: PricingTarget }>, now: Date) { const candidates = discounts.filter((discount) => isActive(discount, now) && appliesTo(product, discount.target)); return candidates.reduce<PricingDiscount | null>((latest, discount) => !latest || discount.createdAt.getTime() > latest.createdAt.getTime() ? discount : latest, null); }
export function formatLabel(discount: Pick<PricingDiscount, 'type' | 'value'>) { return discount.type === 'PERCENT' ? `-${discount.value}%` : `-$${discount.value.toFixed(2)}`; }
export function findConflicts(affectedProductIds: string[], current: Array<{ discount: PricingDiscount; productIds: string[] }>, excludeId?: string) { const affected = new Set(affectedProductIds); return current.filter(({ discount, productIds }) => discount.id !== excludeId && productIds.some((id) => affected.has(id))); }
