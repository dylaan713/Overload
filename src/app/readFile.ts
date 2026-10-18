/** Reads a picked file as text (FileReader works in browsers, WKWebView and jsdom alike). */
export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("Couldn't read the file"));
    r.readAsText(file);
  });
}
