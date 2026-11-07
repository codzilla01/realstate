import "dotenv/config";
// Makes rejected promises inside async route handlers reach the error
// middleware instead of leaving the request hanging (Express 4 behaviour).
import "express-async-errors";

import express from "express";
import cors from "cors";
import morgan from "morgan";

import { config } from "./lib/config.js";
import { prisma } from "./lib/prisma.js";
import { securityHeaders } from "./middleware/security.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { rateLimit } from "./middleware/rateLimit.js";

import authRoutes from "./routes/auth.routes.js";
import propertiesRoutes from "./routes/properties.routes.js";
import clientsRoutes from "./routes/clients.routes.js";
import contractsRoutes from "./routes/contracts.routes.js";
import requestsRoutes from "./routes/requests.routes.js";
import usersRoutes from "./routes/users.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import reportsRoutes from "./routes/reports.routes.js";

const app = express();

// Behind nginx / a cloud proxy we need the real client IP for rate limiting.
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(securityHeaders);
app.use(
  cors({
    origin: config.corsOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86_400,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

if (config.logRequests) {
  app.use(morgan(config.isProduction ? "combined" : "dev"));
}

// A coarse global limit protects the whole API from accidental floods; the
// sensitive endpoints have stricter limits of their own.
app.use("/api", rateLimit({ windowMs: 60_000, max: 300 }));

app.get("/api/health", async (req, res) => {
  const startedAt = Date.now();
  let database = "up";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "down";
  }
  const healthy = database === "up";
  res.status(healthy ? 200 : 503).json({
    ok: healthy,
    env: config.nodeEnv,
    database,
    uptimeSeconds: Math.round(process.uptime()),
    latencyMs: Date.now() - startedAt,
    ts: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/properties", propertiesRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/contracts", contractsRoutes);
app.use("/api/requests", requestsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/reports", reportsRoutes);

app.use(notFound);
app.use(errorHandler);

const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(
    `[api] listening on http://localhost:${config.port} (env=${config.nodeEnv})`
  );
});

async function shutdown(signal) {
  console.log(`[api] ${signal} received — shutting down gracefully`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
    } finally {
      process.exit(0);
    }
  });
  // Do not hang forever on stuck connections.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export { app };
