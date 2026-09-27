import { BusinessCoordinates, BusinessSchedule } from '../../domain/Entities/Business.js';
import { BusinessImageFile } from '../../domain/Entities/BusinessImage.js';

export interface CreateBusinessDTO {
  name: string;
  slug: string;
  description?: string | null;
  logoFile?: BusinessImageFile;
  coverFile?: BusinessImageFile;
  ubication?: string | null;
  ubicationMaps?: BusinessCoordinates | null;
  businessSchedule?: BusinessSchedule;
}

export interface UpdateBusinessDTO {
  name?: string;
  slug?: string;
  description?: string | null;
  logoFile?: BusinessImageFile;
  coverFile?: BusinessImageFile;
  ubication?: string | null;
  ubicationMaps?: BusinessCoordinates | null;
  businessSchedule?: BusinessSchedule;
}
