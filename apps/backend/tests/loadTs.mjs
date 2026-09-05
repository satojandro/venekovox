import { readFile } from "node:fs/promises";

let transpile;

async function getTranspile() {
  if (transpile) return transpile;
  try {
    const ts = await import("typescript");
    transpile = (source) =>
      ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
      }).outputText;
  } catch (error) {
    if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
    const { stripTypeScriptTypes } = await import("node:module");
    if (!stripTypeScriptTypes) throw new Error("Install workspace dependencies to run this test on Node 20.");
    transpile = (source) => stripTypeScriptTypes(source);
  }
  return transpile;
}

const EXPRESS_STUB = `
export function Router() {
  const stack = [];
  const add = (method, path, ...handlers) => {
    stack.push({
      route: {
        path,
        methods: { [method]: true },
        stack: handlers.map((handle) => ({ handle })),
      },
    });
    return api;
  };
  const api = {
    stack,
    get: (path, ...handlers) => add("get", path, ...handlers),
    post: (path, ...handlers) => add("post", path, ...handlers),
    put: (path, ...handlers) => add("put", path, ...handlers),
    delete: (path, ...handlers) => add("delete", path, ...handlers),
  };
  return api;
}
export default { Router };
`;

const EXPRESS_STUB_URL = `data:text/javascript;base64,${Buffer.from(EXPRESS_STUB).toString("base64")}`;

const loading = new Map();

async function toDataUrl(fileUrl) {
  const key = fileUrl.href;
  if (loading.has(key)) return loading.get(key);
  const pending = (async () => {
    let source = await readFile(fileUrl, "utf8");
    source = source
      .replaceAll(`from "express"`, `from "${EXPRESS_STUB_URL}"`)
      .replaceAll(`from 'express'`, `from "${EXPRESS_STUB_URL}"`);
    const specs = [...source.matchAll(/from\s+["'](\.[^"']+)["']/g)].map((match) => match[1]);
    for (const spec of [...new Set(specs)]) {
      const resolved = spec.endsWith(".ts") ? spec : `${spec}.ts`;
      const depUrl = await toDataUrl(new URL(resolved, fileUrl));
      source = source.replaceAll(`from "${spec}"`, `from "${depUrl}"`).replaceAll(`from '${spec}'`, `from "${depUrl}"`);
    }
    const javascript = (await getTranspile())(source);
    return `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`;
  })();
  loading.set(key, pending);
  return pending;
}

export async function importTs(relativeFromTest, importMetaUrl) {
  const dataUrl = await toDataUrl(new URL(relativeFromTest, importMetaUrl));
  return import(dataUrl);
}
