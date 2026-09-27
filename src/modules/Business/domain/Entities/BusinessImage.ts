export type BusinessImageType = 'LOGO' | 'COVER';

export interface UploadedImage {
  url: string;
  publicId: string;
  blurUrl: string;
}

export interface BusinessImageFile {
  buffer: Buffer;
  mimetype: string;
}
