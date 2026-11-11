// Run: node test/worker.test.mjs
// The front Worker: /api goes to the API binding, nothing else does.

import worker from "../worker/index.js";

let passed = 0;
let failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n        expected: ${JSON.stringify(expected)}\n        actual:   ${JSON.stringify(actual)}`}`);
}

const seen = [];
const env = {
  API: { fetch: async (req) => (seen.push(["api", new URL(req.url).pathname, req.method, req.headers.get("Cookie")]), new Response("api")) },
  ASSETS: { fetch: async (req) => (seen.push(["assets", new URL(req.url).pathname]), new Response("file")) },
};
const go = (path, init) => worker.fetch(new Request("https://teach.averages.io" + path, init), env);

check("/api/health to the API", await (await go("/api/health")).text(), "api");
check("/api to the API", await (await go("/api")).text(), "api");
await go("/api/passkeys/signin/verify", { method: "POST", headers: { Cookie: "a=1" }, body: "{}" });
check("method and cookies passed on unchanged", seen.at(-1), ["api", "/api/passkeys/signin/verify", "POST", "a=1"]);
check("/ to the files", await (await go("/")).text(), "file");
check("/apix is not the API", await (await go("/apix")).text(), "file");
check("/x/api/y is not the API", await (await go("/x/api/y")).text(), "file");
const r = await worker.fetch(new Request("https://teach.averages.io/api/health"), { ASSETS: env.ASSETS });
check("no API binding: 503", [r.status, await r.json()], [503, { error: "api_unavailable" }]);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
