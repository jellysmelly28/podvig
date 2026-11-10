// Today: the day's schedule, tasks and every tracker, grouped by area.
import { S, getEntry, setEntry, saveTask, deleteTask, areaById, setShift } from '../store.js';
import { active, doneOn, isScheduled, isDone, dayStats, ratio, streak, lastDone, eventsOn, tasksOn } from '../logic.js';
import { today, addDays, fmtLong, diffDays, fmtShort } from '../dates.js';
import { h, num } from '../ui.js';
import { render, go } from '../app.js';
import { sessionForm, sessionFor, sessionSummary } from './training.js';
import { txForm, spentOn } from './money.js';
import { eur } from '../ui.js';
import { dayInfo } from '../orthodox.js';

const openLater = new Set();
const days = (n) => `${n} ${n === 1 ? 'ден' : 'дни'}`;

function meta(t, date, due) {
  if (t.freq.kind === 'every') {
    const last = lastDone(t, addDays(date, -1));
    if (doneOn(t, date)) return h('div', { class: 'rmeta' }, 'направено днес');
    if (!last && t.startOn && date < t.startOn) return h('div', { class: 'rmeta' }, `започва на ${fmtShort(t.startOn)}`);
    if (!last) return h('div', { class: 'rmeta' }, `на всеки ${days(t.freq.n)}`);
    const ago = diffDays(last, date);
    if (!due) return h('div', { class: 'rmeta' }, `след ${days(t.freq.n - ago)} · последно ${fmtShort(last)}`);
    const late = ago - t.freq.n;
    return h('div', { class: 'rmeta' + (late > 0 ? ' warn' : '') },
      late > 0 ? `просрочено с ${days(late)}` : `последно преди ${days(ago)}`);
  }
  if (date !== today()) return null;
  const s = streak(t);
  return s > 0 ? h('div', { class: 'rmeta' }, `🔥 ${days(s)} подред`) : null;
}

export function trackerRow(t, date, due) {
  const v = getEntry(date, t.id);
  const done = isDone(t, v);
  const set = async (nv) => { await setEntry(date, t.id, nv); render(); };
  const name = h('div', { class: 'rmain' }, h('div', { class: 'rname' }, t.name), meta(t, date, due));

  if (t.type === 'check' && (t.id === 'am' || t.id === 'pm')) {
    const s = sessionFor(date, t.id);
    return h('button', { class: 'row' + (done ? ' done' : ''), onclick: () => sessionForm(s, date, t.id) },
      h('span', { class: 'box' }, done ? '✓' : ''),
      h('div', { class: 'rmain' }, h('div', { class: 'rname' }, t.name),
        s ? h('div', { class: 'rmeta' }, sessionSummary(s)) : meta(t, date, due) || h('div', { class: 'rmeta' }, 'докосни, за да запишеш')),
      h('span', { class: 'chev' }, '›'));
  }
  if (t.id === 'shift' && t.type === 'check') {
    return h('button', { class: 'row' + (done ? ' done' : ''), onclick: async () => { await setShift(date, !done); render(); } },
      h('span', { class: 'box' }, done ? '✓' : ''),
      h('div', { class: 'rmain' }, h('div', { class: 'rname' }, t.name),
        h('div', { class: 'rmeta' }, done ? `+${eur(S.settings.shiftPay ?? 50)} записани в приходи` : `+${eur(S.settings.shiftPay ?? 50)} при отметка`)));
  }
  if (t.type === 'check') {
    return h('button', { class: 'row' + (done ? ' done' : ''), onclick: () => set(!done) },
      h('span', { class: 'box' }, done ? '✓' : ''), name);
  }
  if (t.type === 'number') {
    const goal = t.target != null && t.target !== '' ? `цел ${t.dir === 'max' ? '≤' : '≥'} ${t.target}` : null;
    const input = h('input', { class: 'numin', inputmode: 'decimal', placeholder: goal || '—', value: v ?? '' });
    input.addEventListener('change', () => set(num(input.value)));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    return h('div', { class: 'row' + (done ? ' done' : '') },
      h('span', { class: 'box' }, done ? '✓' : ''), name, input, h('span', { class: 'unit' }, t.unit || ''));
  }
  // counter
  const step = t.step || 1, target = t.target || 1, cur = v || 0;
  return h('div', { class: 'row' + (done ? ' done' : '') },
    h('span', { class: 'box' }, done ? '✓' : ''), name,
    h('div', { class: 'counter' },
      h('button', { 'aria-label': 'Намали', onclick: () => set(Math.max(0, cur - step)) }, '−'),
      h('span', { class: 'val' }, `${cur}/${target}`),
      h('button', { class: 'plus', onclick: () => set(cur + step) }, `+${step}`)));
}

function tasksCard(date) {
  const isToday = date === today();
  const list = tasksOn(date);
  const overdue = isToday ? S.tasks.filter((k) => !k.done && k.date < date) : [];
  const row = (k, late) => h('div', { class: 'row' + (k.done ? ' done' : '') },
    h('button', { class: 'box', 'aria-label': 'Отметни', onclick: async () => { k.done = !k.done; await saveTask(k); render(); } }, k.done ? '✓' : ''),
    h('div', { class: 'rmain' },
      h('div', { class: 'rname' }, k.title),
      late ? h('div', { class: 'rmeta warn' }, `от ${fmtShort(k.date)}`) : k.time ? h('div', { class: 'rmeta' }, k.time) : null),
    late ? h('button', { class: 'btn small', onclick: async () => { k.date = date; await saveTask(k); render(); } }, 'За днес') : null,
    h('button', { class: 'x', 'aria-label': 'Изтрий', onclick: async () => { await deleteTask(k.id); render(); } }, '×'));

  const input = h('input', { placeholder: 'Нова задача…', enterkeyhint: 'done' });
  const add = async () => {
    const title = input.value.trim();
    if (!title) return;
    await saveTask({ title, date, done: false });
    render();
    document.querySelector('.task-add input')?.focus();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });

  const done = list.filter((k) => k.done).length;
  return h('section', { class: 'card', style: { '--c': 'var(--accent)' } },
    h('div', { class: 'sec-title' }, h('h2', {}, '📝 Задачи'), list.length ? h('span', { class: 'count' }, `${done}/${list.length}`) : null),
    h('div', { class: 'rows' },
      overdue.map((k) => row(k, true)),
      [...list].sort((a, b) => (a.time || '99').localeCompare(b.time || '99')).map((k) => row(k, false))),
    h('div', { class: 'task-add' }, input, h('button', { class: 'btn small primary', onclick: add }, 'Добави')));
}

export function faithLine(date) {
  const d = dayInfo(date);
  const name = d.moveable || d.saints || '';
  return h('a', { class: 'faith-line', href: '#/faith' },
    name ? h('span', { class: 'fl-name' + (d.red ? ' red' : '') }, '☦️ ', name) : null,
    d.fast.level !== 'free' ? h('span', {}, `${d.fast.emoji} ${d.fast.label.split(' — ')[0]}`) : null);
}

export default function todayView(arg) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(arg || '') ? arg : today();
  const isToday = date === today();
  const stats = dayStats(date);
  const r = ratio(stats) ?? 0;
  const events = eventsOn(date);

  const areaSections = S.areas.map((a) => {
    const ts = S.trackers.filter((t) => t.area === a.id && active(t, date));
    if (!ts.length) return null;
    const due = ts.filter((t) => doneOn(t, date) || isScheduled(t, date));
    const later = ts.filter((t) => !due.includes(t));
    const s = stats.areas[a.id] || { due: 0, done: 0 };
    const det = later.length ? h('details', { class: 'later', open: openLater.has(a.id) },
      h('summary', {}, `Не е за днес (${later.length}) — може и сега`),
      h('div', { class: 'rows' }, later.map((t) => trackerRow(t, date, false)))) : null;
    det?.addEventListener('toggle', () => det.open ? openLater.add(a.id) : openLater.delete(a.id));
    return h('section', { class: 'card', style: { '--c': a.color } },
      h('div', { class: 'sec-title' },
        h('h2', {}, a.emoji, ' ', a.name),
        s.due ? h('span', { class: 'count' }, `${s.done}/${s.due}`) : null),
      due.length ? h('div', { class: 'rows' }, due.map((t) => trackerRow(t, date, true))) : h('div', { class: 'empty' }, 'Нищо планирано за днес.'),
      det,
      a.id === 'money' ? h('div', { class: 'money-quick' },
        h('span', { class: 'muted' }, `Похарчено: ${eur(spentOn(date))}`),
        h('button', { class: 'btn small', onclick: () => txForm(null, 'expense', date) }, '− Разход'),
        h('button', { class: 'btn small', onclick: () => txForm(null, 'income', date) }, '+ Приход')) : null);
  });

  return h('div', { class: 'page' },
    h('header', { class: 'top' },
      h('div', {},
        h('div', { class: 'eyebrow' }, isToday ? 'Днес' : date < today() ? 'Минал ден' : 'Предстоящ ден'),
        h('h1', { class: 'cap', style: { fontSize: '22px' } }, fmtLong(date)),
        faithLine(date)),
      h('div', { class: 'daynav' },
        !isToday ? h('button', { class: 'pill', onclick: () => go('#/today') }, 'Днес') : null,
        h('button', { class: 'iconbtn', 'aria-label': 'Предишен ден', onclick: () => go('#/today/' + addDays(date, -1)) }, '‹'),
        h('button', { class: 'iconbtn', 'aria-label': 'Следващ ден', onclick: () => go('#/today/' + addDays(date, 1)) }, '›'))),

    h('section', { class: 'card' },
      h('div', { class: 'sec-title' },
        h('h2', {}, stats.due ? `${stats.done} от ${stats.due} изпълнени` : 'Нищо планирано'),
        h('span', { class: 'count' }, `${Math.round(r * 100)}%`)),
      h('div', { class: 'progress' }, h('i', { style: { width: `${r * 100}%` } }))),

    h('section', { class: 'card' },
      h('div', { class: 'sec-title' }, h('h2', {}, '🗓 График'), h('button', { class: 'count', onclick: () => go('#/schedule') }, 'Редактирай →')),
      h('div', { class: 'timeline' }, events.map((e) => {
        const a = areaById(e.area);
        return h('div', { class: 'ev', style: { '--c': a.color } },
          h('time', {}, `${e.start}–${e.end}`), h('div', {}, e.title));
      })),
      events.length ? null : h('div', { class: 'empty' }, 'Няма събития. Добави работа, тренировки и др. в графика.')),

    tasksCard(date),
    areaSections);
}
