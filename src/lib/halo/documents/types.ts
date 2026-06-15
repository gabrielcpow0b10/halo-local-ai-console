export type HaloDocumentType = "txt" | "md" | "log" | "pdf";

export type HaloDocumentExtractionStatus =
  | "ready"
  | "partial"
  | "low_quality"
  | "placeholder"
  | "failed";

export type HaloDocumentChunkQualityStatus = "readable" | "low_quality" | "garbage";

export type HaloDocumentChunkQuality = {
  score: number;
  status: HaloDocumentChunkQualityStatus;
  reason?: string;
};

export type HaloDocumentRecord = {
  id: string;
  filename: string;
  type: HaloDocumentType;
  bytes: number;
  createdAt: string;
  chunkCount: number;
  readableChunkCount?: number;
  lowQualityChunkCount?: number;
  extractedCharCount?: number;
  bestReadablePreview?: string;
  topLowQualityReason?: string;
  extractionStatus: HaloDocumentExtractionStatus;
  note?: string;
};

export type HaloDocumentChunk = {
  documentId: string;
  filename: string;
  documentTitle?: string;
  type: HaloDocumentType;
  createdAt: string;
  chunkIndex: number;
  text: string;
  quality?: HaloDocumentChunkQuality;
};

export type HaloDocumentQueryResult = HaloDocumentChunk & {
  documentTitle: string;
  quality: HaloDocumentChunkQuality;
  score: number;
};
