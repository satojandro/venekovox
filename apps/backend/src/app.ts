import express from "express";
import cors from "cors";
import helmet from "helmet";
import verifyRoute from "./routes/verify";
import pollsRoute from "./routes/polls";
import treesRoute from "./routes/trees";
import graphRoute from "./routes/graph";
import { createEligibilityRouter } from "./routes/eligibility";
import { createDebugRouter } from "./routes/debug";
import { createProductEligibility } from "./eligibility/product";
import { startBackgroundRefresh } from "./trees/service";

const app: import("express").Express = express();

app.use(helmet());

const extraOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://venekovox.com", "https://www.venekovox.com", "https://app.uxisnear.com", ...extraOrigins]
        : [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3002",
            "http://app.uxisnear.com:3000",
            "http://app.uxisnear.com:3100",
            ...extraOrigins,
          ],
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "venekovox-backend",
    version: "1.0.0",
  });
});

app.get("/", (req, res) => {
  res.json({
    name: "VenekoVox Backend",
    description: "ZKPassport eligibility + poll schedule service for VenekoVox",
    version: "1.0.0",
    endpoints: {
      "POST /verify": "Legacy Self Pass verifier (migration debt — do not extend)",
      "POST /eligibility/challenge": "Start a ZKPassport eligibility challenge",
      "POST /eligibility/begin": "Pin the salted query after wallet control",
      "POST /eligibility/receive": "Relay proofs for server-side verify",
      "POST /eligibility/authorize": "Issue EIP-712 gate evidence",
      "GET /eligibility/health": "Eligibility adapter health",
      "GET /health": "Service health check",
      "GET /polls/configured": "Configured poll on-chain voting window",
      "GET /trees/inclusion-proof": "Pinned MACI signup inclusion proof",
      "GET /trees/joined-count": "Indexed joined-participant count (not votes)",
      "POST /graph/query": "Proxied subgraph GraphQL",
      "GET /": "This API information",
    },
    documentation: "See README.md for setup and testing instructions",
  });
});

const eligibility = createProductEligibility(process.env as import("./eligibility/product").ProductEnv);
app.use("/verify", verifyRoute);
app.use("/polls", pollsRoute);
app.use("/trees", treesRoute);
app.use("/graph", graphRoute);
// Client-error intake: makes live-test failures readable from the server log
// instead of the test machine's browser devtools. Error text only, scrubbed.
app.use("/debug", createDebugRouter(eligibility.mode));
app.use(
  "/eligibility",
  createEligibilityRouter({
    service: eligibility.service,
    sessions: eligibility.sessions,
    mode: eligibility.mode,
  }),
);

app.use("*", (req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      "POST /verify",
      "POST /eligibility/challenge",
      "POST /eligibility/begin",
      "POST /eligibility/receive",
      "POST /eligibility/authorize",
      "GET /eligibility/health",
      "GET /health",
      "GET /polls/configured",
      "GET /trees/inclusion-proof",
      "GET /trees/joined-count",
      "POST /graph/query",
      "POST /debug/client-error",
      "GET /",
    ],
  });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Error:", err instanceof Error ? err.message : "Internal Server Error");
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
  });
});

startBackgroundRefresh();

export default app;
