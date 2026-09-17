import { BusinessCoordinates, BusinessSchedule } from '../../domain/Entities/Business.js';

export interface CreateBusinessDTO {
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string;
  coverUrl?: string;
  ubication?: string | null;
  ubicationMaps?: BusinessCoordinates | null;
  businessSchedule?: BusinessSchedule;
}

export interface UpdateBusinessDTO {
  name?: string;
  slug?: string;
  description?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  ubication?: string | null;
  ubicationMaps?: BusinessCoordinates | null;
  businessSchedule?: BusinessSchedule;
}
