// Спільні помічники для скриптів версій (new-version, promote-version).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const VERSIONS = path.join(ROOT, "version");
export const ROOT_PUBLIC = path.join(ROOT, "public");

// Файли, яких немає у версіях: беруться з кореня і ніколи не перезаписуються з версії.
export const ROOT_ONLY = new Set(["supabase-config.js"]);

export function fail(message) {
  console.error(message);
  process.exit(1);
}

export function parseVersion(name) {
  const match = /^v(\d+)\.(\d+)$/.exec(name || "");
  return match ? [Number(match[1]), Number(match[2])] : null;
}

export function listVersions() {
  return fs
    .readdirSync(VERSIONS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && parseVersion(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => {
      const [aMajor, aMinor] = parseVersion(a);
      const [bMajor, bMinor] = parseVersion(b);
      return aMajor - bMajor || aMinor - bMinor;
    });
}

// Усі файли папки як відносні шляхи з "/".
export function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full, base);
    return [path.relative(base, full).split(path.sep).join("/")];
  });
}

// Вміст без різниці в кінцях рядків (git на Windows міняє LF/CRLF).
function sameContent(a, b) {
  const read = (file) => fs.readFileSync(file).toString("latin1").replace(/\r\n/g, "\n");
  return read(a) === read(b);
}

// Файли, що відрізняються між двома папками сайту (без ROOT_ONLY).
export function diffSites(a, b) {
  const filesA = new Set(listFiles(a).filter((file) => !ROOT_ONLY.has(file)));
  const filesB = new Set(listFiles(b).filter((file) => !ROOT_ONLY.has(file)));
  const changed = [];
  for (const file of new Set([...filesA, ...filesB])) {
    if (!filesA.has(file) || !filesB.has(file) || !sameContent(path.join(a, file), path.join(b, file))) {
      changed.push(file);
    }
  }
  return changed.sort();
}
