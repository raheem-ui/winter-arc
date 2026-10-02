import { SupabaseStore, LocalStore, supabaseConfigured } from './store.js?v=5';
import { DEFAULT_SETTINGS, GOALS, ASSIGNMENT_STATUSES, SCHEDULE, GYM, DIET, WEIGHT_MILESTONES, AUTOMATIONS } from './data.js?v=5';
import {
  todayISO, addDays, diffDays, isSunday, dayName, fmtDate, parseISO, buildDays, computeRow, dashboard,
  assignmentFlag, arcWeeks, weekStats, onPaceForDate, macros, phaseFor, nowIST, clockIST,
} from './calc.js?v=5';

// ---------------------------------------------------------------- state
const S = { store: null, started: false, settings: null, logs: {}, assignments: [], reviews: {}, days: [], dash: null, charts: [], asgFilter: 'open', showFuture: false };
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const view = $('#view');

const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };

// ---------------------------------------------------------------- helpers
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pct = (x) => (x == null ? '—' : Math.round(x * 100) + '%');
const dash = (x, suffix = '') => (x == null || x === '' ? '—' : x + suffix);
const scoreClass = (x) => (x == null ? '' : x >= 1 ? 's4' : x >= 0.8 ? 's3' : x >= 0.6 ? 's2' : x >= 0.4 ? 's1' : 's0');
const STATUS_TONE = { 'Locked in': 'good', Solid: 'ok', Slipping: 'warn', 'Fix this first': 'bad', 'No data yet': '' };
const FLAG_TONE = { OVERDUE: 'bad', 'DUE SOON': 'warn', 'On track': 'ice', Submitted: 'good' };
const fmtTime = (t) => {
  if (!t) return '—';
  const [hh, mm] = t.split(':').map(Number);
  return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
};
const yn = (v) => (v === 'Y' ? '<span class="y">Y</span>' : v === 'N' ? '<span class="n">N</span>' : v ? `<span class="o">${h(v)}</span>` : '<span class="muted">·</span>');

let toastTimer;
function toast(msg, isErr = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = 'toast'), isErr ? 5000 : 2400);
}
async function safely(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg); return r; }
  catch (e) { console.error(e); toast(e.message || 'Something went wrong', true); throw e; }
}

function recompute() {
  S.days = buildDays(S.logs, S.settings);
  S.dash = dashboard(S.days, S.assignments, S.settings);
}

function destroyCharts() { S.charts.forEach((c) => c.destroy()); S.charts = []; }

function snow() {
  const el = $('#snow');
  for (let i = 0; i < 28; i++) {
    const f = document.createElement('i');
    const size = 2 + Math.random() * 3;
    Object.assign(f.style, {
      left: Math.random() * 100 + 'vw', width: size + 'px', height: size + 'px', opacity: 0.2 + Math.random() * 0.4,
      animationDuration: 12 + Math.random() * 18 + 's', animationDelay: -Math.random() * 30 + 's',
    });
    el.appendChild(f);
  }
}

// ---------------------------------------------------------------- auth
let phoneState = { phone: '', sent: false };
// "98765 43210" / "098765..." / "+91 98765..." → "+919876543210"; other countries need a leading +.
function normalisePhone(raw) {
  const s = raw.trim();
  let digits = s.replace(/\D/g, '');
  if (s.startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? '+' + digits : null;
  digits = digits.replace(/^0+/, '');
  if (digits.length === 10) return '+91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return '+' + digits;
  return null;
}

function showAuth(mode = 'signin', message = '') {
  S.started = false;
  $('#boot').hidden = true;
  $('#app').hidden = true;
  const auth = $('#auth');
  auth.hidden = false;
  const cloud = supabaseConfigured;
  const P = S.providers || {};
  if (mode !== 'phone') phoneState = { phone: '', sent: false };
  auth.innerHTML = `
    <div class="auth-card">
      <div class="hero">
        <div class="logo-mark">❄</div>
        <h1>Winter Arc</h1>
        <p>92 days. 7 goals. 2 minutes a night.</p>
      </div>
      ${cloud && mode === 'phone' ? `
        <form id="phone-form" novalidate>
          <h2 style="margin-bottom:14px">Sign in with phone</h2>
          <div class="field"><label for="p-phone">Mobile number</label><input id="p-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="98765 43210" value="${h(phoneState.phone)}" ${phoneState.sent ? 'readonly' : ''} /><small>Indian numbers get +91 automatically</small></div>
          ${phoneState.sent ? `
            <div class="field"><label for="p-code">6-digit code</label><input id="p-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" /></div>
            <button class="btn block" type="submit">Verify & sign in</button>
            <p style="text-align:center;margin-top:10px"><a href="#" id="p-change">Change number</a> · <a href="#" id="p-resend">Resend code</a></p>
          ` : `
            <div class="field"><label for="p-name">Your name (new users)</label><input id="p-name" autocomplete="name" placeholder="Optional" /></div>
            <button class="btn block" type="submit">Send code</button>`}
          <p id="auth-msg" class="${message.startsWith('!') ? 'error' : 'notice'}">${h(message.replace(/^!/, ''))}</p>
          <p style="text-align:center;margin-top:6px"><a href="#" id="p-back">← Use email instead</a></p>
        </form>
        <div class="divider">or</div>
      ` : ''}
      ${cloud && mode !== 'phone' ? `
        <div class="auth-tabs">
          <button data-mode="signin" class="${mode === 'signin' ? 'on' : ''}">Sign in</button>
          <button data-mode="signup" class="${mode === 'signup' ? 'on' : ''}">Create account</button>
        </div>
        <form id="auth-form" novalidate>
          ${mode === 'signup' ? `<div class="field"><label for="a-name">Your name</label><input id="a-name" autocomplete="name" placeholder="What should we call you?" /></div>` : ''}
          <div class="field"><label for="a-email">Email</label><input id="a-email" type="email" autocomplete="email" autocapitalize="none" spellcheck="false" required /></div>
          <div class="field"><label for="a-pass">Password</label><input id="a-pass" type="password" minlength="6" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" required /></div>
          <button class="btn block" type="submit">${mode === 'signup' ? 'Start my arc' : 'Sign in'}</button>
          ${mode === 'signin' ? `<p style="text-align:center;margin-top:10px"><a href="#" id="forgot">Forgot password?</a></p>` : ''}
          <p id="auth-msg" class="${message.startsWith('!') ? 'error' : 'notice'}">${h(message.replace(/^!/, ''))}</p>
        </form>
        <div class="divider">or</div>
      ` : ''}
      ${cloud ? `<div class="stack" style="gap:10px;margin-bottom:10px">
        ${P.apple ? `<button class="btn block social apple" data-provider="apple"><svg aria-hidden="true" width="16" height="18" viewBox="0 0 384 512" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg> Continue with Apple</button>` : ''}
        ${P.google ? `<button class="btn block social" data-provider="google"><b aria-hidden="true">G</b> Continue with Google</button>` : ''}
        ${P.phone && mode !== 'phone' ? `<button class="btn ghost block" id="use-phone">📱 Use phone number</button>` : ''}
      </div>` : `<p class="notice" style="margin-bottom:14px">Cloud sync isn't configured yet (see README). You can use the full app in demo mode; data stays in this browser.</p>`}
      <button id="demo" class="btn ${cloud ? 'ghost' : ''} block">Try it without an account</button>
      <div class="features">
        <div><b>7</b>daily goals</div>
        <div><b>4</b>phases</div>
        <div><b>92</b>days</div>
      </div>
    </div>`;

  $$('.auth-tabs button', auth).forEach((b) => b.addEventListener('click', () => showAuth(b.dataset.mode)));
  $$('[data-provider]', auth).forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try { await S.store.signInWithProvider(b.dataset.provider); } // browser redirects to Apple / Google
    catch (err) { b.disabled = false; toast(err.message, true); }
  }));
  $('#use-phone', auth)?.addEventListener('click', () => showAuth('phone'));
  $('#p-back', auth)?.addEventListener('click', (e) => { e.preventDefault(); showAuth('signin'); });
  $('#p-change', auth)?.addEventListener('click', (e) => { e.preventDefault(); phoneState.sent = false; showAuth('phone'); });
  const sendCode = async (msgOnOk) => {
    await S.store.sendPhoneCode(phoneState.phone, phoneState.name);
    phoneState.sent = true;
    showAuth('phone', msgOnOk);
  };
  $('#p-resend', auth)?.addEventListener('click', async (e) => {
    e.preventDefault();
    try { await sendCode(`New code sent to ${phoneState.phone}.`); } catch (err) { showAuth('phone', '!' + err.message); }
  });
  $('#phone-form', auth)?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', e.target);
    btn.disabled = true;
    try {
      if (!phoneState.sent) {
        const phone = normalisePhone($('#p-phone').value);
        if (!phone) { btn.disabled = false; return showAuth('phone', '!Enter a valid mobile number.'); }
        phoneState = { phone, name: $('#p-name').value.trim(), sent: false };
        await sendCode(`Code sent to ${phone}. It expires in a few minutes.`);
      } else {
        const code = $('#p-code').value.replace(/\D/g, '');
        if (code.length !== 6) { btn.disabled = false; return ($('#auth-msg').className = 'error', $('#auth-msg').textContent = 'Enter the 6-digit code from the SMS.'); }
        await S.store.verifyPhoneCode(phoneState.phone, code); // onAuthChange starts the app
      }
    } catch (err) { showAuth('phone', '!' + err.message); }
  });
  $('#demo', auth).addEventListener('click', () => { lsSet('winterArc.mode', 'local'); startApp(new LocalStore()); });
  $('#forgot', auth)?.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = $('#a-email').value.trim();
    if (!email) return ($('#auth-msg').textContent = 'Type your email above first.');
    try { await S.store.resetPassword(email); $('#auth-msg').className = 'notice'; $('#auth-msg').textContent = 'Reset link sent. Check your inbox.'; }
    catch (err) { $('#auth-msg').className = 'error'; $('#auth-msg').textContent = err.message; }
  });
  $('#auth-form', auth)?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', e.target);
    const msg = $('#auth-msg');
    const email = $('#a-email').value.trim(), pass = $('#a-pass').value;
    if (!email || pass.length < 6) { msg.className = 'error'; msg.textContent = 'Enter an email and a password of at least 6 characters.'; return; }
    btn.disabled = true;
    try {
      if (mode === 'signup') {
        const data = await S.store.signUp(email, pass, $('#a-name').value.trim());
        if (!data.session) return showAuth('signin', 'Account created. Check your email to confirm, then sign in.');
      } else {
        await S.store.signIn(email, pass);
      }
    } catch (err) { msg.className = 'error'; msg.textContent = err.message; }
    finally { btn.disabled = false; }
  });
}

async function startApp(store) {
  S.store = store;
  if (store.kind === 'local') await store.init();
  try {
    const data = await store.loadAll();
    Object.assign(S, data);
  } catch (e) {
    console.error(e);
    $('#boot').hidden = true;
    return showAuth('signin', '!Could not load your data: ' + (e.message || e) + '. Did you run supabase/schema.sql?');
  }
  S.started = true;
  recompute();
  $('#boot').hidden = true;
  $('#auth').hidden = true;
  $('#app').hidden = false;
  $('#account-email').textContent = store.email;
  $('#brand-sub').textContent = store.kind === 'local' ? 'Demo mode' : S.settings.displayName || 'Synced';
  render();
  tick();
}

$('#signout').addEventListener('click', signOut);
async function signOut() {
  if (S.store.kind === 'local') { lsSet('winterArc.mode', null); location.hash = ''; return boot(); }
  await S.store.signOut();
}

// ---------------------------------------------------------------- navigation
const NAV = [
  ['dashboard', '◆', 'Dashboard'],
  ['log', '✎', 'Log'],
  ['history', '▦', 'History'],
  ['assignments', '✓', 'Tasks'],
  ['weekly', '↻', 'Weekly'],
  ['plan', '⌖', 'Plan'],
  ['settings', '⚙', 'Settings'],
];
function navHTML(active, items) {
  const badge = S.dash.overdue + S.dash.dueSoon;
  return items.map(([k, ico, label]) => `
    <a href="#/${k}" class="${k === active ? 'on' : ''}"><span class="ico">${ico}</span>${label}
      ${k === 'assignments' && badge ? `<span class="badge">${badge}</span>` : ''}</a>`).join('');
}

function parseRoute() {
  const [name = 'dashboard', arg] = location.hash.replace(/^#\/?/, '').split('/');
  return { name: VIEWS[name] ? name : 'dashboard', arg };
}

function render() {
  if (!S.started) return;
  destroyCharts();
  const { name, arg } = parseRoute();
  $('#nav').innerHTML = navHTML(name, NAV);
  $('#bottom-nav').innerHTML = navHTML(name, NAV.filter(([k]) => k !== 'settings'));
  view.innerHTML = VIEWS[name].html(arg);
  VIEWS[name].bind?.(arg);
  document.title = `${NAV.find(([k]) => k === name)[2]} · Winter Arc`;
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

const settingsBtn = `<a href="#/settings" class="icon-btn mobile-only" aria-label="Settings">⚙</a>`;

// ---------------------------------------------------------------- dashboard
function greeting() {
  const hr = nowIST().hour;
  const part = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  return S.settings.displayName ? `${part}, ${h(S.settings.displayName)}` : part;
}

function heatmap() {
  const today = todayISO();
  const first = S.days[0]?.date;
  if (!first) return '';
  const lead = (parseISO(first).getDay() + 6) % 7;
  const cells = Array.from({ length: lead }, () => '<i></i>').join('') + S.days.map((d) => {
    const cls = [scoreClass(d.score), d.date === today ? 'today' : '', d.date > today ? 'future' : '', d.date < today && !d.logged ? 'missed' : ''].join(' ');
    const tip = `${fmtDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}${d.score != null ? ' · ' + pct(d.score) : d.date < today ? ' · not logged' : ''}`;
    return `<a href="#/log/${d.date}" class="${cls}" title="${tip}">${parseISO(d.date).getDate()}</a>`;
  }).join('');
  return `
    <div class="heat-head">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => `<span>${x}</span>`).join('')}</div>
    <div class="heat">${cells}</div>
    <div class="legend">
      <span><i style="background:#3b1d2a"></i>&lt;40%</span><span><i style="background:#5a3a1a"></i>40%</span>
      <span><i style="background:#4b5a16"></i>60%</span><span><i style="background:#13684f"></i>80%</span>
      <span><i style="background:#0ea5e9"></i>100%</span><span><i style="background:rgba(248,113,113,.25)"></i>missed</span>
    </div>`;
}

const dashboardView = {
  html() {
    const d = S.dash, s = S.settings;
    const today = todayISO();
    const todayRow = S.days.find((x) => x.date === today);
    const phase = s.phases.find((p) => p.name === d.phase);
    const progress = d.dayOfArc ? d.dayOfArc / d.totalDays : 0;
    const ringC = 2 * Math.PI * 50;
    const callouts = [];
    if (today >= s.arcStart && today <= s.arcEnd && !todayRow?.logged)
      callouts.push(`<div class="callout"><span class="ico">✎</span><div><b>Today isn't logged yet.</b><p class="muted">Two minutes at 10:15 PM keeps the streak alive.</p></div><a class="btn sm" href="#/log/${today}" style="margin-left:auto">Log today</a></div>`);
    if (d.twoInARow.length)
      callouts.push(`<div class="callout bad"><span class="ico">⚠</span><div><b>Missed two days in a row: ${h(d.twoInARow.join(', '))}</b><p class="muted">Rule: never miss the same goal two days in a row. Make it the first thing you do tomorrow.</p></div></div>`);
    if (d.weakest && d.weakest.rate < 1)
      callouts.push(`<div class="callout warn"><span class="ico">◎</span><div><b>Weakest goal right now: ${h(d.weakest.label)}</b><p class="muted">${pct(d.weakest.rate)} hit rate. Fix this one first next week.</p></div></div>`);
    if (d.overdue)
      callouts.push(`<div class="callout bad"><span class="ico">⏰</span><div><b>${d.overdue} assignment${d.overdue > 1 ? 's' : ''} overdue</b></div><a class="btn sm ghost" href="#/assignments" style="margin-left:auto">Open</a></div>`);

    return `
      <div class="page-head">
        <div><div class="kicker">${d.dayOfArc ? `Day ${d.dayOfArc} of ${d.totalDays}` : today < s.arcStart ? 'Not started' : 'Arc complete'}</div><h1>${greeting()}</h1></div>
        <div class="flex"><a class="btn" href="#/log/${today}">✎ Log today</a>${settingsBtn}</div>
      </div>
      <div class="stack">
        <div class="hero-card">
          <div>
            <div class="kicker">Current phase</div>
            <h1>${h(d.phase || (today < s.arcStart ? 'Starts ' + fmtDate(s.arcStart) : 'Winter Arc complete'))}</h1>
            ${phase ? `<p class="muted" style="margin-top:6px;max-width:60ch">${h(phase.focus)}</p>` : ''}
            <div class="meta">
              <span class="chip ist-clock">🕒 ${clockIST()} IST</span>
              <span class="chip ice">${d.daysLeft} days left</span>
              <span class="chip">${d.daysLogged} logged</span>
              <span class="chip ${d.currentStreak ? 'good' : ''}">🔥 ${d.currentStreak} day streak</span>
            </div>
            <div class="progress" aria-label="Arc progress"><span style="width:${(progress * 100).toFixed(1)}%"></span></div>
          </div>
          <div class="ring" role="img" aria-label="Average daily score ${pct(d.avgScore)}">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="10"/>
              <circle cx="60" cy="60" r="50" fill="none" stroke="url(#rg)" stroke-width="10" stroke-linecap="round"
                stroke-dasharray="${ringC}" stroke-dashoffset="${ringC * (1 - (d.avgScore || 0))}"/>
              <defs><linearGradient id="rg"><stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#7dd3fc"/></linearGradient></defs>
            </svg>
            <div class="lbl"><b>${pct(d.avgScore)}</b><small class="muted">avg score</small></div>
          </div>
        </div>

        ${callouts.join('')}

        <div class="tiles">
          <div class="tile"><small>Current streak</small><b>${d.currentStreak}</b><span>good days (≥${Math.round(s.goodDayThreshold * 100)}%)</span></div>
          <div class="tile"><small>Best streak</small><b>${d.bestStreak}</b><span>days</span></div>
          <div class="tile"><small>Skill study</small><b>${d.skillHours ?? 0}h</b><span>total this arc</span></div>
          <div class="tile"><small>Assignments</small><b>${d.overdue + d.dueSoon}</b><span>${d.overdue} overdue · ${d.dueSoon} due soon</span></div>
          <div class="tile"><small>Latest weight</small><b>${dash(d.latestWeight, ' kg')}</b><span>start ${s.startWeight} kg</span></div>
          <div class="tile"><small>Kg to target</small><b>${dash(d.kgToTarget)}</b><span>target ${s.targetWeight} kg</span></div>
          <div class="tile"><small>On-pace weight today</small><b>${d.onPaceToday} kg</b><span>${d.latestWeight ? (d.latestWeight - d.onPaceToday <= 0 ? 'ahead of plan ✓' : `${(d.latestWeight - d.onPaceToday).toFixed(1)} kg behind`) : 'weigh in Mon/Wed/Fri'}</span></div>
          <div class="tile"><small>Days logged</small><b>${d.daysLogged}</b><span>of ${d.dayOfArc || 0} so far</span></div>
        </div>

        <div class="grid g2">
          <div class="card">
            <div class="card-head"><h2>Goal hit rates</h2><p>Y ÷ (Y + N)</p></div>
            <div class="goal-list">
              ${d.goals.map((g) => `
                <div class="goal-row">
                  <div><div style="font-weight:650">${h(g.label)}</div><small>${g.y} hit · ${g.n} missed</small></div>
                  <div class="bar"><span style="width:${(g.rate || 0) * 100}%;background:var(--${STATUS_TONE[g.status] === 'bad' ? 'bad' : STATUS_TONE[g.status] === 'warn' ? 'warn' : STATUS_TONE[g.status] === 'ok' ? 'ok' : 'good'})"></span></div>
                  <div class="flex" style="gap:8px;justify-content:flex-end"><span class="pct">${pct(g.rate)}</span><span class="chip ${STATUS_TONE[g.status]}">${g.status}</span></div>
                </div>`).join('')}
            </div>
          </div>
          <div class="card">
            <div class="card-head"><h2>Arc calendar</h2><p>Tap a day to log or edit it</p></div>
            ${heatmap()}
          </div>
        </div>

        <div class="grid g2">
          <div class="card"><div class="card-head"><h2>Daily score</h2></div><div class="chart-box"><canvas id="c-score"></canvas></div></div>
          <div class="card"><div class="card-head"><h2>Weight vs plan</h2></div><div class="chart-box"><canvas id="c-weight"></canvas></div></div>
        </div>
      </div>`;
  },
  bind() { scoreChart($('#c-score')); weightChart($('#c-weight')); },
};

// ---------------------------------------------------------------- charts
function chartDefaults() {
  if (!window.Chart) return false;
  Chart.defaults.color = '#8da2c4';
  Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
  Chart.defaults.borderColor = 'rgba(34,53,90,.6)';
  return true;
}
function emptyChart(canvas, msg) {
  canvas.parentElement.innerHTML = `<div class="empty"><span class="ico">📈</span>${msg}</div>`;
}
function scoreChart(canvas) {
  if (!canvas || !chartDefaults()) return;
  const days = S.days.filter((d) => d.score !== null);
  if (!days.length) return emptyChart(canvas, 'Log your first day to see your score trend.');
  const thr = S.settings.goodDayThreshold;
  S.charts.push(new Chart(canvas, {
    type: 'bar',
    data: {
      labels: days.map((d) => fmtDate(d.date)),
      datasets: [{ label: 'Score', data: days.map((d) => Math.round(d.score * 100)), backgroundColor: days.map((d) => (d.score >= thr ? '#38bdf8' : '#475569')), borderRadius: 4, maxBarThickness: 22 }],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.raw}%` } } },
      scales: { y: { min: 0, max: 100, ticks: { callback: (v) => v + '%', stepSize: 20 } }, x: { grid: { display: false } } },
    },
  }));
}
function weightChart(canvas, full = false) {
  if (!canvas || !chartDefaults()) return;
  const s = S.settings;
  const days = full ? S.days : S.days;
  const hasWeight = days.some((d) => d.weight);
  S.charts.push(new Chart(canvas, {
    type: 'line',
    data: {
      labels: days.map((d) => fmtDate(d.date)),
      datasets: [
        { label: 'On-pace', data: days.map((d) => onPaceForDate(d.date, s)), borderColor: '#5b6f92', borderDash: [6, 5], pointRadius: 0, borderWidth: 2, tension: 0 },
        { label: 'Actual', data: days.map((d) => (d.weight ? Number(d.weight) : null)), borderColor: '#7dd3fc', backgroundColor: '#7dd3fc', spanGaps: true, pointRadius: 3, borderWidth: 2.5, tension: 0.25 },
      ],
    },
    options: {
      maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } }, subtitle: { display: !hasWeight, text: 'Weigh in Mon, Wed, Fri mornings to plot your line' } },
      scales: { y: { ticks: { callback: (v) => v + ' kg' } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } } },
    },
  }));
}

// ---------------------------------------------------------------- daily log
let draft = null;
function newDraft(date) {
  const existing = S.logs[date];
  if (existing) return { ...existing, date };
  const sun = isSunday(date);
  return { date, college: sun ? 'Off' : '', internship: '', gym: sun ? 'Rest' : '', diet: '', assignments: '', skillMin: '', bedtime: '', wake: '', weight: '', notes: '' };
}
function clampDate(date) {
  const s = S.settings;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) date = todayISO();
  return date < s.arcStart ? s.arcStart : date > s.arcEnd ? s.arcEnd : date;
}
const segBtns = (key, value, extra) => `<div class="seg" role="group">${['Y', 'N', ...(extra ? [extra] : [])].map((v) => `<button type="button" data-k="${key}" data-v="${v}" class="${value === v ? 'on' : ''}" aria-pressed="${value === v}">${v}</button>`).join('')}</div>`;

function scorePanel() {
  const s = S.settings;
  const r = computeRow(draft, s);
  const good = r.score !== null && r.score >= s.goodDayThreshold;
  const phaseName = phaseFor(draft.date, s);
  const phase = s.phases.find((p) => p.name === phaseName);
  const gymDay = GYM.days[(parseISO(draft.date).getDay() + 6) % 7];
  return `
    <div class="card">
      <div class="kicker">Daily score</div>
      <div class="flex between" style="align-items:flex-end">
        <div class="big-score" style="color:${r.score == null ? 'var(--faint)' : good ? 'var(--good)' : 'var(--warn)'}">${pct(r.score)}</div>
        <div style="text-align:right"><b>${r.hit} / ${r.counted}</b><br><small>goals hit</small></div>
      </div>
      <div class="derived">
        ${r.score !== null ? `<span class="chip ${good ? 'good' : 'warn'}">${good ? '✓ Good day, counts for streak' : `Below ${Math.round(s.goodDayThreshold * 100)}%, streak resets`}</span>` : '<span class="chip">Fill goals to see your score</span>'}
      </div>
      <div class="derived">
        <span class="chip ${r.sleepOk === 'Y' ? 'good' : r.sleepOk === 'N' ? 'bad' : ''}">Sleep ${r.sleepHrs != null ? r.sleepHrs + ' h' : '—'} ${r.sleepOk ? (r.sleepOk === 'Y' ? '✓' : '✗') : ''}</span>
        <span class="chip ${r.skillOk === 'Y' ? 'good' : r.skillOk === 'N' ? 'bad' : ''}">Skill ${draft.skillMin || 0}/${r.skillTarget} min ${r.skillOk ? (r.skillOk === 'Y' ? '✓' : '✗') : ''}</span>
      </div>
    </div>
    ${phase ? `<div class="card"><div class="kicker">${h(phase.name)}</div><p style="font-weight:600">${h(phase.focus)}</p><p class="muted" style="margin-top:6px;font-size:.88rem">${h(phase.targets)}</p></div>` : ''}
    <div class="card">
      <div class="kicker">${gymDay.day} workout</div>
      <h3>${h(gymDay.focus)}</h3>
      <ul class="clean" style="margin-top:8px;font-size:.88rem">${gymDay.ex.map((e) => `<li>${h(e[0])} <span class="muted">${e[1]}×${h(e[2])}</span></li>`).join('')}</ul>
      <a href="#/plan/gym" style="font-size:.85rem;display:inline-block;margin-top:8px">Full split →</a>
    </div>`;
}

const logView = {
  html(arg) {
    const date = clampDate(arg);
    if (!draft || draft.date !== date) draft = newDraft(date);
    const exists = !!S.logs[date];
    const s = S.settings;
    const sun = isSunday(date);
    const goalItem = (key, name, hint, extra) => `
      <div class="goal-item"><div><div class="name">${name}</div><div class="hint">${hint}</div></div>${segBtns(key, draft[key], extra)}</div>`;
    return `
      <div class="page-head">
        <div>
          <div class="kicker">${exists ? 'Editing entry' : 'New entry'} · ${h(phaseFor(date, s))}</div>
          <h1>${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
        </div>
        <div class="date-nav">
          <button class="icon-btn" id="prev-day" aria-label="Previous day" ${date <= s.arcStart ? 'disabled' : ''}>‹</button>
          <input type="date" id="log-date" value="${date}" min="${s.arcStart}" max="${s.arcEnd}" aria-label="Date" />
          <button class="icon-btn" id="next-day" aria-label="Next day" ${date >= s.arcEnd ? 'disabled' : ''}>›</button>
          ${date !== todayISO() ? `<button class="btn ghost sm" id="to-today">Today</button>` : ''}
        </div>
      </div>
      <div class="grid g3">
        <form id="log-form" class="stack span2" autocomplete="off">
          <div class="card">
            <div class="card-head"><h2>Goals</h2><p>Tap Y or N. Tap again to clear.</p></div>
            <div class="goal-grid">
              ${goalItem('college', '1 · College', sun ? 'Sunday: Off by default' : 'Attended every class?', 'Off')}
              ${goalItem('internship', '2 · Internship', 'Showed up and did the work?')}
              ${goalItem('gym', '3 · Gym', sun ? 'Sunday: Rest + 30–45 min walk' : 'Followed the split?', 'Rest')}
              ${goalItem('diet', '4 · Diet on plan', `~${s.calorieTarget} kcal · ${s.proteinTarget} g protein`)}
              ${goalItem('assignments', '7 · Assignment work done', '45 min block at 9:30 PM')}
            </div>
          </div>
          <div class="card">
            <div class="card-head"><h2>Study, sleep & weight</h2><p>Sleep and skill targets calculate themselves</p></div>
            <div class="row">
              <div class="field">
                <label for="f-skill">5 · Skill study (minutes)</label>
                <input id="f-skill" data-f="skillMin" type="number" min="0" max="600" inputmode="numeric" value="${h(draft.skillMin)}" placeholder="Target ${sun ? s.skillTargetSunday : s.skillTargetWeekday}" />
                <div class="quick">${[15, 30, 60, 120].map((m) => `<button type="button" data-quick="${m}">${m}</button>`).join('')}</div>
              </div>
              <div class="field">
                <label for="f-weight">Weight (kg)</label>
                <input id="f-weight" data-f="weight" type="number" step="0.1" min="20" max="300" inputmode="decimal" value="${h(draft.weight)}" placeholder="${['Mon', 'Wed', 'Fri'].includes(dayName(date)) ? 'Weigh-in day!' : 'Mon / Wed / Fri'}" />
              </div>
            </div>
            <div class="row">
              <div class="field"><label for="f-bed">6 · Bedtime (last night)</label><input id="f-bed" data-f="bedtime" type="time" value="${h(draft.bedtime)}" /><small>Target ${fmtTime(s.lightsOutTarget)}</small></div>
              <div class="field"><label for="f-wake">Wake time</label><input id="f-wake" data-f="wake" type="time" value="${h(draft.wake)}" /><small>Target ${fmtTime(s.wakeTarget)}</small></div>
            </div>
            <div class="field" style="margin:0"><label for="f-notes">Notes</label><textarea id="f-notes" data-f="notes" rows="2" placeholder="Anything worth remembering about today?">${h(draft.notes)}</textarea></div>
          </div>
          <div class="save-bar sticky">
            <button class="btn" type="submit" id="save-log">Save day</button>
            ${exists ? `<button class="btn danger" type="button" id="del-log">Delete entry</button>` : ''}
            <a class="btn ghost" href="#/history">History</a>
          </div>
        </form>
        <aside class="stack score-card" id="score-panel">${scorePanel()}</aside>
      </div>`;
  },
  bind(arg) {
    const date = clampDate(arg);
    const go = (d) => (location.hash = `#/log/${d}`);
    $('#prev-day').addEventListener('click', () => go(addDays(date, -1)));
    $('#next-day').addEventListener('click', () => go(addDays(date, 1)));
    $('#to-today')?.addEventListener('click', () => go(clampDate(todayISO())));
    $('#log-date').addEventListener('change', (e) => e.target.value && go(e.target.value));
    const form = $('#log-form');
    const refresh = () => ($('#score-panel').innerHTML = scorePanel());
    form.addEventListener('click', (e) => {
      const b = e.target.closest('.seg button');
      if (b) {
        const { k, v } = b.dataset;
        draft[k] = draft[k] === v ? '' : v;
        $$(`.seg button[data-k="${k}"]`, form).forEach((x) => { x.classList.toggle('on', x.dataset.v === draft[k]); x.setAttribute('aria-pressed', x.dataset.v === draft[k]); });
        return refresh();
      }
      const q = e.target.closest('[data-quick]');
      if (q) { draft.skillMin = q.dataset.quick; $('#f-skill').value = q.dataset.quick; refresh(); }
    });
    form.addEventListener('input', (e) => {
      const f = e.target.dataset.f;
      if (f) { draft[f] = e.target.value; refresh(); }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('#save-log');
      btn.disabled = true;
      const entry = { ...draft };
      const empty = ['internship', 'diet', 'assignments', 'skillMin', 'bedtime', 'wake', 'weight', 'notes'].every((k) => entry[k] === '' || entry[k] == null)
        && ['', 'Off'].includes(entry.college) && ['', 'Rest'].includes(entry.gym);
      try {
        if (empty) {
          if (S.logs[date]) { await S.store.deleteLog(date); delete S.logs[date]; }
          toast('Nothing to save yet. Fill at least one goal.');
        } else {
          await S.store.saveLog(entry);
          S.logs[date] = entry;
          recompute();
          const row = S.days.find((d) => d.date === date);
          toast(`Saved · ${pct(row.score)}${row.streak ? ` · 🔥 ${row.streak} day streak` : ''}`);
        }
        recompute();
        draft = null;
        render();
      } catch (err) { toast(err.message || 'Save failed', true); btn.disabled = false; }
    });
    $('#del-log')?.addEventListener('click', async () => {
      if (!confirm(`Delete the entry for ${fmtDate(date, { day: 'numeric', month: 'long' })}?`)) return;
      await safely(() => S.store.deleteLog(date), 'Entry deleted');
      delete S.logs[date];
      draft = null;
      recompute();
      render();
    });
  },
};

// ---------------------------------------------------------------- history
const CSV_COLS = [
  ['Date', (d) => d.date], ['Day', (d) => dayName(d.date)], ['Phase', (d) => d.phase],
  ['College', (d) => d.college], ['Internship', (d) => d.internship], ['Gym', (d) => d.gym], ['Diet', (d) => d.diet],
  ['Skill (min)', (d) => d.skillMin], ['Assignments', (d) => d.assignments], ['Bedtime', (d) => d.bedtime], ['Wake', (d) => d.wake],
  ['Sleep hrs', (d) => d.sleepHrs], ['Sleep on target', (d) => d.sleepOk], ['Skill target met', (d) => d.skillOk], ['Weight', (d) => d.weight],
  ['Goals hit', (d) => (d.counted ? d.hit : '')], ['Goals counted', (d) => (d.counted || '')], ['Score', (d) => (d.score == null ? '' : Math.round(d.score * 100) + '%')],
  ['Streak', (d) => d.streak], ['Notes', (d) => d.notes],
];
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportCSV() {
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const rows = [CSV_COLS.map((c) => c[0]), ...S.days.filter((d) => d.logged).map((d) => CSV_COLS.map((c) => c[1](d)))];
  download(`winter-arc-daily-log-${todayISO()}.csv`, rows.map((r) => r.map(esc).join(',')).join('\n'), 'text/csv');
}

const historyView = {
  html() {
    const today = todayISO();
    const rows = S.days.filter((d) => S.showFuture || d.date <= today || d.logged).slice().reverse();
    return `
      <div class="page-head">
        <div><div class="kicker">Daily log</div><h1>History</h1><p>Every day of the arc. Tap a row to edit it.</p></div>
        <div class="flex">
          <label class="flex" style="margin:0;gap:6px;cursor:pointer"><input type="checkbox" id="show-future" ${S.showFuture ? 'checked' : ''} style="width:auto" /> Show future days</label>
          <button class="btn ghost" id="csv">⇩ Export CSV</button>${settingsBtn}
        </div>
      </div>
      ${rows.length ? `
      <div class="day-list only-phone">
        ${rows.map((d) => `
          <a class="day-card ${d.date === today ? 'is-today' : ''} ${d.date > today ? 'is-future' : ''}" href="#/log/${d.date}">
            <div class="flex between">
              <div><b>${fmtDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</b>${d.streak ? ` <span class="muted">🔥 ${d.streak}</span>` : ''}</div>
              ${d.score != null ? `<span class="chip ${d.score >= S.settings.goodDayThreshold ? 'good' : 'warn'}">${pct(d.score)}</span>` : d.date < today ? '<span class="chip bad">missed</span>' : '<span class="chip">—</span>'}
            </div>
            ${d.logged ? `<div class="dots">${GOALS.map((g) => `<span class="dot-${d[g.key] === 'Y' ? 'y' : d[g.key] === 'N' ? 'n' : 'o'}" title="${g.short}">${g.short}</span>`).join('')}</div>
            <div class="muted day-meta">${[d.sleepHrs != null ? `😴 ${d.sleepHrs}h` : '', d.skillMin ? `📚 ${d.skillMin}m` : '', d.weight ? `⚖ ${d.weight} kg` : ''].filter(Boolean).join(' · ')}${d.notes ? ` · ${h(d.notes)}` : ''}</div>` : ''}
          </a>`).join('')}
      </div>
      <div class="table-wrap only-desktop">
        <table>
          <thead><tr><th>Date</th><th>Phase</th><th>College</th><th>Intern</th><th>Gym</th><th>Diet</th><th>Skill</th><th>Assign</th><th>Sleep</th><th>Weight</th><th>Score</th><th>Streak</th><th>Notes</th></tr></thead>
          <tbody>
            ${rows.map((d) => `
              <tr class="clickable ${d.date === today ? 'is-today' : ''} ${d.date > today ? 'is-future' : ''}" data-date="${d.date}">
                <td><b>${fmtDate(d.date)}</b> <span class="muted">${dayName(d.date)}</span></td>
                <td class="muted">${h(d.phase.replace(/^\d · /, ''))}</td>
                <td>${yn(d.college)}</td><td>${yn(d.internship)}</td><td>${yn(d.gym)}</td><td>${yn(d.diet)}</td>
                <td class="num">${d.skillMin !== '' && d.skillMin != null ? `${d.skillMin}m ${yn(d.skillOk)}` : yn('')}</td>
                <td>${yn(d.assignments)}</td>
                <td class="num">${d.sleepHrs != null ? `${d.sleepHrs}h ${yn(d.sleepOk)}` : yn('')}</td>
                <td class="num">${dash(d.weight)}</td>
                <td>${d.score != null ? `<span class="chip ${d.score >= S.settings.goodDayThreshold ? 'good' : 'warn'}">${pct(d.score)}</span>` : d.date < today ? '<span class="chip bad">missed</span>' : ''}</td>
                <td class="num">${d.streak ? '🔥 ' + d.streak : ''}</td>
                <td class="muted" style="max-width:220px;overflow:hidden;text-overflow:ellipsis">${h(d.notes)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : `<div class="card empty"><span class="ico">▦</span>The arc hasn't started yet.</div>`}`;
  },
  bind() {
    $('#csv').addEventListener('click', exportCSV);
    $('#show-future').addEventListener('change', (e) => { S.showFuture = e.target.checked; render(); });
    $$('tr[data-date]').forEach((tr) => tr.addEventListener('click', () => (location.hash = `#/log/${tr.dataset.date}`)));
  },
};

// ---------------------------------------------------------------- assignments
function asgForm(a = {}) {
  return `
    <div class="row">
      <div class="field"><label>Subject</label><input name="subject" required value="${h(a.subject)}" placeholder="e.g. DBMS" /></div>
      <div class="field"><label>Assignment</label><input name="title" required value="${h(a.title)}" placeholder="e.g. ER diagram for library system" /></div>
    </div>
    <div class="row">
      <div class="field"><label>Given on</label><input name="givenOn" type="date" value="${h(a.givenOn ?? todayISO())}" /></div>
      <div class="field"><label>Due date</label><input name="dueDate" type="date" required value="${h(a.dueDate)}" /></div>
      <div class="field"><label>Status</label><select name="status">${ASSIGNMENT_STATUSES.map((s) => `<option ${s === (a.status || 'Not started') ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label>Notes</label><input name="notes" value="${h(a.notes)}" placeholder="Optional" /></div>`;
}
const formData = (form) => Object.fromEntries(new FormData(form).entries());

const assignmentsView = {
  html() {
    const today = todayISO();
    const list = S.assignments.map((a) => ({ ...a, ...assignmentFlag(a, today) }))
      .sort((a, b) => (a.status === 'Submitted') - (b.status === 'Submitted') || (a.dueDate || '9').localeCompare(b.dueDate || '9'));
    const filters = {
      open: (a) => a.status !== 'Submitted', overdue: (a) => a.flag === 'OVERDUE', soon: (a) => a.flag === 'DUE SOON',
      done: (a) => a.status === 'Submitted', all: () => true,
    };
    const count = (k) => list.filter(filters[k]).length;
    const shown = list.filter(filters[S.asgFilter]);
    return `
      <div class="page-head">
        <div><div class="kicker">Goal 7</div><h1>Assignments</h1><p>Add an assignment the moment it's given. Flags update on their own every day.</p></div>
        ${settingsBtn}
      </div>
      <div class="grid g3">
        <div class="stack span2">
          <div class="filters">
            ${[['open', 'Open'], ['overdue', 'Overdue'], ['soon', 'Due soon'], ['done', 'Submitted'], ['all', 'All']].map(([k, l]) => `<button data-filter="${k}" class="${S.asgFilter === k ? 'on' : ''}">${l} · ${count(k)}</button>`).join('')}
          </div>
          ${shown.length ? shown.map((a) => `
            <div class="asg ${a.flag === 'OVERDUE' ? 'overdue' : a.flag === 'DUE SOON' ? 'soon' : a.flag === 'Submitted' ? 'done' : ''}">
              <div>
                <div class="t">${h(a.title || 'Untitled')}</div>
                <div class="meta">
                  <span class="chip">${h(a.subject || 'No subject')}</span>
                  ${a.flag ? `<span class="chip ${FLAG_TONE[a.flag]}">${a.flag}</span>` : ''}
                  <span>Due ${fmtDate(a.dueDate, { weekday: 'short', day: 'numeric', month: 'short' }) || '—'}</span>
                  ${typeof a.daysLeft === 'number' ? `<span>· ${a.daysLeft < 0 ? `${-a.daysLeft} day${a.daysLeft === -1 ? '' : 's'} late` : a.daysLeft === 0 ? 'due today' : `${a.daysLeft} day${a.daysLeft === 1 ? '' : 's'} left`}</span>` : ''}
                </div>
                ${a.notes ? `<p class="muted" style="font-size:.85rem;margin-top:6px">${h(a.notes)}</p>` : ''}
              </div>
              <div class="actions">
                <select data-status="${a.id}" aria-label="Status">${ASSIGNMENT_STATUSES.map((s) => `<option ${s === a.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
                <button class="icon-btn" data-edit="${a.id}" aria-label="Edit">✎</button>
                <button class="icon-btn" data-del="${a.id}" aria-label="Delete">🗑</button>
              </div>
            </div>`).join('') : `<div class="card empty"><span class="ico">✓</span>${S.asgFilter === 'open' ? 'Nothing open. Nice.' : 'Nothing here.'}</div>`}
        </div>
        <form class="card" id="asg-add" style="align-self:start">
          <div class="card-head"><h2>Add assignment</h2></div>
          ${asgForm()}
          <button class="btn block" type="submit">Add</button>
        </form>
      </div>`;
  },
  bind() {
    $$('[data-filter]').forEach((b) => b.addEventListener('click', () => { S.asgFilter = b.dataset.filter; render(); }));
    $('#asg-add').addEventListener('submit', async (e) => {
      e.preventDefault();
      const a = formData(e.target);
      if (!a.title.trim() || !a.dueDate) return toast('Add a title and a due date.', true);
      const saved = await safely(() => S.store.saveAssignment(a), 'Assignment added');
      S.assignments.push(saved);
      recompute(); render();
    });
    $$('[data-status]').forEach((sel) => sel.addEventListener('change', async () => {
      const a = S.assignments.find((x) => x.id === sel.dataset.status);
      const saved = await safely(() => S.store.saveAssignment({ ...a, status: sel.value }), sel.value === 'Submitted' ? 'Submitted ✓' : 'Status updated');
      Object.assign(a, saved);
      recompute(); render();
    }));
    $$('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const a = S.assignments.find((x) => x.id === b.dataset.del);
      if (!confirm(`Delete "${a.title}"?`)) return;
      await safely(() => S.store.deleteAssignment(a.id), 'Deleted');
      S.assignments = S.assignments.filter((x) => x.id !== a.id);
      recompute(); render();
    }));
    $$('[data-edit]').forEach((b) => b.addEventListener('click', () => {
      const a = S.assignments.find((x) => x.id === b.dataset.edit);
      const modal = $('#modal');
      modal.innerHTML = `<form method="dialog" id="asg-edit"><h2 style="margin-bottom:16px">Edit assignment</h2>${asgForm(a)}
        <div class="flex" style="justify-content:flex-end"><button class="btn ghost" value="cancel" formnovalidate>Cancel</button><button class="btn" value="save">Save</button></div></form>`;
      modal.showModal();
      $('#asg-edit').addEventListener('submit', async (e) => {
        if (e.submitter?.value !== 'save') return;
        const saved = await safely(() => S.store.saveAssignment({ ...a, ...formData(e.target) }), 'Saved');
        Object.assign(a, saved);
        recompute(); render();
      });
    }));
  },
};

// ---------------------------------------------------------------- weekly review
const weeklyView = {
  html() {
    const today = todayISO();
    const weeks = arcWeeks(S.settings).filter((w) => w.start <= today).reverse();
    if (!weeks.length) return `<div class="page-head"><div><h1>Weekly Review</h1></div></div><div class="card empty"><span class="ico">↻</span>Your first week starts ${fmtDate(S.settings.arcStart)}.</div>`;
    return `
      <div class="page-head">
        <div><div class="kicker">Every Sunday 9 PM · 15 minutes</div><h1>Weekly Review</h1><p>Stats pull from your daily log. You only fill in the win and the fix.</p></div>
        ${settingsBtn}
      </div>
      <div class="stack">
        ${weeks.map((w) => {
          const st = weekStats(w, S.days, S.assignments, S.settings);
          const r = S.reviews[w.week] || {};
          const current = today >= w.start && today <= w.end;
          return `
            <div class="card week ${current ? 'current' : ''}">
              <div class="card-head">
                <div><h2>Week ${w.week} ${current ? '<span class="chip ice">this week</span>' : ''}</h2><p>${fmtDate(w.start, { weekday: 'short', day: 'numeric', month: 'short' })} – ${fmtDate(w.end, { weekday: 'short', day: 'numeric', month: 'short' })} · ${h(phaseFor(w.end, S.settings))}</p></div>
                <span class="chip ${st.avgScore == null ? '' : st.avgScore >= S.settings.goodDayThreshold ? 'good' : 'warn'}" style="font-size:.9rem">${pct(st.avgScore)} avg</span>
              </div>
              <div class="week-stats">
                <div><small>College days</small><b>${st.college}</b></div>
                <div><small>Gym days</small><b>${st.gym}</b></div>
                <div><small>Diet days</small><b>${st.diet}</b></div>
                <div><small>Skill hours</small><b>${st.skillHours}</b></div>
                <div><small>Avg sleep</small><b>${dash(st.avgSleep, ' h')}</b></div>
                <div><small>Assignments open</small><b>${st.openAssignments}</b></div>
                <div><small>Avg weight</small><b>${dash(st.avgWeight, ' kg')}</b></div>
                <div><small>On-pace weight</small><b>${st.pace} kg</b></div>
                <div><small>Ahead (−) / behind (+)</small><b style="color:${st.delta == null ? 'inherit' : st.delta <= 0 ? 'var(--good)' : 'var(--warn)'}">${st.delta == null ? '—' : (st.delta > 0 ? '+' : '') + st.delta}</b></div>
              </div>
              <div class="row">
                <div class="field" style="margin:0"><label>Biggest win</label><textarea data-week="${w.week}" data-k="win" rows="2" placeholder="What went right?">${h(r.win)}</textarea></div>
                <div class="field" style="margin:0"><label>One thing to fix next week</label><textarea data-week="${w.week}" data-k="fix" rows="2" placeholder="${S.dash.weakest ? 'Hint: ' + h(S.dash.weakest.short) : 'Just one'}">${h(r.fix)}</textarea></div>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  },
  bind() {
    $$('textarea[data-week]').forEach((t) => t.addEventListener('change', async () => {
      const wk = Number(t.dataset.week);
      const r = { win: '', fix: '', ...(S.reviews[wk] || {}), [t.dataset.k]: t.value };
      await safely(() => S.store.saveReview(wk, r), 'Review saved');
      S.reviews[wk] = r;
    }));
  },
};

// ---------------------------------------------------------------- plan
const PLAN_TABS = [['timeline', 'Timeline'], ['schedule', 'Daily schedule'], ['gym', 'Gym split'], ['diet', 'Diet'], ['weight', 'Weight plan'], ['automations', 'Automations']];
const simpleTable = (head, rows) => `<div class="table-wrap cards"><table><thead><tr>${head.map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td data-label="${head[i]}" class="${i === r.length - 1 || String(c).length > 40 ? 'wrap' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

const PLAN = {
  timeline() {
    const today = todayISO();
    return `<div class="timeline">${S.settings.phases.map((p) => {
      const state = today > p.end ? 'past' : today >= p.start ? 'now' : '';
      return `<div class="card phase ${state}"><span class="dot"></span><div>
        <div class="flex between"><h2>${h(p.name)}</h2><span class="chip ${state === 'now' ? 'ice' : state === 'past' ? 'good' : ''}">${fmtDate(p.start)} – ${fmtDate(p.end)} · ${diffDays(p.end, p.start) + 1} days</span></div>
        <p style="margin-top:8px;font-weight:600">${h(p.focus)}</p>
        <p class="muted" style="margin-top:6px"><b style="color:var(--text)">Targets before moving on:</b> ${h(p.targets)}</p>
      </div></div>`;
    }).join('')}<p class="muted" style="font-size:.85rem">Phase 3 is guessed as exam/submission season. Change the dates in Settings when you have your real exam calendar.</p></div>`;
  },
  schedule() {
    const sun = isSunday(todayISO());
    return `<div class="grid g2">
      <div class="card ${!sun ? 'gym-day today' : ''}"><div class="card-head"><h2>Mon–Sat (college days)</h2></div>${simpleTable(['Time', 'Block', 'Goal'], SCHEDULE.weekday.map((r) => r.map(h)))}</div>
      <div class="card ${sun ? 'gym-day today' : ''}"><div class="card-head"><h2>Sunday (reset day)</h2></div>${simpleTable(['Time', 'Block', 'Goal'], SCHEDULE.sunday.map((r) => r.map(h)))}</div>
    </div><div class="spacer"></div><div class="callout"><span class="ico">☾</span><p>${h(SCHEDULE.note)}</p></div>`;
  },
  gym() {
    const todayIdx = (parseISO(todayISO()).getDay() + 6) % 7;
    return `<p class="muted" style="margin-bottom:14px">${h(GYM.intro)}</p>
      <div class="grid g2">${GYM.days.map((d, i) => `
        <div class="card gym-day ${i === todayIdx ? 'today' : ''}">
          <div class="card-head"><div><div class="kicker">${d.day}${i === todayIdx ? ' · today' : ''}</div><h2>${h(d.focus)}</h2></div></div>
          ${simpleTable(['Exercise', 'Sets', 'Reps', 'Rest', 'Cue'], d.ex.map((e) => e.map(h)))}
          ${d.finish ? `<p class="muted" style="font-size:.84rem;margin-top:10px">${h(d.finish)}</p>` : ''}
        </div>`).join('')}</div>
      <div class="spacer"></div>
      <div class="grid g2">
        <div class="card"><div class="card-head"><h2>Progression</h2><p>Double progression</p></div><ul class="clean">${GYM.progression.map((x) => `<li>${h(x)}</li>`).join('')}</ul></div>
        <div class="card"><div class="card-head"><h2>Cycle calendar</h2><p>3 build weeks + 1 deload</p></div>${simpleTable(['Week of', 'Type', 'What changes'], GYM.cycle.map((r) => r.map(h)))}</div>
      </div>`;
  },
  diet() {
    const m = macros(S.settings);
    const lw = S.dash.latestWeight || S.settings.startWeight;
    const band = lw > 75 ? 0 : lw > 70 ? 1 : lw > 65 ? 2 : 3;
    const tk = DIET.meals.reduce((a, r) => a + r[4], 0), tp = DIET.meals.reduce((a, r) => a + r[5], 0);
    return `<p class="muted" style="margin-bottom:14px">${h(DIET.intro)}</p>
      <div class="macro">
        <div class="tile"><small>Calories</small><b>${m.kcal}</b><span>kcal / day</span></div>
        <div class="tile"><small>Protein</small><b>${m.protein} g</b><span>hit it every day</span></div>
        <div class="tile"><small>Fat</small><b>${m.fat} g</b><span>~25% of calories</span></div>
        <div class="tile"><small>Carbs</small><b>${m.carbs} g</b><span>the rest</span></div>
      </div>
      <div class="spacer"></div>
      <div class="card"><div class="card-head"><h2>Mon–Sat meals</h2><p>≈ ${tk} kcal · ${tp} g protein (veg day)</p></div>
        ${simpleTable(['Time', 'Meal', 'Veg day', 'Non-veg day', '~kcal', '~Protein'], DIET.meals.map((r) => r.map(h)))}
        <p class="muted" style="font-size:.85rem;margin-top:10px">${h(DIET.mealNote)}</p>
        <div class="flex" style="margin-top:12px">${DIET.fixed.map((f) => `<span class="chip">${h(f[0])}: <b style="color:var(--text)">${h(f[1])}</b></span>`).join('')}</div>
      </div>
      <div class="spacer"></div>
      <div class="grid g2">
        <div class="card"><div class="card-head"><h2>Breakfast swaps</h2></div><ul class="clean">${DIET.swaps.map((x) => `<li>${h(x)}</li>`).join('')}</ul></div>
        <div class="card"><div class="card-head"><h2>Saturday & Sunday</h2></div><ul class="clean">${DIET.weekend.map((x) => `<li>${h(x)}</li>`).join('')}</ul></div>
        <div class="card"><div class="card-head"><h2>Eat often</h2><p>Cholesterol & calcium</p></div><ul class="clean">${DIET.eatOften.map((x) => `<li>${h(x)}</li>`).join('')}</ul></div>
        <div class="card"><div class="card-head"><h2>Limit</h2></div><ul class="clean">${DIET.limit.map((x) => `<li>${h(x)}</li>`).join('')}</ul></div>
      </div>
      <div class="spacer"></div>
      <div class="card"><div class="card-head"><h2>Calorie step-downs</h2><p>Update Settings when you reach each band</p></div>
        ${simpleTable(['Weekly avg weight', 'Calories / day', 'Protein / day', ''], DIET.stepDowns.map((r, i) => [h(r[0]), r[1], r[2] + ' g', i === band ? '<span class="chip ice">you are here</span>' : '']))}
        <p class="muted" style="font-size:.86rem;margin-top:12px">${h(DIET.adjustRule)}</p>
      </div>
      <div class="spacer"></div>
      <div class="callout"><span class="ico">🩺</span><p>${h(DIET.bloodTest)}</p></div>`;
  },
  weight() {
    const s = S.settings;
    return `<div class="card"><div class="card-head"><h2>${s.startWeight} → ${s.targetWeight} kg</h2><p>${s.lossPerWeekHigh} kg/week above ${s.rateChangePoint} kg, then ${s.lossPerWeekLow} kg/week</p></div><div class="chart-box" style="height:280px"><canvas id="c-weight"></canvas></div></div>
      <div class="spacer"></div>
      <div class="card"><div class="card-head"><h2>Projection</h2><p>The Winter Arc is leg 1; the rest runs into mid-2027</p></div>
        ${simpleTable(['Date', 'Weeks in', 'Projected weight', 'Milestone'], WEIGHT_MILESTONES.map(([d, m]) => [fmtDate(d, { day: 'numeric', month: 'short', year: 'numeric' }), (diffDays(d, s.arcStart) / 7).toFixed(1), onPaceForDate(d, s) + ' kg', h(m)]))}
        <p class="muted" style="font-size:.85rem;margin-top:10px">Change the pace in Settings and this table, the weekly review pace and the dashboard all update.</p>
      </div>`;
  },
  automations() {
    const done = new Set(S.settings.automationsDone || []);
    return `<div class="card-head"><p>Each one removes a daily decision. Set them up this week.</p><span class="chip ${done.size === AUTOMATIONS.length ? 'good' : 'ice'}">${done.size} / ${AUTOMATIONS.length} done</span></div>
      <div class="stack" style="gap:10px">${AUTOMATIONS.map(([t, how, goal], i) => `
        <label class="check ${done.has(i) ? 'done' : ''}" style="margin:0;color:var(--text);font-weight:400">
          <input type="checkbox" data-auto="${i}" ${done.has(i) ? 'checked' : ''} />
          <div><div class="flex between"><span class="t">${i + 1}. ${h(t)}</span><span class="chip">${h(goal)}</span></div><p class="muted" style="font-size:.88rem;margin-top:4px">${h(how)}</p></div>
        </label>`).join('')}</div>`;
  },
};

const planView = {
  html(arg) {
    const tab = PLAN[arg] ? arg : 'timeline';
    return `
      <div class="page-head"><div><div class="kicker">The playbook</div><h1>Plan</h1></div>${settingsBtn}</div>
      <nav class="tabs">${PLAN_TABS.map(([k, l]) => `<a href="#/plan/${k}" class="${k === tab ? 'on' : ''}">${l}</a>`).join('')}</nav>
      ${PLAN[tab]()}`;
  },
  bind(arg) {
    if (arg === 'weight') weightChart($('#c-weight'), true);
    $$('[data-auto]').forEach((cb) => cb.addEventListener('change', async () => {
      const set = new Set(S.settings.automationsDone || []);
      cb.checked ? set.add(Number(cb.dataset.auto)) : set.delete(Number(cb.dataset.auto));
      S.settings.automationsDone = [...set].sort((a, b) => a - b);
      await safely(() => S.store.saveSettings(S.settings), cb.checked ? 'Nice, one less decision' : 'Updated');
      render();
    }));
  },
};

// ---------------------------------------------------------------- settings
const SETTING_FIELDS = [
  ['Profile', [['displayName', 'Your name', 'text']]],
  ['Arc', [['arcStart', 'Arc start date', 'date'], ['arcEnd', 'Arc end date', 'date']]],
  ['Sleep', [['wakeTarget', 'Wake time target', 'time'], ['lightsOutTarget', 'Lights-out target', 'time'], ['minSleepHours', 'Min sleep hours to count as on-target', 'number', 0.5]]],
  ['Study & scoring', [['skillTargetWeekday', 'Skill study target, Mon–Sat (min)', 'number', 5], ['skillTargetSunday', 'Skill study target, Sunday (min)', 'number', 5], ['goodDayThreshold', 'Good-day score threshold (%)', 'percent']]],
  ['Weight', [['startWeight', 'Starting weight (kg)', 'number', 0.1], ['targetWeight', 'Target weight (kg)', 'number', 0.1], ['lossPerWeekHigh', 'Planned loss/week above change point (kg)', 'number', 0.05], ['lossPerWeekLow', 'Planned loss/week below change point (kg)', 'number', 0.05], ['rateChangePoint', 'Rate change point (kg)', 'number', 0.5]]],
  ['Nutrition', [['calorieTarget', 'Calorie target (kcal/day)', 'number', 10], ['proteinTarget', 'Protein target (g/day)', 'number', 1]]],
];

const settingsView = {
  html() {
    const s = S.settings;
    const input = ([k, label, type, step]) => {
      const v = type === 'percent' ? Math.round(s[k] * 100) : s[k];
      return `<div class="field"><label for="s-${k}">${label}</label><input id="s-${k}" name="${k}" type="${type === 'percent' ? 'number' : type}" ${step ? `step="${step}"` : ''} value="${h(v)}" ${type !== 'text' ? 'required' : ''} /></div>`;
    };
    return `
      <div class="page-head"><div><div class="kicker">${S.store.kind === 'local' ? 'Demo mode' : 'Synced to the cloud'}</div><h1>Settings</h1><p>Everything else reads from here.</p></div></div>
      <form id="settings-form" class="stack">
        <div class="grid g2">
          ${SETTING_FIELDS.map(([title, fields]) => `<div class="card"><div class="card-head"><h2>${title}</h2></div><div class="row">${fields.map(input).join('')}</div></div>`).join('')}
        </div>
        <div class="card">
          <div class="card-head"><h2>Phases</h2><p>Replace the dates with your real exam calendar when you have it</p></div>
          ${s.phases.map((p, i) => `
            <div class="row">
              <div class="field"><label>Phase ${i + 1} name</label><input name="phase-${i}-name" value="${h(p.name)}" /></div>
              <div class="field"><label>Start</label><input type="date" name="phase-${i}-start" value="${p.start}" /></div>
              <div class="field"><label>End</label><input type="date" name="phase-${i}-end" value="${p.end}" /></div>
            </div>`).join('')}
        </div>
        <div class="flex"><button class="btn" type="submit">Save settings</button><button class="btn ghost" type="button" id="reset-defaults">Restore defaults</button></div>
      </form>
      <div class="spacer"></div>
      <div class="grid g2">
        <div class="card">
          <div class="card-head"><h2>Your data</h2><p>Back up, move devices or analyse in Excel</p></div>
          <div class="flex">
            <button class="btn ghost" id="exp-json">⇩ Backup (JSON)</button>
            <button class="btn ghost" id="exp-csv">⇩ Daily log (CSV)</button>
            <label class="btn ghost" style="margin:0">⇧ Restore backup<input type="file" id="imp-json" accept="application/json,.json" hidden /></label>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h2>Account</h2></div>
          <p class="muted" style="margin-bottom:12px">${h(S.store.email)}</p>
          <div class="flex">
            <button class="btn ghost" id="s-signout">${S.store.kind === 'local' ? 'Leave demo mode' : 'Sign out'}</button>
            <button class="btn danger" id="wipe">Erase all my data</button>
          </div>
          ${S.store.kind === 'local' && supabaseConfigured ? '<p class="muted" style="font-size:.85rem;margin-top:10px">Tip: back up here, create an account, then restore the backup to move your demo data to the cloud.</p>' : ''}
        </div>
      </div>`;
  },
  bind() {
    $('#settings-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = formData(e.target);
      const next = structuredClone(S.settings);
      SETTING_FIELDS.flatMap((x) => x[1]).forEach(([k, , type]) => {
        next[k] = type === 'number' ? Number(f[k]) : type === 'percent' ? Number(f[k]) / 100 : f[k];
      });
      next.phases = next.phases.map((p, i) => ({ ...p, name: f[`phase-${i}-name`], start: f[`phase-${i}-start`], end: f[`phase-${i}-end`] }));
      if (next.arcEnd < next.arcStart) return toast('Arc end must be after the start.', true);
      if (next.lossPerWeekHigh <= 0 || next.lossPerWeekLow <= 0) return toast('Planned loss per week must be above 0.', true);
      await safely(() => S.store.saveSettings(next), 'Settings saved');
      S.settings = next;
      $('#brand-sub').textContent = S.store.kind === 'local' ? 'Demo mode' : next.displayName || 'Synced';
      recompute(); render();
    });
    $('#reset-defaults').addEventListener('click', async () => {
      if (!confirm('Restore all settings to the original Winter Arc defaults? Your logs are kept.')) return;
      const next = { ...structuredClone(DEFAULT_SETTINGS), displayName: S.settings.displayName, automationsDone: S.settings.automationsDone };
      await safely(() => S.store.saveSettings(next), 'Defaults restored');
      S.settings = next; recompute(); render();
    });
    $('#exp-json').addEventListener('click', () => {
      const payload = { app: 'winter-arc', version: 1, exportedAt: new Date().toISOString(), settings: S.settings, logs: S.logs, assignments: S.assignments, reviews: S.reviews };
      download(`winter-arc-backup-${todayISO()}.json`, JSON.stringify(payload, null, 2), 'application/json');
    });
    $('#exp-csv').addEventListener('click', exportCSV);
    $('#imp-json').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (data.app !== 'winter-arc' || typeof data.logs !== 'object') throw new Error('That file is not a Winter Arc backup.');
        if (!confirm(`Replace everything with this backup (${Object.keys(data.logs).length} days, ${(data.assignments || []).length} assignments)?`)) return;
        await S.store.replaceAll(data);
        Object.assign(S, await S.store.loadAll());
        recompute(); render();
        toast('Backup restored');
      } catch (err) { toast(err.message, true); }
      e.target.value = '';
    });
    $('#s-signout').addEventListener('click', signOut);
    $('#wipe').addEventListener('click', async () => {
      if (prompt('This deletes every log, assignment and review. Type ERASE to confirm.') !== 'ERASE') return;
      await safely(() => S.store.replaceAll({ settings: S.settings, logs: {}, assignments: [], reviews: {} }), 'All data erased');
      Object.assign(S, { logs: {}, assignments: [], reviews: {} });
      recompute(); render();
    });
  },
};

const VIEWS = { dashboard: dashboardView, log: logView, history: historyView, assignments: assignmentsView, weekly: weeklyView, plan: planView, settings: settingsView };

// ---------------------------------------------------------------- boot
async function boot() {
  S.started = false;
  if (lsGet('winterArc.mode') === 'local') return startApp(new LocalStore());
  if (!supabaseConfigured) return showAuth();
  const store = new SupabaseStore();
  S.store = store;
  let user;
  try { [user, S.providers] = await Promise.all([store.init(), store.providers()]); }
  catch (e) { console.error(e); return showAuth('signin', '!Could not reach the server. Check your connection.'); }
  store.onAuthChange(async (u, event) => {
    if (event === 'PASSWORD_RECOVERY') {
      const pw = prompt('Choose a new password (at least 6 characters):');
      if (pw && pw.length >= 6) await safely(() => store.updatePassword(pw), 'Password updated');
    }
    if (u && !S.started && S.store === store) startApp(store);
    if (!u && event === 'SIGNED_OUT') showAuth();
  });
  user ? startApp(store) : showAuth();
}

// Live IST clock; re-render when the IST date rolls over so "today" stays correct.
let lastDay = todayISO();
function tick() {
  $$('.ist-clock').forEach((el) => (el.textContent = `🕒 ${clockIST()} IST`));
  if (S.started && todayISO() !== lastDay) {
    lastDay = todayISO();
    recompute();
    if (parseRoute().name !== 'log') render();
  }
}
setInterval(tick, 20000);

snow();
boot();
