import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireRole("ADMIN", "MANAGER", "AGENT"));

router.get("/", async (req, res) => {
  const { status } = req.query;
  const where = status ? { status: String(status).toUpperCase() } : {};
  const contracts = await prisma.contract.findMany({
    where,
    include: { property: true, client: true, agent: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ items: contracts });
});

const contractSchema = z.object({
  propertyId: z.string(),
  clientId: z.string(),
  agentId: z.string().optional(),
  type: z.enum(["SALE", "RENT"]),
  status: z.enum(["PENDING", "ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
  amount: z.number().positive(),
  commissionPct: z.number().min(0).max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

router.post("/", validate(contractSchema), async (req, res) => {
  const contract = await prisma.contract.create({
    data: {
      ...req.body,
      commissionPct: req.body.commissionPct ?? 3,
      startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
      endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
    },
  });
  res.status(201).json({ contract });
});

router.put("/:id", validate(contractSchema.partial()), async (req, res) => {
  const { startDate, endDate, ...rest } = req.body;
  const contract = await prisma.contract.update({
    where: { id: req.params.id },
    data: {
      ...rest,
      ...(startDate ? { startDate: new Date(startDate) } : {}),
      ...(endDate ? { endDate: new Date(endDate) } : {}),
    },
  });
  res.json({ contract });
});

router.delete("/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  await prisma.contract.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
