import "dotenv/config";

const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

const DEV_JWT_SECRET = "dev-only-insecure-secret-change-me";

function parseOrigins(value) {
  if (!value || value.trim() === "*") return "*";
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function readJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (isProduction) {
    if (!secret || secret.length < 32) {
      throw new Error(
        "JWT_SECRET must be set to a random string of at least 32 characters in production."
      );
    }
    return secret;
  }
  if (!secret) {
    console.warn(
      "[config] JWT_SECRET is not set — using an insecure development secret. Never deploy like this."
    );
    return DEV_JWT_SECRET;
  }
  return secret;
}

export const config = {
  nodeEnv: NODE_ENV,
  isProduction,
  port: Number(process.env.PORT || 4000),
  jwtSecret: readJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN),
  otpExpiresMinutes: Number(process.env.OTP_EXPIRES_MINUTES || 5),
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 5),
  // Dev-only convenience: return the OTP in the API response so the flow can be
  // tested without an SMS provider. Must stay off in production.
  exposeDevOtp:
    !isProduction && process.env.EXPOSE_DEV_OTP !== "false",
  allowPublicRegistration:
    !isProduction && process.env.ALLOW_PUBLIC_REGISTRATION === "true",
  logRequests: process.env.LOG_REQUESTS !== "false",
};
