export interface CreateOptionDTO {
  name: string;
  price?: number;
  isAvailable?: boolean;
}

export interface CreateOptionGroupDTO {
  name: string;
  isRequired?: boolean;
  minSelections?: number;
  maxSelections?: number;
  isActive?: boolean;
  options?: CreateOptionDTO[];
}

export interface UpdateOptionGroupDTO {
  name?: string;
  isRequired?: boolean;
  minSelections?: number;
  maxSelections?: number;
}

export interface UpdateOptionDTO {
  name?: string;
  price?: number;
}
