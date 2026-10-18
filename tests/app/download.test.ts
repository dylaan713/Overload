// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { backupFilename, downloadText, oldDataFilename } from "../../src/app/download";
import { blobText, captureDownloads } from "../helpers/blob";

afterEach(() => vi.restoreAllMocks());

describe("downloadText", () => {
  it("creates a blob URL, clicks a download anchor with the filename, and revokes the URL", async () => {
    const files = captureDownloads(vi);
    downloadText("a.json", '{"ok":true}');
    expect(files[0]!.name).toBe("a.json");
    expect(await blobText(files[0]!.blob)).toBe('{"ok":true}');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:x");
  });
});

describe("filenames", () => {
  it("use the local calendar date, not UTC (a late-evening export keeps today's date)", () => {
    expect(backupFilename(new Date(2026, 9, 17, 23, 45))).toBe("overload-backup-2026-10-17.json");
    expect(backupFilename(new Date(2026, 0, 2, 0, 15))).toBe("overload-backup-2026-01-02.json");
    expect(oldDataFilename(new Date(2026, 9, 17, 23, 45))).toBe("overload-old-app-data-2026-10-17.json");
  });
});
