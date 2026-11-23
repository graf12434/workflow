// Нова версія для редагування — копія попередньої.
//   node scripts/new-version.mjs v2.3            копія останньої версії
//   node scripts/new-version.mjs v2.3 --from v2.1
// Створює version/v2.3/public (без supabase-config.js — він спільний, у корені)
// і шаблон version/v2.3/V1-LOG.md.
import fs from "node:fs";
import path from "node:path";
import { VERSIONS, ROOT_PUBLIC, ROOT_ONLY, fail, parseVersion, listVersions, diffSites } from "./version-lib.mjs";

const [name, flag, fromArg] = process.argv.slice(2);
if (!parseVersion(name)) fail("Вкажіть назву версії у форматі vX.Y, наприклад: node scripts/new-version.mjs v2.3");

const target = path.join(VERSIONS, name);
if (fs.existsSync(target)) fail(`Версія ${name} вже існує.`);

const versions = listVersions();
const from = flag === "--from" ? fromArg : versions.at(-1);
if (!from || !versions.includes(from)) fail(`Немає версії, з якої копіювати: ${from || "(порожньо)"}.`);

const source = path.join(VERSIONS, from, "public");

// Якщо в корені є зміни, яких немає у версії-джерелі, нова версія їх не отримає — попереджаємо.
const drift = diffSites(source, ROOT_PUBLIC);
if (drift.length) {
  console.warn(`Увага: ${from} відрізняється від робочого коду в корені (${drift.length} файл.):`);
  drift.slice(0, 10).forEach((file) => console.warn(`  ${file}`));
  console.warn("Нова версія — копія саме " + from + ".");
}

fs.cpSync(source, path.join(target, "public"), {
  recursive: true,
  filter: (src) => !ROOT_ONLY.has(path.basename(src))
});

const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(
  path.join(target, "V1-LOG.md"),
  `# Workflow ${name.toUpperCase()} — робоча копія, стан на ${today}

Відгалужено від ${from}. Зміни робляться тут; у корінь переносяться командою
\`node scripts/promote-version.mjs ${name}\`.

## Що нового

-

## База даних

Без змін.
`
);

console.log(`Створено version/${name} з ${from}.`);
console.log(`Запуск: node server.js version/${name}`);
