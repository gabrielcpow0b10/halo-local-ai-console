import { access, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { HaloDocumentChunk, HaloDocumentRecord } from "./types";

vi.mock("server-only", () => ({}));

type DocumentsModule = typeof import("./index");

const IDS = {
  first: "00000000-0000-0000-0000-000000000001",
  second: "00000000-0000-0000-0000-000000000002",
  third: "00000000-0000-0000-0000-000000000003",
} as const;
const CREATED = {
  old: "2025-01-01T00:00:00.000Z",
  middle: "2025-01-02T00:00:00.000Z",
  new: "2025-01-03T00:00:00.000Z",
} as const;
const NO_MATCH_ANSWER =
  "Local documents are available, but no relevant chunks matched this question. Try asking with terms from the document title or use the Documents query box.";
const UNREADABLE_ANSWER =
  "The document was found, but no readable chunks were available for this question.";
const READABLE_PROSE =
  "Careful readers compare the evidence, explain each conclusion, and record the method so another student can reproduce the result.";
const LOW_QUALITY_TEXT =
  `alpha beta gamma delta epsilon zeta theta lambda ${"#".repeat(150)}`;

let documents: DocumentsModule;
let temporaryCwd: string;
let indexDirectory: string;
let filesDirectory: string;
const repositoryCwd = process.cwd();

function makeChunk(
  document: HaloDocumentRecord,
  text: string,
  chunkIndex = 0
): HaloDocumentChunk {
  return {
    documentId: document.id,
    filename: document.filename,
    documentTitle: path.basename(document.filename, path.extname(document.filename)),
    type: document.type,
    createdAt: document.createdAt,
    chunkIndex,
    text,
  };
}

async function storeRecord(input: {
  id: string;
  filename: string;
  createdAt?: string;
  chunks?: string[];
  extractionStatus?: HaloDocumentRecord["extractionStatus"];
}) {
  const chunks = input.chunks ?? [];
  const document: HaloDocumentRecord = {
    id: input.id,
    filename: input.filename,
    type: "txt",
    bytes: chunks.reduce((total, text) => total + text.length, 0),
    createdAt: input.createdAt ?? CREATED.middle,
    chunkCount: chunks.length,
    readableChunkCount: chunks.filter(
      (text) => documents.scoreChunkQuality(text).status === "readable"
    ).length,
    lowQualityChunkCount: chunks.filter(
      (text) => documents.scoreChunkQuality(text).status === "low_quality"
    ).length,
    extractedCharCount: chunks.reduce((total, text) => total + text.length, 0),
    extractionStatus: input.extractionStatus ?? "ready",
  };
  const record = {
    document,
    chunks: chunks.map((text, chunkIndex) => makeChunk(document, text, chunkIndex)),
  };

  await writeFile(
    path.join(indexDirectory, `${document.id}.json`),
    `${JSON.stringify(record, null, 2)}\n`
  );
  return record;
}

function longestSuffixPrefix(left: string, right: string) {
  const maximum = Math.min(left.length, right.length);
  for (let length = maximum; length > 0; length -= 1) {
    if (left.slice(-length) === right.slice(0, length)) return length;
  }
  return 0;
}

beforeAll(async () => {
  temporaryCwd = await mkdtemp(path.join(tmpdir(), "halo-document-retrieval-"));
  process.chdir(temporaryCwd);
  temporaryCwd = process.cwd();
  try {
    documents = await import("./index");
  } finally {
    process.chdir(repositoryCwd);
  }

  indexDirectory = path.join(documents.getDocumentsStorageRoot(), "index");
  filesDirectory = path.join(documents.getDocumentsStorageRoot(), "files");
});

beforeEach(async () => {
  await rm(documents.getDocumentsStorageRoot(), { recursive: true, force: true });
  await mkdir(indexDirectory, { recursive: true });
});

afterAll(async () => {
  process.chdir(repositoryCwd);
  await rm(temporaryCwd, { recursive: true, force: true });
});

describe("scoreChunkQuality", () => {
  it("accepts readable natural-language prose", () => {
    expect(documents.scoreChunkQuality(READABLE_PROSE).status).toBe("readable");
  });

  it("keeps programming-heavy text readable", () => {
    const code = `
      class BinarySearchTree<T> {
        insertNode(value: T): TreeNode<T> { return this.root.insert(value); }
        findNode(value: T): TreeNode<T> | null { return this.root.find(value); }
      }
      The implementation maintains ordering while each method handles a clear tree operation.
    `;

    expect(documents.scoreChunkQuality(code).status).toBe("readable");
  });

  it("does not penalize ordinary punctuation and numeric exercise references", () => {
    const text =
      "Exercise 3.7 asks: compare values 12, 18, and 24; then explain why the measured ratio is 2.0. The calculation uses ordinary numeric evidence.";

    expect(documents.scoreChunkQuality(text).status).toBe("readable");
  });

  it("returns the empty-text contract", () => {
    expect(documents.scoreChunkQuality(" \r\n ")).toEqual({
      score: 0,
      status: "garbage",
      reason: "Empty extracted text",
    });
  });

  it("rejects symbol-only extraction", () => {
    expect(documents.scoreChunkQuality("#$%@ <> {} [] !!! ???").status).toBe(
      "garbage"
    );
  });

  it("rejects replacement-character-heavy and suspicious-control extraction", () => {
    const damaged = `${"\ufffd".repeat(40)}\u0001\u0002\u0003 broken`;

    expect(documents.scoreChunkQuality(damaged).status).toBe("garbage");
  });

  it("materially penalizes long repeated character runs", () => {
    const readable = `${READABLE_PROSE} Additional examples make the comparison stable and clear.`;
    const repeated = `${readable} ${"x".repeat(24)}`;

    expect(documents.scoreChunkQuality(readable).score).toBeGreaterThan(
      documents.scoreChunkQuality(repeated).score + 20
    );
  });

  it("has a stable low-quality fixture under the current scorer", () => {
    expect(documents.scoreChunkQuality(LOW_QUALITY_TEXT)).toMatchObject({
      status: "low_quality",
      reason: "Low-quality extracted text",
    });
  });
});

describe("uploadDocument chunking", () => {
  it("uses only the temporary storage root", () => {
    const storageRoot = documents.getDocumentsStorageRoot();
    expect(path.relative(temporaryCwd, storageRoot)).not.toMatch(/^\.\.(?:[/\\]|$)/);
    expect(path.relative(repositoryCwd, storageRoot)).toMatch(/^\.\.(?:[/\\]|$)/);
    expect(storageRoot).toBe(path.join(temporaryCwd, ".halo-documents"));
  });

  it("creates one chunk for short readable text", async () => {
    const result = await documents.uploadDocument({
      filename: "short-reading.txt",
      bytes: Buffer.from(READABLE_PROSE),
    });

    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0].text).toBe(READABLE_PROSE);
  });

  it("creates multiple chunks with approximately 160 characters of overlap", async () => {
    const longText = Array.from(
      { length: 90 },
      (_, index) =>
        `Section ${index + 1} explains a distinct concept with evidence and a reproducible example.`
    ).join(" ");
    const { chunks } = await documents.uploadDocument({
      filename: "long-reading.txt",
      bytes: Buffer.from(longText),
    });

    expect(chunks.length).toBeGreaterThan(2);
    for (let index = 1; index < chunks.length; index += 1) {
      expect(longestSuffixPrefix(chunks[index - 1].text, chunks[index].text)).toBeGreaterThanOrEqual(
        158
      );
    }
  });

  it("prefers a usable paragraph boundary over the hard split", async () => {
    const firstParagraph = Array.from(
      { length: 13 },
      (_, index) => `Paragraph evidence item ${index + 1} gives readers a clear and useful explanation.`
    ).join(" ");
    expect(firstParagraph.length).toBeGreaterThan(720);
    expect(firstParagraph.length).toBeLessThan(1200);
    const secondParagraph = Array.from(
      { length: 20 },
      (_, index) => `Following topic ${index + 1} supplies another deterministic supporting detail.`
    ).join(" ");
    const { chunks } = await documents.uploadDocument({
      filename: "paragraphs.txt",
      bytes: Buffer.from(`${firstParagraph}\n\n${secondParagraph}`),
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].text).toBe(firstParagraph);
    expect(chunks[0].text.length).toBeLessThan(1200);
  });

  it("normalizes CRLF and removes unsafe control characters from chunks", async () => {
    const source = `${READABLE_PROSE}\r\n\r\nSecond paragraph\u0000\u0007 explains another safe example for readers.`;
    const { chunks } = await documents.uploadDocument({
      filename: "normalized.txt",
      bytes: Buffer.from(source),
    });

    expect(chunks.map((chunk) => chunk.text).join("\n")).not.toMatch(
      /\r|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
    );
  });

  it("does not return chunks for garbage-only extraction", async () => {
    const result = await documents.uploadDocument({
      filename: "symbols.txt",
      bytes: Buffer.from("#$%@ <> {} [] !!! ???"),
    });

    expect(result.chunks).toEqual([]);
    expect(result.document.readableChunkCount).toBe(0);
    expect(result.document.extractionStatus).toBe("low_quality");
  });
});

describe("document storage path safety", () => {
  it("rejects a traversal-like delete id", async () => {
    await expect(documents.deleteDocument("../00000000-0000-0000-0000-000000000001"))
      .rejects.toThrow("Invalid document id.");
  });

  it.each([
    "00000000/0000-0000-0000-000000000001",
    "00000000\\0000-0000-0000-000000000001",
  ])("rejects path separators in a delete id: %s", async (id) => {
    await expect(documents.deleteDocument(id)).rejects.toThrow("Invalid document id.");
  });

  it("rejects a malformed delete id", async () => {
    await expect(documents.deleteDocument("not-a-document-id")).rejects.toThrow(
      "Invalid document id."
    );
  });

  it("rejects an unsupported stored document type before filesystem reuse", async () => {
    const record = await storeRecord({
      id: IDS.first,
      filename: "tampered.txt",
      chunks: [READABLE_PROSE],
    });
    await writeFile(
      path.join(indexDirectory, `${IDS.first}.json`),
      JSON.stringify({
        ...record,
        document: { ...record.document, type: "../../outside" },
      })
    );

    await expect(documents.listDocuments()).rejects.toThrow("Invalid document type.");
    await expect(documents.deleteDocument(IDS.first)).rejects.toThrow(
      "Invalid document type."
    );
  });

  it("does not let a tampered stored document id redirect file access", async () => {
    const record = await storeRecord({
      id: IDS.first,
      filename: "tampered-id.txt",
      chunks: [READABLE_PROSE],
    });
    await mkdir(filesDirectory, { recursive: true });
    const requestedFile = path.join(filesDirectory, `${IDS.first}.txt`);
    const redirectedFile = path.join(filesDirectory, `${IDS.second}.txt`);
    await writeFile(requestedFile, READABLE_PROSE);
    await writeFile(redirectedFile, "must remain");
    await writeFile(
      path.join(indexDirectory, `${IDS.first}.json`),
      JSON.stringify({
        ...record,
        document: { ...record.document, id: IDS.second },
      })
    );

    await expect(documents.deleteDocument(IDS.first)).rejects.toThrow(
      "Stored document id does not match requested id."
    );
    await expect(access(requestedFile)).resolves.toBeUndefined();
    await expect(access(redirectedFile)).resolves.toBeUndefined();
  });

  it("deletes a valid document and its stored record", async () => {
    const uploaded = await documents.uploadDocument({
      filename: "valid-delete.txt",
      bytes: Buffer.from(READABLE_PROSE),
    });

    await expect(documents.deleteDocument(uploaded.document.id)).resolves.toMatchObject({
      id: uploaded.document.id,
      type: "txt",
    });
    await expect(
      access(path.join(indexDirectory, `${uploaded.document.id}.json`))
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      access(path.join(filesDirectory, `${uploaded.document.id}.txt`))
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each(["txt", "md", "log", "pdf"] as const)(
    "preserves valid .%s upload, list, and delete behavior",
    async (type) => {
      const uploaded = await documents.uploadDocument({
        filename: `supported.${type}`,
        bytes: Buffer.from(type === "pdf" ? "%PDF-1.4\n%%EOF" : READABLE_PROSE),
      });

      expect(uploaded.document.type).toBe(type);
      await expect(documents.listDocuments()).resolves.toEqual([
        expect.objectContaining({ id: uploaded.document.id, type }),
      ]);
      await expect(documents.deleteDocument(uploaded.document.id)).resolves.toMatchObject({
        id: uploaded.document.id,
        type,
      });
    }
  );
});

describe("queryDocuments retrieval", () => {
  it("prefers filename and title relevance", async () => {
    await storeRecord({
      id: IDS.first,
      filename: "graph-algorithms.txt",
      chunks: [`${READABLE_PROSE} This chapter introduces general study methods.`],
    });
    await storeRecord({
      id: IDS.second,
      filename: "unrelated-notes.txt",
      chunks: [`${READABLE_PROSE} Graph algorithms are mentioned only in passing.`],
    });

    const result = await documents.queryDocuments("graph algorithms");
    expect(result.matches[0].documentId).toBe(IDS.first);
  });

  it("strongly prefers an exact exercise reference", async () => {
    await storeRecord({
      id: IDS.first,
      filename: "practice-a.txt",
      chunks: [`${READABLE_PROSE} Exercise 3.7 demonstrates the requested proof method.`],
    });
    await storeRecord({
      id: IDS.second,
      filename: "practice-b.txt",
      chunks: [`${READABLE_PROSE} Exercise 4.2 demonstrates a different proof method.`],
    });

    const result = await documents.queryDocuments("Explain Exercise 3.7");
    expect(result.matches[0].documentId).toBe(IDS.first);
    expect(result.matches[0].score).toBeGreaterThan(result.matches[1].score);
  });

  it.each(["ConcurrentModificationException", "BinarySearchTree"])(
    "prefers the exact programming identifier %s",
    async (identifier) => {
      await storeRecord({
        id: IDS.first,
        filename: "implementation.txt",
        chunks: [`${READABLE_PROSE} The ${identifier} identifier names the exact behavior discussed here.`],
      });
      await storeRecord({
        id: IDS.second,
        filename: "other-code.txt",
        chunks: [`${READABLE_PROSE} This section discusses a general software behavior.`],
      });

      const result = await documents.queryDocuments(identifier);
      expect(result.matches[0].documentId).toBe(IDS.first);
    }
  );

  it("returns readable matching chunks as context", async () => {
    await storeRecord({
      id: IDS.first,
      filename: "ocean-currents.txt",
      chunks: [`${READABLE_PROSE} Ocean currents redistribute heat across large regions.`],
    });

    const result = await documents.queryDocuments("ocean currents heat");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      documentId: IDS.first,
      quality: { status: "readable" },
    });
    expect(result.answer).toBe(
      "Relevant local document chunks found. Use the returned chunks as source context."
    );
  });

  it("never returns low-quality or garbage matching chunks", async () => {
    await storeRecord({
      id: IDS.first,
      filename: "damaged-keyword.txt",
      chunks: [LOW_QUALITY_TEXT, `${"\ufffd".repeat(50)} damagedkeyword`],
      extractionStatus: "low_quality",
    });

    const result = await documents.queryDocuments("damaged keyword alpha");
    expect(result.matches).toEqual([]);
    expect(result.lowQualityMatchCount).toBeGreaterThan(0);
  });

  it("reports a strongly targeted document with no readable chunks", async () => {
    await storeRecord({
      id: IDS.first,
      filename: "damaged-keyword.txt",
      chunks: [LOW_QUALITY_TEXT],
      extractionStatus: "low_quality",
    });
    await storeRecord({
      id: IDS.second,
      filename: "general-notes.txt",
      chunks: [`${READABLE_PROSE} A damaged keyword may appear in broad reference material.`],
    });

    const result = await documents.queryDocuments("damaged keyword");
    expect(result.matches).toEqual([]);
    expect(result.foundDocumentWithoutReadableChunks).toBe(true);
    expect(result.answer).toBe(UNREADABLE_ANSWER);
  });

  it("returns existing guidance for an unrelated query", async () => {
    await storeRecord({
      id: IDS.first,
      filename: "astronomy-notes.txt",
      chunks: [`${READABLE_PROSE} Planets follow measurable orbital paths.`],
    });

    const result = await documents.queryDocuments("culinary fermentation");
    expect(result.matches).toEqual([]);
    expect(result.answer).toBe(NO_MATCH_ANSWER);
  });

  it("reports when no documents are uploaded", async () => {
    const result = await documents.queryDocuments("any meaningful question");
    expect(result.matches).toEqual([]);
    expect(result.answer).toBe("No local documents uploaded.");
  });

  it("returns no matches for a stopword-only query", async () => {
    await storeRecord({
      id: IDS.first,
      filename: "available-reading.txt",
      chunks: [READABLE_PROSE],
    });

    const result = await documents.queryDocuments("the and with");
    expect(result.matches).toEqual([]);
    expect(result.answer).toBe(NO_MATCH_ANSWER);
  });

  it("sorts by score, then newer creation time, then lower chunk index", async () => {
    await storeRecord({
      id: IDS.first,
      filename: "older.txt",
      createdAt: CREATED.old,
      chunks: [`${READABLE_PROSE} cobalt appears once.`],
    });
    await storeRecord({
      id: IDS.second,
      filename: "newer.txt",
      createdAt: CREATED.new,
      chunks: [
        `${READABLE_PROSE} cobalt appears once.`,
        `${READABLE_PROSE} cobalt appears once.`,
      ],
    });
    await storeRecord({
      id: IDS.third,
      filename: "strongest.txt",
      createdAt: CREATED.old,
      chunks: [`${READABLE_PROSE} cobalt and zircon appear together.`],
    });

    const result = await documents.queryDocuments("cobalt zircon", 8);
    expect(result.matches.map(({ documentId, chunkIndex }) => [documentId, chunkIndex])).toEqual([
      [IDS.third, 0],
      [IDS.second, 0],
      [IDS.second, 1],
      [IDS.first, 0],
    ]);
  });

  it("enforces a requested result limit", async () => {
    await storeRecord({
      id: IDS.first,
      filename: "limited.txt",
      chunks: Array.from(
        { length: 5 },
        (_, index) => `${READABLE_PROSE} amber topic example ${index + 1} remains relevant.`
      ),
    });

    const result = await documents.queryDocuments("amber topic", 2);
    expect(result.matches).toHaveLength(2);
  });

  it("caps an excessive result limit at eight", async () => {
    await storeRecord({
      id: IDS.first,
      filename: "capped.txt",
      chunks: Array.from(
        { length: 10 },
        (_, index) => `${READABLE_PROSE} violet topic example ${index + 1} remains relevant.`
      ),
    });

    const result = await documents.queryDocuments("violet topic", 100);
    expect(result.matches).toHaveLength(8);
  });

  it("limits retrieval and metadata to selected documents", async () => {
    await storeRecord({
      id: IDS.first,
      filename: "selected.txt",
      chunks: [`${READABLE_PROSE} quartz is the selected subject.`],
    });
    await storeRecord({
      id: IDS.second,
      filename: "excluded.txt",
      chunks: [`${READABLE_PROSE} quartz is also described in this excluded record.`],
    });

    const result = await documents.queryDocuments("quartz", 5, [IDS.first]);
    expect(new Set(result.matches.map((match) => match.documentId))).toEqual(
      new Set([IDS.first])
    );
    expect(result).toMatchObject({
      documentCount: 1,
      totalDocumentCount: 2,
      selectedDocumentCount: 1,
    });
  });

  it("rejects an invalid selected document id", async () => {
    await expect(
      documents.queryDocuments("valid question", 5, ["not-a-valid-id"])
    ).rejects.toBeInstanceOf(documents.HaloDocumentError);
  });

  it("rejects a question shorter than two characters", async () => {
    await expect(documents.queryDocuments("x")).rejects.toBeInstanceOf(
      documents.HaloDocumentError
    );
  });
});
