import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createLearningMemoryStore } from "./learning-memory";

let temporaryDirectory: string;

const note = (title: string, content = `${title} content`) => ({
  type: "project_note" as const,
  title,
  content,
});

const persistedNote = {
  id: "existing-id",
  type: "project_note" as const,
  title: "Existing note",
  content: "Existing content",
  createdAt: "2026-08-11T12:00:00.000Z",
  updatedAt: "2026-08-11T12:00:00.000Z",
  source: "manual" as const,
};

const mixedStoreContents = `${JSON.stringify(
  [persistedNote, { id: "malformed-entry" }],
  null,
  2
)}\n`;

beforeEach(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), "halo-memory-test-"));
});

afterEach(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

describe("Learning Memory persistence", () => {
  it("persists a created entry as valid JSON with a trailing newline", async () => {
    const store = createLearningMemoryStore(temporaryDirectory);
    const created = await store.create(note("First note"));
    const raw = await readFile(
      path.join(temporaryDirectory, "entries.json"),
      "utf8"
    );

    expect(JSON.parse(raw)).toEqual([created]);
    expect(raw.endsWith("\n")).toBe(true);
  });

  it("preserves both notes from concurrent creates", async () => {
    const store = createLearningMemoryStore(temporaryDirectory);

    await Promise.all([
      store.create(note("Concurrent one")),
      store.create(note("Concurrent two")),
    ]);

    expect((await store.list()).map((entry) => entry.title).sort()).toEqual([
      "Concurrent one",
      "Concurrent two",
    ]);
  });

  it("updates only the requested note", async () => {
    const store = createLearningMemoryStore(temporaryDirectory);
    const first = await store.create(note("First"));
    const second = await store.create(note("Second"));

    await store.update(first.id, note("Updated", "Updated content"));

    const entries = await store.list();
    expect(entries.find((entry) => entry.id === first.id)).toMatchObject({
      title: "Updated",
      content: "Updated content",
    });
    expect(entries.find((entry) => entry.id === second.id)).toEqual(second);
  });

  it("deletes only the requested note", async () => {
    const store = createLearningMemoryStore(temporaryDirectory);
    const first = await store.create(note("First"));
    const second = await store.create(note("Second"));

    await store.remove(first.id);

    expect(await store.list()).toEqual([second]);
  });

  it("lists a missing entries file as empty", async () => {
    const store = createLearningMemoryStore(temporaryDirectory);

    expect(await store.list()).toEqual([]);
  });

  it("lists corrupt JSON as empty", async () => {
    const store = createLearningMemoryStore(temporaryDirectory);
    await writeFile(
      path.join(temporaryDirectory, "entries.json"),
      "{not valid JSON",
      "utf8"
    );

    expect(await store.list()).toEqual([]);
  });

  it("lists only valid entries from an array containing a malformed entry", async () => {
    await writeFile(
      path.join(temporaryDirectory, "entries.json"),
      mixedStoreContents,
      "utf8"
    );
    const store = createLearningMemoryStore(temporaryDirectory);

    expect(await store.list()).toEqual([persistedNote]);
  });

  it("rejects create without changing a store containing a malformed entry", async () => {
    const memoryFile = path.join(temporaryDirectory, "entries.json");
    await writeFile(memoryFile, mixedStoreContents, "utf8");
    const store = createLearningMemoryStore(temporaryDirectory);

    await expect(store.create(note("Create"))).rejects.toThrow(
      "Learning memory store contains an invalid entry."
    );
    expect(await readFile(memoryFile, "utf8")).toBe(mixedStoreContents);
  });

  it("rejects update without changing a store containing a malformed entry", async () => {
    const memoryFile = path.join(temporaryDirectory, "entries.json");
    await writeFile(memoryFile, mixedStoreContents, "utf8");
    const store = createLearningMemoryStore(temporaryDirectory);

    await expect(store.update(persistedNote.id, note("Update"))).rejects.toThrow(
      "Learning memory store contains an invalid entry."
    );
    expect(await readFile(memoryFile, "utf8")).toBe(mixedStoreContents);
  });

  it("rejects remove without changing a store containing a malformed entry", async () => {
    const memoryFile = path.join(temporaryDirectory, "entries.json");
    await writeFile(memoryFile, mixedStoreContents, "utf8");
    const store = createLearningMemoryStore(temporaryDirectory);

    await expect(store.remove(persistedNote.id)).rejects.toThrow(
      "Learning memory store contains an invalid entry."
    );
    expect(await readFile(memoryFile, "utf8")).toBe(mixedStoreContents);
  });

  it("runs a valid mutation after a malformed-entry rejection and repair", async () => {
    const memoryFile = path.join(temporaryDirectory, "entries.json");
    await writeFile(memoryFile, mixedStoreContents, "utf8");
    const store = createLearningMemoryStore(temporaryDirectory);

    await expect(store.create(note("Fails"))).rejects.toThrow(
      "Learning memory store contains an invalid entry."
    );
    await writeFile(memoryFile, `${JSON.stringify([persistedNote])}\n`, "utf8");

    const created = await store.create(note("Succeeds"));
    expect(await store.list()).toEqual([created, persistedNote]);
  });

  it("rejects every mutation without overwriting corrupt JSON", async () => {
    const memoryFile = path.join(temporaryDirectory, "entries.json");
    const corruptContents = "{corrupt and important";
    await writeFile(memoryFile, corruptContents, "utf8");
    const store = createLearningMemoryStore(temporaryDirectory);

    await expect(store.create(note("Create"))).rejects.toBeInstanceOf(
      SyntaxError
    );
    await expect(store.update("existing-id", note("Update"))).rejects.toBeInstanceOf(
      SyntaxError
    );
    await expect(store.remove("existing-id")).rejects.toBeInstanceOf(
      SyntaxError
    );
    expect(await readFile(memoryFile, "utf8")).toBe(corruptContents);
  });

  it("runs a valid mutation after a failed mutation", async () => {
    const memoryFile = path.join(temporaryDirectory, "entries.json");
    await writeFile(memoryFile, "corrupt", "utf8");
    const store = createLearningMemoryStore(temporaryDirectory);

    await expect(store.create(note("Fails"))).rejects.toBeInstanceOf(
      SyntaxError
    );
    await writeFile(memoryFile, "[]\n", "utf8");

    const created = await store.create(note("Succeeds"));
    expect(await store.list()).toEqual([created]);
  });

  it("keeps persisted JSON valid across concurrent mutations", async () => {
    const store = createLearningMemoryStore(temporaryDirectory);
    const [first, second] = await Promise.all([
      store.create(note("First")),
      store.create(note("Second")),
    ]);

    await Promise.all([
      store.update(first.id, note("First updated")),
      store.remove(second.id),
      store.create(note("Third")),
    ]);

    const raw = await readFile(
      path.join(temporaryDirectory, "entries.json"),
      "utf8"
    );
    const persisted = JSON.parse(raw) as Array<{ title: string }>;

    expect(persisted.map((entry) => entry.title).sort()).toEqual([
      "First updated",
      "Third",
    ]);
  });
});
