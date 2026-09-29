import { describe, expect, it } from 'vitest';
import { isSupportedImageFile } from './image-file.js';

describe('isSupportedImageFile', () => {
  it('accepts a file whose MIME type matches its image signature', () => {
    expect(
      isSupportedImageFile({
        mimetype: 'image/png',
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      }),
    ).toBe(true);
  });

  it('rejects a spoofed image MIME type', () => {
    expect(
      isSupportedImageFile({ mimetype: 'image/png', buffer: Buffer.from('not an image') }),
    ).toBe(false);
  });
});
