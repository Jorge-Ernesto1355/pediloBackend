export type ComboSelectionGroup = {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  products: Array<{
    id: string;
    productId: string;
    name: string;
    isAvailable: boolean;
  }>;
};

export type ResolvedComboSelection = {
  name: string;
  groupName: string;
  price: number;
};

export function resolveComboSelections(
  groups: ComboSelectionGroup[],
  selectedIds: string[],
): ResolvedComboSelection[] | null {
  const selected = new Set(selectedIds);
  if (selected.size !== selectedIds.length) return null;

  const resolved: ResolvedComboSelection[] = [];
  for (const group of groups) {
    const selectedInGroup = group.products.filter((choice) => selected.has(choice.id));
    if (
      selectedInGroup.length < group.minSelections ||
      selectedInGroup.length > group.maxSelections ||
      selectedInGroup.some((choice) => !choice.isAvailable)
    )
      return null;
    resolved.push(
      ...selectedInGroup.map((choice) => ({
        name: choice.name,
        groupName: group.name,
        price: 0,
      })),
    );
  }

  const known = new Set(groups.flatMap((group) => group.products.map((choice) => choice.id)));
  if (selectedIds.some((id) => !known.has(id))) return null;
  return resolved;
}
