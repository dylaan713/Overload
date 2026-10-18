import { todayYmd } from "../domain/dates";

/**
 * The one place a file leaves the app. In a browser it's an <a download>; the native wrap swaps this
 * module for the iOS share sheet (WKWebView ignores the download attribute).
 */
export function downloadText(filename: string, text: string, mime = "application/json"): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Local calendar date (never UTC), matching how sessions are dated.
export const backupFilename = (now: Date = new Date()) => `overload-backup-${todayYmd(now)}.json`;
export const oldDataFilename = (now: Date = new Date()) => `overload-old-app-data-${todayYmd(now)}.json`;
