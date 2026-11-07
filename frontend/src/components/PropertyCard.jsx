import { Link } from "react-router-dom";
import { assetUrl } from "../api/client";

function formatPrice(price, currency) {
  return new Intl.NumberFormat("ar-EG").format(price) + " " + currency;
}

export default function PropertyCard({ property }) {
  const image = assetUrl(property.images?.[0]?.url);
  return (
    <Link
      to={`/properties/${property.id}`}
      className="group block overflow-hidden rounded-xl border border-white/10 bg-ink-800 hover:border-gold/50 transition-colors"
    >
      <div className="aspect-[4/3] overflow-hidden bg-ink-700">
        {image ? (
          <img
            src={image}
            alt={property.titleAr || property.title}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-white/30">
            لا توجد صورة
          </div>
        )}
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs rounded-full bg-gold/10 text-gold px-2 py-0.5">
            {property.purpose === "SALE" ? "للبيع" : "للإيجار"}
          </span>
          <span className="text-xs text-white/50">{property.city}</span>
        </div>
        <h3 className="font-semibold text-white line-clamp-1">
          {property.titleAr || property.title}
        </h3>
        <p className="text-gold font-bold">{formatPrice(property.price, property.currency)}</p>
        <div className="flex gap-3 text-xs text-white/50">
          {property.bedrooms != null && <span>{property.bedrooms} غرف</span>}
          {property.bathrooms != null && <span>{property.bathrooms} حمام</span>}
          {property.areaSqm != null && <span>{property.areaSqm} م²</span>}
        </div>
      </div>
    </Link>
  );
}
