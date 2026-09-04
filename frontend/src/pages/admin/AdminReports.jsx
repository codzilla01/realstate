import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../../api/client";

export default function AdminReports() {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api.get("/reports/summary").then(({ data }) => setSummary(data));
  }, []);

  if (!summary) return <p className="text-white/50">جاري التحميل...</p>;

  const byPurposeData = summary.byPurpose.map((p) => ({
    name: p.purpose === "SALE" ? "بيع" : "إيجار",
    count: p._count._all,
  }));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">التقارير</h1>

      <div className="rounded-xl border border-white/10 bg-ink-800 p-6">
        <h2 className="font-semibold mb-4">العقارات حسب الغرض (بيع / إيجار)</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byPurposeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="name" stroke="#ffffff60" />
              <YAxis stroke="#ffffff60" />
              <Tooltip contentStyle={{ background: "#14161C", border: "1px solid #ffffff20" }} />
              <Bar dataKey="count" fill="#D4AF37" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-ink-800 p-6 grid sm:grid-cols-3 gap-6 text-center">
        <div>
          <p className="text-white/50 text-sm">إجمالي الإيرادات (عقود مكتملة)</p>
          <p className="text-2xl font-bold text-gold mt-1">
            {new Intl.NumberFormat("ar-EG").format(summary.totals.totalRevenue)}
          </p>
        </div>
        <div>
          <p className="text-white/50 text-sm">العقود النشطة</p>
          <p className="text-2xl font-bold text-gold mt-1">{summary.totals.activeContracts}</p>
        </div>
        <div>
          <p className="text-white/50 text-sm">طلبات جديدة</p>
          <p className="text-2xl font-bold text-gold mt-1">{summary.totals.newRequests}</p>
        </div>
      </div>
    </div>
  );
}
