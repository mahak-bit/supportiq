import { describe, expect, it } from "vitest";
import { duration, fileSize, humanize, initials, money, parseUtc, relativeTime } from "./format";

describe("format helpers", () => {
  it("formats money from cents", () => {
    expect(money(14200)).toBe("$142.00");
    expect(money(36200)).toBe("$362.00");
  });

  it("treats naive API timestamps as UTC", () => {
    expect(parseUtc("2026-10-01T12:00:00").toISOString()).toBe("2026-10-01T12:00:00.000Z");
    expect(parseUtc("2026-10-01T12:00:00Z").toISOString()).toBe("2026-10-01T12:00:00.000Z");
  });

  it("renders relative time", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    expect(relativeTime("2026-10-01T11:59:30", now)).toBe("just now");
    expect(relativeTime("2026-10-01T11:15:00", now)).toBe("45m ago");
    expect(relativeTime("2026-10-01T07:00:00", now)).toBe("5h ago");
    expect(relativeTime("2026-09-28T12:00:00", now)).toBe("3d ago");
  });

  it("humanizes identifiers and sizes", () => {
    expect(humanize("damaged_item")).toBe("Damaged item");
    expect(fileSize(2048)).toBe("2.0 KB");
    expect(duration(45)).toBe("45 min");
    expect(duration(180)).toBe("3.0 h");
    expect(duration(null)).toBe("—");
    expect(initials("Maya Okafor")).toBe("MO");
  });
});
