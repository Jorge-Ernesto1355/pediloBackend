export interface CustomerProps {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
  orderCount?: number;
}
export class Customer {
  private constructor(private readonly props: CustomerProps) {}
  static create(props: CustomerProps): Customer {
    return new Customer(props);
  }
  toJSON(): CustomerProps {
    return { ...this.props };
  }
}
