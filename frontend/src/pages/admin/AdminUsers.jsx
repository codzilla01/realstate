import { useEffect, useState } from "react";
import { api } from "../../api/client";
import DataTable from "../../components/DataTable";

const ROLE_LABELS = { ADMIN: "مدير", MANAGER: "مشرف", AGENT: "وكيل", VIEWER: "مشاهد" };

export default function AdminUsers() {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "", role: "AGENT" });
  const [error, setError] = useState("");

  function load() {
    api.get("/users").then(({ data }) => setItems(data.items));
  }
  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/users", form);
      setForm({ name: "", phone: "", email: "", password: "", role: "AGENT" });
      setShowForm(false);
      load();
    } catch {
      setError("تعذر إنشاء المستخدم، تحقق من البيانات (قد يكون رقم الهاتف مستخدم بالفعل).");
    }
  }

  async function toggleActive(u) {
    setError("");
    try {
      await api.put(`/users/${u.id}`, { isActive: !u.isActive });
      load();
    } catch (err) {
      setError(err?.response?.data?.error || "تعذر تحديث حالة المستخدم.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">المستخدمون</h1>
        <button onClick={() => setShowForm((s) => !s)} className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-gold-light">
          + مستخدم جديد
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-ink-800 p-6 grid sm:grid-cols-2 gap-4">
          <input required placeholder="الاسم" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm" />
          <input required placeholder="الهاتف" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm" />
          <input placeholder="البريد الإلكتروني" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm" />
          <input required type="password" placeholder="كلمة المرور" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm">
            {Object.entries(ROLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {error && <p className="sm:col-span-2 text-red-400 text-sm">{error}</p>}
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
          { key: "role", label: "الدور", render: (r) => ROLE_LABELS[r.role] },
          { key: "isActive", label: "الحالة", render: (r) => (r.isActive ? "مفعل" : "معطل") },
        ]}
        rows={items}
        actions={(row) => (
          <button onClick={() => toggleActive(row)} className="text-gold text-xs hover:underline">
            {row.isActive ? "تعطيل" : "تفعيل"}
          </button>
        )}
      />
    </div>
  );
}
