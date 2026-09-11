import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const ethersUrl = pathToFileURL(require.resolve("ethers")).href;
const srcDir = fileURLToPath(new URL("../../src/ens/", import.meta.url));
const files = ["pollName.ts", "ensv2.ts", "labels.ts", "profile.ts", "registration.ts", "injectedNamingWallet.ts"];
const outDir = mkdtempSync(join(tmpdir(), "venekovox-ens-"));

for (const file of files) {
  let js = ts.transpileModule(readFileSync(join(srcDir, file), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: file,
  }).outputText;
  js = js.replaceAll('from "ethers"', `from "${ethersUrl}"`);
  js = js.replace(/from "(\.\/[^"]+)"/g, (_m, spec) => `from "${spec.endsWith(".js") ? spec : spec + ".js"}"`);
  writeFileSync(join(outDir, file.replace(/\.ts$/, ".js")), js);
}

export const ens = await import(pathToFileURL(join(outDir, "registration.js")).href);
export const profile = await import(pathToFileURL(join(outDir, "profile.js")).href);
export const ensv2 = await import(pathToFileURL(join(outDir, "ensv2.js")).href);
export const labels = await import(pathToFileURL(join(outDir, "labels.js")).href);
export const pollName = await import(pathToFileURL(join(outDir, "pollName.js")).href);
