import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireRole("ADMIN", "MANAGER"));

router.get("/summary", async (req, res) => {
  const [
    totalProperties,
    availableProperties,
    totalClients,
    activeContracts,
    completedContracts,
    newRequests,
    revenueAgg,
  ] = await Promise.all([
    prisma.property.count(),
    prisma.property.count({ where: { status: "AVAILABLE" } }),
    prisma.client.count(),
    prisma.contract.count({ where: { status: "ACTIVE" } }),
    prisma.contract.count({ where: { status: "COMPLETED" } }),
    prisma.propertyRequest.count({ where: { status: "NEW" } }),
    prisma.contract.aggregate({
      where: { status: "COMPLETED" },
      _sum: { amount: true },
    }),
  ]);

  const byType = await prisma.property.groupBy({
    by: ["type"],
    _count: { _all: true },
  });

  const byPurpose = await prisma.property.groupBy({
    by: ["purpose"],
    _count: { _all: true },
  });

  res.json({
    totals: {
      totalProperties,
      availableProperties,
      totalClients,
      activeContracts,
      completedContracts,
      newRequests,
      totalRevenue: revenueAgg._sum.amount || 0,
    },
    byType,
    byPurpose,
  });
});

export default router;
