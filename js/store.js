// Storage adapters. Both expose the same async interface so the UI doesn't care
// whether data lives in Supabase (synced, multi-user) or in this browser (demo mode).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js?v=5';
import { DEFAULT_SETTINGS } from './data.js?v=5';

export const supabaseConfigured =
  /^https:\/\/.+\.supabase\.co/.test(SUPABASE_URL) && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.startsWith('YOUR_');

const mergeSettings = (s) => ({ ...DEFAULT_SETTINGS, ...(s || {}) });

// ---------- row mapping (db snake_case <-> app camelCase) ----------
const logToDb = (l, userId) => ({
  user_id: userId, date: l.date, college: l.college || null, internship: l.internship || null,
  gym: l.gym || null, diet: l.diet || null, assignments: l.assignments || null,
  skill_min: l.skillMin === '' || l.skillMin == null ? null : Number(l.skillMin),
  bedtime: l.bedtime || null, wake: l.wake || null,
  weight: l.weight === '' || l.weight == null ? null : Number(l.weight),
  notes: l.notes || null, updated_at: new Date().toISOString(),
});
const logFromDb = (r) => ({
  date: r.date, college: r.college || '', internship: r.internship || '', gym: r.gym || '', diet: r.diet || '',
  assignments: r.assignments || '', skillMin: r.skill_min ?? '', bedtime: r.bedtime || '', wake: r.wake || '',
  weight: r.weight ?? '', notes: r.notes || '',
});
const asgToDb = (a, userId) => ({
  ...(a.id ? { id: a.id } : {}), user_id: userId, subject: a.subject || '', title: a.title || '',
  given_on: a.givenOn || null, due_date: a.dueDate || null, status: a.status || 'Not started', notes: a.notes || '',
});
const asgFromDb = (r) => ({
  id: r.id, subject: r.subject, title: r.title, givenOn: r.given_on || '', dueDate: r.due_date || '', status: r.status, notes: r.notes || '',
});

// ---------- Supabase ----------
export class SupabaseStore {
  kind = 'cloud';
  async init() {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    this.sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await this.sb.auth.getSession();
    this.user = data.session?.user || null;
    return this.user;
  }
  onAuthChange(cb) { this.sb.auth.onAuthStateChange((event, session) => { this.user = session?.user || null; cb(this.user, event); }); }
  async updatePassword(password) {
    const { error } = await this.sb.auth.updateUser({ password });
    if (error) throw error;
  }
  async signUp(email, password, displayName) {
    const { data, error } = await this.sb.auth.signUp({
      email, password, options: { data: { display_name: displayName }, emailRedirectTo: location.origin + location.pathname },
    });
    if (error) throw error;
    return data;
  }
  // Which sign-in methods are switched on in the Supabase dashboard ({ apple, google, phone, ... }).
  async providers() {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } });
      return (await res.json()).external || {};
    } catch { return {}; }
  }
  async signInWithProvider(provider) {
    const { error } = await this.sb.auth.signInWithOAuth({ provider, options: { redirectTo: location.origin + location.pathname } });
    if (error) throw error;
  }
  async sendPhoneCode(phone, displayName) {
    const { error } = await this.sb.auth.signInWithOtp({ phone, options: { data: displayName ? { display_name: displayName } : undefined } });
    if (error) throw error;
  }
  async verifyPhoneCode(phone, token) {
    const { error } = await this.sb.auth.verifyOtp({ phone, token, type: 'sms' });
    if (error) throw error;
  }
  async signIn(email, password) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }
  async resetPassword(email) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw error;
  }
  async signOut() { await this.sb.auth.signOut(); }
  get email() { return this.user?.email || (this.user?.phone ? '+' + this.user.phone.replace(/^\+/, '') : ''); }
  check({ error }) { if (error) throw error; }

  async loadAll() {
    const uid = this.user.id;
    const [p, l, a, w] = await Promise.all([
      this.sb.from('profiles').select('settings').eq('user_id', uid).maybeSingle(),
      this.sb.from('daily_logs').select('*').eq('user_id', uid),
      this.sb.from('assignments').select('*').eq('user_id', uid).order('due_date', { ascending: true }),
      this.sb.from('weekly_reviews').select('*').eq('user_id', uid),
    ]);
    [p, l, a, w].forEach((r) => this.check(r));
    let settings = p.data?.settings;
    if (!settings) {
      settings = mergeSettings({ displayName: this.user.user_metadata?.display_name || '' });
      await this.saveSettings(settings);
    }
    const logs = {}; (l.data || []).forEach((r) => (logs[r.date] = logFromDb(r)));
    const reviews = {}; (w.data || []).forEach((r) => (reviews[r.week] = { win: r.win || '', fix: r.fix || '' }));
    return { settings: mergeSettings(settings), logs, assignments: (a.data || []).map(asgFromDb), reviews };
  }
  async saveSettings(settings) {
    this.check(await this.sb.from('profiles').upsert({ user_id: this.user.id, settings, updated_at: new Date().toISOString() }));
  }
  async saveLog(log) { this.check(await this.sb.from('daily_logs').upsert(logToDb(log, this.user.id))); }
  async deleteLog(date) { this.check(await this.sb.from('daily_logs').delete().eq('user_id', this.user.id).eq('date', date)); }
  async saveAssignment(a) {
    const res = await this.sb.from('assignments').upsert(asgToDb(a, this.user.id)).select().single();
    this.check(res);
    return asgFromDb(res.data);
  }
  async deleteAssignment(id) { this.check(await this.sb.from('assignments').delete().eq('id', id)); }
  async saveReview(week, review) {
    this.check(await this.sb.from('weekly_reviews').upsert({ user_id: this.user.id, week, win: review.win, fix: review.fix }));
  }
  async replaceAll(data) {
    const uid = this.user.id;
    await this.saveSettings(data.settings);
    this.check(await this.sb.from('daily_logs').delete().eq('user_id', uid));
    this.check(await this.sb.from('assignments').delete().eq('user_id', uid));
    this.check(await this.sb.from('weekly_reviews').delete().eq('user_id', uid));
    const logs = Object.values(data.logs || {}).map((l) => logToDb(l, uid));
    if (logs.length) this.check(await this.sb.from('daily_logs').insert(logs));
    const asg = (data.assignments || []).map(({ id, ...a }) => asgToDb(a, uid));
    if (asg.length) this.check(await this.sb.from('assignments').insert(asg));
    const rev = Object.entries(data.reviews || {}).map(([week, r]) => ({ user_id: uid, week: Number(week), win: r.win, fix: r.fix }));
    if (rev.length) this.check(await this.sb.from('weekly_reviews').insert(rev));
  }
}

// ---------- Local (demo / offline) ----------
const KEY = 'winterArc.v1';
export class LocalStore {
  kind = 'local';
  async init() { this.user = { id: 'local', email: 'demo@local' }; return this.user; }
  onAuthChange() {}
  get email() { return 'Demo mode · saved in this browser'; }
  read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
  }
  write(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { console.warn('localStorage unavailable', e); }
    this.mem = d;
  }
  data() { return this.mem || this.read() || { settings: mergeSettings(), logs: {}, assignments: [], reviews: {} }; }
  async loadAll() { const d = this.data(); d.settings = mergeSettings(d.settings); this.mem = d; return structuredClone(d); }
  async saveSettings(s) { const d = this.data(); d.settings = s; this.write(d); }
  async saveLog(l) { const d = this.data(); d.logs[l.date] = l; this.write(d); }
  async deleteLog(date) { const d = this.data(); delete d.logs[date]; this.write(d); }
  async saveAssignment(a) {
    const d = this.data();
    const saved = { ...a, id: a.id || crypto.randomUUID() };
    const i = d.assignments.findIndex((x) => x.id === saved.id);
    i >= 0 ? (d.assignments[i] = saved) : d.assignments.push(saved);
    this.write(d);
    return saved;
  }
  async deleteAssignment(id) { const d = this.data(); d.assignments = d.assignments.filter((a) => a.id !== id); this.write(d); }
  async saveReview(week, r) { const d = this.data(); d.reviews[week] = r; this.write(d); }
  async replaceAll(data) { this.write({ settings: mergeSettings(data.settings), logs: data.logs || {}, assignments: data.assignments || [], reviews: data.reviews || {} }); }
  async signOut() {}
}
