export interface CategoryProps {
  id: string;
  businessId: string;
  menuId: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Category {
  private constructor(private readonly props: CategoryProps) {}

  static create(props: CategoryProps): Category {
    return new Category(props);
  }

  toJSON(): CategoryProps {
    return { ...this.props };
  }
}
