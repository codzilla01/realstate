import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.js";
import { requireAuth, requireRole, requireStaff } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = Router();

// ── Public: submit an inquiry / viewing request ──
const requestSchema = z.object({
  propertyId: z.string().optional(),
  name: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional(),
  message: z.string().optional(),
});

router.post(
  "/",
  rateLimit({ windowMs: 10 * 60_000, max: 10, message: "Too many requests. Please try again later." }),
  validate(requestSchema),
  async (req, res) => {
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
          title: "طلب جديد على أحد العقارات",
          body: `${request.name} (${request.phone}) أرسل طلباً جديداً.`,
        })),
      });
    }

    res.status(201).json({ request });
  }
);

// ── Admin: manage requests ──
// Read access for the whole staff, status updates are checked below.
router.use(requireAuth, requireRole("ADMIN", "MANAGER", "AGENT", "VIEWER"));

router.get("/", async (req, res) => {
  const { status } = req.query;
  const statuses = ["NEW", "CONTACTED", "IN_PROGRESS", "CLOSED"];
  const requested = String(status || "").toUpperCase();
  const where = statuses.includes(requested) ? { status: requested } : {};
  const items = await prisma.propertyRequest.findMany({
    where,
    include: { property: true, client: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ items });
});

router.put("/:id", requireStaff, validate(z.object({
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
