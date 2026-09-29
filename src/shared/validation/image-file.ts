type ImageFileLike = {
  buffer: Buffer;
  mimetype: string;
};

const signatures: ReadonlyArray<{ mimetype: string; bytes: number[] }> = [
  { mimetype: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mimetype: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mimetype: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
];

export function isSupportedImageFile(file: ImageFileLike): boolean {
  if (file.mimetype === 'image/webp') {
    return (
      file.buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      file.buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }

  const signature = signatures.find(({ mimetype }) => mimetype === file.mimetype);
  return Boolean(signature && signature.bytes.every((byte, index) => file.buffer[index] === byte));
}
