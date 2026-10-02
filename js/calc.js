// Calculation engine. Each function mirrors a formula from the original workbook.
import { GOALS } from './data.js?v=5';

// ---------- dates (local, YYYY-MM-DD strings) ----------
export const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
// "Now" is always India Standard Time, whatever timezone the device is set to.
export const TZ = 'Asia/Kolkata';
const nowFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function nowIST() {
  const p = Object.fromEntries(nowFmt.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) };
}
export const todayISO = () => nowIST().date;
export const clockIST = () => new Date().toLocaleString('en-IN', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
export const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return toISO(d); };
export const diffDays = (a, b) => Math.round((parseISO(a) - parseISO(b)) / 86400000); // a - b
export const isSunday = (s) => parseISO(s).getDay() === 0;
export const dayName = (s) => parseISO(s).toLocaleDateString('en-US', { weekday: 'short' });
export const fmtDate = (s, opts = { day: '2-digit', month: 'short' }) => (s ? parseISO(s).toLocaleDateString('en-IN', opts) : '');

export function arcDates(settings) {
  const out = [];
  for (let d = settings.arcStart; d <= settings.arcEnd; d = addDays(d, 1)) out.push(d);
  return out;
}

export function phaseFor(date, settings) {
  // MATCH(date, phaseStarts, 1): last phase whose start <= date
  let found = '';
  for (const p of settings.phases) if (p.start && date >= p.start) found = p.name;
  return found;
}

// ---------- daily row ----------
const timeToMin = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };

export function sleepHours(bed, wake) {
  const b = timeToMin(bed), w = timeToMin(wake);
  if (b === null || w === null) return null;
  const mins = (((w - b) % 1440) + 1440) % 1440; // MOD(wake - bed, 1)
  return Math.round((mins / 60) * 10) / 10;
}

export function computeRow(log, settings) {
  const r = { ...log };
  r.sleepHrs = sleepHours(log.bedtime, log.wake);
  r.sleepOk = r.sleepHrs === null ? '' : r.sleepHrs >= settings.minSleepHours ? 'Y' : 'N';
  const skillTarget = isSunday(log.date) ? settings.skillTargetSunday : settings.skillTargetWeekday;
  r.skillTarget = skillTarget;
  r.skillOk = log.skillMin === null || log.skillMin === undefined || log.skillMin === '' ? '' : Number(log.skillMin) >= skillTarget ? 'Y' : 'N';
  r.hit = GOALS.filter((g) => r[g.key] === 'Y').length;
  r.counted = GOALS.filter((g) => r[g.key] === 'Y' || r[g.key] === 'N').length;
  r.score = r.counted === 0 ? null : r.hit / r.counted;
  return r;
}

// Builds every arc day (logged or not), with running streak like column S.
export function buildDays(logs, settings) {
  let prevStreak = 0;
  return arcDates(settings).map((date) => {
    const log = logs[date];
    const row = computeRow(log ? { ...log, date } : { date }, settings);
    row.logged = !!log;
    row.phase = phaseFor(date, settings);
    if (row.score === null) { row.streak = null; prevStreak = 0; }
    else { row.streak = row.score >= settings.goodDayThreshold ? prevStreak + 1 : 0; prevStreak = row.streak; }
    return row;
  });
}

// ---------- weight pace ----------
export function onPaceWeight(weeks, s) {
  weeks = Math.max(0, weeks);
  const fast = s.startWeight - s.lossPerWeekHigh * weeks;
  if (fast >= s.rateChangePoint) return Math.round(fast * 10) / 10;
  const weeksToChange = (s.startWeight - s.rateChangePoint) / s.lossPerWeekHigh;
  const slow = s.rateChangePoint - s.lossPerWeekLow * (weeks - weeksToChange);
  return Math.round(Math.max(s.targetWeight, slow) * 10) / 10;
}
export const onPaceForDate = (date, s) => onPaceWeight(diffDays(date, s.arcStart) / 7, s);

// ---------- assignments ----------
export function assignmentFlag(a, today = todayISO()) {
  if (!a.dueDate) return { daysLeft: '', flag: '' };
  if (a.status === 'Submitted') return { daysLeft: 'Done', flag: 'Submitted' };
  const left = diffDays(a.dueDate, today);
  return { daysLeft: left, flag: left < 0 ? 'OVERDUE' : left <= 2 ? 'DUE SOON' : 'On track' };
}

// ---------- weeks (week 1 runs from arc start to first Sunday, then Mon–Sun) ----------
export function arcWeeks(settings) {
  const weeks = [];
  let start = settings.arcStart, n = 1;
  while (start <= settings.arcEnd) {
    let end = start;
    while (!isSunday(end) && end < settings.arcEnd) end = addDays(end, 1);
    weeks.push({ week: n++, start, end });
    start = addDays(end, 1);
  }
  return weeks;
}

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round1 = (x) => (x === null ? null : Math.round(x * 10) / 10);

export function weekStats(week, days, assignments, settings) {
  const inWeek = days.filter((d) => d.date >= week.start && d.date <= week.end);
  const scores = inWeek.filter((d) => d.score !== null).map((d) => d.score);
  const sleeps = inWeek.filter((d) => d.sleepHrs !== null).map((d) => d.sleepHrs);
  const weights = inWeek.filter((d) => d.weight).map((d) => Number(d.weight));
  const avgWeight = round1(avg(weights));
  const pace = onPaceForDate(week.end, settings);
  const horizon = addDays(week.end, 7);
  return {
    ...week,
    avgScore: avg(scores),
    college: inWeek.filter((d) => d.college === 'Y').length,
    gym: inWeek.filter((d) => d.gym === 'Y').length,
    diet: inWeek.filter((d) => d.diet === 'Y').length,
    skillHours: round1(inWeek.reduce((a, d) => a + (Number(d.skillMin) || 0), 0) / 60),
    avgSleep: round1(avg(sleeps)),
    openAssignments: assignments.filter((a) => a.dueDate && a.dueDate <= horizon && a.status !== 'Submitted').length,
    avgWeight,
    pace,
    delta: avgWeight === null ? null : round1(avgWeight - pace),
  };
}

// ---------- dashboard ----------
export function goalStatus(rate) {
  if (rate === null) return 'No data yet';
  if (rate >= 0.9) return 'Locked in';
  if (rate >= 0.75) return 'Solid';
  if (rate >= 0.5) return 'Slipping';
  return 'Fix this first';
}

export function dashboard(days, assignments, settings, today = todayISO()) {
  const total = diffDays(settings.arcEnd, settings.arcStart) + 1;
  const scored = days.filter((d) => d.score !== null);
  const lastScored = scored[scored.length - 1];
  const weighed = days.filter((d) => d.weight);
  const latestWeight = weighed.length ? Number(weighed[weighed.length - 1].weight) : null;
  const goals = GOALS.map((g) => {
    const y = days.filter((d) => d[g.key] === 'Y').length;
    const n = days.filter((d) => d[g.key] === 'N').length;
    const rate = y + n === 0 ? null : y / (y + n);
    return { ...g, y, n, rate, status: goalStatus(rate) };
  });
  const rated = goals.filter((g) => g.rate !== null);
  const weakest = rated.length ? rated.reduce((a, b) => (b.rate < a.rate ? b : a)) : null;
  const flags = assignments.map((a) => assignmentFlag(a, today).flag);
  // "never miss the same goal two days in a row" check against the last two logged days
  const logged = days.filter((d) => d.logged && d.date <= today);
  const twoInARow = logged.length >= 2
    ? GOALS.filter((g) => logged[logged.length - 1][g.key] === 'N' && logged[logged.length - 2][g.key] === 'N').map((g) => g.short)
    : [];
  return {
    today,
    dayOfArc: today < settings.arcStart ? null : Math.min(diffDays(today, settings.arcStart) + 1, total),
    totalDays: total,
    phase: phaseFor(today, settings),
    daysLeft: Math.max(0, diffDays(settings.arcEnd, today)),
    daysLogged: scored.length,
    avgScore: avg(scored.map((d) => d.score)),
    currentStreak: lastScored ? lastScored.streak : 0,
    bestStreak: Math.max(0, ...days.map((d) => d.streak || 0)),
    skillHours: round1(days.reduce((a, d) => a + (Number(d.skillMin) || 0), 0) / 60),
    latestWeight,
    kgToTarget: latestWeight ? round1(latestWeight - settings.targetWeight) : null,
    onPaceToday: onPaceForDate(today, settings),
    overdue: flags.filter((f) => f === 'OVERDUE').length,
    dueSoon: flags.filter((f) => f === 'DUE SOON').length,
    goals,
    weakest,
    twoInARow,
  };
}

export function macros(s) {
  const fat = Math.round((s.calorieTarget * 0.25) / 9);
  const carbs = Math.round((s.calorieTarget - s.proteinTarget * 4 - fat * 9) / 4);
  return { kcal: s.calorieTarget, protein: s.proteinTarget, fat, carbs };
}
