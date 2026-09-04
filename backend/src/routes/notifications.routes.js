import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const items = await prisma.notification.findMany({
    where: { userId: req.user.sub },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({ items });
});

router.put("/:id/read", async (req, res) => {
  const notification = await prisma.notification.update({
    where: { id: req.params.id },
    data: { read: true },
  });
  res.json({ notification });
});

router.put("/read-all", async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user.sub, read: false },
    data: { read: true },
  });
  res.json({ ok: true });
});

export default router;
