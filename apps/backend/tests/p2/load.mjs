import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(process.env.P2_TOOLCHAIN_PACKAGE_JSON || import.meta.url);
const ts = require("typescript");
const cache = new Map();
export async function importSource(url) {
  if (cache.has(url.href)) return cache.get(url.href);
  const pending = (async () => {
    let js = ts.transpileModule(await readFile(url, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    for (const spec of [...new Set([...js.matchAll(/from ["']([^"']+)["']/g)].map((m) => m[1]))]) {
      const resolved = spec.startsWith(".")
        ? await moduleUrl(new URL(spec + ".ts", url))
        : spec.startsWith("node:")
          ? spec
          : new URL("file://" + require.resolve(spec)).href;
      js = js.replaceAll(`from "${spec}"`, `from "${resolved}"`).replaceAll(`from '${spec}'`, `from "${resolved}"`);
    }
    return `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
  })();
  cache.set(url.href, pending);
  return pending;
}
const moduleUrl = importSource;
export async function load(relative) {
  return import(await moduleUrl(new URL(relative, import.meta.url)));
}
