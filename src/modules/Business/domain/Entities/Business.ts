export interface BusinessProps {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  logoBlurUrl?: string | null;
  coverUrl?: string | null;
  coverBlurUrl?: string | null;
  ubication?: string | null;
  ubicationMaps?: BusinessCoordinates | null;
  businessSchedule?: BusinessSchedule;
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessScheduleDay {
  key: string;
  label: string;
  enabled: boolean;
}

export interface BusinessSchedule {
  days: BusinessScheduleDay[];
  openTime: string;
  closeTime: string;
}

export interface BusinessCoordinates {
  latitude: number;
  longitude: number;
}

export class Business {
  private constructor(private readonly props: BusinessProps) {}

  public static create(props: BusinessProps): Business {
    return new Business(props);
  }

  public get id(): string {
    return this.props.id;
  }

  public get name(): string {
    return this.props.name;
  }

  public get slug(): string {
    return this.props.slug;
  }

  public get description(): string | null | undefined {
    return this.props.description;
  }

  public get logoUrl(): string | undefined {
    return this.props.logoUrl ?? undefined;
  }

  public get coverUrl(): string | undefined {
    return this.props.coverUrl ?? undefined;
  }

  public get logoBlurUrl(): string | undefined {
    return this.props.logoBlurUrl ?? undefined;
  }

  public get coverBlurUrl(): string | undefined {
    return this.props.coverBlurUrl ?? undefined;
  }

  public get ubication(): string | null | undefined {
    return this.props.ubication;
  }

  public get ubicationMaps(): BusinessCoordinates | null | undefined {
    return this.props.ubicationMaps;
  }

  public get businessSchedule(): BusinessSchedule | undefined {
    return this.props.businessSchedule;
  }

  public toJSON(): BusinessProps {
    return { ...this.props };
  }
}
