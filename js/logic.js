// Rules for what is due on a day, what counts as done, scores and streaks.
import { S, getEntry } from './store.js';
import { dow, addDays, today, DAYS_SHORT } from './dates.js';
import { isFastDay } from './orthodox.js';

export const active = (t, date) => date >= t.createdAt && !(t.archivedAt && date >= t.archivedAt);

export function isDone(t, v) {
  if (t.type === 'check') return v === true;
  if (t.type === 'number') {
    if (v == null || v === '') return false;
    if (t.target == null || t.target === '') return true;
    return t.dir === 'max' ? v <= t.target : v >= t.target;
  }
  if (t.type === 'counter') return (v || 0) >= (t.target || 1);
  return false;
}
export const doneOn = (t, date) => isDone(t, getEntry(date, t.id));

// Weekly trackers are due on their weekdays. "Every N days" trackers are due
// once N days have passed since they were last done.
export function isScheduled(t, date) {
  if (t.startOn && date < t.startOn) return false;
  if (t.freq.kind === 'week') return t.freq.days.includes(dow(date));
  if (t.freq.kind === 'fast') return isFastDay(date);
  const n = t.freq.n || 1;
  for (let i = 1; i < n; i++) {
    const d = addDays(date, -i);
    if (d < t.createdAt) break;
    if (doneOn(t, d)) return false;
  }
  return true;
}

export const tasksOn = (date) => S.tasks.filter((k) => k.date === date);

export function dayStats(date) {
  const res = { due: 0, done: 0, areas: {} };
  for (const t of S.trackers) {
    if (!active(t, date)) continue;
    const done = doneOn(t, date);
    if (!done && !isScheduled(t, date)) continue;
    const a = (res.areas[t.area] ||= { due: 0, done: 0 });
    a.due++; res.due++;
    if (done) { a.done++; res.done++; }
  }
  for (const k of tasksOn(date)) { res.due++; if (k.done) res.done++; }
  return res;
}

export const ratio = (s) => (s && s.due ? s.done / s.due : null);
export function level(r) {
  if (r == null) return -1;
  if (r === 0) return 0;
  if (r < 0.4) return 1;
  if (r < 0.7) return 2;
  if (r < 1) return 3;
  return 4;
}

export const firstDay = () => S.trackers.reduce((m, t) => (t.createdAt < m ? t.createdAt : m), today());

export function streak(t) {
  let d = today(), n = 0;
  if (!doneOn(t, d)) d = addDays(d, -1);
  for (let i = 0; i < 2000 && d >= t.createdAt; i++, d = addDays(d, -1)) {
    if (doneOn(t, d)) n++;
    else if (isScheduled(t, d)) break;
  }
  return n;
}

export function lastDone(t, from = today()) {
  for (let i = 0; i < 400; i++) {
    const d = addDays(from, -i);
    if (d < t.createdAt) return null;
    if (doneOn(t, d)) return d;
  }
  return null;
}

// Consecutive days with at least `threshold` of the day's items done.
export function dayStreak(threshold = 0.8) {
  const start = firstDay();
  let d = today(), n = 0;
  if (!(ratio(dayStats(d)) >= threshold)) d = addDays(d, -1);
  for (; d >= start; d = addDays(d, -1)) {
    const r = ratio(dayStats(d));
    if (r == null) continue;
    if (r >= threshold) n++; else break;
  }
  return n;
}

export function eventsOn(date) {
  const wd = dow(date);
  return S.events
    .filter((e) => (e.days && e.days.length ? e.days.includes(wd) : e.date === date))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function freqText(f) {
  if (f.kind === 'fast') return 'В постни дни';
  if (f.kind === 'every') return f.n <= 1 ? 'Всеки ден' : `На всеки ${f.n} дни`;
  if (!f.days.length) return 'Когато се случи';
  if (f.days.length === 7) return 'Всеки ден';
  if (f.days.join() === '0,1,2,3,4') return 'Пн – Пт';
  if (f.days.join() === '0,1,2,3,4,5') return 'Пн – Сб';
  return f.days.map((d) => DAYS_SHORT[d]).join(', ');
}

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
