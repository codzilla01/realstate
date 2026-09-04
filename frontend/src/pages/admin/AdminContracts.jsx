import { useEffect, useState } from "react";
import { api } from "../../api/client";
import DataTable from "../../components/DataTable";

export default function AdminContracts() {
  const [items, setItems] = useState([]);
  const [properties, setProperties] = useState([]);
  const [clients, setClients] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ propertyId: "", clientId: "", type: "SALE", amount: "", commissionPct: 3 });

  function load() {
    api.get("/contracts").then(({ data }) => setItems(data.items));
  }

  useEffect(() => {
    load();
    api.get("/properties", { params: { pageSize: 100, status: "" } }).then(({ data }) => setProperties(data.items));
    api.get("/clients").then(({ data }) => setClients(data.items));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    await api.post("/contracts", {
      ...form,
      amount: Number(form.amount),
      commissionPct: Number(form.commissionPct),
    });
    setForm({ propertyId: "", clientId: "", type: "SALE", amount: "", commissionPct: 3 });
    setShowForm(false);
    load();
  }

  async function updateStatus(id, status) {
    await api.put(`/contracts/${id}`, { status });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">العقود</h1>
        <button onClick={() => setShowForm((s) => !s)} className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-gold-light">
          + عقد جديد
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-ink-800 p-6 grid sm:grid-cols-3 gap-4">
          <select required value={form.propertyId} onChange={(e) => setForm({ ...form, propertyId: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm">
            <option value="">اختر عقار</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.titleAr || p.title}</option>
            ))}
          </select>
          <select required value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm">
            <option value="">اختر عميل</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm">
            <option value="SALE">بيع</option>
            <option value="RENT">إيجار</option>
          </select>
          <input required type="number" placeholder="المبلغ" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm" />
          <input type="number" step="0.1" placeholder="نسبة العمولة %" value={form.commissionPct} onChange={(e) => setForm({ ...form, commissionPct: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm" />
          <div className="sm:col-span-3 flex gap-3">
            <button className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-ink-900">حفظ</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md border border-white/10 px-4 py-2 text-sm">إلغاء</button>
          </div>
        </form>
      )}

      <DataTable
        columns={[
          { key: "property", label: "العقار", render: (r) => r.property?.titleAr || r.property?.title },
          { key: "client", label: "العميل", render: (r) => r.client?.name },
          { key: "type", label: "النوع", render: (r) => (r.type === "SALE" ? "بيع" : "إيجار") },
          { key: "amount", label: "المبلغ", render: (r) => new Intl.NumberFormat("ar-EG").format(r.amount) },
          { key: "status", label: "الحالة" },
        ]}
        rows={items}
        actions={(row) => (
          <select
            value={row.status}
            onChange={(e) => updateStatus(row.id, e.target.value)}
            className="rounded-md bg-ink-900 border border-white/10 px-2 py-1 text-xs"
          >
            <option value="PENDING">معلق</option>
            <option value="ACTIVE">نشط</option>
            <option value="COMPLETED">مكتمل</option>
            <option value="CANCELLED">ملغى</option>
          </select>
        )}
      />
    </div>
  );
}
