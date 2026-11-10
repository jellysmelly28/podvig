// Money: every euro in and out, monthly budgets with warnings, green/red days, savings goal.
import { S, saveTx, deleteTx, setSetting, setEntry, setShift, saveTracker, saveEvent, deleteEvent, getEntry } from '../store.js';
import { DEFAULT_CATEGORIES } from '../defaults.js';
import { today, parse, pad, dow, fmtShort, fmtLong, MONTHS, uid } from '../dates.js';
import { h, openSheet, field, choiceChips, dayChips, toast, num, eur } from '../ui.js';
import { DAYS_SHORT } from '../dates.js';
import { render } from '../app.js';

export const cats = () => S.settings.categories || DEFAULT_CATEGORIES;
export const catById = (id) => cats().find((c) => c.id === id) || { id, name: 'Друго', emoji: '📦' };
const budgets = () => S.settings.budgets || {};
const KIND = [['expense', 'Разход'], ['income', 'Приход'], ['saving', 'Спестих']];
const col = (...k) => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } }, ...k);

const monthOf = (d) => d.slice(0, 7);
const daysIn = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate(); };
const txIn = (m) => S.transactions.filter((x) => x.date.startsWith(m));
const sum = (list) => list.reduce((a, x) => a + (x.amount || 0), 0);
const isVariable = (x) => x.kind === 'expense' && !catById(x.category).fixed;

export function spentOn(date) { return sum(S.transactions.filter((x) => x.date === date && x.kind === 'expense')); }

function warn(x) {
  const m = monthOf(x.date);
  const list = txIn(m).filter((t) => t.kind === 'expense');
  const c = catById(x.category);
  if (c.id === 'trading') {
    if (S.trackers.some((t) => t.id === 'notrading')) setEntry(x.date, 'notrading', null);
    return toast('📉 Записано. Падането не е краят — утре започваш нова серия.');
  }
  const b = budgets()[c.id];
  if (b) {
    const spent = sum(list.filter((t) => t.category === c.id));
    const before = spent - x.amount;
    if (before < b && spent >= b) return toast(`⛔ Превиши бюджета за ${c.name}`);
    if (before < 0.8 * b && spent >= 0.8 * b) return toast(`⚠️ 80% от бюджета за ${c.name}`);
  }
  const lim = S.settings.monthLimit;
  if (lim && isVariable(x)) {
    const v = sum(list.filter(isVariable));
    if (v - x.amount < lim && v >= lim) return toast('⛔ Превиши месечния лимит');
    if (v - x.amount < 0.8 * lim && v >= 0.8 * lim) return toast('⚠️ Използва 80% от месечния лимит');
  }
  toast('Записано');
}

export function txForm(existing, kind = 'expense', date = today(), category = null) {
  const x = existing ? { ...existing } : { kind, date, amount: null, category, note: '' };
  const amount = h('input', { class: 'amount', inputmode: 'decimal', placeholder: '0,00', value: x.amount != null ? String(x.amount).replace('.', ',') : '' });
  const dateIn = h('input', { type: 'date', value: x.date });
  const note = h('input', { value: x.note || '', placeholder: 'напр. Lidl, протеин, такси' });
  const catBox = h('div');
  let catC;
  const drawCats = (k) => {
    if (k === 'saving') { catC = null; catBox.replaceChildren(h('p', { class: 'fhint', style: { margin: 0 } }, 'Пари, които си заделил настрана. Отиват към целта ти за спестяване.')); return; }
    catC = choiceChips(cats().filter((c) => c.kind === k).map((c) => [c.id, `${c.emoji} ${c.name}`]), x.kind === k ? x.category : null);
    catBox.replaceChildren(field('Категория', catC.el));
  };
  const kindC = choiceChips(KIND, x.kind, (k) => { if (!k) { kindC.set(x.kind); return; } x.kind = k; drawCats(k); });
  drawCats(x.kind);
  setTimeout(() => amount.focus(), 250);

  openSheet({
    title: existing ? 'Редакция' : 'Нов запис',
    body: col(kindC.el, h('div', { class: 'amount-wrap' }, amount, h('span', {}, '€')), catBox, h('div', { class: 'two' }, field('Дата', dateIn), field('Бележка', note))),
    actions: [
      existing ? { label: 'Изтрий', kind: 'danger', onClick: async () => { if (!confirm('Да изтрия ли записа?')) return false; await deleteTx(existing.id); render(); } } : null,
      { label: 'Запази', kind: 'primary', onClick: async () => {
        const a = num(amount.value);
        if (!a || a <= 0) { toast('Въведи сума'); return false; }
        const category = x.kind === 'saving' ? null : catC?.get() || (x.kind === 'income' ? 'inc_other' : 'other');
        Object.assign(x, { amount: Math.round(a * 100) / 100, date: dateIn.value || date, note: note.value.trim(), category });
        await saveTx(x);
        if (x.kind === 'expense' && !existing) warn(x); else toast('Записано');
        render();
      } },
    ].filter(Boolean),
  });
}

function budgetsForm() {
  const b = { ...budgets() };
  const limit = h('input', { inputmode: 'decimal', value: S.settings.monthLimit ?? '', placeholder: 'напр. 600' });
  const inputs = cats().filter((c) => c.kind === 'expense' && !c.noBudget).map((c) => {
    const i = h('input', { inputmode: 'decimal', value: b[c.id] ?? '', placeholder: '—', style: { width: '96px', flex: 'none', textAlign: 'right' } });
    return [c, i];
  });
  openSheet({
    title: 'Бюджети за месеца',
    body: col(
      field('Месечен лимит за ежедневни разходи (€)', limit, 'Без наем, сметки и абонаменти. От него се смята дневният зелен/червен цвят.'),
      h('div', { class: 'group-label' }, 'По категории (€ на месец)'),
      h('div', { class: 'list' }, inputs.map(([c, i]) => h('label', { class: 'li' }, h('span', { style: { flex: 1 } }, `${c.emoji} ${c.name}`), i))),
      h('button', { class: 'btn small', onclick: () => categoryForm() }, '+ Нова категория')),
    actions: [{ label: 'Запази', kind: 'primary', onClick: async () => {
      const nb = {};
      for (const [c, i] of inputs) { const v = num(i.value); if (v) nb[c.id] = v; }
      await setSetting('budgets', nb);
      await setSetting('monthLimit', num(limit.value));
      render(); toast('Бюджетите са запазени');
    } }],
  });
}

function categoryForm() {
  const name = h('input', { placeholder: 'напр. Кафе' });
  const emoji = h('input', { value: '🏷️', maxlength: 4 });
  const kind = choiceChips([['expense', 'Разход'], ['income', 'Приход']], 'expense');
  const fixed = h('input', { type: 'checkbox', style: { width: 'auto' } });
  openSheet({
    title: 'Нова категория',
    body: col(field('Вид', kind.el), h('div', { class: 'two' }, field('Име', name), field('Емоджи', emoji)),
      h('label', { class: 'li' }, fixed, h('span', {}, 'Фиксиран разход (като наем) — не влиза в дневния цвят'))),
    actions: [{ label: 'Добави', kind: 'primary', onClick: async () => {
      if (!name.value.trim()) { toast('Напиши име'); return false; }
      await setSetting('categories', [...cats(), { id: uid(), kind: kind.get() || 'expense', name: name.value.trim(), emoji: emoji.value.trim() || '🏷️', fixed: fixed.checked || undefined }]);
      render(); toast('Категорията е добавена — отвори Бюджети отново');
    } }],
  });
}

function goalForm() {
  const g = S.settings.goal || {};
  const name = h('input', { value: g.name || '', placeholder: 'напр. Резерв за 3 месеца' });
  const target = h('input', { inputmode: 'decimal', value: g.target ?? '', placeholder: 'напр. 3000' });
  openSheet({
    title: 'Цел за спестяване',
    body: col(field('За какво', name), field('Сума (€)', target)),
    actions: [{ label: 'Запази', kind: 'primary', onClick: async () => {
      if (!num(target.value)) { toast('Въведи сума'); return false; }
      await setSetting('goal', { name: name.value.trim() || 'Спестявания', target: num(target.value) }); render();
    } }],
  });
}

// Day colour: green when variable spending stayed within the daily allowance, red when over.
function dayClass(date, allowance) {
  const list = S.transactions.filter((x) => x.date === date);
  if (!list.length) return '';
  const exp = sum(list.filter(isVariable));
  if (exp === 0) return 'g4';
  if (allowance) {
    const r = exp / allowance;
    return r <= 0.5 ? 'g4' : r <= 1 ? 'g2' : r <= 1.5 ? 'r2' : 'r4';
  }
  const inc = sum(list.filter((x) => x.kind !== 'expense'));
  return inc >= sum(list.filter((x) => x.kind === 'expense')) ? 'g2' : 'r3';
}

function workForm() {
  const tr = S.trackers.find((t) => t.id === 'shift');
  const ev = S.events.find((e) => e.id === 'ev-shift');
  const pay = h('input', { inputmode: 'decimal', value: String(S.settings.shiftPay ?? 50).replace('.', ',') });
  const chips = dayChips(tr?.freq.days || []);
  const start = h('input', { type: 'time', value: ev?.start || '' });
  const end = h('input', { type: 'time', value: ev?.end || '' });
  openSheet({
    title: 'Работа',
    body: col(
      field('Заплащане на смяна (€)', pay),
      field('В кои дни работиш обикновено', chips.el, 'Ако графикът ти се мени, остави празно — просто отмятай смяната в деня, в който работиш.'),
      h('div', { class: 'two' }, field('Начало (по желание)', start), field('Край', end)),
      h('p', { class: 'fhint', style: { margin: 0 } }, 'С час смените се появяват в графика и в сутрешното известие.')),
    actions: [{ label: 'Запази', kind: 'primary', onClick: async () => {
      const days = chips.get();
      await setSetting('shiftPay', num(pay.value) ?? 50);
      if (tr) { tr.freq = { kind: 'week', days }; await saveTracker(tr); }
      if (days.length && start.value) await saveEvent({ id: 'ev-shift', title: 'Смяна на работа', area: 'work', start: start.value, end: end.value || start.value, days });
      else if (ev) await deleteEvent('ev-shift');
      render(); toast('Запазено');
    } }],
  });
}

let month = null;
let selDay = null;

function workCard(month, t, list) {
  const pay = S.settings.shiftPay ?? 50;
  const tr = S.trackers.find((x) => x.id === 'shift');
  const shifts = list.filter((x) => x.kind === 'income' && x.category === 'shifts');
  const store = sum(list.filter((x) => x.kind === 'income' && x.category === 'bbb'));
  const workedToday = getEntry(t, 'shift') === true;
  const perMonth = tr?.freq.days.length ? Math.round(tr.freq.days.length * pay * 52 / 12) : null;
  return h('section', { class: 'card', style: { '--c': '#39c5cf' } },
    h('div', { class: 'sec-title' }, h('h2', {}, '💼 Работа и магазин'), h('button', { class: 'count', onclick: workForm }, 'Настройки →')),
    h('div', { class: 'money-sum' },
      h('div', {}, h('span', {}, 'Смени'), h('b', {}, `${shifts.length} × ${eur(pay).replace(',00', '')}`)),
      h('div', {}, h('span', {}, 'От смени'), h('b', { class: 'pos' }, eur(sum(shifts)))),
      h('div', {}, h('span', {}, 'BuiltByBit'), h('b', { class: 'pos' }, eur(store)))),
    h('div', { class: 'fhint', style: { marginTop: '8px' } },
      tr?.freq.days.length
        ? `Работиш ${tr.freq.days.map((d) => DAYS_SHORT[d]).join(', ')} · очаквано ~${eur(perMonth)} на месец от смени`
        : 'Задай дните, в които обикновено работиш, в Настройки.'),
    h('div', { class: 'btn-row', style: { marginTop: '10px' } },
      monthOf(t) === month ? h('button', { class: 'btn small' + (workedToday ? '' : ' primary'), onclick: async () => { await setShift(t, !workedToday); render(); toast(workedToday ? 'Смяната е махната' : `+${eur(pay)} за смяна`); } },
        workedToday ? '✓ Смяна днес (махни)' : `+ Смяна днес (${eur(pay)})`) : null,
      h('button', { class: 'btn small', onclick: () => txForm(null, 'income', monthOf(t) === month ? t : `${month}-01`, 'bbb') }, '🛍️ + BuiltByBit')));
}

function incomeCard(list) {
  const inc = cats().filter((c) => c.kind === 'income').map((c) => [c, sum(list.filter((x) => x.kind === 'income' && x.category === c.id))]).filter(([, v]) => v > 0);
  if (!inc.length) return null;
  const total = inc.reduce((a, [, v]) => a + v, 0);
  return h('section', { class: 'card' },
    h('div', { class: 'sec-title' }, h('h2', {}, 'Приходи по източник'), h('span', { class: 'count' }, eur(total))),
    h('div', { class: 'list' }, inc.sort((a, z) => z[1] - a[1]).map(([c, v]) => h('div', { class: 'catrow' },
      h('div', { class: 'sec-title', style: { marginBottom: '4px' } }, h('span', {}, `${c.emoji} ${c.name}`), h('span', { class: 'muted' }, `${eur(v)} · ${Math.round((v / total) * 100)}%`)),
      h('div', { class: 'progress', style: { height: '6px' } }, h('i', { style: { width: `${(v / total) * 100}%` } }))))));
}

export default function money() {
  const t = today();
  month ||= monthOf(t);
  const [y, mo] = month.split('-').map(Number);
  const list = txIn(month);
  const income = sum(list.filter((x) => x.kind === 'income'));
  const expense = sum(list.filter((x) => x.kind === 'expense'));
  const saved = sum(list.filter((x) => x.kind === 'saving'));
  const variable = sum(list.filter(isVariable));
  const lim = S.settings.monthLimit;
  const allowance = lim ? lim / daysIn(month) : null;
  const shift = (n) => { const d = new Date(y, mo - 1 + n, 1); month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; selDay = null; render(); };

  // calendar
  const first = `${month}-01`;
  const cal = h('div', { class: 'cal' },
    ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((d) => h('span', { class: 'cal-h' }, d)),
    Array.from({ length: dow(first) }, () => h('span')),
    Array.from({ length: daysIn(month) }, (_, i) => {
      const d = `${month}-${pad(i + 1)}`;
      const spent = sum(S.transactions.filter((x) => x.date === d && x.kind === 'expense'));
      return h('button', {
        class: `cal-d ${dayClass(d, allowance)}${d === t ? ' now' : ''}${d === selDay ? ' sel' : ''}${d > t ? ' fut' : ''}`,
        onclick: () => { selDay = selDay === d ? null : d; render(); },
      }, h('b', {}, i + 1), spent ? h('small', {}, Math.round(spent) + '€') : null);
    }));

  // categories
  const b = budgets();
  const byCat = cats().filter((c) => c.kind === 'expense').map((c) => [c, sum(list.filter((x) => x.kind === 'expense' && x.category === c.id))])
    .filter(([c, v]) => v > 0 || b[c.id]).sort((a, z) => z[1] - a[1]);

  const goal = S.settings.goal;
  const totalSaved = sum(S.transactions.filter((x) => x.kind === 'saving'));

  const shown = (selDay ? list.filter((x) => x.date === selDay) : list).sort((a, z) => z.date.localeCompare(a.date));
  const groups = [];
  for (const x of shown) { const g = groups.at(-1); if (g && g[0] === x.date) g[1].push(x); else groups.push([x.date, [x]]); }

  const pct = lim ? variable / lim : 0;
  return h('div', { class: 'page', style: { '--c': '#3fb950' } },
    h('header', { class: 'top' },
      h('div', {}, h('div', { class: 'eyebrow' }, 'Пари'), h('h1', { class: 'cap', style: { fontSize: '22px' } }, `${MONTHS[mo - 1]} ${y}`)),
      h('div', { class: 'daynav' },
        h('button', { class: 'iconbtn', 'aria-label': 'Предишен месец', onclick: () => shift(-1) }, '‹'),
        h('button', { class: 'iconbtn', 'aria-label': 'Следващ месец', onclick: () => shift(1) }, '›'))),

    h('div', { class: 'btn-row' },
      h('button', { class: 'btn primary', style: { background: '#f85149', borderColor: '#f85149', color: '#fff' }, onclick: () => txForm(null, 'expense', selDay || t) }, '− Разход'),
      h('button', { class: 'btn primary', onclick: () => txForm(null, 'income', selDay || t) }, '+ Приход'),
      h('button', { class: 'btn', onclick: () => txForm(null, 'saving', selDay || t) }, '🐷 Спестих')),

    h('section', { class: 'card' },
      h('div', { class: 'money-sum' },
        h('div', {}, h('span', {}, 'Приходи'), h('b', { class: 'pos' }, eur(income))),
        h('div', {}, h('span', {}, 'Разходи'), h('b', { class: 'neg' }, eur(expense))),
        h('div', {}, h('span', {}, 'Остават'), h('b', { class: income - expense - saved >= 0 ? 'pos' : 'neg' }, eur(income - expense - saved)))),
      lim ? h('div', { style: { marginTop: '12px' } },
        h('div', { class: 'sec-title', style: { marginBottom: '6px' } },
          h('span', { class: 'muted' }, `Ежедневни разходи: ${eur(variable)} от ${eur(lim)}`),
          h('span', { class: 'count' }, `${Math.round(pct * 100)}%`)),
        h('div', { class: 'progress' }, h('i', { style: { width: `${Math.min(100, pct * 100)}%`, background: pct >= 1 ? 'var(--danger)' : pct >= 0.8 ? '#f0883e' : 'var(--c)' } })),
        monthOf(t) === month ? h('div', { class: 'fhint', style: { marginTop: '6px' } },
          `Дневен лимит: ${eur(allowance)} · днес: ${eur(sum(S.transactions.filter((x) => x.date === t && isVariable(x))))}`) : null)
        : h('button', { class: 'banner', style: { marginTop: '12px' }, onclick: budgetsForm }, '🎯 Задай месечен лимит и бюджети — така ще знаеш кога харчиш твърде много →')),

    workCard(month, t, list),

    h('section', { class: 'card' },
      h('div', { class: 'sec-title' }, h('h2', {}, 'Дни'), h('span', { class: 'count' }, '🟩 в лимит · 🟥 над лимит')),
      cal),

    h('section', { class: 'card' },
      h('div', { class: 'sec-title' }, h('h2', {}, 'По категории'), h('button', { class: 'count', onclick: budgetsForm }, 'Бюджети →')),
      byCat.length ? h('div', { class: 'list' }, byCat.map(([c, v]) => {
        const bud = b[c.id], p = bud ? v / bud : 0;
        const color = c.noBudget ? 'var(--danger)' : p >= 1 ? 'var(--danger)' : p >= 0.8 ? '#f0883e' : 'var(--c)';
        return h('div', { class: 'catrow' },
          h('div', { class: 'sec-title', style: { marginBottom: '4px' } },
            h('span', {}, `${c.emoji} ${c.name}`),
            h('span', { class: 'muted', style: { color: c.noBudget && v ? 'var(--danger)' : null } }, bud ? `${eur(v)} / ${eur(bud)}` : eur(v))),
          bud ? h('div', { class: 'progress', style: { height: '6px' } }, h('i', { style: { width: `${Math.min(100, p * 100)}%`, background: color } })) : null);
      })) : h('div', { class: 'empty' }, 'Няма разходи този месец.')),

    incomeCard(list),

    h('section', { class: 'card' },
      h('div', { class: 'sec-title' }, h('h2', {}, '🐷 Спестявания'), h('button', { class: 'count', onclick: goalForm }, goal ? 'Промени' : 'Задай цел →')),
      goal ? [
        h('div', { class: 'sec-title', style: { marginBottom: '6px' } }, h('span', {}, goal.name), h('span', { class: 'muted' }, `${eur(totalSaved)} / ${eur(goal.target)}`)),
        h('div', { class: 'progress' }, h('i', { style: { width: `${Math.min(100, (totalSaved / goal.target) * 100)}%` } })),
      ] : h('div', { class: 'empty' }, `Общо спестени: ${eur(totalSaved)}. Задай цел, за да виждаш напредъка.`)),

    h('section', { class: 'card' },
      h('div', { class: 'sec-title' }, h('h2', {}, selDay ? fmtLong(selDay) : 'Записи'), selDay ? h('button', { class: 'count', onclick: () => { selDay = null; render(); } }, 'Целия месец') : h('span', { class: 'count' }, list.length)),
      groups.length ? groups.map(([d, items]) => [
        selDay ? null : h('div', { class: 'group-label' }, fmtShort(d)),
        h('div', { class: 'list' }, items.map((x) => {
          const c = x.kind === 'saving' ? { emoji: '🐷', name: 'Спестяване' } : catById(x.category);
          return h('button', { class: 'li', onclick: () => txForm(x) },
            h('span', {}, c.emoji),
            h('div', { style: { flex: 1, minWidth: 0 } }, h('div', {}, c.name), x.note ? h('div', { class: 'rmeta clip' }, x.note) : null),
            h('b', { class: x.kind === 'expense' ? 'neg' : x.kind === 'income' ? 'pos' : 'sav' }, (x.kind === 'expense' ? '−' : x.kind === 'income' ? '+' : '→ ') + eur(x.amount)));
        })),
      ]) : h('div', { class: 'empty' }, 'Няма записи.')));
}
