// Lists Thai keys used in the code that have no English entry, and English entries
// nobody uses any more. Keys are found in t("…"), tk("…") and new HttpError(…, "…").
//   npm run i18n:check
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { en } from "../src/i18n/en";

const THAI = /[฀-๿]/;
const CALL = /\b(?:t|tk)\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
const HTTP = /new HttpError\(\s*\d+\s*,\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return p.endsWith(join("i18n", "en")) ? [] : files(p);
    // src/i18n/index.ts only has examples in its doc comment
    return /\.tsx?$/.test(f) && !p.endsWith(join("i18n", "index.ts")) ? [p] : [];
  });
}

const used = new Map<string, string>();
const dynamic: string[] = [];
for (const f of files("src")) {
  const src = readFileSync(f, "utf8");
  for (const re of [CALL, HTTP]) {
    for (const m of src.matchAll(re)) {
      const key = m[2].replace(/\\(["'`\\])/g, "$1").replace(/\\n/g, "\n");
      if (m[1] === "`" && key.includes("${")) dynamic.push(`${f}: ${key}`);
      else if (THAI.test(key)) used.set(key, f);
    }
  }
}

const missing = [...used].filter(([k]) => !(k in en));
const unused = Object.keys(en).filter((k) => THAI.test(k) && !used.has(k));
for (const [k, f] of missing) console.log(`missing  ${f}: ${JSON.stringify(k)}`);
for (const d of dynamic) console.log(`dynamic  ${d}  (use {placeholders} instead of \${…})`);
for (const k of unused) console.log(`unused   ${JSON.stringify(k)}`);
console.log(`\n${used.size} keys used · ${missing.length} missing · ${dynamic.length} dynamic · ${unused.length} unused`);
process.exit(missing.length || dynamic.length ? 1 : 0);
