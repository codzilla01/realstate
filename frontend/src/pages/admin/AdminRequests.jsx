import { useEffect, useState } from "react";
import { api } from "../../api/client";
import DataTable from "../../components/DataTable";

const STATUS_LABELS = { NEW: "جديد", CONTACTED: "تم التواصل", IN_PROGRESS: "قيد المعالجة", CLOSED: "مغلق" };

export default function AdminRequests() {
  const [items, setItems] = useState([]);

  function load() {
    api.get("/requests").then(({ data }) => setItems(data.items));
  }
  useEffect(load, []);

  async function updateStatus(id, status) {
    await api.put(`/requests/${id}`, { status });
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">طلبات العملاء</h1>
      <DataTable
        columns={[
          { key: "name", label: "الاسم" },
          { key: "phone", label: "الهاتف" },
          { key: "property", label: "العقار", render: (r) => r.property?.titleAr || r.property?.title || "—" },
          { key: "message", label: "الرسالة", render: (r) => r.message || "—" },
          { key: "status", label: "الحالة", render: (r) => STATUS_LABELS[r.status] },
        ]}
        rows={items}
        actions={(row) => (
          <select
            value={row.status}
            onChange={(e) => updateStatus(row.id, e.target.value)}
            className="rounded-md bg-ink-900 border border-white/10 px-2 py-1 text-xs"
          >
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        )}
      />
    </div>
  );
}
