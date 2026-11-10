// Training: two-a-day session logs, weekly load, weight and fight camp.
import { S, saveSession, deleteSession, setEntry, getEntry, setSetting } from '../store.js';
import { SESSION_TYPES } from '../defaults.js';
import { today, addDays, weekStart, diffDays, fmtShort, fmtLong, DAYS_SHORT } from '../dates.js';
import { h, openSheet, field, choiceChips, textarea, toast, num } from '../ui.js';
import { render } from '../app.js';

const FEEL = ['😫', '😕', '😐', '🙂', '💪'];
const SLOTS = [['am', 'Сутрин'], ['pm', 'Вечер'], ['extra', 'Допълнителна']];
const typeLabel = (v) => (SESSION_TYPES.find((x) => x[0] === v) || [, '• Тренировка'])[1];
const load = (s) => (s.duration || 0) * (s.rpe || 0);
const col = (...k) => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } }, ...k);

export const sessionFor = (date, slot) => S.sessions.find((x) => x.date === date && x.slot === slot);
export const sessionSummary = (s) => [typeLabel(s.type), s.duration ? `${s.duration} мин` : null, s.rpe ? `RPE ${s.rpe}` : null].filter(Boolean).join(' · ');

export function sessionForm(existing, date = today(), slot = 'am') {
  const s = existing ? { ...existing } : { date, slot, type: null, duration: 90, rpe: null, feel: null };
  const dateIn = h('input', { type: 'date', value: s.date });
  const slotC = choiceChips(SLOTS, s.slot);
  const typeC = choiceChips(SESSION_TYPES, s.type);
  const dur = h('input', { inputmode: 'numeric', value: s.duration ?? '' });
  const durC = choiceChips([[45, '45'], [60, '60'], [90, '90'], [120, '120']], s.duration, (v) => { if (v) dur.value = v; });
  dur.addEventListener('input', () => durC.set(num(dur.value)));
  const rpeC = choiceChips(Array.from({ length: 10 }, (_, i) => [i + 1, String(i + 1)]), s.rpe);
  const rounds = h('input', { inputmode: 'numeric', value: s.rounds ?? '', placeholder: '—' });
  const drilled = textarea(s.drilled, 'напр. джеб-крос-лоу кик, защита от тейкдаун');
  const sparring = textarea(s.sparring, 'С кого, колко рунда, какво мина и какво не');
  const feelC = choiceChips(FEEL.map((f, i) => [i + 1, f]), s.feel);
  const pain = h('input', { value: s.pain || '', placeholder: 'напр. ляво коляно, дясна китка' });
  const notes = textarea(s.notes, 'Каквото искаш да запомниш');

  const trackerChecked = !existing && (slot === 'am' || slot === 'pm') && getEntry(date, slot) === true;

  openSheet({
    title: existing ? 'Редакция на тренировка' : 'Запиши тренировка',
    body: col(
      h('div', { class: 'two' }, field('Дата', dateIn), field('Рунда (по желание)', rounds)),
      field('Сесия', slotC.el),
      field('Вид', typeC.el),
      field('Продължителност (мин)', h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, durC.el, h('div', { style: { width: '80px', flex: 'none' } }, dur))),
      field('Натоварване (RPE)', rpeC.el, '1 = много леко · 10 = до краен предел'),
      field('Какво тренирах', drilled),
      field('Спаринг / как мина', sparring),
      field('Как се чувствах', feelC.el),
      field('Болки / контузии', pain),
      field('Бележки', notes)),
    actions: [
      existing ? { label: 'Изтрий', kind: 'danger', onClick: async () => {
        if (!confirm('Да изтрия ли тази тренировка?')) return false;
        await deleteSession(existing); render();
      } } : null,
      trackerChecked ? { label: 'Махни отметката', onClick: async () => { await setEntry(date, slot, null); render(); } } : null,
      !existing && !trackerChecked && (slot === 'am' || slot === 'pm') ? { label: 'Само отметни', onClick: async () => { await setEntry(date, slot, true); render(); } } : null,
      { label: 'Запази', kind: 'primary', onClick: async () => {
        Object.assign(s, {
          date: dateIn.value || date, slot: slotC.get() || 'extra', type: typeC.get() || 'other',
          duration: num(dur.value), rpe: rpeC.get(), rounds: num(rounds.value),
          drilled: drilled.value.trim(), sparring: sparring.value.trim(), feel: feelC.get(),
          pain: pain.value.trim(), notes: notes.value.trim(),
        });
        await saveSession(s, existing); render(); toast('Тренировката е записана 💪');
      } },
    ].filter(Boolean),
  });
}

function fightForm() {
  const f = S.settings.fight || {};
  const date = h('input', { type: 'date', value: f.date || '' });
  const weight = h('input', { inputmode: 'decimal', value: f.weight ?? '', placeholder: 'напр. 70,3' });
  const name = h('input', { value: f.name || '', placeholder: 'напр. срещу Иванов, турнир…' });
  openSheet({
    title: 'Предстоящ мач',
    body: col(field('Мач', name), h('div', { class: 'two' }, field('Дата', date), field('Категория (кг)', weight))),
    actions: [
      f.date ? { label: 'Премахни', kind: 'danger', onClick: async () => { await setSetting('fight', null); render(); } } : null,
      { label: 'Запази', kind: 'primary', onClick: async () => {
        if (!date.value) { toast('Избери дата'); return false; }
        await setSetting('fight', { date: date.value, weight: num(weight.value), name: name.value.trim() }); render();
      } },
    ].filter(Boolean),
  });
}

function latestWeight() {
  for (let i = 0; i < 60; i++) { const d = addDays(today(), -i); const v = getEntry(d, 'weight'); if (v != null) return [d, v]; }
  return null;
}

function weightChart(target) {
  const pts = [];
  for (let i = 29; i >= 0; i--) { const d = addDays(today(), -i); const v = getEntry(d, 'weight'); if (v != null) pts.push([29 - i, v]); }
  if (pts.length < 2) return h('div', { class: 'empty' }, pts.length ? 'Още едно измерване и ще видиш графиката.' : 'Записвай теглото си всяка сутрин — тук ще се появи графиката.');
  const vals = pts.map((p) => p[1]).concat(target ? [target] : []);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 2) { lo -= 1; hi += 1; }
  const W = 320, H = 120, P = 6;
  const x = (i) => P + (i / 29) * (W - 2 * P);
  const y = (v) => P + (1 - (v - lo) / (hi - lo)) * (H - 2 * P);
  const line = pts.map(([i, v]) => `${x(i)},${y(v)}`).join(' ');
  const last = pts[pts.length - 1];
  return h('div', { class: 'chart', html: `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" width="100%" height="${H}" role="img" aria-label="Тегло за последните 30 дни">
      ${target ? `<line x1="0" x2="${W}" y1="${y(target)}" y2="${y(target)}" stroke="var(--muted)" stroke-dasharray="4 4" stroke-width="1"/>` : ''}
      <polyline points="${line}" fill="none" stroke="#ff7b47" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      <circle cx="${x(last[0])}" cy="${y(last[1])}" r="4" fill="#ff7b47"/>
    </svg>
    <div class="chart-axis"><span>преди 30 дни</span>${target ? `<span>- - цел ${String(target).replace('.', ',')} кг</span>` : ''}<span>днес</span></div>` });
}

let historyCount = 10;

export default function training() {
  const t = today();
  const ws = weekStart(t);
  const thisWeek = S.sessions.filter((s) => s.date >= ws && s.date <= t);
  const lastWeek = S.sessions.filter((s) => s.date >= addDays(ws, -7) && s.date < ws);
  const sum = (list, fn) => list.reduce((a, s) => a + (fn(s) || 0), 0);
  const loadNow = sum(thisWeek, load), loadPrev = sum(lastWeek, load);
  const rpeList = thisWeek.filter((s) => s.rpe);
  const avgRpe = rpeList.length ? (sum(rpeList, (s) => s.rpe) / rpeList.length).toFixed(1).replace('.', ',') : '—';
  const dayLoads = Array.from({ length: 7 }, (_, i) => sum(S.sessions.filter((s) => s.date === addDays(ws, i)), load));
  const maxLoad = Math.max(...dayLoads, 1);

  const fight = S.settings.fight;
  const lw = latestWeight();
  const hasWeight = S.trackers.some((x) => x.id === 'weight');

  const weightIn = h('input', { class: 'numin', inputmode: 'decimal', placeholder: 'кг', value: getEntry(t, 'weight') ?? '' });
  weightIn.addEventListener('change', async () => { await setEntry(t, 'weight', num(weightIn.value)); render(); });

  const slotCard = (slot, label) => {
    const s = sessionFor(t, slot);
    const ticked = getEntry(t, slot) === true;
    return h('button', { class: 'slot' + (s || ticked ? ' done' : ''), onclick: () => sessionForm(s, t, slot) },
      h('div', { class: 'slot-label' }, label),
      s ? h('div', {}, h('div', { class: 'slot-title' }, typeLabel(s.type)), h('div', { class: 'rmeta' }, [s.duration && `${s.duration} мин`, s.rpe && `RPE ${s.rpe}`, s.feel && FEEL[s.feel - 1]].filter(Boolean).join(' · ')))
        : h('div', { class: 'slot-title muted' }, ticked ? '✓ отметната — добави детайли' : '+ Запиши'));
  };

  const history = [...S.sessions].sort((a, b) => b.date.localeCompare(a.date) || a.slot.localeCompare(b.slot));

  return h('div', { class: 'page', style: { '--c': '#ff7b47' } },
    h('header', { class: 'top' }, h('div', {}, h('div', { class: 'eyebrow' }, fmtLong(t)), h('h1', {}, 'Тренировки'))),

    fight && fight.date >= t ? h('section', { class: 'card fight', onclick: fightForm },
      h('div', { class: 'fight-days' }, h('b', {}, diffDays(t, fight.date)), h('span', {}, 'дни до мача')),
      h('div', {},
        h('div', { class: 'slot-title' }, fight.name || 'Предстоящ мач', ' · ', fmtShort(fight.date)),
        fight.weight ? h('div', { class: 'rmeta' }, lw
          ? `Сега ${String(lw[1]).replace('.', ',')} кг · цел ${String(fight.weight).replace('.', ',')} кг · ${lw[1] > fight.weight ? `остават ${(lw[1] - fight.weight).toFixed(1).replace('.', ',')} кг` : 'в категория ✓'}`
          : `Цел ${fight.weight} кг`) : null))
      : h('button', { class: 'banner', style: { background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--muted)' }, onclick: fightForm }, '🏆 Имаш ли предстоящ мач? Задай дата и категория →'),

    h('section', { class: 'card' },
      h('div', { class: 'sec-title' }, h('h2', {}, 'Днес'), h('button', { class: 'count', onclick: () => sessionForm(null, t, 'extra') }, '+ допълнителна')),
      h('div', { class: 'two' }, slotCard('am', '☀️ Сутрин'), slotCard('pm', '🌙 Вечер')),
      sessionFor(t, 'extra') ? h('div', { class: 'rmeta', style: { marginTop: '8px' } }, '+ допълнителна: ', sessionSummary(sessionFor(t, 'extra'))) : null),

    h('section', { class: 'card' },
      h('div', { class: 'sec-title' }, h('h2', {}, 'Тази седмица')),
      h('div', { class: 'bars' }, dayLoads.map((v, i) => h('div', { class: 'bar' + (addDays(ws, i) === t ? ' now' : '') },
        h('i', { style: { height: `${Math.max(v ? 6 : 2, (v / maxLoad) * 100)}%`, opacity: v ? 1 : 0.25 } }), h('span', {}, DAYS_SHORT[i])))),
      h('div', { class: 'stats-row' },
        h('div', {}, h('b', {}, thisWeek.length), h('span', {}, 'сесии')),
        h('div', {}, h('b', {}, (sum(thisWeek, (s) => s.duration) / 60).toFixed(1).replace('.', ',')), h('span', {}, 'часа')),
        h('div', {}, h('b', {}, avgRpe), h('span', {}, 'средно RPE')),
        h('div', {}, h('b', {}, loadPrev ? `${loadNow >= loadPrev ? '+' : ''}${Math.round((loadNow / loadPrev - 1) * 100)}%` : '—'), h('span', {}, 'спрямо мин. седм.'))),
      h('p', { class: 'fhint', style: { margin: '10px 0 0' } }, 'Натоварване = минути × RPE. Скок над ~30% седмично увеличава риска от контузия.')),

    hasWeight ? h('section', { class: 'card' },
      h('div', { class: 'sec-title' }, h('h2', {}, '⚖️ Тегло'),
        h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, h('span', { class: 'muted' }, 'днес'), weightIn, h('span', { class: 'unit' }, 'кг'))),
      weightChart(fight?.weight)) : null,

    h('section', { class: 'card' },
      h('div', { class: 'sec-title' }, h('h2', {}, 'История'), h('span', { class: 'count' }, `${S.sessions.length} общо`)),
      history.length ? h('div', { class: 'list' }, history.slice(0, historyCount).map((s) => h('button', { class: 'li', onclick: () => sessionForm(s) },
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('div', {}, typeLabel(s.type)),
          h('div', { class: 'rmeta' }, `${fmtShort(s.date)} · ${SLOTS.find((x) => x[0] === s.slot)?.[1] || ''}${s.duration ? ` · ${s.duration} мин` : ''}${s.rpe ? ` · RPE ${s.rpe}` : ''}`),
          s.drilled ? h('div', { class: 'rmeta clip' }, s.drilled) : null,
          s.pain ? h('div', { class: 'rmeta warn' }, '⚠ ', s.pain) : null),
        h('span', { class: 'chev' }, '›'))))
        : h('div', { class: 'empty' }, 'Още нямаш записани тренировки.'),
      history.length > historyCount ? h('button', { class: 'btn small block', style: { marginTop: '8px' }, onclick: () => { historyCount += 20; render(); } }, 'Покажи още') : null));
}
