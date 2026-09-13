import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(process.env.ENS_TOOLCHAIN_PACKAGE_JSON || import.meta.url);
const ts = require("typescript");
const cache = new Map();
export function moduleUrl(file) {
  const url = new URL(file, import.meta.url);
  if (cache.has(url.href)) return cache.get(url.href);
  let js = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  js = js.replaceAll('from "ethers"', `from "${pathToFileURL(require.resolve("ethers"))}"`);
  js = js.replace(/from "(\.\.?\/[^\"]+)"/g, (_, relative) => `from "${moduleUrl(new URL(relative + ".ts", url))}"`);
  const result = "data:text/javascript;base64," + Buffer.from(js).toString("base64");
  cache.set(url.href, result);
  return result;
}
export const load = (file) => import(moduleUrl(file));
export const ethers = require("ethers");
