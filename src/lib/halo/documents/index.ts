import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { extractPdfText } from "./pdf-extractor";
import type {
  HaloDocumentChunk,
  HaloDocumentChunkQuality,
  HaloDocumentQueryResult,
  HaloDocumentRecord,
  HaloDocumentType,
} from "./types";
import { MAX_UPLOAD_BYTES } from "./upload-size-policy";

export { MAX_UPLOAD_BYTES } from "./upload-size-policy";

const STORAGE_ROOT = path.resolve(process.cwd(), ".halo-documents");
const FILES_DIR = path.resolve(STORAGE_ROOT, "files");
const INDEX_DIR = path.resolve(STORAGE_ROOT, "index");
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 160;
const PDF_EXTRACTION_FAILED_NOTE =
  "PDF uploaded, but text extraction failed or produced no readable text.";
export const PDF_NO_EXTRACTABLE_TEXT_NOTE =
  "This PDF appears to contain no extractable text. OCR is not implemented yet.";
export const LOW_QUALITY_EXTRACTED_TEXT_NOTE =
  "This document was uploaded, but the extracted text quality is too low for reliable local context. OCR is not implemented yet.";
export const PARTIAL_EXTRACTED_TEXT_NOTE =
  "This document was uploaded with partial readable text.";
const STOPWORDS = new Set([
  "a",
  "about",
  "al",
  "and",
  "answer",
  "con",
  "dame",
  "de",
  "del",
  "document",
  "documents",
  "el",
  "en",
  "exercise",
  "exercises",
  "ejercicio",
  "ejercicios",
  "find",
  "for",
  "from",
  "give",
  "in",
  "is",
  "la",
  "las",
  "local",
  "los",
  "me",
  "of",
  "on",
  "que",
  "solution",
  "the",
  "to",
  "what",
  "with",
  "using",
  "say",
  "says",
]);
const SECRET_FILENAME_PATTERNS = [
  ".env",
  "id_rsa",
  "id_ed25519",
  "privatekey",
  "private-key",
  "password",
  "passwd",
  "token",
  "secret",
];

type UploadDocumentInput = {
  filename: string;
  bytes: Buffer;
};

export class HaloDocumentError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "HaloDocumentError";
    this.statusCode = statusCode;
  }
}

function assertSafeId(id: unknown): string {
  if (typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id)) {
    throw new HaloDocumentError("Invalid document id.");
  }

  return id;
}

function isHaloDocumentType(type: unknown): type is HaloDocumentType {
  return type === "txt" || type === "md" || type === "log" || type === "pdf";
}

function assertHaloDocumentType(type: unknown): HaloDocumentType {
  if (!isHaloDocumentType(type)) {
    throw new HaloDocumentError("Invalid document type.");
  }

  return type;
}

function directChildPath(directory: string, filename: string) {
  const resolvedDirectory = path.resolve(directory);
  const candidate = path.resolve(resolvedDirectory, filename);
  const relative = path.relative(resolvedDirectory, candidate);

  if (
    !relative ||
    relative === "." ||
    path.isAbsolute(relative) ||
    relative.startsWith(`..${path.sep}`) ||
    relative === ".." ||
    relative.includes(path.sep) ||
    path.dirname(candidate) !== resolvedDirectory
  ) {
    throw new HaloDocumentError("Invalid document storage path.");
  }

  return candidate;
}

function documentPath(idInput: unknown, typeInput: unknown) {
  const id = assertSafeId(idInput);
  const type = assertHaloDocumentType(typeInput);
  return directChildPath(FILES_DIR, `${id}.${type}`);
}

function recordPath(idInput: unknown) {
  const id = assertSafeId(idInput);
  return directChildPath(INDEX_DIR, `${id}.json`);
}

function validateStoredRecord(value: unknown) {
  if (!value || typeof value !== "object") {
    throw new HaloDocumentError("Invalid stored document record.");
  }

  const stored = value as { document?: unknown; chunks?: unknown };
  if (
    !stored.document ||
    typeof stored.document !== "object" ||
    !Array.isArray(stored.chunks)
  ) {
    throw new HaloDocumentError("Invalid stored document record.");
  }

  const document = stored.document as Record<string, unknown>;
  const id = assertSafeId(document.id);
  const type = assertHaloDocumentType(document.type);

  return {
    document: { ...document, id, type } as HaloDocumentRecord,
    chunks: stored.chunks as HaloDocumentChunk[],
  };
}

function cleanFilename(filename: string) {
  return path.basename(filename).replace(/[^\w.\- ()]/g, "_").slice(0, 160);
}

function documentTitleFromFilename(filename: string) {
  return path
    .basename(filename, path.extname(filename))
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getDocumentType(filename: string): HaloDocumentType | null {
  const extension = path.extname(filename).toLowerCase().replace(".", "");

  if (isHaloDocumentType(extension)) {
    return extension;
  }

  return null;
}

function isBlockedFilename(filename: string) {
  const normalized = filename.toLowerCase();
  return SECRET_FILENAME_PATTERNS.some((pattern) => normalized.includes(pattern));
}

async function ensureStorage() {
  await mkdir(FILES_DIR, { recursive: true });
  await mkdir(INDEX_DIR, { recursive: true });
}

function normalizeText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .trim();
}

function longestRepeatedRun(value: string) {
  let longest = 0;
  let current = 0;
  let previous = "";

  for (const char of value) {
    if (char === previous) {
      current += 1;
    } else {
      previous = char;
      current = 1;
    }

    longest = Math.max(longest, current);
  }

  return longest;
}

function cleanedPreview(value: string, limit = 280) {
  return value
    .replace(/\s+/g, " ")
    .replace(/([!#$%&'*+,./:;<=>?@[\\\]^_`{|}~-])(?:\s+\1){2,}/g, "$1")
    .trim()
    .slice(0, limit);
}

function getBestReadablePreview(chunks: HaloDocumentChunk[]) {
  const bestChunk = chunks
    .filter((chunk) => chunk.quality?.status === "readable")
    .sort((a, b) => (b.quality?.score ?? 0) - (a.quality?.score ?? 0))[0];

  return bestChunk ? cleanedPreview(bestChunk.text) : undefined;
}

function getTopLowQualityReason(
  chunkCandidates: { quality: HaloDocumentChunkQuality }[]
) {
  return chunkCandidates
    .filter((chunk) => chunk.quality.status !== "readable")
    .sort((a, b) => (b.quality.score ?? 0) - (a.quality.score ?? 0))[0]?.quality
    .reason;
}

function getExtractionStatus(input: {
  extractedCharCount: number;
  readableChunkCount: number;
  lowQualityChunkCount: number;
  extractionStatus: HaloDocumentRecord["extractionStatus"];
}) {
  if (input.extractionStatus === "placeholder") {
    return input.extractionStatus;
  }

  if (input.extractedCharCount === 0) {
    return "failed" as const;
  }

  if (input.readableChunkCount === 0) {
    return "low_quality" as const;
  }

  if (input.lowQualityChunkCount > 0) {
    return "partial" as const;
  }

  return "ready" as const;
}

function getExtractionNote(
  status: HaloDocumentRecord["extractionStatus"],
  note?: string
) {
  if (status === "ready") return undefined;
  if (status === "low_quality") return LOW_QUALITY_EXTRACTED_TEXT_NOTE;
  if (status === "partial") return PARTIAL_EXTRACTED_TEXT_NOTE;
  if (status === "failed") return note ?? PDF_NO_EXTRACTABLE_TEXT_NOTE;
  if (note) return note;
  return note;
}

function createDocumentChunks(input: {
  id: string;
  filename: string;
  type: HaloDocumentType;
  createdAt: string;
  text: string;
}) {
  const chunkCandidates = chunkText(input.text).map((text) => ({
    text,
    quality: scoreChunkQuality(text),
  }));
  const chunkTexts = chunkCandidates.filter(
    (chunk) => chunk.quality.status !== "garbage"
  );
  const documentTitle = documentTitleFromFilename(input.filename);
  const chunks = chunkTexts.map(
    ({ text, quality }, chunkIndex): HaloDocumentChunk => ({
      documentId: input.id,
      filename: input.filename,
      documentTitle,
      type: input.type,
      createdAt: input.createdAt,
      chunkIndex,
      text,
      quality,
    })
  );

  return {
    chunkCandidates,
    chunks,
    readableChunkCount: chunks.filter(
      (chunk) => chunk.quality?.status === "readable"
    ).length,
    lowQualityChunkCount: chunkCandidates.filter(
      (chunk) => chunk.quality.status !== "readable"
    ).length,
  };
}

export function scoreChunkQuality(text: string): HaloDocumentChunkQuality {
  const normalized = normalizeText(text).replace(/\s+/g, " ");
  const length = normalized.length;

  if (length === 0) {
    return { score: 0, status: "garbage", reason: "Empty extracted text" };
  }

  const letters = normalized.match(/\p{L}/gu)?.length ?? 0;
  const digits = normalized.match(/[0-9]/g)?.length ?? 0;
  const symbols = normalized.match(/[^\p{L}0-9\s]/gu)?.length ?? 0;
  const suspiciousCharacters =
    normalized.match(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f\ufffd]/g)
      ?.length ?? 0;
  const isolatedSymbols =
    normalized.match(/(?:^|\s)[^\p{L}0-9\s](?=\s|$)/gu)?.length ?? 0;
  const words = normalized.match(/[\p{L}][\p{L}0-9'-]{2,}/gu) ?? [];
  const codeIdentifiers =
    normalized.match(/\b[A-Za-z_$][A-Za-z0-9_$]{2,}\b/g) ?? [];
  const numbers = normalized.match(/\b\d+(?:\.\d+)*\b/g) ?? [];
  const codeSyntax = normalized.match(/[(){}[\]<>!=]=?|[;:_]/g)?.length ?? 0;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const uniqueMeaningfulTerms = new Set([
    ...words.map((word) => word.toLowerCase()),
    ...codeIdentifiers.map((identifier) => identifier.toLowerCase()),
  ]);
  const meaningfulTokenCount =
    uniqueMeaningfulTerms.size + Math.min(numbers.length, Math.max(4, words.length));
  const readableWordRatio =
    tokens.length > 0 ? meaningfulTokenCount / tokens.length : 0;
  const letterRatio = letters / length;
  const symbolRatio = symbols / length;
  const suspiciousRatio = suspiciousCharacters / length;
  const repeatedRun = longestRepeatedRun(normalized);
  const hasProgrammingSignals =
    codeIdentifiers.length >= 3 &&
    (codeSyntax >= 4 || /[a-z][A-Z]|_/.test(normalized));
  const hasReadableTextSignals =
    words.length >= 8 ||
    meaningfulTokenCount >= 10 ||
    (hasProgrammingSignals && meaningfulTokenCount >= 5);

  let score = 100;

  if (letters < 12 && meaningfulTokenCount < 5) score -= 38;
  if (letters < 5 && meaningfulTokenCount < 3) score -= 36;
  if (letterRatio < 0.14 && meaningfulTokenCount < 8) {
    score -= Math.round((0.14 - letterRatio) * 140);
  }
  if (symbolRatio > (hasProgrammingSignals ? 0.62 : 0.5)) {
    score -= Math.round((symbolRatio - (hasProgrammingSignals ? 0.62 : 0.5)) * 120);
  }
  if (readableWordRatio < (hasProgrammingSignals ? 0.16 : 0.24)) {
    score -= Math.round(
      ((hasProgrammingSignals ? 0.16 : 0.24) - readableWordRatio) * 100
    );
  }
  if (isolatedSymbols > Math.max(18, meaningfulTokenCount * 3)) score -= 18;
  if (repeatedRun >= 10) score -= 20;
  if (repeatedRun >= 18) score -= 26;
  if (suspiciousRatio > 0.02) score -= Math.round(suspiciousRatio * 600);
  if (length < 80 && meaningfulTokenCount < 6) score -= 12;
  if (digits > letters * 3 && meaningfulTokenCount < 8) score -= 14;
  if (length > 200 && words.length < 8 && !hasProgrammingSignals) score -= 45;
  if (words.length < 4 && !hasProgrammingSignals && meaningfulTokenCount < 8) score -= 36;
  if (symbols > letters * 2 && words.length < 12 && !hasProgrammingSignals) {
    score -= 24;
  }
  if (hasProgrammingSignals) score += 10;
  if (hasReadableTextSignals) score += 14;
  if (words.length >= 12) score += 8;

  score = Math.max(0, Math.min(100, score));

  if (
    suspiciousRatio > 0.12 ||
    (meaningfulTokenCount < 3 && letters < 8) ||
    (score < 25 && !hasReadableTextSignals) ||
    (symbolRatio > 0.72 && meaningfulTokenCount < 8)
  ) {
    return {
      score,
      status: "garbage",
      reason: "Mostly symbols or unreadable extracted text",
    };
  }

  if (score < 40) {
    return {
      score,
      status: "low_quality",
      reason: "Low-quality extracted text",
    };
  }

  return { score, status: "readable" };
}

function chunkText(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const hardEnd = Math.min(start + CHUNK_SIZE, normalized.length);
    const softEnd = normalized.lastIndexOf("\n\n", hardEnd);
    const end = softEnd > start + CHUNK_SIZE * 0.6 ? softEnd : hardEnd;
    const chunk = normalized.slice(start, end).trim();

    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;

    start = Math.max(0, end - CHUNK_OVERLAP);
  }

  return chunks;
}

async function extractText(type: HaloDocumentType, bytes: Buffer) {
  if (type === "pdf") {
    try {
      const text = extractPdfText(bytes);

      if (!text) {
        return {
          text: "",
          extractionStatus: "failed" as const,
          note: PDF_NO_EXTRACTABLE_TEXT_NOTE,
        };
      }

      return {
        text,
        extractionStatus: "ready" as const,
      };
    } catch (error) {
      console.warn("[HALO documents] PDF text extraction failed", error);

      return {
        text: "",
        extractionStatus: "failed" as const,
        note: PDF_EXTRACTION_FAILED_NOTE,
      };
    }
  }

  return {
    text: bytes.toString("utf8"),
    extractionStatus: "ready" as const,
  };
}

function getDocumentNote(type: HaloDocumentType, chunkCount: number, note?: string) {
  if (note) return { note };

  if (type === "pdf" && chunkCount === 0) {
    return {
      note: PDF_EXTRACTION_FAILED_NOTE,
    };
  }

  return {};
}

function normalizeRecord(record: {
  document: HaloDocumentRecord;
  chunks: HaloDocumentChunk[];
}) {
  const chunks = record.chunks.map((chunk) => ({
    ...chunk,
    documentTitle: chunk.documentTitle ?? documentTitleFromFilename(chunk.filename),
    quality: scoreChunkQuality(chunk.text),
  }));
  const chunkCandidates = chunks.map((chunk) => ({ quality: chunk.quality }));
  const chunkCount = Math.max(record.document.chunkCount ?? 0, chunks.length);
  const readableChunkCount = chunks.filter(
    (chunk) => chunk.quality.status === "readable"
  ).length;
  const storedLowQualityChunkCount = chunks.filter(
    (chunk) => chunk.quality.status === "low_quality"
  ).length;
  const lowQualityChunkCount =
    chunks.length > 0
      ? storedLowQualityChunkCount
      : (record.document.lowQualityChunkCount ?? 0);
  const extractedCharCount =
    record.document.extractedCharCount ??
    chunks.reduce((total, chunk) => total + chunk.text.length, 0);
  const extractionStatus = getExtractionStatus({
    extractedCharCount,
    readableChunkCount,
    lowQualityChunkCount,
    extractionStatus: record.document.extractionStatus,
  });

  return {
    document: {
      ...record.document,
      chunkCount,
      readableChunkCount,
      lowQualityChunkCount,
      extractedCharCount,
      bestReadablePreview: getBestReadablePreview(chunks),
      topLowQualityReason: getTopLowQualityReason(chunkCandidates),
      extractionStatus,
      note: getExtractionNote(extractionStatus, record.document.note),
    },
    chunks,
  };
}

function shouldReprocessStoredRecord(record: {
  document: HaloDocumentRecord;
  chunks: HaloDocumentChunk[];
}) {
  return (
    record.chunks.length === 0 &&
    (record.document.extractedCharCount === undefined ||
      record.document.extractionStatus === "low_quality" ||
      record.document.extractionStatus === "failed")
  );
}

async function normalizeStoredRecord(value: unknown) {
  const record = validateStoredRecord(value);

  if (!shouldReprocessStoredRecord(record)) {
    return normalizeRecord(record);
  }

  try {
    const bytes = await readFile(documentPath(record.document.id, record.document.type));
    const extraction = await extractText(record.document.type, bytes);
    const extractedCharCount = extraction.text.length;
    const {
      chunkCandidates,
      chunks,
      readableChunkCount,
      lowQualityChunkCount,
    } = createDocumentChunks({
      id: record.document.id,
      filename: record.document.filename,
      type: record.document.type,
      createdAt: record.document.createdAt,
      text: extraction.text,
    });
    const extractionStatus = getExtractionStatus({
      extractedCharCount,
      readableChunkCount,
      lowQualityChunkCount,
      extractionStatus: extraction.extractionStatus,
    });

    return normalizeRecord({
      document: {
        ...record.document,
        chunkCount: chunkCandidates.length,
        readableChunkCount,
        lowQualityChunkCount,
        extractedCharCount,
        bestReadablePreview: getBestReadablePreview(chunks),
        topLowQualityReason: getTopLowQualityReason(chunkCandidates),
        extractionStatus,
        note: getExtractionNote(extractionStatus, extraction.note),
      },
      chunks,
    });
  } catch {
    return normalizeRecord(record);
  }
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[_./\\-]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return new Set(
    normalizeSearchText(value)
      .split(" ")
      .filter((term) => term.length >= 2 && !STOPWORDS.has(term))
  );
}

function phraseScore(needle: string, haystack: string, weight: number) {
  if (needle.length < 3 || haystack.length < 3) return 0;
  if (haystack.includes(needle)) return weight;
  if (needle.includes(haystack) && haystack.length >= 6) return Math.floor(weight / 2);
  return 0;
}

function tokenOverlapScore(queryTerms: Set<string>, fieldTerms: Set<string>, weight: number) {
  let score = 0;

  for (const term of queryTerms) {
    if (fieldTerms.has(term)) {
      score += weight;
      continue;
    }

    if (
      Array.from(fieldTerms).some(
        (fieldTerm) =>
          (term.length >= 4 && fieldTerm.includes(term)) ||
          (fieldTerm.length >= 4 && term.includes(fieldTerm))
      )
    ) {
      score += Math.max(1, Math.floor(weight / 2));
    }
  }

  return score;
}

function extractExerciseRefs(value: string) {
  return new Set(
    Array.from(value.matchAll(/\b(?:exercise|ejercicio|ex\.?)?\s*(\d+(?:\.\d+)+)\b/gi))
      .map((match) => match[1])
      .filter(Boolean)
  );
}

function extractIdentifiers(value: string) {
  return new Set(
    Array.from(value.matchAll(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g))
      .map((match) => match[0])
      .filter((term) => {
        if (STOPWORDS.has(term.toLowerCase())) return false;
        if (term.length < 3) return false;

        return (
          /[a-z][A-Z]/.test(term) ||
          /^[A-Z][A-Za-z0-9_$]*$/.test(term) ||
          /(?:Exception|Iterator|List|Array|Node|Tree|Queue|Stack|Map|Set)$/.test(term)
        );
      })
  );
}

function countOccurrences(haystack: string, needle: string) {
  if (!needle) return 0;

  let count = 0;
  let index = haystack.indexOf(needle);

  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }

  return count;
}

function scoreChunk(
  chunk: HaloDocumentChunk,
  document: HaloDocumentRecord,
  question: string
) {
  const documentTitle = documentTitleFromFilename(document.filename);
  const queryTerms = tokenize(question);
  const queryExerciseRefs = extractExerciseRefs(question);
  const queryIdentifiers = extractIdentifiers(question);
  const chunkTerms = tokenize(chunk.text);
  const chunkExerciseRefs = extractExerciseRefs(chunk.text);
  const chunkIdentifiers = extractIdentifiers(chunk.text);
  const documentTitleTerms = tokenize(documentTitle);
  const filenameTerms = tokenize(document.filename);
  const documentTerms = tokenize(
    [
      document.filename,
      documentTitle,
      document.type,
      document.extractionStatus,
      document.note ?? "",
    ].join(" ")
  );
  const lowerText = normalizeSearchText(chunk.text);
  const lowerQuestion = normalizeSearchText(question);
  const lowerDocumentTitle = normalizeSearchText(documentTitle);
  const lowerFilename = normalizeSearchText(document.filename);
  let score = 0;

  score += phraseScore(lowerQuestion, lowerDocumentTitle, 120);
  score += phraseScore(lowerQuestion, lowerFilename, 100);
  score += phraseScore(lowerDocumentTitle, lowerQuestion, 45);
  score += phraseScore(lowerFilename, lowerQuestion, 35);
  score += tokenOverlapScore(queryTerms, documentTitleTerms, 80);
  score += tokenOverlapScore(queryTerms, filenameTerms, 36);
  score += tokenOverlapScore(queryTerms, documentTerms, 18);
  score += tokenOverlapScore(queryTerms, chunkTerms, 4);

  for (const ref of queryExerciseRefs) {
    if (chunkExerciseRefs.has(ref)) {
      score += 60;
      if (/\b(?:exercise|ejercicio|ex\.?)\s*/i.test(chunk.text)) score += 15;
    } else if (lowerText.includes(ref)) {
      score += 35;
    }
  }

  for (const identifier of queryIdentifiers) {
    const exactMatches = countOccurrences(chunk.text, identifier);
    const lowerMatches = countOccurrences(lowerText, identifier.toLowerCase());

    if (exactMatches > 0) {
      score += 24 + Math.min(exactMatches, 3) * 4;
    } else if (lowerMatches > 0) {
      score += 12;
    } else if (chunkIdentifiers.has(identifier)) {
      score += 10;
    }
  }

  for (const term of queryTerms) {
    if (chunkTerms.has(term)) score += 3;
    if (lowerText.includes(term)) score += 1;
  }

  if (
    lowerQuestion.length >= 8 &&
    (lowerText.includes(lowerQuestion) ||
      lowerFilename.includes(lowerQuestion) ||
      lowerDocumentTitle.includes(lowerQuestion))
  ) {
    score += 20;
  }

  return score;
}

function scoreDocumentMetadata(document: HaloDocumentRecord, question: string) {
  const documentTitle = documentTitleFromFilename(document.filename);
  const queryTerms = tokenize(question);
  const documentTitleTerms = tokenize(documentTitle);
  const filenameTerms = tokenize(document.filename);
  const documentTerms = tokenize(
    [
      document.filename,
      documentTitle,
      document.type,
      document.extractionStatus,
      document.note ?? "",
    ].join(" ")
  );
  const lowerQuestion = normalizeSearchText(question);
  const lowerDocumentTitle = normalizeSearchText(documentTitle);
  const lowerFilename = normalizeSearchText(document.filename);

  return (
    phraseScore(lowerQuestion, lowerDocumentTitle, 120) +
    phraseScore(lowerQuestion, lowerFilename, 100) +
    phraseScore(lowerDocumentTitle, lowerQuestion, 45) +
    phraseScore(lowerFilename, lowerQuestion, 35) +
    tokenOverlapScore(queryTerms, documentTitleTerms, 80) +
    tokenOverlapScore(queryTerms, filenameTerms, 36) +
    tokenOverlapScore(queryTerms, documentTerms, 18)
  );
}

async function readRecord(id: string) {
  const requestedId = assertSafeId(id);
  const raw = await readFile(recordPath(requestedId), "utf8");
  const record = validateStoredRecord(JSON.parse(raw) as unknown);

  if (record.document.id !== requestedId) {
    throw new HaloDocumentError("Stored document id does not match requested id.");
  }

  return normalizeStoredRecord(record);
}

export function getDocumentsStorageRoot() {
  return STORAGE_ROOT;
}

export async function uploadDocument(input: UploadDocumentInput) {
  const filename = cleanFilename(input.filename);
  const type = getDocumentType(filename);

  if (!filename || !type) {
    throw new HaloDocumentError("Allowed document types are .txt, .md, .log, and .pdf.");
  }

  if (isBlockedFilename(filename)) {
    throw new HaloDocumentError(
      "This filename is blocked by HALO Console document safety policy."
    );
  }

  if (input.bytes.byteLength === 0) {
    throw new HaloDocumentError("Document is empty.");
  }

  if (input.bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new HaloDocumentError("Document is larger than the 10 MB local upload limit.");
  }

  await ensureStorage();

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const extraction = await extractText(type, input.bytes);
  const extractedCharCount = extraction.text.length;
  const {
    chunkCandidates,
    chunks,
    readableChunkCount,
    lowQualityChunkCount,
  } = createDocumentChunks({
    id,
    filename,
    type,
    createdAt,
    text: extraction.text,
  });
  const extractionStatus = getExtractionStatus({
    extractedCharCount,
    readableChunkCount,
    lowQualityChunkCount,
    extractionStatus: extraction.extractionStatus,
  });
  const document: HaloDocumentRecord = {
    id,
    filename,
    type,
    bytes: input.bytes.byteLength,
    createdAt,
    chunkCount: chunkCandidates.length,
    readableChunkCount,
    lowQualityChunkCount,
    extractedCharCount,
    bestReadablePreview: getBestReadablePreview(chunks),
    topLowQualityReason: getTopLowQualityReason(chunkCandidates),
    extractionStatus,
    ...getDocumentNote(type, chunks.length, getExtractionNote(extractionStatus, extraction.note)),
  };

  await writeFile(documentPath(id, type), input.bytes, { flag: "wx" });
  await writeFile(recordPath(id), `${JSON.stringify({ document, chunks }, null, 2)}\n`, {
    flag: "wx",
  });

  return { document, chunks };
}

export async function listDocuments() {
  await ensureStorage();

  const entries = await readdir(INDEX_DIR, { withFileTypes: true });
  const documents = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const id = assertSafeId(entry.name.slice(0, -".json".length));
        return (await readRecord(id)).document;
      })
  );

  return documents.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteDocument(idInput: unknown) {
  const id = assertSafeId(idInput);
  const { document } = await readRecord(id);

  await rm(recordPath(id), { force: true });
  await rm(documentPath(id, document.type), { force: true });

  return document;
}

export async function queryDocuments(
  questionInput: unknown,
  limitInput: unknown = 5,
  selectedDocumentIdsInput?: unknown
) {
  if (typeof questionInput !== "string" || questionInput.trim().length < 2) {
    throw new HaloDocumentError("Question must be at least 2 characters.");
  }

  const limit =
    typeof limitInput === "number" && Number.isFinite(limitInput)
      ? Math.min(Math.max(Math.floor(limitInput), 1), 8)
      : 5;
  const trimmedQuestion = questionInput.trim();
  const queryTerms = tokenize(trimmedQuestion);
  const queryExerciseRefs = extractExerciseRefs(trimmedQuestion);
  const queryIdentifiers = extractIdentifiers(trimmedQuestion);
  const selectedDocumentIds = Array.isArray(selectedDocumentIdsInput)
    ? new Set(selectedDocumentIdsInput.map(assertSafeId))
    : null;
  const allDocuments = await listDocuments();
  const documents = selectedDocumentIds
    ? allDocuments.filter((document) => selectedDocumentIds.has(document.id))
    : allDocuments;

  if (queryTerms.size === 0 && queryExerciseRefs.size === 0 && queryIdentifiers.size === 0) {
    return {
      question: trimmedQuestion,
      matches: [] as HaloDocumentQueryResult[],
      documentCount: documents.length,
      totalDocumentCount: allDocuments.length,
      selectedDocumentCount: selectedDocumentIds?.size,
      answer:
        documents.length > 0
          ? "Local documents are available, but no relevant chunks matched this question. Try asking with terms from the document title or use the Documents query box."
          : "No local documents uploaded.",
    };
  }

  const records = await Promise.all(
    documents.map(async (document) => readRecord(document.id).catch(() => null))
  );

  const scoredMatches = records
    .flatMap((record) =>
      record
        ? record.chunks.map((chunk) => ({
            chunk,
            document: record.document,
          }))
        : []
    )
    .map(({ chunk, document }) => {
      const documentTitle = documentTitleFromFilename(document.filename);

      return {
        ...chunk,
        documentTitle,
        quality: chunk.quality ?? scoreChunkQuality(chunk.text),
        score: scoreChunk(chunk, document, trimmedQuestion),
      };
    })
    .filter((chunk) => chunk.score > 0);
  const loadedRecords = records.filter(
    (record): record is NonNullable<typeof record> => record !== null
  );
  const metadataScores = loadedRecords
    .map((record) => ({
      document: record.document,
      score: scoreDocumentMetadata(record.document, trimmedQuestion),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  const matchingDocumentIds = new Set(metadataScores.map((item) => item.document.id));
  const matches = scoredMatches
    .filter((chunk) => chunk.quality.status === "readable")
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.createdAt !== a.createdAt) return b.createdAt.localeCompare(a.createdAt);
      return a.chunkIndex - b.chunkIndex;
    })
    .slice(0, limit);
  for (const match of scoredMatches) {
    matchingDocumentIds.add(match.documentId);
  }

  const matchingDocumentCount = matchingDocumentIds.size;
  const lowQualityMatchCount = scoredMatches.filter(
    (match) => match.quality.status !== "readable"
  ).length;
  const matchingDocuments = loadedRecords
    .filter((record) => matchingDocumentIds.has(record.document.id));
  const strongestDocumentMatch = metadataScores[0];
  const bestReadableDocumentMetadataScore = Math.max(
    0,
    ...matches.map((match) =>
      scoreDocumentMetadata(
        matchingDocuments.find((record) => record.document.id === match.documentId)
          ?.document ?? {
          id: match.documentId,
          filename: match.filename,
          type: match.type,
          bytes: 0,
          createdAt: match.createdAt,
          chunkCount: 0,
          extractionStatus: "ready" as const,
        },
        trimmedQuestion
      )
    )
  );
  const targetedUnreadableDocument =
    strongestDocumentMatch &&
    strongestDocumentMatch.score >= 120 &&
    (strongestDocumentMatch.document.readableChunkCount ?? 0) === 0 &&
    strongestDocumentMatch.score > bestReadableDocumentMetadataScore;
  const returnedMatches = targetedUnreadableDocument ? [] : matches;
  const foundDocumentWithoutReadableChunks =
    matchingDocumentCount > 0 &&
    returnedMatches.length === 0 &&
    (lowQualityMatchCount > 0 ||
      targetedUnreadableDocument ||
      matchingDocuments.some((record) => (record.document.readableChunkCount ?? 0) === 0));

  return {
    question: trimmedQuestion,
    matches: returnedMatches,
    documentCount: documents.length,
    totalDocumentCount: allDocuments.length,
    selectedDocumentCount: selectedDocumentIds?.size,
    matchingDocumentCount,
    lowQualityMatchCount,
    foundDocumentWithoutReadableChunks,
    answer:
      returnedMatches.length > 0
        ? "Relevant local document chunks found. Use the returned chunks as source context."
        : foundDocumentWithoutReadableChunks
          ? "The document was found, but no readable chunks were available for this question."
        : documents.length > 0
          ? "Local documents are available, but no relevant chunks matched this question. Try asking with terms from the document title or use the Documents query box."
          : "No local documents uploaded.",
  };
}
