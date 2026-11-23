// Перенесення готової версії в робочий код кореня.
//   node scripts/promote-version.mjs v2.3
// Робить public/ у корені копією version/v2.3/public: змінені й нові файли переносяться,
// видалені у версії — видаляються в корені (supabase-config.js кореня не чіпається).
// Нічого не комітить: після перенесення переглянути `git status` і закомітити окремо.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, VERSIONS, ROOT_PUBLIC, fail, parseVersion, diffSites } from "./version-lib.mjs";

const name = process.argv[2];
if (!parseVersion(name)) fail("Вкажіть версію: node scripts/promote-version.mjs v2.3");

const source = path.join(VERSIONS, name, "public");
if (!fs.existsSync(path.join(source, "index.html"))) fail(`У version/${name}/public немає index.html.`);

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });

// Незакомічені зміни в корені перенесення б затерло — тоді зупиняємось.
if (git("status", "--porcelain", "--", "public").trim()) {
  fail("У public/ кореня є незакомічені зміни. Закомітьте або відкиньте їх перед перенесенням.");
}

const changed = diffSites(source, ROOT_PUBLIC);
if (!changed.length) {
  console.log(`${name} уже збігається з коренем — переносити нічого.`);
  process.exit(0);
}

// Переносимо лише файли, що відрізняються по суті: копії з іншими кінцями рядків (LF/CRLF)
// git показав би як змінені, хоча вміст той самий.
for (const file of changed) {
  const from = path.join(source, file);
  const to = path.join(ROOT_PUBLIC, file);
  if (fs.existsSync(from)) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  } else {
    fs.rmSync(to);
  }
}

console.log(`Перенесено ${name} у корінь (${changed.length} файл.):`);
console.log(git("status", "--short", "--", "public"));
console.log("Далі: перевірити, закомітити й запушити.");
