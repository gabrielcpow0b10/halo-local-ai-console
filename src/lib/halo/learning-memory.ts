import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

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
const MEMORY_FILE = path.join(MEMORY_DIR, "entries.json");
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

async function ensureMemoryStore() {
  await mkdir(MEMORY_DIR, { recursive: true });
}

async function writeLearningMemories(entries: LearningMemoryEntry[]) {
  await ensureMemoryStore();
  await writeFile(MEMORY_FILE, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

export async function listLearningMemories() {
  try {
    const raw = await readFile(MEMORY_FILE, "utf8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isLearningMemoryEntry).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }

    throw error;
  }
}

export async function createLearningMemory(input: LearningMemoryInput) {
  const normalized = normalizeInput(input);
  const now = new Date().toISOString();
  const entry: LearningMemoryEntry = {
    id: crypto.randomUUID(),
    ...normalized,
    createdAt: now,
    updatedAt: now,
    source: "manual",
  };
  const entries = await listLearningMemories();

  await writeLearningMemories([entry, ...entries]);

  return entry;
}

export async function updateLearningMemory(id: unknown, input: LearningMemoryInput) {
  if (typeof id !== "string" || !id) {
    throw new Error("Learning note id is required.");
  }

  const normalized = normalizeInput(input);
  const entries = await listLearningMemories();
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
}

export async function deleteLearningMemory(id: unknown) {
  if (typeof id !== "string" || !id) {
    throw new Error("Learning note id is required.");
  }

  const entries = await listLearningMemories();
  const nextEntries = entries.filter((entry) => entry.id !== id);

  if (nextEntries.length === entries.length) {
    throw new Error("Learning note not found.");
  }

  await writeLearningMemories(nextEntries);
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
