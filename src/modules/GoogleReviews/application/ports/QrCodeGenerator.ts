export interface QrCodeGenerator {
  toPng(value: string): Promise<Buffer>;
}
