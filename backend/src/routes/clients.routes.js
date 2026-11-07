import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.js";
import { requireAuth, requireRole, requireStaff } from "../middleware/auth.js";
import { serializeClient } from "../lib/serialize.js";

const router = Router();
// Everyone on staff (including read-only VIEWER) can browse clients.
router.use(requireAuth, requireRole("ADMIN", "MANAGER", "AGENT", "VIEWER"));

router.get("/", async (req, res) => {
  const { q } = req.query;
  const where = q
    ? { OR: [{ name: { contains: String(q) } }, { phone: { contains: String(q) } }] }
    : {};
  const clients = await prisma.client.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json({ items: clients });
});

router.get("/:id", async (req, res) => {
  const client = await prisma.client.findUnique({
    where: { id: req.params.id },
    include: { contracts: true, requests: true },
  });
  if (!client) return res.status(404).json({ error: "Client not found" });
  res.json({ client: serializeClient(client) });
});

const clientSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional(),
  notes: z.string().optional(),
});

router.post("/", requireStaff, validate(clientSchema), async (req, res) => {
  const client = await prisma.client.create({ data: req.body });
  res.status(201).json({ client });
});

router.put("/:id", requireStaff, validate(clientSchema.partial()), async (req, res) => {
  const client = await prisma.client.update({ where: { id: req.params.id }, data: req.body });
  res.json({ client: serializeClient(client) });
});

router.delete("/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  await prisma.client.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
