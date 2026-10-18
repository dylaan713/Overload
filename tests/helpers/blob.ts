export function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(blob);
  });
}

/** Captures what downloadText hands to the browser. */
export function captureDownloads(vi: typeof import("vitest").vi) {
  const files: { name: string; blob: Blob }[] = [];
  let pending: Blob | null = null;
  URL.createObjectURL = vi.fn((b: Blob | MediaSource) => {
    pending = b as Blob;
    return "blob:x";
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    files.push({ name: this.download, blob: pending! });
  });
  return files;
}
