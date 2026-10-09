import { describe, it, expect } from "vitest";
import { buildEntries, entriesByExercise } from "../../src/domain/entries";
import { syntheticBackup } from "../helpers/fixtures";

describe("entries", () => {
  const { exercises, sessions } = syntheticBackup();

  it("flattens blocks into dated entries", () => {
    const entries = buildEntries(sessions);
    expect(entries).toHaveLength(sessions.reduce((n, s) => n + s.blocks.length, 0));
    expect(entries[0]).toMatchObject({ date: "2026-03-01", sessionName: "Day 1" });
  });

  it("groups per exercise, newest first, with empty buckets for unused exercises", () => {
    const map = entriesByExercise([...exercises, { id: "unused", name: "U", type: "compound", muscleGroup: "Core" }], sessions);
    expect(map["unused"]).toEqual([]);
    const dates = map["ex-ramp"]!.map((e) => e.date);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(dates).toHaveLength(6);
  });

  it("keeps entries whose exercise no longer exists", () => {
    const orphan = [{ id: "s", date: "2026-01-01", name: "x", blocks: [{ id: "b", exerciseId: "gone", sets: [] }] }];
    expect(entriesByExercise([], orphan)["gone"]).toHaveLength(1);
  });
});
