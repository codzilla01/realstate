import { $, $$, icon, icons, escape as e, translations as t, options, num, money, uaeToday, api, setupDialog, toast, busy, errorIn } from './ui.js';

icons();
const form = $('#search-form'), grid = $('#listing-grid'), detail = $('#property-dialog'), inquiry = $('#inquiry-dialog'), inquiryForm = $('#inquiry-form');
const params = new URLSearchParams(location.search);
let properties = [], loaded = false, savedOnly = false, currentProperty = null, saved;
try { saved = new Set(JSON.parse(localStorage.getItem('almaktab_saved') || '[]')); } catch { saved = new Set(); }
$('#year').textContent = new Date().getFullYear();
$('#search-city').innerHTML = options('cities', 'كل الإمارات');
$('#search-type').innerHTML = options('plural', 'كل الأنواع');
$('#type-filters').innerHTML = [['', 'الكل'], ...Object.entries(t.plural)].map(([value, label]) => `<button type="button" class="filter-pill" data-filter="${value}" aria-pressed="${!value}">${label}</button>`).join('');
[detail, inquiry].forEach(setupDialog);

const specs = p => `<ul class="card-specs"><li>${icon('bed')} ${num.format(p.beds)} غرف</li><li>${icon('bath')} ${num.format(p.baths)} حمّام</li><li>${icon('area')} ${num.format(p.area)} م²</li></ul>`;
const photo = (p, lazy = false) => p.image ? `<img src="${e(p.image)}" alt="${e(p.title)}"${lazy ? ' loading="lazy"' : ''} decoding="async">` : `<span class="placeholder-art">${icon('building')}</span>`;
const listingHref = p => `/?property=${encodeURIComponent(p.id)}`;
const saveButton = p => `<button class="icon-button save-button" aria-label="حفظ ${e(p.title)}" aria-pressed="${saved.has(p.id)}" data-save="${e(p.id)}">${icon('heart')}</button>`;
const locationLabel = p => `<span class="card-location">${icon('pin')} ${e(p.district)}، ${e(t.cities[p.city])}</span>`;
const card = (p, index) => `<article class="listing-card"><div class="card-media"><a data-property="${e(p.id)}" href="${listingHref(p)}" aria-label="${e(p.title)}">${photo(p, index > 2)}</a>${p.status !== 'available' || p.featured ? `<span class="badge">${p.status !== 'available' ? t.statuses[p.status] : 'اختيار المكتب'}</span>` : ''}${saveButton(p)}</div><div class="card-body">${locationLabel(p)}<h3><a data-property="${e(p.id)}" href="${listingHref(p)}">${e(p.title)}</a></h3>${specs(p)}<div class="card-bottom"><strong>${money(p.price)}</strong><a aria-label="تفاصيل ${e(p.title)}" data-property="${e(p.id)}" href="${listingHref(p)}">${icon('arrow-left')}</a></div></div></article>`;
const fallbackImages = parent => $$('img', parent).forEach(img => {
  const fallback = () => { const placeholder = document.createElement('span'); placeholder.className = 'placeholder-art'; placeholder.innerHTML = icon('building'); img.replaceWith(placeholder); };
  img.addEventListener('error', fallback, { once:true });
  if (img.complete && !img.naturalWidth) fallback();
});
const normalized = s => s.normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0640]/g,'').replace(/[إأآ]/g,'ا').trim();
function updateSaved() {
  const count = properties.filter(p => saved.has(p.id)).length;
  $('.saved-count').hidden = !count;
  $('.saved-count').textContent = count;
  $('#saved-toggle').setAttribute('aria-pressed', savedOnly);
}
function render() {
  if (!loaded) return;
  const { q, city, type } = Object.fromEntries(new FormData(form));
  const filtered = properties.filter(p => (!savedOnly || saved.has(p.id)) && (!city || p.city === city) && (!type || p.type === type) && (!q || normalized(`${p.title} ${p.district} ${t.cities[p.city]} ${t.types[p.type]}`).includes(normalized(q))));
  const sort = $('#sort').value;
  if (sort === 'asc' || sort === 'desc') filtered.sort((a,b) => (sort === 'asc' ? 1 : -1) * (a.price-b.price));
  if (sort === 'recent') filtered.sort((a,b) => b.updated_at.localeCompare(a.updated_at));
  $$('.filter-pill').forEach(button => button.setAttribute('aria-pressed', button.dataset.filter === type));
  $('#collection-title').innerHTML = savedOnly ? 'العقارات المحفوظة<span>.</span>' : 'المجموعة العقارية<span>.</span>';
  $('#results-meta').innerHTML = `<span>${num.format(filtered.length)} عقار</span>${filtered.some(p => p.demo) ? '<span class="demo-note">تتضمّن المجموعة عقارات نموذجية مصوّرة توضيحيًا</span>' : ''}${q || city || type ? '<button type="button" class="text-button" data-reset>إزالة التصفيات</button>' : ''}`;
  const focusedSave = grid.contains(document.activeElement) ? document.activeElement.dataset.save : null;
  grid.innerHTML = filtered.length ? filtered.map(card).join('') : `<div class="empty">${icon(savedOnly ? 'heart' : 'search')}<h3>${savedOnly ? 'لا توجد عقارات محفوظة هنا' : 'لا توجد عقارات مطابقة'}</h3><p>${savedOnly ? 'احفظ عقاراتك المفضّلة بالضغط على رمز القلب، أو عد لعرض المجموعة.' : 'جرّب عبارة أخرى أو أزل التصفيات لعرض المجموعة.'}</p><button class="button secondary" data-show-all>عرض المجموعة</button></div>`;
  if (focusedSave) $$('[data-save]', grid).find(el => el.dataset.save === focusedSave)?.focus({preventScroll:true});
  fallbackImages(grid);
  updateSaved();
}
async function load() {
  grid.setAttribute('aria-busy', 'true');
  try {
    const data = await api('/api/site');
    properties = data.properties; loaded = true;
    const [first, ...rest] = data.site.headline.split('\n');
    const heroTitle = $('#hero-title'); heroTitle.textContent = first;
    if (rest.length) { const span = document.createElement('span'); span.textContent = rest.join(' '); heroTitle.append(span); }
    $('#hero-intro').textContent = data.site.intro;
    const contact = $('#footer-contact'); contact.replaceChildren();
    for (const [value, protocol] of [[data.site.email, 'mailto'], [data.site.phone, 'tel']]) if (value) { const link = document.createElement('a'); link.href = `${protocol}:${value}`; link.textContent = value; link.dir = 'ltr'; contact.append(link); }
    contact.hidden = !contact.childElementCount;
    render();
  } catch (err) { grid.innerHTML = `<div class="empty" role="alert"><h3>تعذر عرض العقارات</h3><p>${e(err.message)}</p><button class="button secondary" data-retry>حاول مرة أخرى</button></div>`; return; }
  finally { grid.setAttribute('aria-busy', 'false'); }
  if (params.has('preview')) {
    try { openProperty(await api(`/api/admin/properties/${encodeURIComponent(params.get('preview'))}`), true); }
    catch (err) { toast(err.message); }
  } else if (params.has('property')) {
    const p = properties.find(x => x.id === params.get('property'));
    if (p) openProperty(p); else toast('هذا العقار لم يعد منشورًا.');
  }
}
function openProperty(p, preview = false) {
  currentProperty = p;
  const content = $('#property-detail');
  content.innerHTML = `<div class="detail-image">${photo(p)}</div><div class="dialog-body"><div class="detail-badges"><span class="badge">${t.types[p.type]}</span><span class="badge">${t.statuses[p.status]}</span>${p.demo ? '<span class="badge">عقار نموذجي</span>' : ''}${preview ? '<span class="badge">معاينة الإدارة · غير قابلة للمشاركة</span>' : ''}</div><div class="detail-heading"><div><h2 id="property-title">${e(p.title)}</h2>${locationLabel(p)}</div><strong>${money(p.price)}</strong></div><p class="detail-description">${e(p.description || 'تواصل مع المكتب لمزيد من التفاصيل عن هذا العقار.')}</p>${specs(p)}${preview ? '' : `<div class="detail-actions">${p.status === 'available' ? '<button class="button primary" data-viewing>اطلب معاينة خاصة '+icon('arrow-left')+'</button>' : ''}<button class="button secondary" data-share>${icon('link')} نسخ رابط العقار</button>${saveButton(p)}</div>`}</div>`;
  fallbackImages(content);
  if (!detail.open) detail.showModal();
}
function openInquiry(p = null) {
  if (inquiry.open) return;
  if (detail.open) detail.close();
  inquiryForm.reset(); errorIn(inquiryForm);
  inquiryForm.dataset.property = p?.id || '';
  inquiryForm.hidden = false; $('#inquiry-success').hidden = true;
  $('#preferred-field').hidden = !p;
  inquiryForm.elements.preferredDate.min = uaeToday();
  $('#inquiry-title').textContent = p ? 'اطلب معاينة خاصة' : 'تحدّث مع مستشار';
  $('#inquiry-context').textContent = p ? `طلب معاينة: ${p.title}` : 'شاركنا بيانات التواصل ليتابع معك فريق المكتب.';
  inquiry.showModal();
}
inquiryForm.addEventListener('submit', async event => {
  event.preventDefault(); busy(inquiryForm, true); errorIn(inquiryForm);
  try {
    const data = Object.fromEntries(new FormData(inquiryForm));
    data.propertyId = inquiryForm.dataset.property;
    const result = await api('/api/inquiries', { method:'POST', data });
    inquiryForm.hidden = true;
    const success = $('#inquiry-success'); success.hidden = false;
    success.innerHTML = `<h3>${icon('check')} وصل طلبك إلى المكتب</h3><p>سيتواصل معك الفريق. رقم الطلب: <b dir="ltr">${e(result.reference)}</b></p><button type="button" class="button secondary" data-finish>تم</button>`;
    $('[data-finish]', success).focus();
  } catch (err) { errorIn(inquiryForm, err.message); }
  finally { busy(inquiryForm, false); }
});
const goToCollection = () => $('#collection').scrollIntoView({ block:'start' });
form.addEventListener('submit', event => { event.preventDefault(); savedOnly = false; render(); goToCollection(); });
$('#sort').addEventListener('change', render);
const toggleMenu = visible => { $('#mobile-nav').hidden = !visible; $('#mobile-menu').setAttribute('aria-expanded', visible); };
document.addEventListener('click', async event => {
  const el = event.target.closest('a,button'); if (!el) return;
  if (el.id === 'mobile-menu') { toggleMenu($('#mobile-nav').hidden); return; }
  if (el.closest('#mobile-nav')) toggleMenu(false);
  if (el.matches('.site-nav a')) { $$('.site-nav a').forEach(x => x.classList.toggle('current', x === el)); }
  if (el.matches('[data-inquiry]')) openInquiry();
  if (el.matches('[data-viewing]')) openInquiry(currentProperty);
  if (el.matches('[data-finish]')) inquiry.close();
  if (el.matches('[data-retry]')) load();
  if (el.matches('[data-filter]')) { form.elements.type.value = el.dataset.filter; render(); }
  if (el.matches('[data-reset],[data-show-all]')) { form.reset(); if (el.hasAttribute('data-show-all')) savedOnly = false; render(); }
  if (el.id === 'saved-toggle') { savedOnly = !savedOnly; if (savedOnly) form.reset(); updateSaved(); render(); goToCollection(); }
  if (el.matches('[data-property]') && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
    event.preventDefault(); const p = properties.find(x => x.id === el.dataset.property); if (p) openProperty(p);
  }
  if (el.matches('[data-save]')) {
    const id = el.dataset.save;
    if (saved.has(id)) { saved.delete(id); toast('أُزيل العقار من المحفوظات'); } else { saved.add(id); toast('أُضيف العقار إلى المحفوظات'); }
    try { localStorage.setItem('almaktab_saved', JSON.stringify([...saved])); } catch { /* Still works until refresh. */ }
    el.setAttribute('aria-pressed', saved.has(id)); render();
  }
  if (el.matches('[data-share]')) {
    const url = new URL(listingHref(currentProperty), location.origin).href;
    try { await navigator.clipboard.writeText(url); toast('تم نسخ رابط العقار'); }
    catch { const field = document.createElement('input'); field.value = url; field.readOnly = true; field.setAttribute('aria-label','رابط العقار'); el.replaceWith(field); field.select(); }
  }
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('#mobile-nav').hidden) { toggleMenu(false); $('#mobile-menu').focus(); } });
load();
