import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const OTP_EXPIRES_MINUTES = Number(process.env.OTP_EXPIRES_MINUTES || 5);

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function toPublicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

// ── Register (admin creates staff accounts in practice, but open for MVP bootstrap) ──
const registerSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "MANAGER", "AGENT", "VIEWER"]).optional(),
});

router.post("/register", validate(registerSchema), async (req, res) => {
  const { name, phone, email, password, role } = req.body;

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) return res.status(409).json({ error: "Phone number already registered" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, phone, email, passwordHash, role: role || "AGENT" },
  });

  res.status(201).json({ user: toPublicUser(user) });
});

// ── Login with phone + password ──
const loginSchema = z.object({
  phone: z.string().min(8),
  password: z.string().min(1),
});

router.post("/login", validate(loginSchema), async (req, res) => {
  const { phone, password } = req.body;

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !user.isActive) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken({ sub: user.id, role: user.role, phone: user.phone });
  res.json({ token, user: toPublicUser(user) });
});

// ── Request OTP (alternative to password login) ──
const otpRequestSchema = z.object({
  phone: z.string().min(8),
});

router.post("/otp/request", validate(otpRequestSchema), async (req, res) => {
  const { phone } = req.body;

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !user.isActive) {
    // Do not leak which phone numbers exist
    return res.json({ message: "If this account exists, an OTP has been sent." });
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60_000);

  await prisma.otpCode.create({
    data: { userId: user.id, code, expiresAt, purpose: "LOGIN" },
  });

  // MVP: log to console instead of sending a real SMS.
  // Swap this block for a real SMS provider (Twilio, etc.) in production.
  console.log(`[OTP] Phone ${phone} → code ${code} (expires in ${OTP_EXPIRES_MINUTES}m)`);

  res.json({
    message: "If this account exists, an OTP has been sent.",
    devOnlyOtp: process.env.NODE_ENV === "production" ? undefined : code,
  });
});

// ── Verify OTP → issue token ──
const otpVerifySchema = z.object({
  phone: z.string().min(8),
  code: z.string().length(6),
});

router.post("/otp/verify", validate(otpVerifySchema), async (req, res) => {
  const { phone, code } = req.body;

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) return res.status(401).json({ error: "Invalid or expired code" });

  const otp = await prisma.otpCode.findFirst({
    where: { userId: user.id, code, consumed: false, purpose: "LOGIN" },
    orderBy: { createdAt: "desc" },
  });

  if (!otp || otp.expiresAt < new Date()) {
    return res.status(401).json({ error: "Invalid or expired code" });
  }

  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });

  const token = signToken({ sub: user.id, role: user.role, phone: user.phone });
  res.json({ token, user: toPublicUser(user) });
});

// ── Current user ──
router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: toPublicUser(user) });
});

export default router;
