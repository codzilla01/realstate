import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import PropertyCard from "../components/PropertyCard";

const TYPES = [
  { value: "", label: "كل الأنواع" },
  { value: "APARTMENT", label: "شقة" },
  { value: "VILLA", label: "فيلا" },
  { value: "OFFICE", label: "مكتب" },
  { value: "LAND", label: "أرض" },
  { value: "SHOP", label: "محل" },
  { value: "BUILDING", label: "مبنى" },
];

export default function Properties() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const purpose = searchParams.get("purpose") || "";
  const type = searchParams.get("type") || "";
  const q = searchParams.get("q") || "";
  const city = searchParams.get("city") || "";

  useEffect(() => {
    setLoading(true);
    const params = Object.fromEntries(
      Object.entries({ purpose, type, q, city }).filter(([, v]) => v)
    );
    api
      .get("/properties", { params })
      .then(({ data }) => {
        setItems(data.items);
        setTotal(data.total);
      })
      .finally(() => setLoading(false));
  }, [purpose, type, q, city]);

  function update(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold mb-6">العقارات</h1>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-8">
        <input
          value={q}
          onChange={(e) => update("q", e.target.value)}
          placeholder="ابحث بالعنوان أو المنطقة..."
          className="sm:col-span-2 rounded-md bg-ink-800 border border-white/10 px-3 py-2 text-sm focus:border-gold outline-none"
        />
        <select
          value={purpose}
          onChange={(e) => update("purpose", e.target.value)}
          className="rounded-md bg-ink-800 border border-white/10 px-3 py-2 text-sm focus:border-gold outline-none"
        >
          <option value="">بيع أو إيجار</option>
          <option value="sale">للبيع</option>
          <option value="rent">للإيجار</option>
        </select>
        <select
          value={type}
          onChange={(e) => update("type", e.target.value)}
          className="rounded-md bg-ink-800 border border-white/10 px-3 py-2 text-sm focus:border-gold outline-none"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-white/50">جاري التحميل...</p>
      ) : items.length === 0 ? (
        <p className="text-white/50">لا توجد نتائج مطابقة.</p>
      ) : (
        <>
          <p className="text-white/50 text-sm mb-4">{total} عقار</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
