// Confere se toda chave t('...') usada em src/ tem tradução em en.ts e es.ts.
// Uso: node scripts/i18n-check.mjs [--dump]  (--dump imprime as chaves faltantes em JSON)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src/', import.meta.url).pathname;
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(f) && !p.includes('/i18n/')) files.push(p);
  }
};
walk(root);

const keys = new Set();
const re = /\bt\(\s*'((?:[^'\\]|\\.)*)'/g;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(re)) keys.add(m[1].replace(/\\'/g, "'"));
}

const load = (lang) => {
  const src = readFileSync(join(root, 'i18n', `${lang}.ts`), 'utf8');
  const out = new Map();
  for (const m of src.matchAll(/^\s*('|")((?:(?!\1)[^\\]|\\.)*)\1:\s*('|")((?:(?!\3)[^\\]|\\.)*)\3,?\s*$/gm)) out.set(m[2].replace(/\\(['"])/g, '$1'), m[4]);
  return out;
};

let failed = false;
const missingAll = {};
for (const lang of ['en', 'es']) {
  const dict = load(lang);
  const missing = [...keys].filter((k) => !dict.has(k));
  const unused = [...dict.keys()].filter((k) => !keys.has(k));
  const badParams = [...keys].filter((k) => dict.has(k)).filter((k) => {
    const p = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    return p(k) !== p(dict.get(k));
  });
  missingAll[lang] = missing;
  console.log(`${lang}: ${keys.size} chaves · ${missing.length} faltando · ${unused.length} sem uso · ${badParams.length} com parâmetros diferentes`);
  for (const k of badParams) console.log(`  parâmetros: ${k}`);
  if (missing.length || badParams.length) failed = true;
}
if (process.argv.includes('--dump')) console.log(JSON.stringify(missingAll.en, null, 1));
process.exit(failed ? 1 : 0);
