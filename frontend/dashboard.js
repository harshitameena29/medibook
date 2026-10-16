/* MediBook dashboard. Depends on app.js for: $, api, esc, clinicForm, readClinic */
const u = JSON.parse(localStorage.user || 'null');
if (!u) location = 'index.html';
const E = esc, first = (u.name || '').split(' ')[0];

/* ---------- small helpers ---------- */
const ICON = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2.5.6 4 2.3 4 5.2"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
  pin: '<path d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  down: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  rupee: '<path d="M6 4h12M6 9h12M6 4c6 0 8 2 8 5s-2 5-8 5l7 6"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  steth: '<path d="M6 3v6a4 4 0 0 0 8 0V3"/><path d="M10 13v2a5 5 0 0 0 10 0v-1"/><circle cx="20" cy="12" r="2"/>'
};
const I = (n, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
const badge = s => `<span class="b ${s}">${s}</span>`;
const money = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const pad = n => String(n).padStart(2, '0'), ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const TODAY = ymd(new Date()), TOMORROW = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return ymd(d); })();
const last7 = () => [6, 5, 4, 3, 2, 1, 0].map(i => { const d = new Date(); d.setDate(d.getDate() - i); return ymd(d); });
const place = a => [a.clinic_name, a.clinic_address, a.city].filter(Boolean).join(', ');
const mapLink = a => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place(a));
const tel = p => p ? `<a href="tel:${E(p)}">${E(p)}</a>` : '—';
const days = w => { const a = (w || 'Mon,Tue,Wed,Thu,Fri,Sat').split(','); return a.length == 7 ? 'Every day' : a.join(', '); };
const initials = n => String(n || '?').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase();
const fd = d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const dayLabel = (d, wd) => d === TODAY ? 'Today' : d === TOMORROW ? 'Tomorrow' : `${wd} ${+d.slice(8)}`;
const hello = () => { const h = new Date().getHours(); return (h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening') + ', ' + (u.role == 'doctor' ? 'Dr. ' : '') + first; };
const today = () => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
const contact = a => {
  if (u.role == 'patient') return (place(a) ? `${I('pin', 14)} ${E(place(a))} <a href="${mapLink(a)}" target="_blank" rel="noopener">Map</a><br>` : '') + tel(a.doctor_phone);
  if (u.role == 'doctor') return tel(a.patient_phone);
  return `Dr: ${tel(a.doctor_phone)}<br>Patient: ${tel(a.patient_phone)}`;
};
function toast(msg, type = 'ok') {
  const t = document.createElement('div'); t.className = 'toast ' + type; t.setAttribute('role', type == 'err' ? 'alert' : 'status'); t.textContent = msg;
  $('toasts').append(t); setTimeout(() => t.remove(), 4500);
}
const run = async f => { try { await f(); } catch (e) { toast(e.message, 'err'); } init(); };
const st = (id, s) => run(() => api('/appointments/' + id, 'PATCH', { status: s }));
const dv = (id, s) => run(() => api('/admin/doctors/' + id, 'PATCH', { status: s }));
const upcoming = a => a.filter(x => x.appt_date >= TODAY && ['pending', 'confirmed'].includes(x.status)).sort((x, y) => (x.appt_date + x.appt_time).localeCompare(y.appt_date + y.appt_time));
const logout = () => { localStorage.clear(); location = 'index.html'; };

/* ---------- widgets ---------- */
const stat = ([ic, tone, n, l, sub]) => `<div class="stat"><span class="ico ${tone}">${I(ic, 20)}</span><div><b>${n}</b><span>${l}</span>${sub ? `<small>${sub}</small>` : ''}</div></div>`;
const stats = a => `<div class="stats">${a.map(stat).join('')}</div>`;

function areaChart(s, key, fmt) {
  const ds = last7().map(d => { const r = s.days.find(x => x.d === d); return { d, v: +(r && r[key] || 0) }; });
  const W = 420, H = 150, px = 14, py = 16, mx = Math.max(1, ...ds.map(x => x.v));
  const X = i => px + i * (W - 2 * px) / 6, Y = v => H - py - (v / mx) * (H - 2 * py - 10);
  let line = `M${X(0)},${Y(ds[0].v)}`;
  for (let i = 1; i < 7; i++) { const m = (X(i - 1) + X(i)) / 2; line += ` C${m},${Y(ds[i - 1].v)} ${m},${Y(ds[i].v)} ${X(i)},${Y(ds[i].v)}`; }
  const total = ds.reduce((a, x) => a + x.v, 0), id = 'ag' + key;
  return `<div class="area"><div class="total">${fmt(total)} <span class="muted" style="font:500 13px var(--body)">in 7 days</span></div>
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Last 7 days"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a855f7" stop-opacity=".35"/><stop offset="1" stop-color="#a855f7" stop-opacity="0"/></linearGradient></defs>
  <path d="${line} L${X(6)},${H - py} L${X(0)},${H - py} Z" fill="url(#${id})"/><path d="${line}" fill="none" stroke="#7c3aed" stroke-width="2.5" stroke-linecap="round"/>
  ${ds.map((x, i) => `<circle cx="${X(i)}" cy="${Y(x.v)}" r="4" fill="#fff" stroke="#c026d3" stroke-width="2"><title>${fd(x.d)}: ${fmt(x.v)}</title></circle>`).join('')}</svg>
  <div class="xl">${ds.map(x => `<span>${new Date(x.d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })}</span>`).join('')}</div></div>`;
}
function donut(t) {
  const k = [['pending', '#f472b6'], ['confirmed', '#8b5cf6'], ['completed', '#22c55e'], ['cancelled', '#f87171']], R = 42, C = 2 * Math.PI * R;
  let off = 0;
  const seg = t.total ? k.map(([n, c]) => { const len = t[n] / t.total * C, el = `<circle r="${R}" cx="60" cy="60" fill="none" stroke="${c}" stroke-width="14" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"/>`; off += len; return el; }).join('') : '';
  return `<div class="donut"><svg viewBox="0 0 120 120" role="img" aria-label="Appointments by status"><circle r="${R}" cx="60" cy="60" fill="none" stroke="#efe7fd" stroke-width="14"/>${seg}<text x="60" y="60" text-anchor="middle" class="dn">${t.total}</text><text x="60" y="76" text-anchor="middle" class="dl">total</text></svg>
  <ul>${k.map(([n, c]) => `<li><i style="background:${c}"></i>${n}<b>${t[n]}</b></li>`).join('')}</ul></div>`;
}

/* filterable appointments table + CSV export (columns depend on role) */
let AP = [], ACT = () => '', F = { q: '', s: 'all' };
const feeCell = a => `₹${a.amount}${a.paid ? ' ' + I('check', 13) : ''}`;
const COLS = {
  patient: [['Date', a => fd(a.appt_date)], ['Time', a => a.appt_time], ['Doctor', a => 'Dr. ' + E(a.doctor)], ['Clinic and contact', contact, 'wrap'], ['Reason', a => E((a.reason || '—').slice(0, 40))], ['Fee', feeCell], ['Status', a => badge(a.status)]],
  doctor: [['Date', a => fd(a.appt_date)], ['Time', a => a.appt_time], ['Patient', a => E(a.patient)], ['Phone', contact], ['Reason', a => E((a.reason || '—').slice(0, 40))], ['Fee', feeCell], ['Status', a => badge(a.status)]],
  admin: [['Date', a => fd(a.appt_date)], ['Time', a => a.appt_time], ['Patient', a => E(a.patient)], ['Doctor', a => 'Dr. ' + E(a.doctor)], ['Contact', contact, 'wrap'], ['Reason', a => E((a.reason || '—').slice(0, 40))], ['Fee', feeCell], ['Status', a => badge(a.status)]]
};
const rows = (l, act) => {
  if (!l.length) return '<p class="muted" style="padding:14px 0">No appointments found.</p>';
  const c = COLS[u.role];
  return `<div class="tw"><table><tr>${c.map(x => `<th>${x[0]}</th>`).join('')}<th></th></tr>${l.map(a => `<tr>${c.map(x => `<td${x[2] ? ' class="wrap"' : ''}>${x[1](a)}</td>`).join('')}<td>${act(a)}</td></tr>`).join('')}</table></div>`;
};
const listCard = (a, act, title) => {
  AP = a; ACT = act;
  return `<div class="card"><div class="head"><h2>${title}</h2><button class="btn sm ghost" onclick="csv()">${I('down', 15)} Export CSV</button></div>
  <div class="filters"><input id="q" placeholder="Search by name or reason" aria-label="Search appointments" oninput="F.q=this.value;paint()">
  <select id="fs" aria-label="Filter by status" onchange="F.s=this.value;paint()"><option value="all">All statuses</option><option>pending</option><option>confirmed</option><option>completed</option><option>cancelled</option></select></div><div id="tbl"></div></div>`;
};
const filtered = () => { const q = F.q.toLowerCase(); return AP.filter(a => (F.s == 'all' || a.status == F.s) && (!q || [a.patient, a.doctor, a.reason].join(' ').toLowerCase().includes(q))); };
const paint = () => { if (!$('tbl')) return; $('q').value = F.q; $('fs').value = F.s; $('tbl').innerHTML = rows(filtered(), ACT); };
const csv = () => {
  const c = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const L = [['Date', 'Time', 'Patient', 'Patient phone', 'Doctor', 'Doctor phone', 'Clinic', 'Reason', 'Amount', 'Paid', 'Status'],
    ...filtered().map(a => [a.appt_date, a.appt_time, a.patient, a.patient_phone, a.doctor, a.doctor_phone, place(a), a.reason, a.amount, a.paid ? 'yes' : 'no', a.status])];
  const b = new Blob([L.map(r => r.map(c).join(',')).join('\n')], { type: 'text/csv' }), l = document.createElement('a');
  l.href = URL.createObjectURL(b); l.download = 'appointments.csv'; l.click();
};

/* ---------- AI booking assistant (patient) ---------- */
let CHAT = [], CTX = null, BUSY = false;
const cities = () => [...new Set((D.docs || []).map(d => d.city).filter(Boolean))].sort();
const prompts = () => ['Skin rash, free tomorrow evening', 'My child has had a fever since yesterday', 'Cheapest dentist this week', cities()[0] ? `Cardiologist in ${cities()[0]} after 5 pm` : 'Cardiologist after 5 pm'];
const welcome = () => `<div class="welcome"><h2 class="display">What brings you in today?</h2><p>Describe a symptom, the kind of doctor, a day or a budget. I'll check who has real openings.</p>
  <div class="chips">${prompts().map(p => `<button class="chip" data-ask="${E(p)}">${E(p)}</button>`).join('')}</div></div>`;
const dcard = (d, reason) => `<article class="dcard" data-reason="${E(reason)}"><div class="dhead"><span class="dav">${E(initials(d.name))}</span>
  <div class="dmeta"><b>Dr. ${E(d.name)}</b><span>${E(d.specialization)}${d.qualification ? ', ' + E(d.qualification) : ''}${d.experience ? ', ' + d.experience + ' yrs' : ''}</span>
  <span class="loc">${I('pin', 14)} ${E([d.clinic_name, d.city].filter(Boolean).join(', ') || 'Clinic address not added')}</span></div><div class="fee">${money(d.fee)}</div></div>
  ${d.days.length ? d.days.map(y => `<div class="dayrow"><span class="dl">${dayLabel(y.date, y.day)}</span><div class="slots">${y.slots.slice(0, 6).map(t => `<button class="slot" data-book="${d.id}" data-date="${y.date}" data-time="${t}">${t}</button>`).join('')}${y.slots.length > 6 ? `<button class="slot more" data-book="${d.id}" data-date="${y.date}">+${y.slots.length - 6} more</button>` : ''}</div></div>`).join('')
    : `<div class="dayrow"><span class="muted">No openings in this window.</span><button class="slot more" data-book="${d.id}">See all times</button></div>`}</article>`;
const msgHTML = (m, last) => {
  if (m.role == 'me') return `<div class="msg me"><div class="bub">${E(m.text)}</div></div>`;
  return `<div class="msg ai${m.error ? ' err' : ''}"><span class="av">${I('spark', 16)}</span><div class="aib"><div class="bub">${E(m.text)}</div>
   ${m.notice ? `<div class="notice" role="alert">${E(m.notice)}</div>` : ''}
   ${m.understood && m.understood.length ? `<div class="understood">Looking for ${m.understood.map((c, i) => `<span class="chip pop" style="--i:${i}">${E(c)}</span>`).join('')}</div>` : ''}
   ${(m.doctors || []).map(d => dcard(d, m.reason || '')).join('')}
   ${last && m.follow && m.follow.length ? `<div class="follow">${m.follow.map(f => `<button class="chip" data-ask="${E(f)}">${E(f)}</button>`).join('')}</div>` : ''}</div></div>`;
};
function paintThread(typing) {
  const t = $('thread'); if (!t) return;
  t.innerHTML = (CHAT.length ? CHAT.map((m, i) => msgHTML(m, i == CHAT.length - 1)).join('') : welcome()) +
    (typing ? `<div class="msg ai"><span class="av">${I('spark', 16)}</span><div class="bub typing" aria-label="Assistant is typing"><i></i><i></i><i></i></div></div>` : '');
  // while waiting, stay at the bottom; once answered, start at the patient's question so the answer reads top-down
  const mine = t.querySelectorAll('.msg.me'), q = mine[mine.length - 1];
  t.scrollTop = typing || !q ? t.scrollHeight : Math.max(0, q.offsetTop - 16);
}
function autosize() { const t = $('msg'); if (t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; } }
async function ask(text) {
  text = (text || ($('msg') && $('msg').value) || '').trim();
  if (!text || BUSY) return;
  BUSY = true; if ($('msg')) { $('msg').value = ''; autosize(); } if ($('send')) $('send').disabled = true;
  CHAT.push({ role: 'me', text }); paintThread(true);
  try {
    const r = await api('/assistant/chat', 'POST', { message: text, context: CTX });
    CTX = r.criteria;
    CHAT.push({ role: 'ai', text: r.reply, understood: r.understood, notice: r.notice, doctors: r.doctors, reason: r.reason,
      follow: r.doctors.length ? ['Cheapest first', 'Most experienced first', 'Tomorrow', 'Mornings only'] : [] });
  } catch (e) { CHAT.push({ role: 'ai', text: e.message, error: true }); }
  BUSY = false; if ($('send')) $('send').disabled = false; paintThread(); if ($('msg')) $('msg').focus();
}
const resetChat = () => { CHAT = []; CTX = null; paintThread(); };

/* ---------- booking sheet (reuses POST /appointments and /pay) ---------- */
let SEL = null, SLOT = null, PRE = {};
async function openBook(id, pre = {}) {
  SEL = (D.docs || []).find(d => d.id == id);
  if (!SEL) { try { D.docs = await api('/doctors'); SEL = D.docs.find(d => d.id == id); } catch (e) { return toast(e.message, 'err'); } }
  if (!SEL) return toast('That doctor is no longer available', 'err');
  SLOT = null; PRE = pre;
  $('sheet').innerHTML = `<div class="sh-head"><span class="dav">${E(initials(SEL.name))}</span><div><h2>Dr. ${E(SEL.name)}</h2><p>${E(SEL.specialization)}${SEL.qualification ? ', ' + E(SEL.qualification) : ''}</p></div>
   <button class="sh-x" aria-label="Close" onclick="$('sheet').close()">${I('x', 18)}</button></div>
  <div class="sh-body"><p class="loc">${I('pin', 16)} <span>${E(place(SEL)) || 'Clinic address not added yet'} ${place(SEL) ? `<a href="${mapLink(SEL)}" target="_blank" rel="noopener">Map</a>` : ''}</span></p>
   <p class="muted" style="font-size:13.5px">Sees patients ${SEL.open_time || '10:00'} to ${SEL.close_time || '17:00'}, ${days(SEL.work_days)}</p>
   <label class="lbl" style="margin-top:16px">Date<input id="dt" type="date" min="${TODAY}" onchange="loadSlots()"></label>
   <div id="slots" class="slots"><span class="muted">Pick a date to see open slots.</span></div>
   <label class="lbl">Reason for visit<input id="rs" maxlength="255" placeholder="Optional" value="${E(pre.reason || '')}"></label></div>
  <div class="sh-foot"><button class="btn" id="bb" onclick="book()" disabled>Book and pay ${money(SEL.fee)}</button></div>`;
  $('sheet').showModal();
  if (pre.date) { $('dt').value = pre.date; await loadSlots(); }
}
async function loadSlots() {
  SLOT = null; const bb = $('bb'); if (bb) bb.disabled = true;
  const dt = $('dt').value; if (!dt) return;
  try {
    const r = await api(`/doctors/${SEL.id}/slots?date=${dt}`);
    $('slots').innerHTML = r.slots.length ? r.slots.map(t => `<button class="slot" data-t="${t}" onclick="chooseSlot('${t}')">${t}</button>`).join('')
      : `<span class="muted">${r.closed ? `Dr. ${E(SEL.name)} doesn't see patients on ${r.day}.` : 'No free slots on this day.'}</span>`;
    if (PRE.time && r.slots.includes(PRE.time)) chooseSlot(PRE.time);
    PRE = { reason: PRE.reason };
  } catch (e) { $('slots').textContent = e.message; }
}
function chooseSlot(t) {
  SLOT = t; document.querySelectorAll('#slots .slot').forEach(x => x.classList.toggle('on', x.dataset.t == t)); $('bb').disabled = false;
}
async function book() {
  const bb = $('bb'), doc = SEL, date = $('dt').value, time = SLOT;
  try {
    if (!time) return toast('Choose a time slot', 'err');
    bb.disabled = true; bb.textContent = 'Booking…';
    const o = await api('/appointments', 'POST', { doctor_id: doc.id, appt_date: date, appt_time: time, reason: $('rs').value });
    const done = () => {
      CHAT.push({ role: 'ai', text: `Booked with Dr. ${doc.name} on ${fd(date)} at ${time}. You can see it under Appointments.` });
      toast('Appointment confirmed', 'ok'); init();
    };
    if (o.demo) { await api(`/appointments/${o.id}/pay`, 'POST', {}); $('sheet').close(); toast('Demo payment, no money charged', 'ok'); return done(); }
    if (typeof Razorpay === 'undefined') {   // checkout.js blocked/offline: undo the unpaid booking instead of leaving it pending
      try { await api('/appointments/' + o.id, 'PATCH', { status: 'cancelled' }); } catch (e) { }
      throw new Error('Razorpay checkout could not load. Check your internet / disable ad blocker, then try again.');
    }
    $('sheet').close();   // the Razorpay popup would sit behind a modal dialog
    new Razorpay({
      key: o.key, order_id: o.order.id, amount: o.order.amount, currency: 'INR', name: 'MediBook', description: 'Consultation fee',
      handler: async r => { try { await api(`/appointments/${o.id}/pay`, 'POST', r); done(); } catch (e) { toast(e.message, 'err'); init(); } },
      modal: { ondismiss: async () => { try { await api('/appointments/' + o.id, 'PATCH', { status: 'cancelled' }); } catch (e) { } init(); } }
    }).open();
  } catch (e) {
    toast(e.message, 'err');
    if ($('sheet').open) { bb.disabled = false; bb.textContent = 'Book and pay ' + money(doc.fee); if ($('dt').value) loadSlots(); }
  }
}

/* ---------- doctor directory (patient) ---------- */
let DF = { q: '', c: 'all' };
const docRow = d => `<div class="doc"><div><div style="display:flex;gap:12px;align-items:center"><span class="dav">${E(initials(d.name))}</span><div class="dmeta"><b>Dr. ${E(d.name)}</b><span>${E(d.specialization)}${d.qualification ? ', ' + E(d.qualification) : ''}${d.experience ? ', ' + d.experience + ' yrs experience' : ''}</span></div></div>
  <div class="info">${place(d) ? `${I('pin', 14)} ${E(place(d))} <a href="${mapLink(d)}" target="_blank" rel="noopener">Map</a><br>` : ''}${I('clock', 14)} ${d.open_time || '10:00'} to ${d.close_time || '17:00'}, ${days(d.work_days)}${d.phone ? `<br>${tel(d.phone)}` : ''}${d.bio ? `<br><span class="muted">${E(d.bio)}</span>` : ''}</div></div>
  <div class="side"><b>${money(d.fee)}</b><button class="btn sm" onclick="openBook(${d.id})">Book</button></div></div>`;
const dirPaint = () => {
  if (!$('dir')) return; $('dq').value = DF.q; $('dc').value = DF.c; const q = DF.q.toLowerCase();
  const l = D.docs.filter(d => (DF.c == 'all' || d.city == DF.c) && (!q || [d.name, d.specialization, d.city, d.clinic_name, d.qualification].join(' ').toLowerCase().includes(q)));
  $('dir').innerHTML = l.length ? l.map(docRow).join('') : '<p class="muted" style="padding:14px 0">No doctors match your search.</p>';
};

/* ---------- views ---------- */
let D = {}, VIEW = 'home';
const NAV = {
  patient: [['home', 'Home', 'home'], ['doctors', 'Doctors', 'search'], ['appts', 'Visits', 'cal']],
  doctor: [['home', 'Overview', 'home'], ['appts', 'Visits', 'cal'], ['profile', 'Clinic', 'user']],
  admin: [['home', 'Overview', 'home'], ['doctors', 'Doctors', 'steth'], ['appts', 'Visits', 'cal']]
};
const head = (t, s) => `<div class="greet"><h1 class="display">${t}</h1>${s ? `<p class="sub">${s}</p>` : ''}</div>`;
const nextCard = nx => nx ? `<div class="card"><div class="nextc"><div class="date-tile"><b>${+nx.appt_date.slice(8)}</b><span>${new Date(nx.appt_date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short' })}</span></div>
  <div style="flex:1"><h3>Dr. ${E(nx.doctor)}</h3><p>${fd(nx.appt_date)} at ${nx.appt_time}</p><p style="margin-top:6px">${contact(nx)}</p>${nx.reason ? `<p class="muted" style="margin-top:4px">${E(nx.reason)}</p>` : ''}</div>${badge(nx.status)}</div></div>`
  : `<div class="card"><h2 style="margin-bottom:4px">Nothing booked yet</h2><p class="muted">Tell the assistant what you need and pick a slot. Your next visit will show up here.</p></div>`;
const cancelBtn = a => ['pending', 'confirmed'].includes(a.status) ? `<button class="btn sm ghost" onclick="st(${a.id},'cancelled')">Cancel</button>` : '';

const VIEWS = {
  patient: {
    home() {
      const t = D.s.totals, nx = upcoming(D.ap)[0];
      $('root').innerHTML = `<div class="page">${head(hello(), today())}<div class="cols">
        <section class="card chat" aria-label="Booking assistant"><div class="chat-head"><span class="spark">${I('spark', 20)}</span><div><h2>Booking assistant</h2><p>Say what you need in your own words. I only show real, open slots.</p></div><button class="linkbtn" onclick="resetChat()">New chat</button></div>
          <div class="thread" id="thread" role="log" aria-live="polite"></div>
          <div class="composer"><div class="aurora"><div class="in"><textarea id="msg" rows="1" maxlength="500" placeholder="Skin rash, tomorrow evening, under ₹600" aria-label="Message the booking assistant"></textarea>
          <button class="send" id="send" aria-label="Send message" onclick="ask()">${I('send', 18)}</button></div></div>
          <p class="hint">The assistant finds doctors and slots. It can't diagnose. You confirm and pay before anything is booked.</p></div></section>
        <aside class="stack">${nextCard(nx)}${stats([['cal', '', t.upcoming, 'Upcoming'], ['check', 'gn', t.completed, 'Completed'], ['rupee', 'pk', money(t.revenue), 'Spent'], ['users', 'am', t.total, 'Bookings']])}</aside></div></div>`;
      paintThread();
    },
    doctors() {
      $('root').innerHTML = `<div class="page">${head('Find a doctor', `${D.docs.length} approved ${D.docs.length == 1 ? 'doctor' : 'doctors'} on MediBook`)}<div class="card">
        ${D.docs.length ? `<div class="filters"><input id="dq" placeholder="Search by name, speciality, clinic or city" aria-label="Search doctors" oninput="DF.q=this.value;dirPaint()"><select id="dc" aria-label="Filter by city" onchange="DF.c=this.value;dirPaint()"><option value="all">All cities</option>${cities().map(c => `<option>${E(c)}</option>`).join('')}</select></div><div id="dir"></div>`
          : '<p class="muted">No doctors are available yet. Check back once an admin approves one.</p>'}</div></div>`;
      dirPaint();
    },
    appts() { $('root').innerHTML = `<div class="page">${head('My appointments')}${listCard(D.ap, cancelBtn, 'All visits')}</div>`; paint(); }
  },
  doctor: {
    home() {
      const t = D.s.totals, p = D.prof, td = D.ap.filter(a => a.appt_date == TODAY && ['pending', 'confirmed'].includes(a.status)).sort((x, y) => x.appt_time.localeCompare(y.appt_time));
      const act = a => a.status == 'confirmed' ? `<button class="btn sm" onclick="st(${a.id},'completed')">Mark done</button> <button class="btn sm ghost" onclick="st(${a.id},'cancelled')">Cancel</button>` : '';
      $('root').innerHTML = `<div class="page">${head(hello(), today())}
        ${!p.clinic_address || !p.phone || !p.city ? `<div class="warn">Your clinic profile is incomplete, so patients can't see your address or number. <a href="#" onclick="go('profile');return false">Complete it now</a></div>` : ''}
        ${stats([['clock', '', t.today, "Today's visits"], ['cal', 'pk', t.upcoming, 'Upcoming'], ['check', 'gn', t.completed, 'Completed'], ['users', 'am', t.patients, 'Patients seen'], ['rupee', 'gn', money(t.revenue), 'Earnings']])}
        <div class="card"><h2 style="margin-bottom:14px">Today's schedule</h2>${td.length ? `<div class="tl">${td.map(a => `<div class="tl-i"><span class="t">${a.appt_time}</span><div class="who"><b>${E(a.patient)}</b><small>${E(a.reason || 'No reason given')}</small></div>${tel(a.patient_phone)}${badge(a.status)}<span>${act(a)}</span></div>`).join('')}</div>`
          : '<p class="muted">Nothing scheduled for today.</p>'}</div>
        <div class="cols2"><div class="card"><h2 style="margin-bottom:10px">Earnings</h2>${areaChart(D.s, 'rev', money)}</div><div class="card"><h2 style="margin-bottom:10px">Appointment status</h2>${donut(t)}</div></div></div>`;
    },
    appts() {
      const act = a => a.status == 'confirmed' ? `<button class="btn sm" onclick="st(${a.id},'completed')">Mark done</button> <button class="btn sm ghost" onclick="st(${a.id},'cancelled')">Cancel</button>` : '';
      $('root').innerHTML = `<div class="page">${head('Appointments')}${listCard(D.ap, act, 'All my appointments')}</div>`; paint();
    },
    profile() {
      $('root').innerHTML = `<div class="page">${head('Clinic profile', 'Patients see this when they book. Your hours and slot length decide which slots they can pick.')}
        <div class="card" style="max-width:640px"><label class="lbl">Full name<input id="p_name" value="${E(D.prof.name)}"></label>${clinicForm(D.prof, 'p_')}<button class="btn" style="margin-top:8px" onclick="saveProfile()">Save profile</button></div></div>`;
    }
  },
  admin: {
    home() {
      const t = D.s.totals, x = D.s.admin, rate = t.total ? Math.round(t.completed / t.total * 100) : 0, pend = D.ds.filter(d => d.status == 'pending');
      $('root').innerHTML = `<div class="page">${head(hello(), today())}
        ${stats([['users', '', x.patients, 'Patients'], ['steth', 'gn', x.approved, 'Active doctors', x.pendingDoctors ? x.pendingDoctors + ' awaiting approval' : ''], ['clock', 'pk', t.today, "Today's visits"], ['cal', 'am', t.total, 'All appointments', rate + '% completed'], ['rupee', 'gn', money(t.revenue), 'Fees collected']])}
        ${pend.length ? `<div class="card"><h2 style="margin-bottom:6px">Waiting for your approval</h2>${pend.map(d => `<div class="pend"><div class="who"><b>Dr. ${E(d.name)}</b><small>${E(d.specialization)}${place(d) ? ', ' + E(place(d)) : ''}</small></div><button class="btn sm" onclick="dv(${d.id},'approved')">Approve</button><button class="btn sm ghost" onclick="dv(${d.id},'rejected')">Reject</button></div>`).join('')}</div>` : ''}
        <div class="cols2"><div class="card"><h2 style="margin-bottom:10px">Revenue</h2>${areaChart(D.s, 'rev', money)}</div><div class="card"><h2 style="margin-bottom:10px">Bookings</h2>${areaChart(D.s, 'n', String)}</div></div>
        <div class="cols2"><div class="card"><h2 style="margin-bottom:10px">Appointment status</h2>${donut(t)}</div>
        <div class="card"><h2 style="margin-bottom:10px">Top doctors</h2>${D.s.top.length ? D.s.top.map((d, i) => `<div class="rank"><span class="n">${i + 1}</span><div class="who"><b>Dr. ${E(d.name)}</b><br><small>${d.n} ${d.n == 1 ? 'appointment' : 'appointments'}</small></div><b>${money(d.rev)}</b></div>`).join('') : '<p class="muted">No data yet.</p>'}</div></div></div>`;
    },
    doctors() {
      $('root').innerHTML = `<div class="page">${head('Doctors', `${D.ds.length} registered`)}<div class="card"><div class="tw"><table><tr><th>Name</th><th>Speciality</th><th>Clinic</th><th>Timings</th><th>Contact</th><th>Fee</th><th>Status</th><th></th></tr>
        ${D.ds.map(d => `<tr><td>Dr. ${E(d.name)}</td><td>${E(d.specialization)}</td><td class="wrap">${E(place(d)) || '<span class="muted">not added</span>'}</td><td>${d.open_time || '10:00'} to ${d.close_time || '17:00'}<br><span class="muted">${days(d.work_days)}</span></td>
        <td>${tel(d.phone)}<br><span class="muted">${E(d.email)}</span></td><td>₹${d.fee}</td><td>${badge(d.status)}</td>
        <td><button class="btn sm" onclick="dv(${d.id},'approved')">Approve</button> <button class="btn sm ghost" onclick="dv(${d.id},'rejected')">Reject</button></td></tr>`).join('')}</table></div></div></div>`;
    },
    appts() { $('root').innerHTML = `<div class="page">${head('All appointments')}${listCard(D.ap, () => '', 'Every booking')}</div>`; paint(); }
  }
};
const saveProfile = async () => { try { const b = readClinic('p_'); b.name = $('p_name').value; await api('/doctor/profile', 'PUT', b); toast('Profile saved'); init(); } catch (e) { toast(e.message, 'err'); } };

/* ---------- shell: nav, routing, data ---------- */
function rail() {
  const roleName = { patient: 'Patient', doctor: 'Doctor', admin: 'Admin' }[u.role];
  $('rail').innerHTML = `<div class="brand"><span class="mark">${I('steth', 18).replace('currentColor', '#fff')}</span>MediBook</div>
   <nav class="nav" aria-label="Main">${NAV[u.role].map(([id, label, ic]) => `<button data-go="${id}" class="${id == VIEW ? 'on' : ''}"${id == VIEW ? ' aria-current="page"' : ''}>${I(ic, 20)}<span>${label}</span></button>`).join('')}</nav>
   <div class="me"><span class="av0">${E(initials(u.name))}</span><div><b>${E(u.name)}</b><small>${roleName}</small></div><button aria-label="Log out" title="Log out" onclick="logout()">${I('out', 18)}</button></div>`;
}
function go(v) { VIEW = v; rail(); render(); window.scrollTo(0, 0); }
function render() { (VIEWS[u.role][VIEW] || VIEWS[u.role].home)(); }
async function init() {
  try {
    if (u.role == 'patient') { const [docs, ap, s] = await Promise.all([api('/doctors'), api('/appointments'), api('/stats')]); D = { docs, ap, s }; }
    else if (u.role == 'doctor') { const [ap, s, prof] = await Promise.all([api('/appointments'), api('/stats'), api('/doctor/profile')]); D = { ap, s, prof }; }
    else { const [ds, ap, s] = await Promise.all([api('/admin/doctors'), api('/appointments'), api('/stats')]); D = { ds, ap, s }; }
    rail(); render();
  } catch (e) { if (/Unauthorized/.test(e.message)) logout(); else toast(e.message, 'err'); }
}

/* one set of delegated listeners (chat prompts, slot buttons, nav, Enter to send) */
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go);
  const a = e.target.closest('[data-ask]'); if (a) return ask(a.dataset.ask);
  const b = e.target.closest('[data-book]');
  if (b) { const c = b.closest('[data-reason]'); openBook(+b.dataset.book, { date: b.dataset.date, time: b.dataset.time, reason: c ? c.dataset.reason : '' }); }
  if (e.target === $('sheet')) $('sheet').close();
});
document.addEventListener('keydown', e => { if (e.target.id == 'msg' && e.key == 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(); } });
document.addEventListener('input', e => { if (e.target.id == 'msg') autosize(); });
init();
