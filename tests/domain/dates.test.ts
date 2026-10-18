import { describe, it, expect } from "vitest";
import { addDays, daysBetween, todayYmd, weekStart } from "../../src/domain/dates";

describe("dates", () => {
  it("todayYmd uses local parts", () => {
    expect(todayYmd(new Date(2026, 9, 17, 23, 45))).toBe("2026-10-17");
  });
  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("counts whole days", () => {
    expect(daysBetween("2026-09-01", "2026-09-20")).toBe(19);
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2); // across a DST change
  });
  it("weeks start on Sunday", () => {
    expect(weekStart("2026-10-14")).toBe("2026-10-11");
    expect(weekStart("2026-10-11")).toBe("2026-10-11");
    expect(weekStart("2026-10-17")).toBe("2026-10-11");
    expect(weekStart("2026-10-18")).toBe("2026-10-18");
  });
});
