// Schedule: week strip, the selected day's events and tasks, add/edit forms.
import { S, saveEvent, deleteEvent, saveTask, deleteTask, areaById } from '../store.js';
import { eventsOn, tasksOn } from '../logic.js';
import { today, addDays, weekStart, parse, fmtLong, MONTHS, DAYS_SHORT } from '../dates.js';
import { h, openSheet, field, select, dayChips, toast } from '../ui.js';
import { render } from '../app.js';

let selected = null;

function repeatText(e) {
  if (!e.days || !e.days.length) return 'еднократно';
  if (e.days.length === 7) return 'всеки ден';
  return 'всеки ' + e.days.map((d) => DAYS_SHORT[d]).join(', ');
}

function eventForm(ev, date) {
  const e = ev ? { ...ev } : { title: '', area: 'training', start: '09:00', end: '10:00', days: [], date };
  const title = h('input', { value: e.title, placeholder: 'напр. Работа, Спаринг, Лекар' });
  const area = select(S.areas.map((a) => [a.id, `${a.emoji} ${a.name}`]), e.area);
  const start = h('input', { type: 'time', value: e.start });
  const end = h('input', { type: 'time', value: e.end });
  const chips = dayChips(e.days || []);
  const dateIn = h('input', { type: 'date', value: e.date || date });
  const dateField = field('Дата', dateIn);
  const sync = () => dateField.classList.toggle('hidden', chips.get().length > 0);
  chips.el.addEventListener('change', sync); sync();

  openSheet({
    title: ev ? 'Редакция на събитие' : 'Ново събитие',
    body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
      field('Заглавие', title),
      field('Област', area),
      h('div', { class: 'two' }, field('Начало', start), field('Край', end)),
      field('Повтаря се', chips.el, 'Без избрани дни = еднократно събитие'),
      dateField),
    actions: [
      ev ? { label: 'Изтрий', kind: 'danger', onClick: async () => { if (!confirm('Да изтрия ли събитието?')) return false; await deleteEvent(ev.id); render(); } } : null,
      { label: 'Запази', kind: 'primary', onClick: async () => {
        if (!title.value.trim()) { toast('Напиши заглавие'); return false; }
        const days = chips.get();
        Object.assign(e, { title: title.value.trim(), area: area.value, start: start.value || '00:00', end: end.value || start.value, days, date: days.length ? null : dateIn.value });
        await saveEvent(e); render();
      } },
    ].filter(Boolean),
  });
}

function taskForm(task, date) {
  const k = task ? { ...task } : { title: '', date, time: '', done: false };
  const title = h('input', { value: k.title, placeholder: 'Какво трябва да направиш?' });
  const dateIn = h('input', { type: 'date', value: k.date });
  const time = h('input', { type: 'time', value: k.time || '' });
  openSheet({
    title: task ? 'Редакция на задача' : 'Нова задача',
    body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
      field('Задача', title), h('div', { class: 'two' }, field('Дата', dateIn), field('Час (по желание)', time))),
    actions: [
      task ? { label: 'Изтрий', kind: 'danger', onClick: async () => { await deleteTask(task.id); render(); } } : null,
      { label: 'Запази', kind: 'primary', onClick: async () => {
        if (!title.value.trim()) { toast('Напиши задачата'); return false; }
        Object.assign(k, { title: title.value.trim(), date: dateIn.value || date, time: time.value });
        await saveTask(k); render();
      } },
    ].filter(Boolean),
  });
}

export default function schedule() {
  const t = today();
  selected ||= t;
  const ws = weekStart(selected);
  const we = addDays(ws, 6);
  const range = parse(ws).getMonth() === parse(we).getMonth()
    ? `${parse(ws).getDate()}–${parse(we).getDate()} ${MONTHS[parse(we).getMonth()]}`
    : `${parse(ws).getDate()} ${MONTHS[parse(ws).getMonth()].slice(0, 3)} – ${parse(we).getDate()} ${MONTHS[parse(we).getMonth()].slice(0, 3)}`;
  const pick = (d) => { selected = d; render(); };

  const events = eventsOn(selected);
  const tasks = tasksOn(selected).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));

  return h('div', { class: 'page' },
    h('header', { class: 'top' },
      h('div', {}, h('div', { class: 'eyebrow' }, 'Седмица'), h('h1', { style: { fontSize: '22px' } }, range)),
      h('div', { class: 'daynav' },
        selected !== t ? h('button', { class: 'pill', onclick: () => pick(t) }, 'Днес') : null,
        h('button', { class: 'iconbtn', 'aria-label': 'Предишна седмица', onclick: () => pick(addDays(selected, -7)) }, '‹'),
        h('button', { class: 'iconbtn', 'aria-label': 'Следваща седмица', onclick: () => pick(addDays(selected, 7)) }, '›'))),

    h('div', { class: 'week' }, Array.from({ length: 7 }, (_, i) => {
      const d = addDays(ws, i);
      const busy = eventsOn(d).length + tasksOn(d).length > 0;
      return h('button', { class: 'wd' + (d === selected ? ' on' : '') + (d === t ? ' today' : ''), onclick: () => pick(d) },
        DAYS_SHORT[i], h('b', {}, parse(d).getDate()), busy ? h('span', { class: 'dot' }) : h('span', { class: 'dot', style: { opacity: 0 } }));
    })),

    h('section', { class: 'card' },
      h('div', { class: 'sec-title' }, h('h2', { class: 'cap' }, fmtLong(selected))),
      events.length
        ? h('div', { class: 'timeline' }, events.map((e) => h('button', { class: 'ev', style: { '--c': areaById(e.area).color }, onclick: () => eventForm(e, selected) },
            h('time', {}, `${e.start}–${e.end}`),
            h('div', {}, h('div', {}, e.title), h('div', { class: 'sub' }, `${areaById(e.area).emoji} ${repeatText(e)}`)))))
        : h('div', { class: 'empty' }, 'Няма събития за този ден.'),
      h('div', { class: 'btn-row', style: { marginTop: '12px' } },
        h('button', { class: 'btn small', onclick: () => eventForm(null, selected) }, '+ Събитие'),
        h('button', { class: 'btn small', onclick: () => taskForm(null, selected) }, '+ Задача'))),

    tasks.length ? h('section', { class: 'card' },
      h('div', { class: 'sec-title' }, h('h2', {}, '📝 Задачи')),
      h('div', { class: 'list' }, tasks.map((k) => h('button', { class: 'li', onclick: () => taskForm(k, selected) },
        h('span', {}, k.done ? '✅' : '⬜'), h('span', { style: { flex: 1 } }, k.title), k.time ? h('span', { class: 'muted' }, k.time) : null)))) : null,

    h('p', { class: 'muted', style: { margin: '0 2px' } },
      'Добави работните си смени като повтарящи се събития в област „Работа“ — ще се показват всеки ден в списъка и в сутрешното известие.'));
}
