export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function isDocumentUploadOversized(size: number) {
  return size > MAX_UPLOAD_BYTES;
}
