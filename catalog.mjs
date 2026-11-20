export const types = ['villa', 'apartment', 'penthouse'];
export const cities = ['dubai', 'abudhabi', 'sharjah', 'rak'];
export const statuses = ['available', 'reserved', 'sold', 'rented'];
export const stages = ['new', 'contacted', 'scheduled', 'closed'];
export const siteDefaults = {
  headline: 'عقارات استثنائية.\nلحياةٍ لا تشبه سواها.',
  intro: 'مجموعة منتقاة من أرقى العناوين السكنية في الإمارات، لمن يبحث عن أكثر من مجرد عقار.',
  email: '', phone: '',
};
export const samples = [
  { id: 'palm-residence', title: 'فيلا أفق النخلة', type: 'villa', city: 'dubai', district: 'نخلة جميرا', price: 28500000, beds: 5, baths: 6, area: 782, image: '/images/palm.jpg', description: 'فيلا معاصرة بتكوين معماري أفقي، ومساحات معيشة تنفتح على تراس خاص ومسبح مطل على الواجهة المائية.', featured: 1 },
  { id: 'skyline-penthouse', title: 'بنتهاوس سكاي لاين', type: 'penthouse', city: 'dubai', district: 'وسط مدينة دبي', price: 16900000, beds: 4, baths: 5, area: 410, image: '/images/downtown.jpg', description: 'إطلالات بانورامية على أفق دبي من صالة زجاجية واسعة، مع خامات طبيعية وتوزيع داخلي يمنح كل مساحة خصوصيتها.', featured: 1 },
  { id: 'saadiyat-residence', title: 'ذا ريزيدنس في السعديات', type: 'apartment', city: 'abudhabi', district: 'جزيرة السعديات', price: 8750000, beds: 3, baths: 4, area: 295, image: '/images/saadiyat.jpg', description: 'إقامة ساحلية هادئة، بشرفة واسعة تطل على البحر وتفاصيل حجرية فاتحة تستلهم ألوان الشاطئ.', featured: 1 },
];
