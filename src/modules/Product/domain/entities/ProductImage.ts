export interface ProductImageFile {
  buffer: Buffer;
  mimetype: string;
}

export interface UploadedProductImage {
  url: string;
  publicId: string;
  blurUrl: string;
}
