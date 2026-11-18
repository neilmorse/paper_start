import { describe, expect, it } from "vitest";
import {
  LIBRARY_VERSION,
  emptyLibrary,
  exportFilename,
  migrateLibrary,
  normalizeItem,
  parseLibrary,
} from "@/src/lib/storage";

const valid = {
  workId: "https://openalex.org/W1",
  savedAt: "2026-01-01T00:00:00.000Z",
  snapshot: { title: "T", authors: ["A"], year: 2020, venue: "V", sourceId: "S1", type: "journal", citedByCount: 5 },
  tags: ["x"],
  status: "reading",
  note: "n",
};

describe("parseLibrary / migrateLibrary", () => {
  it("null or corrupted JSON → empty library", () => {
    expect(parseLibrary(null)).toEqual(emptyLibrary());
    expect(parseLibrary("{bad json")).toEqual(emptyLibrary());
    expect(parseLibrary("not json at all")).toEqual(emptyLibrary());
  });
  it("valid persisted v1 payload → normalized items", () => {
    const raw = JSON.stringify({ state: { items: [valid] }, version: LIBRARY_VERSION });
    const lib = parseLibrary(raw);
    expect(lib.items).toHaveLength(1);
    expect(lib.items[0].workId).toBe(valid.workId);
    expect(lib.items[0].status).toBe("reading");
    expect(lib.items[0].snapshot.countries).toEqual([]);
  });
  it("unknown or future version rejected → empty", () => {
    for (const v of [0, 2, 99]) {
      expect(migrateLibrary({ items: [valid] }, v)).toEqual(emptyLibrary());
    }
  });
  it("v1 with non-array items → empty", () => {
    expect(migrateLibrary({ items: "nope" }, LIBRARY_VERSION)).toEqual(emptyLibrary());
    expect(migrateLibrary(undefined, LIBRARY_VERSION)).toEqual(emptyLibrary());
  });
  it("dedups by workId and drops invalid entries", () => {
    const lib = migrateLibrary({ items: [valid, valid, { snapshot: {} }, null] }, LIBRARY_VERSION);
    expect(lib.items).toHaveLength(1);
  });
});

describe("normalizeItem defaults", () => {
  it("fills missing tags/status/note/snapshot fields", () => {
    const n = normalizeItem({ workId: "W2" })!;
    expect(n.tags).toEqual([]);
    expect(n.status).toBe("unread");
    expect(n.note).toBe("");
    expect(n.snapshot.title).toBe("");
    expect(n.snapshot.authors).toEqual([]);
    expect(n.snapshot.year).toBeNull();
    expect(n.snapshot.citedByCount).toBe(0);
    expect(n.snapshot.countries).toEqual([]);
    expect(typeof n.savedAt).toBe("string");
  });
  it("invalid status falls back to unread; non-string tags filtered", () => {
    const n = normalizeItem({ workId: "W3", status: "bogus", tags: ["ok", 5] })!;
    expect(n.status).toBe("unread");
    expect(n.tags).toEqual(["ok"]);
  });
  it("rejects entries without workId", () => {
    expect(normalizeItem({})).toBeNull();
    expect(normalizeItem(null)).toBeNull();
  });
});

describe("exportFilename", () => {
  it("paperstart-YYYYMMDD.ext", () => {
    expect(exportFilename("bib", new Date(2026, 10, 18))).toBe("paperstart-20261118.bib");
    expect(exportFilename("json", new Date(2026, 0, 5))).toBe("paperstart-20260105.json");
  });
});