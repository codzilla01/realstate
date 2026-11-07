import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, assetUrl } from "../api/client";
import PropertyMap from "../components/PropertyMap";

export default function PropertyDetails() {
  const { id } = useParams();
  const [property, setProperty] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/properties/${id}`)
      .then(({ data }) => {
        setProperty(data.property);
        setActiveImage(0);
      })
      .catch(() => setProperty(null));
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/requests", { ...form, propertyId: id });
      setSubmitted(true);
    } catch {
      setError("حدث خطأ، حاول مرة أخرى.");
    }
  }

  if (!property) return <div className="mx-auto max-w-5xl px-4 py-16 text-white/50">جاري التحميل...</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 space-y-8">
      <div className="space-y-3">
        <div className="aspect-video rounded-xl overflow-hidden bg-ink-800">
          {property.images?.[activeImage]?.url || property.images?.[0]?.url ? (
            <img
              src={assetUrl(property.images[activeImage]?.url || property.images[0].url)}
              alt={property.titleAr || property.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-white/30 text-sm">
              لا توجد صورة
            </div>
          )}
        </div>
        {property.images?.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {property.images.map((image, index) => (
              <button
                key={image.id || image.url}
                type="button"
                onClick={() => setActiveImage(index)}
                className={`h-16 w-24 shrink-0 overflow-hidden rounded-md border transition-colors ${
                  index === activeImage ? "border-gold" : "border-white/10 hover:border-white/30"
                }`}
              >
                <img src={assetUrl(image.url)} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{property.titleAr || property.title}</h1>
          <p className="text-white/50 mt-1">
            {property.district ? `${property.district}, ` : ""}
            {property.city}
          </p>
        </div>
        <p className="text-2xl font-bold text-gold">
          {new Intl.NumberFormat("ar-EG").format(property.price)} {property.currency}
        </p>
      </div>

      <div className="flex gap-6 text-sm text-white/70 border-y border-white/10 py-4">
        {property.bedrooms != null && <span>{property.bedrooms} غرف نوم</span>}
        {property.bathrooms != null && <span>{property.bathrooms} حمام</span>}
        {property.areaSqm != null && <span>{property.areaSqm} م²</span>}
        <span>{property.purpose === "SALE" ? "للبيع" : "للإيجار"}</span>
      </div>

      <p className="text-white/80 leading-relaxed">
        {property.descriptionAr || property.description}
      </p>

      <PropertyMap lat={property.lat} lng={property.lng} title={property.titleAr} />

      <div className="rounded-xl border border-white/10 bg-ink-800 p-6">
        <h2 className="text-lg font-semibold mb-4">مهتم بهذا العقار؟</h2>
        {submitted ? (
          <p className="text-gold">تم إرسال طلبك بنجاح، سيتواصل معك فريقنا قريباً.</p>
        ) : (
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
            <input
              required
              placeholder="الاسم"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm focus:border-gold outline-none"
            />
            <input
              required
              placeholder="رقم الهاتف"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm focus:border-gold outline-none"
            />
            <input
              placeholder="البريد الإلكتروني (اختياري)"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="sm:col-span-2 rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm focus:border-gold outline-none"
            />
            <textarea
              placeholder="رسالتك (اختياري)"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="sm:col-span-2 rounded-md bg-ink-900 border border-white/10 px-3 py-2 text-sm focus:border-gold outline-none"
              rows={3}
            />
            {error && <p className="sm:col-span-2 text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              className="sm:col-span-2 rounded-md bg-gold px-4 py-2 font-semibold text-ink-900 hover:bg-gold-light transition-colors"
            >
              إرسال الطلب
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
