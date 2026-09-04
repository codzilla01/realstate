import { useEffect, useState } from "react";
import { api } from "../../api/client";
import DataTable from "../../components/DataTable";

export default function AdminClients() {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });

  function load() {
    api.get("/clients").then(({ data }) => setItems(data.items));
  }
  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    await api.post("/clients", form);
    setForm({ name: "", phone: "", email: "", notes: "" });
    setShowForm(false);
    load();
  }

  async function handleDelete(id) {
    if (!confirm("حذف هذا العميل؟")) return;
    await api.delete(`/clients/${id}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">العملاء</h1>
        <button onClick={() => setShowForm((s) => !s)} className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-gold-light">
          + إضافة عميل
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-ink-800 p-6 grid sm:grid-cols-2 gap-4">
          <input required placeholder="الاسم" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm" />
          <input required placeholder="الهاتف" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm" />
          <input placeholder="البريد الإلكتروني" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm" />
          <input placeholder="ملاحظات" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm" />
          <div className="sm:col-span-2 flex gap-3">
            <button className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-ink-900">حفظ</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md border border-white/10 px-4 py-2 text-sm">إلغاء</button>
          </div>
        </form>
      )}

      <DataTable
        columns={[
          { key: "name", label: "الاسم" },
          { key: "phone", label: "الهاتف" },
          { key: "email", label: "البريد" },
        ]}
        rows={items}
        actions={(row) => (
          <button onClick={() => handleDelete(row.id)} className="text-red-400 text-xs hover:underline">حذف</button>
        )}
      />
    </div>
  );
}
