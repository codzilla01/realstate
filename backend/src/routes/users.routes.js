import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireRole("ADMIN"));

function toPublicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

router.get("/", async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ items: users.map(toPublicUser) });
});

router.get("/:id", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: toPublicUser(user) });
});

// Staff accounts are created by an administrator — public sign-up is off.
const createSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().min(8).max(20),
  email: z.string().email().optional(),
  password: z.string().min(8).max(128),
  role: z.enum(["ADMIN", "MANAGER", "AGENT", "VIEWER"]).optional(),
});

router.post("/", validate(createSchema), async (req, res) => {
  const { name, phone, email, password, role } = req.body;

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) return res.status(409).json({ error: "Phone number already registered" });

  const user = await prisma.user.create({
    data: {
      name,
      phone,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: role || "AGENT",
    },
  });
  res.status(201).json({ user: toPublicUser(user) });
});

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  role: z.enum(["ADMIN", "MANAGER", "AGENT", "VIEWER"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(128).optional(),
});

router.put("/:id", validate(updateSchema), async (req, res) => {
  const { password, ...rest } = req.body;

  // Guard rails: an admin cannot lock themselves out or drop their own role.
  if (req.params.id === req.user.sub) {
    if (rest.isActive === false) {
      return res.status(400).json({ error: "You cannot deactivate your own account" });
    }
    if (rest.role && rest.role !== "ADMIN") {
      return res.status(400).json({ error: "You cannot change your own role" });
    }
  }

  const data = { ...rest };
  if (password) data.passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.update({ where: { id: req.params.id }, data });
  res.json({ user: toPublicUser(user) });
});

router.delete("/:id", async (req, res) => {
  if (req.params.id === req.user.sub) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }
  await prisma.user.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
