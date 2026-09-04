import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// ── Public: submit an inquiry / viewing request ──
const requestSchema = z.object({
  propertyId: z.string().optional(),
  name: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional(),
  message: z.string().optional(),
});

router.post("/", validate(requestSchema), async (req, res) => {
  const request = await prisma.propertyRequest.create({ data: req.body });

  // Notify admins/managers of the new inquiry
  const staff = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true },
    select: { id: true },
  });
  if (staff.length) {
    await prisma.notification.createMany({
      data: staff.map((u) => ({
        userId: u.id,
        title: "New property inquiry",
        body: `${request.name} (${request.phone}) submitted an inquiry.`,
      })),
    });
  }

  res.status(201).json({ request });
});

// ── Admin: manage requests ──
router.use(requireAuth, requireRole("ADMIN", "MANAGER", "AGENT"));

router.get("/", async (req, res) => {
  const { status } = req.query;
  const where = status ? { status: String(status).toUpperCase() } : {};
  const items = await prisma.propertyRequest.findMany({
    where,
    include: { property: true, client: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ items });
});

router.put("/:id", validate(z.object({
  status: z.enum(["NEW", "CONTACTED", "IN_PROGRESS", "CLOSED"]).optional(),
  clientId: z.string().optional(),
})), async (req, res) => {
  const request = await prisma.propertyRequest.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json({ request });
});

export default router;
