import { describe, expect, it } from "vitest";

import {
  isDocumentUploadOversized,
  MAX_UPLOAD_BYTES,
} from "./upload-size-policy";

describe("document upload size policy", () => {
  it("allows a file exactly at the upload limit", () => {
    expect(isDocumentUploadOversized(MAX_UPLOAD_BYTES)).toBe(false);
  });

  it("rejects a file one byte over the upload limit", () => {
    expect(isDocumentUploadOversized(MAX_UPLOAD_BYTES + 1)).toBe(true);
  });
});
