export interface MenuCategorySummary {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
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
      categories: this.props.categories.map((category) => ({ ...category })),
    };
  }
}
