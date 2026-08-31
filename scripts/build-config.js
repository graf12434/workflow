const fs = require("fs");
const path = require("path");

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.");
  process.exit(1);
}

const content = `window.WORKFLOW_SUPABASE = {
  url: ${JSON.stringify(url)},
  anonKey: ${JSON.stringify(anonKey)}
};
`;

fs.writeFileSync(path.join(__dirname, "..", "supabase-config.js"), content);
console.log("supabase-config.js generated.");
