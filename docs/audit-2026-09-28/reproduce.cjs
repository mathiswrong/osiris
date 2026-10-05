// Read-only, offline probes of the exact checked-out implementation.
// Run from the repository root: node docs/audit-2026-09-28/reproduce.cjs
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const results = [];
function load(file, start, end, name, extras = {}) {
 const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
 const source = text.slice(text.indexOf(start), end ? text.indexOf(end, text.indexOf(start)) : undefined);
 const js = ts.transpileModule(source.replace(/export /g, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
 const context = vm.createContext({Buffer, console, Date, Map, ...extras});
 return vm.runInContext(js + `\n${name}`, context);
}
(async () => {
 const imageType = load('src/app/api/cctv/proxy/route.ts', 'export function imageType', '/**\n * A host', 'imageType');
 assert.equal(imageType(Buffer.from('<h1>untrusted</h1>'), 'text/html'), 'text/html');
 assert.equal(imageType(Buffer.from('<svg/>'), 'image/svg+xml'), 'image/svg+xml');
 results.push('Confirmed: image proxy permits HTML and active SVG content types. No exploit sent.');
 const cachedSource = load('src/lib/sourceCache.ts', 'interface Entry', null, 'cachedSource');
 let n = 0;
 const cached = cachedSource('audit', async () => ++n === 1 ? ['old warning'] : [], -1);
 await cached();
 assert.equal((await cached())[0], 'old warning');
 results.push('Confirmed: a successful empty source refresh retains the previous nonempty warning.');
 const probe = load('src/components/WorldRemote.tsx', 'async function probeNetwork', '/* ═══════════════════════════════════════════════════════════════\n   TYPES', 'probeNetwork', {
  navigator: {}, performance: { now: () => 10 }, AbortController,
  fetch: async () => { throw new TypeError('synthetic blocked request'); },
  setTimeout: () => 1, clearTimeout: () => {},
 });
 assert.equal((await probe()).openPorts.length, 15);
 results.push('Confirmed: 15 synthetic rejected requests are reported as 15 open ports. No network scan performed.');
 console.log(JSON.stringify({ testedAt: new Date().toISOString(), results }, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
