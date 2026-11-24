// Локальний сервер для розробки.
//   node server.js                 — робочий код з кореня (public/)
//   node server.js version/v2.3    — будь-яка версія (її public/)
// Версії не мають власного supabase-config.js: він береться з кореневого public/.
const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT || 8000);
const rootPublic = path.join(__dirname, "public");

function siteDir(arg) {
  if (!arg) return rootPublic;
  const dir = path.resolve(process.cwd(), arg);
  const nested = path.join(dir, "public");
  const site = fs.existsSync(nested) ? nested : dir;
  if (!fs.existsSync(path.join(site, "index.html"))) {
    console.error(`У ${site} немає index.html — це не папка сайту чи версії.`);
    process.exit(1);
  }
  return site;
}

const site = siteDir(process.argv[2]);
const SHARED_FROM_ROOT = new Set(["supabase-config.js"]);

// Ті самі заголовки безпеки, що й на Vercel (vercel.json) — щоб CSP перевірялась і локально
const securityHeaders = Object.fromEntries(
  (JSON.parse(fs.readFileSync(path.join(__dirname, "vercel.json"), "utf8")).headers || [])
    .flatMap((rule) => rule.headers)
    .map(({ key, value }) => [key, value])
);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".sql": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function resolveFile(relativePath) {
  const filePath = path.resolve(site, relativePath);
  if (filePath !== site && !filePath.startsWith(site + path.sep)) return null;
  if (!fs.existsSync(filePath) && SHARED_FROM_ROOT.has(relativePath)) {
    return path.join(rootPublic, relativePath);
  }
  return filePath;
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split("?")[0]);
  } catch {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }
  const relativePath = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const filePath = resolveFile(relativePath);

  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      ...securityHeaders,
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
});

// Лише цей комп'ютер: сервер не видно з локальної мережі
server.listen(port, "127.0.0.1", () => {
  console.log(`Workflow (${path.relative(__dirname, site) || "public"}) — http://localhost:${port}`);
});
