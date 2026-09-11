import { Router, type Request, type Response } from "express";

const router: import("express").Router = Router();

/** Forward GraphQL to the configured Studio/local endpoint. Never log the URL. */
router.post("/query", async (req: Request, res: Response) => {
  const url = process.env.GRAPH_URL || process.env.MACI_GRAPH_URL;
  if (!url) {
    return res.status(404).json({ error: "NOT_CONFIGURED" });
  }
  const timeoutMs = Number(process.env.GRAPH_TIMEOUT_MS || 8000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ query: req.body?.query, variables: req.body?.variables }),
      signal: controller.signal,
    });
    const text = await upstream.text();
    res.status(upstream.status).type("application/json").send(text);
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return res.status(aborted ? 504 : 502).json({
      error: aborted ? "GRAPH_TIMEOUT" : "GRAPH_UNAVAILABLE",
      message: "Indexed query failed.",
    });
  } finally {
    clearTimeout(timer);
  }
});

export default router;
