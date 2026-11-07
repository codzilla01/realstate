import { config } from "../lib/config.js";

const PRISMA_ERRORS = {
  P2002: { status: 409, message: "A record with these values already exists." },
  P2003: { status: 400, message: "Related record not found." },
  P2025: { status: 404, message: "Record not found." },
  P2014: { status: 409, message: "This change would break a required relation." },
};

export function notFound(req, res) {
  res.status(404).json({ error: "Not found", path: req.originalUrl });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const prismaError = PRISMA_ERRORS[err?.code];
  const status = prismaError?.status || err.status || err.statusCode || 500;
  const message =
    prismaError?.message ||
    (status >= 500 && config.isProduction
      ? "Internal server error"
      : err.message || "Internal server error");

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  } else if (!config.isProduction) {
    console.warn(`[warn] ${req.method} ${req.originalUrl} -> ${status}: ${message}`);
  }

  if (res.headersSent) return next(err);

  const body = { error: message };
  if (err.details) body.details = err.details;
  if (!config.isProduction && status >= 500) body.stack = err.stack;

  return res.status(status).json(body);
}
