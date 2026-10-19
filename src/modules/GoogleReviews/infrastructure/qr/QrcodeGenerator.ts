import QRCode from 'qrcode';
import type { QrCodeGenerator } from '../../application/ports/QrCodeGenerator.js';

export class QrcodeGenerator implements QrCodeGenerator {
  toPng(value: string): Promise<Buffer> {
    return QRCode.toBuffer(value, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 1024,
    });
  }
}
