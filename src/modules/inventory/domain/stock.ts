export type StockLevel = 'OK' | 'LOW' | 'CRITICAL' | 'OUT';
export type LowStockMode = 'PERCENT' | 'ABSOLUTE';
export type StockBlockMode = 'NONE' | 'OUT_OF_STOCK' | 'LOW_STOCK';

export type ThresholdInput = {
  parLevel: number;
  mode: LowStockMode;
  /** PERCENT: % of parLevel. ABSOLUTE: quantity. null falls back to the default. */
  value: number | null;
  defaultPercent: number;
};

const SEVERITY: Record<StockLevel, number> = { OK: 0, LOW: 1, CRITICAL: 2, OUT: 3 };

/** Quantities are stored with 3 decimals; round after arithmetic to avoid float drift. */
export function roundQuantity(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Stock at or below this value is "low". 0 means only an empty stock alerts. */
export function lowStockThreshold({
  parLevel,
  mode,
  value,
  defaultPercent,
}: ThresholdInput): number {
  if (mode === 'ABSOLUTE') return Math.max(0, value ?? 0);
  const percent = value ?? defaultPercent;
  return roundQuantity((Math.max(0, parLevel) * Math.max(0, percent)) / 100);
}

/** OUT at or below 0, CRITICAL at or below half the threshold, LOW at or below the threshold. */
export function computeStockLevel(stock: number, threshold: number): StockLevel {
  if (stock <= 0) return 'OUT';
  if (threshold <= 0) return 'OK';
  if (stock <= threshold / 2) return 'CRITICAL';
  if (stock <= threshold) return 'LOW';
  return 'OK';
}

export function isWorseLevel(next: StockLevel, previous: StockLevel): boolean {
  return SEVERITY[next] > SEVERITY[previous];
}

/**
 * Share of the available quantity that was used inside the window:
 * consumed / (stock now + consumed). Returns 0 when nothing was consumed.
 */
export function consumptionShare(consumedInWindow: number, stock: number): number {
  const consumed = Math.max(0, consumedInWindow);
  const base = Math.max(0, stock) + consumed;
  if (consumed <= 0 || base <= 0) return 0;
  return (consumed / base) * 100;
}

export function isHighConsumption(
  consumedInWindow: number,
  stock: number,
  percent: number,
): boolean {
  if (percent <= 0) return false;
  return consumptionShare(consumedInWindow, stock) >= percent;
}

export type RecipeLine = { ingredientId: string; quantity: number };

export type OrderedLine = {
  productId: string;
  quantity: number;
  /** One entry per selected option occurrence (a repeated option appears repeatedly). */
  options: { productOptionId?: string | null; globalOptionId?: string | null }[];
};

export type RecipeBook = {
  byProduct: Map<string, RecipeLine[]>;
  byProductOption: Map<string, RecipeLine[]>;
  byGlobalOption: Map<string, RecipeLine[]>;
};

/** Total ingredient quantities needed to fulfil the given order lines. */
export function aggregateRequirements(
  lines: OrderedLine[],
  recipes: RecipeBook,
): Map<string, number> {
  const totals = new Map<string, number>();
  const add = (recipe: RecipeLine[] | undefined, times: number) => {
    for (const { ingredientId, quantity } of recipe ?? [])
      totals.set(ingredientId, (totals.get(ingredientId) ?? 0) + quantity * times);
  };
  for (const line of lines) {
    add(recipes.byProduct.get(line.productId), line.quantity);
    for (const option of line.options) {
      if (option.productOptionId)
        add(recipes.byProductOption.get(option.productOptionId), line.quantity);
      if (option.globalOptionId)
        add(recipes.byGlobalOption.get(option.globalOptionId), line.quantity);
    }
  }
  for (const [id, quantity] of totals) totals.set(id, roundQuantity(quantity));
  return totals;
}

/** An alert that was just opened or escalated and should reach the dashboards live. */
export type StockAlertNotice = {
  alertId: string;
  businessId: string;
  ingredientId: string;
  ingredientName: string;
  unit: 'G' | 'ML' | 'UNIT';
  kind: 'STOCK' | 'CONSUMPTION';
  level: 'LOW' | 'CRITICAL' | 'OUT' | 'HIGH';
  stock: number;
  threshold: number;
  createdAt: Date;
};
