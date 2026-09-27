const CLOUDINARY_UPLOAD_SEGMENT = '/upload/';
const BLUR_TRANSFORMATION = 'e_blur:1000,q_1,w_50';

export function createCloudinaryBlurUrl(secureUrl: string): string {
  const uploadIndex = secureUrl.indexOf(CLOUDINARY_UPLOAD_SEGMENT);
  if (uploadIndex === -1) return secureUrl;
  const insertionPoint = uploadIndex + CLOUDINARY_UPLOAD_SEGMENT.length;
  return `${secureUrl.slice(0, insertionPoint)}${BLUR_TRANSFORMATION}/${secureUrl.slice(insertionPoint)}`;
}
