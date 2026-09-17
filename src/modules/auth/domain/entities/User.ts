export interface UserProps {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: Date;
  businessId?: string | null;
}

export class User {
  private constructor(private readonly props: UserProps) {}

  public static create(props: UserProps) {
    return new User(props);
  }

  public getId() {
    return this.props.id;
  }

  public getEmail() {
    return this.props.email;
  }

  public getName() {
    return this.props.name;
  }

  public isEmailVerified() {
    return this.props.emailVerified;
  }

  public getCreatedAt() {
    return this.props.createdAt;
  }

  public getBusinessId() {
    return this.props.businessId;
  }

  toJSON() {
    return {
      id: this.props.id,
      email: this.props.email,
      name: this.props.name,
      emailVerified: this.props.emailVerified,
      createdAt: this.props.createdAt,
      businessId: this.props.businessId,
    };
  }
}
