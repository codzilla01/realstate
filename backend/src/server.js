import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";

import authRoutes from "./routes/auth.routes.js";
import propertiesRoutes from "./routes/properties.routes.js";
import clientsRoutes from "./routes/clients.routes.js";
import contractsRoutes from "./routes/contracts.routes.js";
import requestsRoutes from "./routes/requests.routes.js";
import usersRoutes from "./routes/users.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import reportsRoutes from "./routes/reports.routes.js";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));

app.get("/api/health", (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.use("/api/auth", authRoutes);
app.use("/api/properties", propertiesRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/contracts", contractsRoutes);
app.use("/api/requests", requestsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/reports", reportsRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
