// Minimal static server for trial HTML pages (no express/deps).
// Usage: node static-trial.mjs [port] [file]
// Serves ONE html file at "/". Used for the policy-mode isolation test page.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const port = Number(process.argv[2] || 3114);
const file = resolve(process.argv[3] || "src/trialPolicyTest.html");

const server = createServer(async (_req, res) => {
  try {
    const html = await readFile(file, "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  } catch (e) {
    res.writeHead(500);
    res.end("ERR " + e.message);
  }
});
server.listen(port, () => console.log(`static-trial serving ${file} on :${port}`));
