import { exportBackup } from "../data/backup";
import { bootStore, dumpLegacyRaw } from "../data/boot";
import { createLocalStorageKV } from "../data/kv";

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
    // Dry run: nothing is written. The real migration happens in the new UI.
    const { kind, doc, warnings } = await bootStore(kv, { persist: false });
    line(`Result: ${kind}`);
    line(`${doc.exercises.length} exercises · ${doc.sessions.length} sessions · ${doc.customGroups.length} custom groups`);
    const dates = doc.sessions.map((s) => s.date).sort();
    if (dates.length) line(`History: ${dates[0]} → ${dates[dates.length - 1]}`);
    line(`Settings: ${doc.settings.unit}, increment ${doc.settings.increment}`);
    line(warnings.length ? `Warnings:\n${warnings.join("\n")}` : "No warnings.");
    button("Download v2 backup", () => download(`overload-v2-${new Date().toISOString().slice(0, 10)}.json`, exportBackup(doc)));
  } catch (e) {
    line(`Could not read your data: ${e instanceof Error ? e.message : String(e)}`, "err");
    line("Nothing was changed. You can still save exactly what is stored:");
    button("Download raw data", async () => download("overload-raw.json", JSON.stringify(await dumpLegacyRaw(kv), null, 2)));
  }
}

void main();
