import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const LEARNING_MEMORY_TYPES = [
  "project_note",
  "study_note",
  "code_pattern",
  "mistake_corrected",
  "personal_preference",
] as const;

export type LearningMemoryType = (typeof LEARNING_MEMORY_TYPES)[number];

export type LearningMemoryEntry = {
  id: string;
  type: LearningMemoryType;
  title: string;
  content: string;
  sourceLabel?: string;
  createdAt: string;
  updatedAt: string;
  source: "manual";
};

const MEMORY_DIR = path.join(process.cwd(), ".halo-memory");
const MAX_TITLE_LENGTH = 80;
const MAX_CONTENT_LENGTH = 800;
const MAX_SOURCE_LABEL_LENGTH = 80;
const MAX_SELECTED_CONTEXT_ENTRIES = 5;

type LearningMemoryInput = {
  type: unknown;
  title: unknown;
  content: unknown;
  sourceLabel?: unknown;
};

function isLearningMemoryType(value: unknown): value is LearningMemoryType {
  return (
    typeof value === "string" &&
    LEARNING_MEMORY_TYPES.includes(value as LearningMemoryType)
  );
}

function normalizeWhitespace(value: string, limit: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

function normalizeInput(input: LearningMemoryInput) {
  if (!isLearningMemoryType(input.type)) {
    throw new Error("Invalid learning note type.");
  }

  if (typeof input.title !== "string" || typeof input.content !== "string") {
    throw new Error("Learning note title and note are required.");
  }

  const title = normalizeWhitespace(input.title, MAX_TITLE_LENGTH);
  const content = normalizeWhitespace(input.content, MAX_CONTENT_LENGTH);
  const sourceLabel =
    typeof input.sourceLabel === "string"
      ? normalizeWhitespace(input.sourceLabel, MAX_SOURCE_LABEL_LENGTH)
      : "";

  if (!title || !content) {
    throw new Error("Learning note title and note are required.");
  }

  return {
    type: input.type,
    title,
    content,
    sourceLabel: sourceLabel || undefined,
  };
}

function isLearningMemoryEntry(value: unknown): value is LearningMemoryEntry {
  if (!value || typeof value !== "object") return false;

  const entry = value as Partial<LearningMemoryEntry>;

  return (
    typeof entry.id === "string" &&
    isLearningMemoryType(entry.type) &&
    typeof entry.title === "string" &&
    typeof entry.content === "string" &&
    typeof entry.createdAt === "string" &&
    typeof entry.updatedAt === "string" &&
    entry.source === "manual" &&
    (entry.sourceLabel === undefined || typeof entry.sourceLabel === "string")
  );
}

function isMissingFileError(error: unknown) {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function parseLearningMemories(raw: string, strict = false) {
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("Learning memory store must contain a JSON array.");
  }

  if (strict && !parsed.every(isLearningMemoryEntry)) {
    throw new Error("Learning memory store contains an invalid entry.");
  }

  return parsed.filter(isLearningMemoryEntry).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

export function createLearningMemoryStore(memoryDirectory: string) {
  const memoryFile = path.join(memoryDirectory, "entries.json");
  let mutationTail: Promise<void> = Promise.resolve();

  async function readForMutation() {
    try {
      return parseLearningMemories(await readFile(memoryFile, "utf8"), true);
    } catch (error) {
      if (isMissingFileError(error)) return [];
      throw error;
    }
  }

  async function writeLearningMemories(entries: LearningMemoryEntry[]) {
    await mkdir(memoryDirectory, { recursive: true });
    const temporaryFile = path.join(
      memoryDirectory,
      `.entries.json.${randomUUID()}.tmp`
    );

    try {
      await writeFile(
        temporaryFile,
        `${JSON.stringify(entries, null, 2)}\n`,
        "utf8"
      );
      await rename(temporaryFile, memoryFile);
    } catch (error) {
      try {
        await unlink(temporaryFile);
      } catch {
        // The temporary file may not have been created or may already be gone.
      }

      throw error;
    }
  }

  function enqueueMutation<T>(mutation: () => Promise<T>) {
    const result = mutationTail.then(mutation);
    mutationTail = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  async function list() {
    try {
      return parseLearningMemories(await readFile(memoryFile, "utf8"));
    } catch (error) {
      if (isMissingFileError(error) || error instanceof SyntaxError) return [];
      if (
        error instanceof Error &&
        error.message === "Learning memory store must contain a JSON array."
      ) {
        return [];
      }
      throw error;
    }
  }

  function create(input: LearningMemoryInput) {
    return enqueueMutation(async () => {
      const normalized = normalizeInput(input);
      const entries = await readForMutation();
      const now = new Date().toISOString();
      const entry: LearningMemoryEntry = {
        id: randomUUID(),
        ...normalized,
        createdAt: now,
        updatedAt: now,
        source: "manual",
      };

      await writeLearningMemories([entry, ...entries]);
      return entry;
    });
  }

  function update(id: unknown, input: LearningMemoryInput) {
    return enqueueMutation(async () => {
      if (typeof id !== "string" || !id) {
        throw new Error("Learning note id is required.");
      }

      const normalized = normalizeInput(input);
      const entries = await readForMutation();
      let updatedEntry: LearningMemoryEntry | null = null;
      const nextEntries = entries.map((entry) => {
        if (entry.id !== id) return entry;

        updatedEntry = {
          ...entry,
          ...normalized,
          updatedAt: new Date().toISOString(),
        };

        return updatedEntry;
      });

      if (!updatedEntry) {
        throw new Error("Learning note not found.");
      }

      await writeLearningMemories(nextEntries);
      return updatedEntry;
    });
  }

  function remove(id: unknown) {
    return enqueueMutation(async () => {
      if (typeof id !== "string" || !id) {
        throw new Error("Learning note id is required.");
      }

      const entries = await readForMutation();
      const nextEntries = entries.filter((entry) => entry.id !== id);

      if (nextEntries.length === entries.length) {
        throw new Error("Learning note not found.");
      }

      await writeLearningMemories(nextEntries);
    });
  }

  return { list, create, update, remove };
}

const defaultStore = createLearningMemoryStore(MEMORY_DIR);

export function listLearningMemories() {
  return defaultStore.list();
}

export function createLearningMemory(input: LearningMemoryInput) {
  return defaultStore.create(input);
}

export function updateLearningMemory(id: unknown, input: LearningMemoryInput) {
  return defaultStore.update(id, input);
}

export function deleteLearningMemory(id: unknown) {
  return defaultStore.remove(id);
}

export async function getSelectedLearningMemories(ids: unknown) {
  if (!Array.isArray(ids)) return [];

  const requestedIds = ids
    .filter((id): id is string => typeof id === "string")
    .slice(0, MAX_SELECTED_CONTEXT_ENTRIES);
  const requestedIdSet = new Set(requestedIds);
  const entries = await listLearningMemories();

  return requestedIds
    .map((id) => entries.find((entry) => entry.id === id))
    .filter((entry): entry is LearningMemoryEntry => Boolean(entry))
    .filter((entry) => requestedIdSet.has(entry.id));
}

export function formatSelectedLearningContext(entries: LearningMemoryEntry[]) {
  return entries
    .slice(0, MAX_SELECTED_CONTEXT_ENTRIES)
    .map((entry) => {
      const source = entry.sourceLabel ? ` (source: ${entry.sourceLabel})` : "";

      return [
        `- [${entry.type}] ${entry.title}${source}`,
        `  ${entry.content.replace(/\s+/g, " ").trim()}`,
      ].join("\n");
    })
    .join("\n");
}
