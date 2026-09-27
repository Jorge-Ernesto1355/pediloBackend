export interface CreateCustomerDTO {
  name: string;
  phone: string;
}
export interface UpdateCustomerDTO {
  name?: string;
  phone?: string;
}
export interface ListCustomersDTO {
  businessId: string;
  page: number;
  limit: number;
  search?: string;
}
