import { useEffect, useState } from "react";
import { api } from "../../api/client";
import DataTable from "../../components/DataTable";

const emptyForm = {
  title: "",
  titleAr: "",
  purpose: "SALE",
  type: "APARTMENT",
  status: "AVAILABLE",
  price: "",
  city: "",
  district: "",
  bedrooms: "",
  bathrooms: "",
  areaSqm: "",
  lat: "",
  lng: "",
  imageUrl: "",
};

export default function AdminProperties() {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  function load() {
    api.get("/properties", { params: { pageSize: 100, status: "" } }).then(({ data }) => setItems(data.items));
  }

  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
    setError("");
  }

  function openEdit(p) {
    setForm({
      title: p.title,
      titleAr: p.titleAr || "",
      purpose: p.purpose,
      type: p.type,
      status: p.status,
      price: p.price,
      city: p.city || "",
      district: p.district || "",
      bedrooms: p.bedrooms ?? "",
      bathrooms: p.bathrooms ?? "",
      areaSqm: p.areaSqm ?? "",
      lat: p.lat ?? "",
      lng: p.lng ?? "",
      imageUrl: p.images?.[0]?.url || "",
    });
    setEditingId(p.id);
    setShowForm(true);
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const payload = {
      title: form.title,
      titleAr: form.titleAr || undefined,
      purpose: form.purpose,
      type: form.type,
      status: form.status,
      price: Number(form.price),
      city: form.city || undefined,
      district: form.district || undefined,
      bedrooms: form.bedrooms !== "" ? Number(form.bedrooms) : undefined,
      bathrooms: form.bathrooms !== "" ? Number(form.bathrooms) : undefined,
      areaSqm: form.areaSqm !== "" ? Number(form.areaSqm) : undefined,
      lat: form.lat !== "" ? Number(form.lat) : undefined,
      lng: form.lng !== "" ? Number(form.lng) : undefined,
      images: form.imageUrl ? [form.imageUrl] : undefined,
    };
    try {
      if (editingId) {
        await api.put(`/properties/${editingId}`, payload);
      } else {
        await api.post("/properties", payload);
      }
      setShowForm(false);
      load();
    } catch {
      setError("تعذر حفظ العقار، تحقق من البيانات.");
    }
  }

  async function handleDelete(id) {
    if (!confirm("هل أنت متأكد من حذف هذا العقار؟")) return;
    await api.delete(`/properties/${id}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">العقارات</h1>
        <button
          onClick={openNew}
          className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-gold-light"
        >
          + إضافة عقار
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-ink-800 p-6 grid sm:grid-cols-3 gap-4">
          <input required placeholder="العنوان (En)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm" />
          <input placeholder="العنوان (عربي)" value={form.titleAr} onChange={(e) => setForm({ ...form, titleAr: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm" />
          <select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm">
            <option value="SALE">بيع</option>
            <option value="RENT">إيجار</option>
          </select>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm">
            <option value="APARTMENT">شقة</option>
            <option value="VILLA">فيلا</option>
            <option value="OFFICE">مكتب</option>
            <option value="LAND">أرض</option>
            <option value="SHOP">محل</option>
            <option value="BUILDING">مبنى</option>
          </select>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm">
            <option value="AVAILABLE">متاح</option>
            <option value="RESERVED">محجوز</option>
            <option value="SOLD">مباع</option>
            <option value="RENTED">مؤجر</option>
            <option value="DRAFT">مسودة</option>
          </select>
          <input required type="number" placeholder="السعر" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm" />
          <input placeholder="المدينة" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm" />
          <input placeholder="الحي" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm" />
          <input type="number" placeholder="غرف النوم" value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm" />
          <input type="number" placeholder="الحمامات" value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm" />
          <input type="number" placeholder="المساحة (م²)" value={form.areaSqm} onChange={(e) => setForm({ ...form, areaSqm: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm" />
          <input type="number" step="any" placeholder="خط العرض (lat)" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm" />
          <input type="number" step="any" placeholder="خط الطول (lng)" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm" />
          <input placeholder="رابط الصورة" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className="sm:col-span-3 rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm" />

          {error && <p className="sm:col-span-3 text-red-400 text-sm">{error}</p>}

          <div className="sm:col-span-3 flex gap-3">
            <button className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-ink-900">حفظ</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md border border-white/10 px-4 py-2 text-sm">إلغاء</button>
          </div>
        </form>
      )}

      <DataTable
        columns={[
          { key: "titleAr", label: "العنوان", render: (r) => r.titleAr || r.title },
          { key: "purpose", label: "الغرض", render: (r) => (r.purpose === "SALE" ? "بيع" : "إيجار") },
          { key: "type", label: "النوع" },
          { key: "status", label: "الحالة" },
          { key: "price", label: "السعر", render: (r) => new Intl.NumberFormat("ar-EG").format(r.price) },
          { key: "city", label: "المدينة" },
        ]}
        rows={items}
        actions={(row) => (
          <div className="flex gap-2">
            <button onClick={() => openEdit(row)} className="text-gold text-xs hover:underline">تعديل</button>
            <button onClick={() => handleDelete(row.id)} className="text-red-400 text-xs hover:underline">حذف</button>
          </div>
        )}
      />
    </div>
  );
}
