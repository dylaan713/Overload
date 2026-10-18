import { exportBackup } from "../data/backup";
import { bootStore, dumpLegacyRaw, hasLegacyData } from "../data/boot";
import { createLocalStorageKV } from "../data/kv";
import { todayYmd } from "../domain/dates";

const out = document.getElementById("out")!;

function line(text: string, cls?: string) {
  const p = document.createElement("pre");
  p.textContent = text;
  if (cls) p.className = cls;
  out.appendChild(p);
}

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function button(label: string, onClick: () => void) {
  const b = document.createElement("button");
  b.textContent = label;
  b.onclick = onClick;
  out.appendChild(b);
}

async function main() {
  out.textContent = "";
  const kv = createLocalStorageKV();
  try {
    // Dry run: nothing is written. The new app starts empty; old data is only offered as a raw download.
    const { kind, doc, warnings } = await bootStore(kv, { persist: false });
    line(`Result: ${kind}`);
    line(`${doc.exercises.length} exercises · ${doc.sessions.length} sessions`);
    const phase = [...doc.settings.phases].sort((a, b) => a.startDate.localeCompare(b.startDate)).at(-1);
    line(`Settings: ${doc.settings.unit}, style ${phase?.style ?? "none"}`);
    const legacy = await hasLegacyData(kv);
    line(`Old app data on this device: ${legacy ? "yes" : "no"}`);
    line(warnings.length ? `Warnings:\n${warnings.join("\n")}` : "No warnings.");
    button("Download v2 backup", () => download(`overload-v2-${todayYmd()}.json`, exportBackup(doc)));
    if (legacy) button("Download old app data", async () => download("overload-old-app-data.json", JSON.stringify(await dumpLegacyRaw(kv), null, 2)));
  } catch (e) {
    line(`Could not read your data: ${e instanceof Error ? e.message : String(e)}`, "err");
    line("Nothing was changed. You can still save exactly what is stored:");
    button("Download raw data", async () => download("overload-raw.json", JSON.stringify(await dumpLegacyRaw(kv), null, 2)));
  }
}

void main();
