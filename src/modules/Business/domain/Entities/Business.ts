export interface BusinessProps {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string;
  coverUrl?: string;
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
    return this.props.logoUrl;
  }

  public get coverUrl(): string | undefined {
    return this.props.coverUrl;
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
