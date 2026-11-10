// In-memory app state, written through to IndexedDB on every change.
import * as db from './db.js';
import { today, uid, addDays } from './dates.js';
import { DEFAULT_AREAS, DEFAULT_TRACKERS, DEFAULT_EVENTS, SHIFT_TRACKER } from './defaults.js';

export const S = { settings: {}, areas: [], trackers: [], entries: new Map(), events: [], tasks: [], sessions: [], transactions: [] };

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);

export async function load() {
  await db.open();
  const [kv, areas, trackers, entries, events, tasks, sessions, transactions] = await Promise.all(
    ['kv', 'areas', 'trackers', 'entries', 'events', 'tasks', 'sessions', 'transactions'].map((s) => db.all(s))
  );
  S.settings = Object.fromEntries(kv.map((x) => [x.k, x.v]));
  if (!S.settings.seeded) { await seed(); return load(); }
  S.areas = areas.sort(byOrder);
  S.trackers = trackers.sort(byOrder);
  S.entries = new Map(entries.map((e) => [e.k, e.v]));
  S.events = events;
  S.tasks = tasks;
  S.sessions = sessions;
  S.transactions = transactions;
  await migrate();
}

// Upgrades for data created by older versions of the app.
async function migrate() {
  const v = S.settings.schema || 1;
  if (v < 2) {
    if (!S.trackers.some((t) => t.id === 'shift')) await saveTracker({ ...SHIFT_TRACKER, order: 999, createdAt: today() });
    if (S.settings.shiftPay == null) await setSetting('shiftPay', 50);
    await setSetting('schema', 2);
  }
  if (v < 3) {
    // Phase 3: faith trackers + fasting follows the church calendar
    const NEW = ['theology', 'examen', 'alms', 'confession', 'communion'];
    for (const [i, def] of DEFAULT_TRACKERS.entries()) {
      if (!NEW.includes(def.id) || S.trackers.some((t) => t.id === def.id)) continue;
      const { startIn, ...rest } = def;
      await saveTracker({ ...rest, order: i + 0.5, createdAt: today(), ...(startIn ? { startOn: addDays(today(), startIn) } : {}) });
    }
    const fast = S.trackers.find((t) => t.id === 'fast');
    if (fast && fast.freq.kind === 'week') { fast.freq = { kind: 'fast' }; await saveTracker(fast); }
    await setSetting('schema', 3);
  }
}

async function seed() {
  const d = today();
  await db.replaceAll('areas', DEFAULT_AREAS);
  await db.replaceAll('trackers', DEFAULT_TRACKERS.map(({ startIn, ...t }, i) => ({ ...t, order: i, createdAt: d, ...(startIn ? { startOn: addDays(d, startIn) } : {}) })));
  await db.replaceAll('events', DEFAULT_EVENTS);
  await setSetting('notifyTime', '06:00');
  await setSetting('currency', 'EUR');
  await setSetting('installedAt', d);
  await setSetting('seeded', true);
}

export async function setSetting(k, v) { S.settings[k] = v; await db.put('kv', { k, v }); }

// ---- daily entries ----
export const ek = (date, id) => `${date}|${id}`;
export const getEntry = (date, id) => S.entries.get(ek(date, id));
export async function setEntry(date, id, v) {
  const k = ek(date, id);
  const empty = v == null || v === false || v === '' || v === 0 || (typeof v === 'number' && Number.isNaN(v));
  if (empty) { S.entries.delete(k); await db.del('entries', k); }
  else { S.entries.set(k, v); await db.put('entries', { k, d: date, t: id, v }); }
}

// ---- generic list helpers ----
function upsert(list, item) {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = item; else list.push(item);
}
function remove(list, id) { const i = list.findIndex((x) => x.id === id); if (i >= 0) list.splice(i, 1); }

export async function saveTracker(t) {
  t.id ||= uid();
  t.createdAt ||= today();
  t.order ??= Date.now();
  upsert(S.trackers, t);
  S.trackers.sort(byOrder);
  await db.put('trackers', t);
}
export async function deleteTracker(id) {
  remove(S.trackers, id);
  await db.del('trackers', id);
  for (const k of [...S.entries.keys()]) {
    if (k.endsWith('|' + id)) { S.entries.delete(k); await db.del('entries', k); }
  }
}

export async function saveArea(a) {
  a.id ||= uid();
  a.order ??= S.areas.length;
  upsert(S.areas, a);
  S.areas.sort(byOrder);
  await db.put('areas', a);
}
export async function deleteArea(id) { remove(S.areas, id); await db.del('areas', id); }

export async function saveEvent(e) { e.id ||= uid(); upsert(S.events, e); await db.put('events', e); }
export async function deleteEvent(id) { remove(S.events, id); await db.del('events', id); }

export async function saveTask(t) { t.id ||= uid(); upsert(S.tasks, t); await db.put('tasks', t); }
export async function deleteTask(id) { remove(S.tasks, id); await db.del('tasks', id); }

// ---- training sessions (AM/PM sessions also tick the matching daily tracker) ----
async function syncSlot(date, slot) {
  if (!S.trackers.some((t) => t.id === slot)) return;
  const has = S.sessions.some((x) => x.date === date && x.slot === slot);
  await setEntry(date, slot, has || null);
}
export async function saveSession(s, prev) {
  s.id ||= uid();
  upsert(S.sessions, s);
  await db.put('sessions', s);
  if (prev && (prev.date !== s.date || prev.slot !== s.slot)) await syncSlot(prev.date, prev.slot);
  await syncSlot(s.date, s.slot);
}
export async function deleteSession(s) {
  remove(S.sessions, s.id);
  await db.del('sessions', s.id);
  await syncSlot(s.date, s.slot);
}

// ---- money ----
export async function saveTx(x) { x.id ||= uid(); upsert(S.transactions, x); await db.put('transactions', x); }
export async function deleteTx(id) { remove(S.transactions, id); await db.del('transactions', id); }

// A worked shift = ticked tracker + one automatic income entry for that day.
export const shiftTx = (date) => S.transactions.find((x) => x.auto === 'shift' && x.date === date);
export async function setShift(date, on) {
  await setEntry(date, 'shift', on || null);
  const tx = shiftTx(date);
  if (on && !tx) await saveTx({ kind: 'income', category: 'shifts', amount: S.settings.shiftPay ?? 50, date, note: 'Смяна', auto: 'shift' });
  if (!on && tx) await deleteTx(tx.id);
}

export const areaById = (id) => S.areas.find((a) => a.id === id) || { id, name: '—', emoji: '•', color: '#8b949e' };

// ---- backup ----
export async function exportData() {
  const data = {};
  for (const name of db.storeNames) data[name] = await db.all(name);
  return { app: 'podvig', version: 1, exportedAt: new Date().toISOString(), data };
}
export async function importData(obj) {
  if (!obj || obj.app !== 'podvig' || !obj.data) throw new Error('Това не е резервно копие на Подвиг.');
  for (const name of db.storeNames) await db.replaceAll(name, obj.data[name] || []);
  await load();
}
