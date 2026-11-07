import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { config } from "../lib/config.js";
import { signToken } from "../lib/jwt.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { clientKey, rateLimit } from "../middleware/rateLimit.js";

const router = Router();

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function toPublicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

const phoneSchema = z.string().min(8).max(20);

// ── Bootstrap registration ────────────────────────────────────────────────
// Public self-registration is disabled by default: on a real estate CRM the
// admin creates staff accounts from the dashboard (POST /api/users). It can be
// temporarily enabled with ALLOW_PUBLIC_REGISTRATION=true to bootstrap the
// very first account, and it always creates an AGENT — never an ADMIN.
const registerSchema = z.object({
  name: z.string().min(2).max(120),
  phone: phoneSchema,
  email: z.string().email().optional(),
  password: z.string().min(8).max(128),
});

router.post(
  "/register",
  rateLimit({ windowMs: 15 * 60_000, max: 10 }),
  validate(registerSchema),
  async (req, res) => {
    if (!config.allowPublicRegistration) {
      return res.status(403).json({
        error:
          "Public registration is disabled. Ask an administrator to create your account.",
      });
    }

    const { name, phone, email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) return res.status(409).json({ error: "Phone number already registered" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, phone, email, passwordHash, role: "AGENT" },
    });

    return res.status(201).json({ user: toPublicUser(user) });
  }
);

// ── Login with phone + password ───────────────────────────────────────────
const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1).max(128),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  message: "Too many login attempts. Try again in a few minutes.",
  keyGenerator: (req) => `login:${clientKey(req)}:${req.body?.phone || ""}`,
});

router.post("/login", loginLimiter, validate(loginSchema), async (req, res) => {
  const { phone, password } = req.body;

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !user.isActive) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken({ sub: user.id, role: user.role, phone: user.phone });
  return res.json({ token, user: toPublicUser(user) });
});

// ── Request OTP (alternative to password login) ───────────────────────────
const otpRequestSchema = z.object({ phone: phoneSchema });

router.post(
  "/otp/request",
  rateLimit({
    windowMs: 10 * 60_000,
    max: 5,
    message: "Too many code requests. Try again later.",
    keyGenerator: (req) => `otp-req:${clientKey(req)}:${req.body?.phone || ""}`,
  }),
  validate(otpRequestSchema),
  async (req, res) => {
    const { phone } = req.body;

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user || !user.isActive) {
      // Do not leak which phone numbers exist.
      return res.json({ message: "If this account exists, a verification code has been sent." });
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + config.otpExpiresMinutes * 60_000);

    // Any previous unused code becomes invalid as soon as a new one is issued.
    await prisma.otpCode.updateMany({
      where: { userId: user.id, consumed: false, purpose: "LOGIN" },
      data: { consumed: true },
    });

    await prisma.otpCode.create({
      data: { userId: user.id, code, expiresAt, purpose: "LOGIN" },
    });

    // MVP: log to the console instead of sending a real SMS.
    // Replace this block with an SMS provider (Twilio, Vonage, ...).
    if (!config.isProduction) {
      console.log(`[OTP] ${phone} → ${code} (valid ${config.otpExpiresMinutes}m)`);
    }

    return res.json({
      message: "If this account exists, a verification code has been sent.",
      ...(config.exposeDevOtp ? { devOnlyOtp: code } : {}),
    });
  }
);

// ── Verify OTP → issue token ──────────────────────────────────────────────
const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

router.post(
  "/otp/verify",
  rateLimit({
    windowMs: 10 * 60_000,
    max: 20,
    message: "Too many verification attempts. Try again later.",
    keyGenerator: (req) => `otp-verify:${clientKey(req)}:${req.body?.phone || ""}`,
  }),
  validate(otpVerifySchema),
  async (req, res) => {
    const { phone, code } = req.body;

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid or expired code" });
    }

    const otp = await prisma.otpCode.findFirst({
      where: {
        userId: user.id,
        consumed: false,
        purpose: "LOGIN",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otp || otp.attempts >= config.otpMaxAttempts) {
      return res.status(401).json({ error: "Invalid or expired code" });
    }

    // Every guess counts (right or wrong) so a 6-digit code cannot be
    // brute-forced inside its validity window.
    const matches = timingSafeEqual(Buffer.from(otp.code), Buffer.from(code));

    if (!matches) {
      await prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      return res.status(401).json({ error: "Invalid or expired code" });
    }

    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumed: true, attempts: { increment: 1 } },
    });

    const token = signToken({ sub: user.id, role: user.role, phone: user.phone });
    return res.json({ token, user: toPublicUser(user) });
  }
);

// ── Current user ──────────────────────────────────────────────────────────
router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (!user || !user.isActive) return res.status(401).json({ error: "User not found" });
  return res.json({ user: toPublicUser(user) });
});

export default router;
