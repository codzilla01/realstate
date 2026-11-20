import { $, $$, icon, icons, escape as e, translations as t, options, num, money, localDate, uaeToday, api, setupDialog, toast, busy, errorIn } from './ui.js';

icons();
const login = $('#login'), shell = $('#admin-shell'), content = $('#admin-content'), loginForm = $('#login-form');
const codeForm = $('#code-form'), resendBtn = $('#resend-code'), changeEmailBtn = $('#change-email');
let loginEmail = '', resendAt = 0, resendTimer, authPending = false, loginConfigured = true;
$('#login-frame-note').hidden = window.self === window.top;
const propertyEditor = $('#property-editor'), leadEditor = $('#lead-editor'), propertyForm = $('#property-form'), leadForm = $('#lead-form');
const tabs = ['overview', 'inventory', 'leads', 'site'];
let data = null, tab = 'overview', stage = '', inventoryStatus = '', inventoryQuery = '', leadQuery = '', selectedDay = '';
[propertyEditor, leadEditor].forEach(setupDialog);
for (const [field, group] of [['type','types'],['city','cities'],['status','statuses']]) propertyForm.elements[field].innerHTML = options(group);
leadForm.elements.stage.innerHTML = options('stages');
$('#admin-date').textContent = localDate(new Date());

const title = (label, heading, subtitle, actions = '') => `<div class="workspace-title"><div><div class="overline"><i></i>${label}</div><h1>${heading}<span>.</span></h1><p>${subtitle}</p></div><div class="workspace-actions">${actions}</div></div>`;
const add = `<button class="button primary" data-add>${icon('plus')} إضافة عقار</button>`;
const badge = (text, style = '') => `<span class="badge ${style}">${e(text)}</span>`;
const leadStage = l => badge(t.stages[l.stage], l.stage);
const empty = text => `<p class="panel-empty">${text}</p>`;
const upcoming = () => data.leads.filter(l => l.stage === 'scheduled' && l.scheduled_at && Date.parse(`${l.scheduled_at}+04:00`) >= Date.now()).sort((a,b) => a.scheduled_at.localeCompare(b.scheduled_at));
const dateTime = s => s ? `${localDate(`${s}+04:00`)} · ${s.slice(11)}` : '—';

function weekCalendar() {
  const today = uaeToday(), first = Date.parse(today), appointments = upcoming();
  const days = Array.from({length:7}, (_, i) => new Date(first + i * 86400000).toISOString().slice(0,10));
  if (!days.includes(selectedDay)) selectedDay = today;
  const weekday = new Intl.DateTimeFormat('ar-AE', {weekday:'short',timeZone:'Asia/Dubai'});
  return `<div class="week-days">${days.map(date => {
    const count = appointments.filter(l => l.scheduled_at.startsWith(date)).length;
    return `<button data-day="${date}" aria-pressed="${date === selectedDay}" aria-label="${localDate(date)}، ${count} معاينة"><span>${date === today ? 'اليوم' : weekday.format(new Date(date))}</span><b>${Number(date.slice(-2))}</b><small>${count ? `${count} موعد` : '—'}</small></button>`;
  }).join('')}</div><div id="day-appointments" aria-live="polite"></div>`;
}
function renderDay() {
  const slot = $('#day-appointments'); if (!slot) return;
  $$('[data-day]').forEach(button => button.setAttribute('aria-pressed',button.dataset.day === selectedDay));
  const rows = upcoming().filter(l => l.scheduled_at.startsWith(selectedDay));
  slot.innerHTML = rows.map(l => `<div class="activity"><div><button class="text-button" data-lead="${e(l.id)}">${e(l.name)}</button><small>${e(l.property_title || 'استشارة عامة')}</small></div><b dir="ltr">${l.scheduled_at.slice(11)}</b></div>`).join('') || empty('لا توجد معاينات في هذا اليوم.');
}
function overview() {
  const {properties, leads} = data, appointments = upcoming(), published = properties.filter(p => p.published).length;
  const metrics = [['building','عقارات منشورة',published,`${properties.length - published} مسودة`],['eye','اختيارات المكتب',properties.filter(p => p.published && p.featured).length,'عقارات مميزة على الموقع'],['inbox','طلبات جديدة',leads.filter(l => l.stage === 'new').length,`${leads.length} إجمالي الطلبات`],['calendar','معاينات قادمة',appointments.length,'بتوقيت الإمارات']];
  return `${title('ملخّص العمل','نظرة عامة','منشورات الموقع، الطلبات الواردة، والمعاينات في لمحة واحدة.',`<button class="button secondary" data-refresh>تحديث البيانات</button>${add}`)}<div class="metrics">${metrics.map(([i,label,count,sub]) => `<article class="metric"><span>${icon(i)} ${label}</span><strong>${num.format(count)}</strong><small>${sub}</small></article>`).join('')}</div><div class="admin-panels"><section class="panel"><div class="panel-heading"><h2>أحدث الطلبات</h2><a href="#leads">كل الطلبات ${icon('arrow-left')}</a></div>${leads.slice(0,5).map(l => `<div class="activity"><div><button class="text-button" data-lead="${e(l.id)}">${e(l.name)}</button><small>${e(l.property_title || 'استشارة عامة')} · ${localDate(l.created_at)}</small></div>${leadStage(l)}</div>`).join('') || empty('ستظهر طلبات الزوار هنا فور إرسالها من الموقع.')}</section><section class="panel"><div class="panel-heading"><h2>معاينات الأيام السبعة المقبلة</h2>${icon('calendar')}</div>${weekCalendar()}</section></div><section class="panel pipeline-summary"><div class="panel-heading"><h2>مسار متابعة الطلبات</h2><a href="#leads">فتح مساحة المتابعة ${icon('arrow-left')}</a></div><div class="pipeline-summary-grid">${Object.entries(t.stages).map(([key,label], i) => { const count = leads.filter(l => l.stage === key).length; return `<a href="#leads" data-overview-stage="${key}"><span class="stage-index">0${i + 1}</span><span>${label}</span><b>${count}</b><progress aria-label="${label}" value="${count}" max="${leads.length || 1}"></progress></a>`; }).join('')}</div></section>`;
}
function inventory() {
  return `${title('المخزون العقاري','العقارات','أعدّ المسودات وراجعها قبل نشرها، أو عدّل حالة التوفر في أي وقت.',add)}<section class="panel"><div class="admin-filters"><input id="inventory-query" type="search" aria-label="بحث في العقارات" placeholder="ابحث بالعنوان أو المنطقة" value="${e(inventoryQuery)}"><select id="inventory-status" aria-label="حالة النشر"><option value="">كل العقارات</option><option value="live"${inventoryStatus === 'live' ? ' selected' : ''}>منشور</option><option value="draft"${inventoryStatus === 'draft' ? ' selected' : ''}>مسودة</option></select></div><div id="inventory-table" class="table-scroll" tabindex="0" role="region" aria-label="جدول العقارات"></div></section>`;
}
function renderInventory() {
  const rows = data.properties.filter(p => (!inventoryStatus || (inventoryStatus === 'live') === !!p.published) && `${p.title} ${p.district} ${t.cities[p.city]}`.toLowerCase().includes(inventoryQuery.toLowerCase().trim()));
  $('#inventory-table').innerHTML = rows.length ? `<table class="admin-table"><thead><tr><th>العقار</th><th>السعر</th><th>التوفر</th><th>النشر</th><th>الإجراءات</th></tr></thead><tbody>${rows.map(p => `<tr><td><b>${e(p.title)}</b><small>${e(p.district)}، ${t.cities[p.city]} · ${t.types[p.type]}</small></td><td>${money(p.price)}</td><td>${badge(t.statuses[p.status])}</td><td>${p.published ? badge('منشور','live') : badge('مسودة')}${p.featured ? ` ${badge('مميّز')}` : ''}</td><td><button class="icon-button" data-edit="${e(p.id)}" aria-label="تعديل ${e(p.title)}">${icon('edit')}</button> <a class="icon-button" href="/?preview=${encodeURIComponent(p.id)}" target="_blank" rel="noopener" aria-label="معاينة ${e(p.title)}">${icon('eye')}</a></td></tr>`).join('')}</tbody></table>` : empty('لا توجد عقارات مطابقة. أزل عامل التصفية أو أضف عقارًا جديدًا.');
}
function leadRows() {
  return data.leads.filter(l => (!stage || l.stage === stage) && `${l.name} ${l.phone} ${l.email} ${l.property_title || ''}`.toLowerCase().includes(leadQuery.toLowerCase().trim()));
}
function leads() {
  return `${title('علاقات العملاء','الطلبات والمعاينات','تابع طلبات الموقع، وثّق التواصل، وحدّد موعد المعاينة.',`<button class="button secondary" data-refresh>تحديث الطلبات</button><button class="button primary" data-export>${icon('download')} تصدير النتائج</button>`)}<div class="pipeline" aria-label="تصفية حسب مرحلة المتابعة">${Object.entries(t.stages).map(([key,label]) => `<button data-stage="${key}" aria-pressed="${stage === key}"><strong>${num.format(data.leads.filter(l => l.stage === key).length)}</strong>${label}</button>`).join('')}</div><section class="panel"><div class="admin-filters"><input id="lead-query" type="search" aria-label="بحث في الطلبات" placeholder="ابحث بالاسم أو رقم الهاتف أو العقار" value="${e(leadQuery)}"><button class="button secondary" data-clear-stage>كل المراحل</button></div><div id="lead-table" class="table-scroll" tabindex="0" role="region" aria-label="جدول الطلبات"></div></section>`;
}
function renderLeads() {
  const rows = leadRows();
  $$('[data-stage]').forEach(el => el.setAttribute('aria-pressed', el.dataset.stage === stage));
  $('#lead-table').innerHTML = rows.length ? `<table class="admin-table"><thead><tr><th>صاحب الطلب</th><th>العقار</th><th>المرحلة</th><th>تاريخ الطلب</th><th>موعد المعاينة</th><th>المتابعة</th></tr></thead><tbody>${rows.map(l => `<tr><td><b>${e(l.name)}</b><small><bdi>${e(l.phone)}</bdi></small></td><td>${e(l.property_title || 'استشارة عامة')}</td><td>${leadStage(l)}</td><td>${localDate(l.created_at)}</td><td>${dateTime(l.scheduled_at)}</td><td><button class="button secondary" data-lead="${e(l.id)}" aria-label="متابعة طلب ${e(l.name)}">فتح الطلب</button></td></tr>`).join('')}</tbody></table>` : empty('لا توجد طلبات في هذه النتيجة. جرّب البحث أو اختر جميع المراحل.');
}
function siteView() {
  const s = data.site;
  return `${title('واجهة الزوار','محتوى الموقع','عدّل رسالة الاستقبال ووسائل التواصل التي تظهر للزوار.')}<section class="panel"><div class="panel-heading"><h2>الصفحة الرئيسية والتواصل</h2><a target="_blank" rel="noopener" href="/">عرض الموقع ${icon('arrow-up')}</a></div><form class="form-grid site-form" id="site-form"><label class="full">العنوان الرئيسي <textarea name="headline" maxlength="100" minlength="3" required rows="2">${e(s.headline)}</textarea></label><label class="full">النص التعريفي <textarea name="intro" maxlength="230" minlength="3" required rows="3">${e(s.intro)}</textarea></label><label>رقم الهاتف <input dir="ltr" name="phone" type="tel" maxlength="30" value="${e(s.phone)}"></label><label>البريد الإلكتروني <input dir="ltr" name="email" type="email" maxlength="180" value="${e(s.email)}"></label><p class="full form-note">يمكن ترك بيانات التواصل فارغة. تظل استمارة الاستشارة متاحة للزوار.</p><p class="full form-error" role="alert" hidden></p><button class="button primary full" type="submit">نشر التعديلات ${icon('check')}</button></form></section>`;
}
function render() {
  if (!data) return;
  const hash = location.hash.slice(1); tab = tabs.includes(hash) ? hash : 'overview';
  $$('.admin-nav a').forEach(link => link.dataset.tab === tab ? link.setAttribute('aria-current','page') : link.removeAttribute('aria-current'));
  const count = data.leads.filter(l => l.stage === 'new').length;
  $('#nav-count').textContent = count; $('#nav-count').hidden = !count;
  content.innerHTML = { overview, inventory, leads, site:siteView }[tab]();
  if (tab === 'overview') renderDay();
  if (tab === 'inventory') renderInventory();
  if (tab === 'leads') renderLeads();
}
function signedOut() {
  data = null; shell.hidden = true; login.hidden = false; loginForm.reset(); showEmailStep(false); content.replaceChildren();
  propertyForm.reset(); leadForm.reset(); $('#lead-contact').replaceChildren();
  for (const dialog of [propertyEditor, leadEditor]) if (dialog.open) dialog.close();
  $('.skip').href = '#admin-main';
}
async function refresh() {
  data = await api('/api/admin/data');
  login.hidden = true; shell.hidden = false; $('.skip').href = '#workspace'; render();
}
async function initialLoad() {
  try { await refresh(); }
  catch (err) {
    if (err.status !== 401) { errorIn(loginForm, err.message); return; }
    try {
      const { configured } = await api('/api/admin/login/status');
      if (configured === false) {
        loginConfigured = false;
        const notice = $('#login-unavailable');
        notice.textContent = 'لم يُفعّل الدخول بالبريد في هذه النسخة بعد. يلزم ضبط البريد الإداري وخدمة الإرسال على الخادم ثم إعادة تشغيله.';
        notice.hidden = false;
        loginForm.elements.email.disabled = true;
        busy(loginForm, true);
      }
    } catch (statusError) { errorIn(loginForm, statusError.message); }
  }
}
function handleError(err, form) {
  if (err.status === 401 && form !== loginForm && form !== codeForm) { signedOut(); errorIn(loginForm, 'انتهت جلسة الإدارة. سجّل الدخول مجددًا.'); }
  else if (form) errorIn(form, err.message); else toast(err.message);
}
function showEmailStep(focus = true) {
  clearInterval(resendTimer); resendAt = 0; loginEmail = '';
  codeForm.hidden = true; codeForm.reset(); errorIn(codeForm);
  $('#login-email').textContent = '';
  loginForm.hidden = false; errorIn(loginForm);
  $('#login-title').innerHTML = 'أهلاً بعودتك<span>.</span>';
  $('#login-intro').textContent = 'أدخل البريد الإداري المعتمد لتلقّي رمز دخول مؤقت، من دون كلمة مرور.';
  if (focus) loginForm.elements.email.focus();
}
function showCodeStep(expiresIn) {
  loginForm.hidden = true; codeForm.hidden = false; codeForm.reset(); errorIn(codeForm);
  $('#login-title').innerHTML = 'تحقّق من بريدك<span>.</span>';
  $('#login-intro').textContent = `إذا كان البريد معتمدًا، فسيصلك رمز صالح لمدة ${Math.floor(expiresIn / 60)} دقائق.`;
  $('#login-email').textContent = loginEmail;
  $('#code-note').textContent = 'تحقّق من صندوق الوارد أو الرسائل غير المرغوب فيها.';
  codeForm.elements.code.focus();
}
function renderResend() {
  const wait = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
  resendBtn.disabled = authPending || wait > 0;
  resendBtn.textContent = wait ? `إعادة إرسال الرمز بعد ${wait} ث` : 'إعادة إرسال الرمز';
  if (!wait) clearInterval(resendTimer);
}
function startResendTimer(seconds) {
  clearInterval(resendTimer);
  resendAt = Date.now() + seconds * 1000;
  resendTimer = setInterval(renderResend, 250);
  renderResend();
}
function setCodeBusy(value) {
  authPending = value;
  busy(codeForm, value);
  changeEmailBtn.disabled = value;
  renderResend();
}
const requestLoginCode = email => api('/api/admin/login/request-code', {method:'POST', data:{email}});
loginForm.addEventListener('submit', async ev => {
  ev.preventDefault();
  if (authPending || !loginConfigured) return;
  authPending = true; busy(loginForm,true); errorIn(loginForm);
  const email = loginForm.elements.email.value.trim();
  try {
    const result = await requestLoginCode(email);
    loginEmail = email;
    showCodeStep(result.expiresIn);
    startResendTimer(result.retryAfter);
  } catch (err) { errorIn(loginForm, err.message); }
  finally { authPending = false; busy(loginForm,!loginConfigured); renderResend(); }
});
changeEmailBtn.addEventListener('click', () => showEmailStep());
resendBtn.addEventListener('click', async () => {
  if (authPending || Date.now() < resendAt) return;
  setCodeBusy(true); errorIn(codeForm);
  try {
    const result = await requestLoginCode(loginEmail);
    codeForm.reset(); codeForm.elements.code.focus();
    $('#code-note').textContent = 'تم طلب رمز جديد. استخدم آخر رمز يصلك في البريد.';
    startResendTimer(result.retryAfter);
  } catch (err) { errorIn(codeForm, err.message); }
  finally { setCodeBusy(false); }
});
codeForm.addEventListener('submit', async ev => {
  ev.preventDefault();
  if (authPending) return;
  setCodeBusy(true); errorIn(codeForm);
  try {
    await api('/api/admin/login/verify-code', {method:'POST', data:{email:loginEmail, code:codeForm.elements.code.value}});
    await refresh(); loginForm.reset(); showEmailStep(false); $('#workspace').focus();
  } catch (err) { errorIn(codeForm, err.message); }
  finally { setCodeBusy(false); }
});
$('#logout').addEventListener('click', async () => {
  try { await api('/api/admin/logout',{method:'POST',data:{}}); signedOut(); loginForm.elements.email.focus(); }
  catch (err) { handleError(err); }
});
function openProperty(p) {
  propertyForm.reset(); errorIn(propertyForm); propertyForm.dataset.id = p?.id || '';
  $('#editor-title').textContent = p ? 'تعديل العقار' : 'إضافة عقار';
  if (p) for (const field of propertyForm.elements) { if (!field.name) continue; if (field.type === 'checkbox') field.checked = Boolean(p[field.name]); else field.value = p[field.name] ?? ''; }
  propertyEditor.showModal();
}
function openLead(l) {
  if (!l) return;
  leadForm.reset(); errorIn(leadForm); leadForm.dataset.id = l.id;
  $('#lead-title').textContent = l.name;
  $('#lead-contact').innerHTML = `<div class="lead-contact"><b>${e(l.property_title || 'استشارة عامة')}</b><p><a dir="ltr" href="tel:${e(l.phone)}">${e(l.phone)}</a>${l.email ? ` · <a dir="ltr" href="mailto:${e(l.email)}">${e(l.email)}</a>` : ''}</p><p>رقم الطلب: <b dir="ltr">${e(l.id.split('-')[0].toUpperCase())}</b> · التاريخ المفضّل: ${l.preferred_date ? localDate(l.preferred_date) : 'غير محدد'}</p>${l.message ? `<blockquote>${e(l.message)}</blockquote>` : ''}</div>`;
  leadForm.elements.stage.value = l.stage; leadForm.elements.notes.value = l.notes; leadForm.elements.scheduledAt.value = l.scheduled_at;
  leadForm.elements.scheduledAt.required = l.stage === 'scheduled';
  leadEditor.showModal();
}
leadForm.elements.stage.addEventListener('change', () => { leadForm.elements.scheduledAt.required = leadForm.elements.stage.value === 'scheduled'; });
async function saveForm(form, dialog, path, method, payload, message) {
  busy(form,true); errorIn(form);
  try { await api(path,{method,data:payload}); }
  catch (err) { handleError(err,form); return; }
  finally { busy(form,false); }
  if (dialog?.open) dialog.close();
  toast(message);
  try { await refresh(); } catch (err) { handleError(err); }
}
propertyForm.addEventListener('submit', ev => {
  ev.preventDefault(); const id = propertyForm.dataset.id, payload = Object.fromEntries(new FormData(propertyForm));
  payload.featured = propertyForm.elements.featured.checked; payload.published = propertyForm.elements.published.checked;
  saveForm(propertyForm, propertyEditor, id ? `/api/admin/properties/${encodeURIComponent(id)}` : '/api/admin/properties', id ? 'PUT' : 'POST', payload, payload.published ? 'حُفظ العقار ونُشر على الموقع' : 'حُفظ العقار كمسودة');
});
leadForm.addEventListener('submit', ev => { ev.preventDefault(); saveForm(leadForm, leadEditor, `/api/admin/leads/${encodeURIComponent(leadForm.dataset.id)}`, 'PATCH', Object.fromEntries(new FormData(leadForm)), 'حُفظت متابعة الطلب'); });
content.addEventListener('submit', ev => { if (ev.target.id === 'site-form') { ev.preventDefault(); saveForm(ev.target,null,'/api/admin/site','PUT',Object.fromEntries(new FormData(ev.target)),'نُشرت التعديلات على الموقع'); } });
content.addEventListener('input', ev => {
  if (ev.target.id === 'inventory-query') { inventoryQuery = ev.target.value; renderInventory(); }
  if (ev.target.id === 'lead-query') { leadQuery = ev.target.value; renderLeads(); }
});
content.addEventListener('change', ev => { if (ev.target.id === 'inventory-status') { inventoryStatus = ev.target.value; renderInventory(); } });
function exportLeads() {
  const rows = leadRows(); if (!rows.length) { toast('لا توجد نتائج للتصدير'); return; }
  // Prefix spreadsheet formula markers in user-controlled values, including phone numbers.
  const csvCell = value => { const s = String(value ?? ''); return `"${(/^[\s\uFEFF]*[=+@\-]|^[\t\r\n]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`; };
  const csv = [['رقم الطلب','الاسم','الهاتف','البريد','العقار','المرحلة','التاريخ المفضّل','الموعد بتوقيت الإمارات','تاريخ الطلب'], ...rows.map(l => [l.id.split('-')[0].toUpperCase(),l.name,l.phone,l.email,l.property_title || 'استشارة عامة',t.stages[l.stage],l.preferred_date,l.scheduled_at,l.created_at])].map(row => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'}));
  const link = document.createElement('a'); link.href=url; link.download='almaktab-inquiries.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
}
content.addEventListener('click', async ev => {
  const overviewStage = ev.target.closest('[data-overview-stage]');
  if (overviewStage) { stage = overviewStage.dataset.overviewStage; leadQuery = ''; }
  const button = ev.target.closest('button'); if (!button) return;
  const ds = button.dataset;
  if (ds.day) { selectedDay = ds.day; renderDay(); }
  if ('add' in ds) openProperty();
  if (ds.edit) openProperty(data.properties.find(p => p.id === ds.edit));
  if (ds.lead) openLead(data.leads.find(l => l.id === ds.lead));
  if (ds.stage) { stage = stage === ds.stage ? '' : ds.stage; renderLeads(); }
  if ('clearStage' in ds) { stage = ''; renderLeads(); }
  if ('export' in ds) exportLeads();
  if ('refresh' in ds) {
    button.disabled = true;
    try { await refresh(); toast('تم تحديث البيانات'); } catch (err) { handleError(err); }
    finally { button.disabled = false; }
  }
});
window.addEventListener('hashchange', () => { render(); if (data) { window.scrollTo(0,0); $('#workspace').focus({preventScroll:true}); } });
initialLoad();
