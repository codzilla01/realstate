const paths = {
  brand:'<path d="M3 20V8l9-5 9 5v12M6 20V10l6-3.3 6 3.3v10M9 20v-8l3-1.7 3 1.7v8M1.5 20.5h21"/>',
  'arrow-left':'<path d="M20 12H4m6 6-6-6 6-6"/>', 'arrow-up':'<path d="M6 18 18 6M7 6h11v11"/>',
  heart:'<path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.5 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
  search:'<circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 4 4"/>', pin:'<path d="M20 10c0 5-8 11-8 11s-8-6-8-11a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  building:'<path d="M3 21h18M6 21V5l9-2v18m0-11h4v11M9.5 8h2m-2 4h2m-2 4h2"/>', chevron:'<path d="m6 9 6 6 6-6"/>',
  bed:'<path d="M3 18V8m18 10v-4H3m3 0v-4h5v4m0-4h7a3 3 0 0 1 3 3v1M3 17h18"/>', bath:'<path d="M3 13h18v2a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-2Zm3 0V6a3 3 0 0 1 6 0v1m-5 12v2m10-2v2"/>', area:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 16l8-8m-4 0h4v4"/>',
  sort:'<path d="M4 7h16M7 12h10m-7 5h4"/>', menu:'<path d="M4 7h16M4 12h16M4 17h16"/>', x:'<path d="m6 6 12 12M18 6 6 18"/>',
  check:'<path d="m5 12 4 4L19 6"/>', plus:'<path d="M12 5v14M5 12h14"/>', grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  inbox:'<path d="M4 4h16l2 11v5H2v-5L4 4Zm-2 11h6l2 2h4l2-2h6"/>', edit:'<path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15l-1 5Z"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>', eye:'<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  logout:'<path d="M11 4H4v16h7m4-4 4-4-4-4m4 4H8"/>', download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>', link:'<path d="m10 14 4-4m-5 6-1 1a3.5 3.5 0 1 1-5-5l4-4a3.5 3.5 0 0 1 5 0m3 0 1-1a3.5 3.5 0 1 1 5 5l-4 4a3.5 3.5 0 0 1-5 0"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
};
export const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
export const $ = (s, parent = document) => parent.querySelector(s);
export const $$ = (s, parent = document) => [...parent.querySelectorAll(s)];
export function icons(parent = document) { $$('[data-icon]', parent).forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const translations = {
  types: {villa:'فيلا', apartment:'شقة', penthouse:'بنتهاوس'},
  plural: {villa:'فلل', apartment:'شقق', penthouse:'بنتهاوس'},
  cities: {dubai:'دبي', abudhabi:'أبوظبي', sharjah:'الشارقة', rak:'رأس الخيمة'},
  statuses: {available:'متاح', reserved:'محجوز', sold:'مباع', rented:'مؤجّر'},
  stages: {new:'جديد', contacted:'تم التواصل', scheduled:'معاينة مجدولة', closed:'مغلق'},
};
export const options = (group, first) => (first ? `<option value="">${first}</option>` : '') + Object.entries(translations[group]).map(([key, name]) => `<option value="${key}">${name}</option>`).join('');
export const num = new Intl.NumberFormat('en-AE');
export const money = n => `${num.format(n)} د.إ`;
export const uaeToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
export const localDate = date => new Intl.DateTimeFormat('ar-AE', { timeZone:'Asia/Dubai', dateStyle:'medium' }).format(new Date(date));
export async function api(path, init = {}) {
  let response;
  try { response = await fetch(path, { method:init.method, ...(init.data && { headers:{'Content-Type':'application/json'}, body:JSON.stringify(init.data) }) }); }
  catch { throw new Error('تعذر الاتصال بالخادم. تحقق من اتصالك وحاول مرة أخرى.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'تعذر إكمال العملية.'), { status: response.status });
  return data;
}
export function setupDialog(dialog) {
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => {
    if (e.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) dialog.close();
  });
}
let toastTimer;
export function toast(text) {
  const el = $('#toast'), layer = $('dialog[open]') || document.body;
  if (el.parentElement !== layer) layer.append(el);
  el.hidden = false; el.textContent = text;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}
export function busy(form, value) { form.querySelector('[type="submit"]').disabled = value; }
export function errorIn(form, text = '') { const el = $('.form-error', form); el.textContent = text; el.hidden = !text; }
