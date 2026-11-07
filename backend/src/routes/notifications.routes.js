import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({ where: { userId: req.user.sub, read: false } }),
  ]);
  res.json({ items, unread });
});

// Declared before "/:id/read" so the literal path always wins.
router.put("/read-all", async (req, res) => {
  const result = await prisma.notification.updateMany({
    where: { userId: req.user.sub, read: false },
    data: { read: true },
  });
  res.json({ ok: true, updated: result.count });
});

router.put("/:id/read", async (req, res) => {
  // Ownership check: a user may only touch their own notifications.
  const notification = await prisma.notification.findFirst({
    where: { id: req.params.id, userId: req.user.sub },
  });
  if (!notification) return res.status(404).json({ error: "Notification not found" });

  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { read: true },
  });
  res.json({ notification: updated });
});

export default router;
