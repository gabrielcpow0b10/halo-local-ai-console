import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, expect, it, vi } from "vitest";

import type { HaloDocumentRecord } from "../documents/types";

vi.mock("server-only", () => ({}));

const IDS = {
  garden: "00000000-0000-0000-0000-000000000001",
  ferry: "00000000-0000-0000-0000-000000000002",
  code: "00000000-0000-0000-0000-000000000003",
  spanish: "00000000-0000-0000-0000-000000000004",
  greenhouse: "00000000-0000-0000-0000-000000000005",
} as const;

// Entirely fictional corpus, fixed IDs and timestamps; no upload UUIDs or clock input.
const corpus = [
  { id: IDS.garden, filename: "garden-guide.txt", text: "The amber watering bell signals sunrise irrigation. Garden volunteers water seedlings every Tuesday using collected rainwater. Reference 2.4 describes the seedling schedule and the copper watering cans." },
  { id: IDS.ferry, filename: "ferry-handbook.txt", text: "The silver harbor ferry departs at nine each morning. Passengers collect tickets at the eastern kiosk before boarding. Exercise 8.6 calculates the ferry crossing distance across the fictional lake." },
  { id: IDS.code, filename: "software-workshop.txt", text: "The LanternQueue identifier names a fictional task buffer. Its enqueue method adds pending tasks while dequeue removes the oldest entry. Exercise 2.4 demonstrates ordered task processing in this software workshop." },
  { id: IDS.spanish, filename: "biblioteca-manual.txt", text: "La biblioteca del pueblo abre los jueves por la tarde. Los lectores pueden devolver libros en el mostrador verde. El catálogo incluye cuentos infantiles y mapas de una isla imaginaria." },
  { id: IDS.greenhouse, filename: "greenhouse-guide.txt", text: "Greenhouse volunteers water seedlings every Friday using filtered water. The violet ventilation lever opens roof panels during warm afternoons. Reference 5.9 describes the greenhouse watering schedule and glass roof maintenance." },
];

const cases: {
  name: string;
  query: string;
  expectedDocumentId: string | null;
  selectedDocumentIds?: string[];
}[] = [
  { name: "exact phrase", query: "amber watering bell", expectedDocumentId: IDS.garden },
  { name: "identifier", query: "LanternQueue", expectedDocumentId: IDS.code },
  { name: "exercise reference", query: "Exercise 8.6", expectedDocumentId: IDS.ferry },
  { name: "natural language", query: "When do garden volunteers water seedlings?", expectedDocumentId: IDS.garden },
  { name: "passenger question", query: "Where do ferry passengers collect tickets?", expectedDocumentId: IDS.ferry },
  { name: "Spanish question", query: "¿Cuándo abre la biblioteca del pueblo?", expectedDocumentId: IDS.spanish },
  { name: "Spanish fact", query: "¿Dónde devolver libros?", expectedDocumentId: IDS.spanish },
  { name: "method query", query: "Which method removes the oldest entry?", expectedDocumentId: IDS.code },
  { name: "greenhouse fact", query: "violet ventilation lever", expectedDocumentId: IDS.greenhouse },
  { name: "competing schedule", query: "Who uses filtered water every Friday?", expectedDocumentId: IDS.greenhouse },
  { name: "selected scope", query: "garden volunteers water seedlings", selectedDocumentIds: [IDS.greenhouse], expectedDocumentId: IDS.greenhouse },
  { name: "selected multi-document scope", query: "LanternQueue", selectedDocumentIds: [IDS.code, IDS.ferry], expectedDocumentId: IDS.code },
  { name: "unrelated", query: "volcanic basalt geology", expectedDocumentId: null },
  { name: "excluded identifier", query: "LanternQueue", selectedDocumentIds: [IDS.ferry], expectedDocumentId: null },
];

let documents: typeof import("../documents");
let temporaryCwd: string;
const repositoryCwd = process.cwd();

beforeAll(async () => {
  // Match document-retrieval.test.ts: import only after switching to isolated storage.
  temporaryCwd = await mkdtemp(path.join(tmpdir(), "halo-retrieval-eval-"));
  try {
    process.chdir(temporaryCwd);
    temporaryCwd = process.cwd();
    documents = await import("../documents");
  } finally {
    process.chdir(repositoryCwd);
  }
  expect(documents.getDocumentsStorageRoot()).toBe(path.join(temporaryCwd, ".halo-documents"));
  const indexDirectory = path.join(documents.getDocumentsStorageRoot(), "index");
  await mkdir(indexDirectory, { recursive: true });
  for (const fixture of corpus) {
    expect(documents.scoreChunkQuality(fixture.text).status).toBe("readable");
    const document: HaloDocumentRecord = {
      id: fixture.id,
      filename: fixture.filename,
      type: "txt",
      bytes: Buffer.byteLength(fixture.text),
      createdAt: "2025-01-01T00:00:00.000Z",
      chunkCount: 1,
      readableChunkCount: 1,
      lowQualityChunkCount: 0,
      extractedCharCount: fixture.text.length,
      extractionStatus: "ready",
    };
    await writeFile(path.join(indexDirectory, `${fixture.id}.json`), JSON.stringify({
      document,
      chunks: [{
        documentId: fixture.id,
        filename: fixture.filename,
        type: document.type,
        createdAt: document.createdAt,
        chunkIndex: 0,
        text: fixture.text,
      }],
    }));
  }
});

afterAll(async () => {
  process.chdir(repositoryCwd);
  if (temporaryCwd) await rm(temporaryCwd, { recursive: true, force: true });
});

it("evaluates offline retrieval quality (top-1 >=80%, hit@3 >=90%)", async () => {
  const results = [];
  for (const fixture of cases) {
    const result = await documents.queryDocuments(fixture.query, 3, fixture.selectedDocumentIds);
    const actualIds = result.matches.map((match) => match.documentId);
    if (fixture.selectedDocumentIds) {
      expect(actualIds.every((id) => fixture.selectedDocumentIds!.includes(id)), fixture.name).toBe(true);
    }
    results.push({ ...fixture, actualIds });
  }
  // Positive-query denominators exclude no-match cases; no-match has its own gate.
  const positives = results.filter((result) => result.expectedDocumentId !== null);
  const negatives = results.filter((result) => result.expectedDocumentId === null);
  const top1 = positives.filter((result) => result.actualIds[0] === result.expectedDocumentId).length;
  const hits = positives.filter((result) => result.actualIds.includes(result.expectedDocumentId!)).length;
  const noMatchCorrect = negatives.filter((result) => result.actualIds.length === 0).length;
  const accuracy = top1 / positives.length;
  const hitAt3 = hits / positives.length;
  process.stdout.write(`[retrieval quality] total=${cases.length} positive=${positives.length} top-1=${top1}/${positives.length} accuracy=${(accuracy * 100).toFixed(1)}% hit@3=${hits}/${positives.length} (${(hitAt3 * 100).toFixed(1)}%) no-match=${noMatchCorrect}/${negatives.length}\n`);
  const failures = JSON.stringify(results.filter((result) => result.expectedDocumentId === null
    ? result.actualIds.length > 0
    : result.actualIds[0] !== result.expectedDocumentId));
  expect(accuracy, failures).toBeGreaterThanOrEqual(0.8);
  expect(hitAt3, failures).toBeGreaterThanOrEqual(0.9);
  expect(noMatchCorrect, failures).toBe(negatives.length);
});
