import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import PropertyCard from "../components/PropertyCard";

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/properties", { params: { pageSize: 6 } })
      .then(({ data }) => setFeatured(data.items))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-gradient-to-b from-gold/10 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-24 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            ابحث عن <span className="text-gold">عقار أحلامك</span>
          </h1>
          <p className="mt-4 text-white/70 max-w-2xl mx-auto">
            منصة عقارية متكاملة للبيع والإيجار — عقارات مختارة بعناية بأسعار تنافسية.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              to="/properties?purpose=sale"
              className="rounded-md bg-gold px-6 py-3 font-semibold text-ink-900 hover:bg-gold-light transition-colors"
            >
              تصفح العقارات للبيع
            </Link>
            <Link
              to="/properties?purpose=rent"
              className="rounded-md border border-gold/60 px-6 py-3 font-semibold text-gold hover:bg-gold/10 transition-colors"
            >
              تصفح العقارات للإيجار
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">عقارات مميزة</h2>
          <Link to="/properties" className="text-gold text-sm hover:underline">
            عرض الكل
          </Link>
        </div>

        {loading ? (
          <p className="text-white/50">جاري التحميل...</p>
        ) : featured.length === 0 ? (
          <p className="text-white/50">لا توجد عقارات متاحة حالياً.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
