// Trial-server ESM loader (node 22): transpiles .ts/.mts on the fly and
// resolves relative imports with .ts/.mts fallbacks, so src/trialServer.ts can
// import the .mts SDK boundaries that CJS ts-node-dev cannot handle.
// Usage: node --loader ./tests/p2/run-trial.mjs ./tests/p2/run-trial-entry.mjs
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(process.env.P2_TOOLCHAIN_PACKAGE_JSON || import.meta.url);
const ts = require("typescript");

async function exists(u) {
  try {
    await readFile(u);
    return true;
  } catch {
    return false;
  }
}

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith(".")) return nextResolve(specifier, context);
  const base = new URL(context.parentURL ?? import.meta.url);
  for (const candidate of [specifier, specifier + ".ts", specifier + ".mts"]) {
    const u = new URL(candidate, base);
    if (await exists(u)) return { url: u.href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".ts") || url.endsWith(".mts")) {
    // fs.readFile needs a URL OBJECT, not a string ("file:///..." as a string
    // is treated as a literal path and fails with ENOENT).
    const source = await readFile(new URL(url), "utf8");
    const js = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    return { format: "module", source: js, shortCircuit: true };
  }
  return nextLoad(url, context);
}
