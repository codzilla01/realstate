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

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(["ADMIN", "MANAGER", "AGENT", "VIEWER"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

router.put("/:id", validate(updateSchema), async (req, res) => {
  const { password, ...rest } = req.body;
  const data = { ...rest };
  if (password) data.passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.update({ where: { id: req.params.id }, data });
  res.json({ user: toPublicUser(user) });
});

router.delete("/:id", async (req, res) => {
  await prisma.user.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
