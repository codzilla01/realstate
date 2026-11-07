import { useEffect, useRef, useState } from "react";
import { api, assetUrl } from "../../api/client";
import DataTable from "../../components/DataTable";
import { useAuth } from "../../context/AuthContext";

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
  images: [],
};

export default function AdminProperties() {
  const { canWrite } = useAuth();
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const fileInput = useRef(null);

  function load() {
    api
      .get("/properties", { params: { pageSize: 100, includeDrafts: "true" } })
      .then(({ data }) => setItems(data.items));
  }

  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
    setError("");
    setImageUrl("");
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
      images: (p.images || []).map((image) => image.url),
    });
    setEditingId(p.id);
    setShowForm(true);
    setError("");
    setImageUrl("");
  }

  // ── Images ──────────────────────────────────────────────────────────────
  async function handleFiles(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setError("");
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const body = new FormData();
        body.append("file", file);
        const { data } = await api.post("/uploads", body, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        uploaded.push(data.file.url);
      }
      setForm((current) => ({ ...current, images: [...current.images, ...uploaded] }));
    } catch (err) {
      setError(err?.response?.data?.error || "تعذر رفع الصورة، جرّب صورة أصغر أو بصيغة JPG/PNG.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function addImageUrl() {
    const url = imageUrl.trim();
    if (!url) return;
    setForm((current) => ({ ...current, images: [...current.images, url] }));
    setImageUrl("");
  }

  function removeImage(index) {
    setForm((current) => ({
      ...current,
      images: current.images.filter((_, i) => i !== index),
    }));
  }

  function makeCover(index) {
    setForm((current) => {
      const images = [...current.images];
      const [picked] = images.splice(index, 1);
      return { ...current, images: [picked, ...images] };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
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
      images: form.images.length ? form.images : undefined,
    };
    try {
      if (editingId) {
        await api.put(`/properties/${editingId}`, payload);
      } else {
        await api.post("/properties", payload);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err?.response?.data?.error || "تعذر حفظ العقار، تحقق من البيانات.");
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
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-white/10 bg-ink-800 p-6 grid sm:grid-cols-3 gap-4"
        >
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

          {/* ── معرض الصور ── */}
          <div className="sm:col-span-3 rounded-lg border border-white/10 bg-ink-900/60 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-white/70">
                صور العقار{" "}
                <span className="text-white/40 text-xs">
                  (JPG / PNG / WebP — بحد أقصى 5MB للصورة، الأولى هي صورة الغلاف)
                </span>
              </p>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleFiles}
                  className="hidden"
                  id="property-images"
                />
                <label
                  htmlFor="property-images"
                  className={`cursor-pointer rounded-md border border-gold/50 px-3 py-1.5 text-xs text-gold hover:bg-gold/10 ${
                    uploading ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  {uploading ? "جاري الرفع..." : "اختر صوراً من جهازك"}
                </label>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                placeholder="أو أضف رابط صورة (https://...)"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="flex-1 rounded-md bg-ink-800 border border-white/10 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={addImageUrl}
                className="rounded-md border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
              >
                إضافة
              </button>
            </div>

            {form.images.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {form.images.map((url, index) => (
                  <div key={`${url}-${index}`} className="group relative overflow-hidden rounded-md border border-white/10">
                    <img src={assetUrl(url)} alt="" className="h-24 w-full object-cover" />
                    {index === 0 && (
                      <span className="absolute top-1 right-1 rounded bg-gold px-1.5 py-0.5 text-[10px] font-semibold text-ink-900">
                        الغلاف
                      </span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 px-2 py-1 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                      {index !== 0 ? (
                        <button type="button" onClick={() => makeCover(index)} className="text-gold">
                          اجعلها الغلاف
                        </button>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                      <button type="button" onClick={() => removeImage(index)} className="text-red-300">
                        حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/40">لا توجد صور بعد.</p>
            )}
          </div>

          {error && <p className="sm:col-span-3 text-red-400 text-sm">{error}</p>}

          <div className="sm:col-span-3 flex gap-3">
            <button
              disabled={uploading}
              className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-ink-900 disabled:opacity-50"
            >
              حفظ
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md border border-white/10 px-4 py-2 text-sm">
              إلغاء
            </button>
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
        actions={
          canWrite
            ? (row) => (
                <div className="flex gap-2">
                  <button onClick={() => openEdit(row)} className="text-gold text-xs hover:underline">تعديل</button>
                  <button onClick={() => handleDelete(row.id)} className="text-red-400 text-xs hover:underline">حذف</button>
                </div>
              )
            : undefined
        }
      />
    </div>
  );
}
