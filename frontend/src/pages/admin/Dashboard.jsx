import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { api } from "../../api/client";

const COLORS = ["#D4AF37", "#E9CD6B", "#A9862B", "#8A6D22", "#F2E3B0", "#6B551A"];

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-ink-800 p-5">
      <p className="text-white/50 text-sm">{label}</p>
      <p className="text-2xl font-bold text-gold mt-1">{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api.get("/reports/summary").then(({ data }) => setSummary(data));
  }, []);

  if (!summary) return <p className="text-white/50">جاري التحميل...</p>;

  const { totals, byType } = summary;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">لوحة المعلومات</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="إجمالي العقارات" value={totals.totalProperties} />
        <Stat label="العقارات المتاحة" value={totals.availableProperties} />
        <Stat label="العملاء" value={totals.totalClients} />
        <Stat label="العقود النشطة" value={totals.activeContracts} />
        <Stat label="العقود المكتملة" value={totals.completedContracts} />
        <Stat label="طلبات جديدة" value={totals.newRequests} />
        <Stat
          label="إجمالي الإيرادات"
          value={new Intl.NumberFormat("ar-EG").format(totals.totalRevenue)}
        />
      </div>

      <div className="rounded-xl border border-white/10 bg-ink-800 p-6">
        <h2 className="font-semibold mb-4">توزيع العقارات حسب النوع</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={byType}
                dataKey="_count._all"
                nameKey="type"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {byType.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
