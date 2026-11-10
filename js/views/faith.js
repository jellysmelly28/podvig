// Faith: today's feast/saints and fast, prayer rope, theology topic, Scripture plan, prayer book, church calendar.
import { S, getEntry, setEntry, setSetting } from '../store.js';
import { active, doneOn, isScheduled } from '../logic.js';
import { dayInfo, nextFeast, readingFor, topicFor, topics } from '../orthodox.js';
import { PRAYERS, RULES } from '../prayers.js';
import { today, addDays, parse, pad, dow, fmtLong, fmtShort, MONTHS } from '../dates.js';
import { h, openSheet, toast } from '../ui.js';
import { render } from '../app.js';
import { trackerRow } from './today.js';

const start = () => S.settings.installedAt || today();
const studied = () => S.settings.studied || {};
const days = (n) => `${n} ${n === 1 ? 'ден' : 'дни'}`;

export function fastBadge(fast) {
  return h('div', { class: 'fast fast-' + fast.level }, h('span', {}, fast.emoji), h('div', {}, h('b', {}, fast.label), fast.note ? h('div', { class: 'rmeta' }, fast.note) : null));
}

function prayerText(p, mult) {
  return h('div', { class: 'prayer' }, h('h3', {}, p.title, mult ? h('span', { class: 'muted' }, ` · ${mult}`) : null), h('p', {}, p.text));
}
export const prayerSheet = (id) => openSheet({ title: PRAYERS[id].title, body: h('div', { class: 'prayer' }, h('p', {}, PRAYERS[id].text)) });
const ruleSheet = (r) => openSheet({ title: r.title, body: h('div', {}, h('p', { class: 'muted', style: { marginTop: 0 } }, r.note), r.items.map(([id, m]) => prayerText(PRAYERS[id], m))) });

async function markStudied(t, date) {
  await setSetting('studied', { ...studied(), [t.id]: date });
  if (S.trackers.some((x) => x.id === 'theology')) await setEntry(date, 'theology', true);
  toast('Слава Богу! Темата е отбелязана');
  render();
}

function topicSheet(t, date = today()) {
  const done = !!studied()[t.id];
  openSheet({
    title: t.title,
    body: h('div', { class: 'prayer' },
      h('div', { class: 'eyebrow' }, t.cat),
      h('p', {}, t.text),
      t.read ? h('p', { class: 'muted' }, '📖 За четене: ', t.read) : null),
    actions: [done ? { label: `✓ Изучена (${fmtShort(studied()[t.id])})` } : { label: 'Изучих я ✓', kind: 'primary', onClick: () => markStudied(t, date) }],
  });
}

function librarySheet() {
  const all = topics(), st = studied();
  const cats = [...new Set(all.map((t) => t.cat))];
  openSheet({
    title: `Библиотека · ${Object.keys(st).length}/${all.length} изучени`,
    body: h('div', {}, cats.map((c) => [
      h('div', { class: 'group-label' }, c, ` · ${all.filter((t) => t.cat === c && st[t.id]).length}/${all.filter((t) => t.cat === c).length}`),
      h('div', { class: 'list' }, all.filter((t) => t.cat === c).map((t) => h('button', { class: 'li', onclick: () => topicSheet(t) },
        h('span', {}, st[t.id] ? '✅' : '▫️'), h('span', { style: { flex: 1 } }, t.title)))),
    ])),
  });
}

function daySheet(date) {
  const d = dayInfo(date);
  openSheet({
    title: fmtLong(date),
    body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
      d.moveable ? h('div', { class: 'feast' + (d.red ? ' red' : '') }, d.moveable) : null,
      d.saints ? h('div', {}, d.saints) : null,
      fastBadge(d.fast),
      d.season ? h('div', { class: 'muted' }, d.season) : null),
  });
}

function rope(t) {
  const tr = S.trackers.find((x) => x.id === 'jesus');
  const target = tr?.target || 100;
  const R = 70, C = 2 * Math.PI * R;
  const ring = h('div', { class: 'rope', html: `<svg viewBox="0 0 160 160" width="160" height="160" aria-hidden="true">
      <circle cx="80" cy="80" r="${R}" fill="none" stroke="var(--line)" stroke-width="6" stroke-dasharray="2 9.3" />
      <circle class="rp" cx="80" cy="80" r="${R}" fill="none" stroke="var(--c)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C}" transform="rotate(-90 80 80)"/></svg>` });
  const num = h('b');
  const update = (v) => {
    num.textContent = v;
    ring.querySelector('.rp').setAttribute('stroke-dashoffset', C * (1 - Math.min(1, v / target)));
  };
  const btn = h('button', { class: 'rope-btn', 'aria-label': 'Още една молитва' }, ring, h('div', { class: 'rope-num' }, num, h('span', {}, `от ${target}`)));
  btn.onclick = async () => {
    const v = (getEntry(t, 'jesus') || 0) + 1;
    update(v);
    navigator.vibrate?.(8);
    await setEntry(t, 'jesus', v);
    if (v === target) toast('Слава Богу! 🙏');
  };
  update(getEntry(t, 'jesus') || 0);
  return h('section', { class: 'card', style: { textAlign: 'center' } },
    h('div', { class: 'sec-title' }, h('h2', {}, '📿 Броеница'), h('button', { class: 'count', onclick: () => prayerSheet('jesus') }, 'Текст →')),
    btn,
    h('p', { class: 'muted', style: { margin: '6px 0 10px' } }, '„Господи Иисусе Христе, Сине Божий, помилуй мене грешния.“'),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn small', onclick: async () => { const v = Math.max(0, (getEntry(t, 'jesus') || 0) - 1); update(v); await setEntry(t, 'jesus', v); } }, '− 1'),
      h('button', { class: 'btn small', onclick: async () => { if (!confirm('Да нулирам ли броя за днес?')) return; update(0); await setEntry(t, 'jesus', 0); } }, 'Нулирай')));
}

let calMonth = null;
function calendar(t) {
  calMonth ||= t.slice(0, 7);
  const [y, m] = calMonth.split('-').map(Number);
  const n = new Date(y, m, 0).getDate();
  const first = `${calMonth}-01`;
  const shift = (k) => { const d = new Date(y, m - 1 + k, 1); calMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; render(); };
  return h('section', { class: 'card' },
    h('div', { class: 'sec-title' },
      h('h2', { class: 'cap' }, `${MONTHS[m - 1]} ${y}`),
      h('div', { class: 'daynav' },
        h('button', { class: 'iconbtn', 'aria-label': 'Предишен месец', onclick: () => shift(-1) }, '‹'),
        h('button', { class: 'iconbtn', 'aria-label': 'Следващ месец', onclick: () => shift(1) }, '›'))),
    h('div', { class: 'cal' },
      ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((d) => h('span', { class: 'cal-h' }, d)),
      Array.from({ length: dow(first) }, () => h('span')),
      Array.from({ length: n }, (_, i) => {
        const d = `${calMonth}-${pad(i + 1)}`, info = dayInfo(d);
        return h('button', { class: `cal-d ocal${info.red ? ' red' : ''}${info.great ? ' great' : ''}${d === t ? ' now' : ''}`, onclick: () => daySheet(d) },
          h('b', {}, i + 1), h('small', {}, info.fast.level === 'free' ? '' : info.fast.emoji));
      })),
    h('div', { class: 'fhint', style: { marginTop: '8px' } }, 'Червено = празник/неделя · ', Object.values({ a: '🐟 риба', b: '🫒 олио', c: '🥦 постно', d: '🍞 строг' }).join(' · ')));
}

export default function faith() {
  const t = today();
  const info = dayInfo(t);
  const nf = nextFeast(t);
  const topic = topicFor(t, start());
  const rd = readingFor(t, start());
  const readTr = S.trackers.find((x) => x.id === 'scripture');
  const readDone = readTr && doneOn(readTr, t);
  const rows = S.trackers.filter((x) => x.area === 'faith' && x.id !== 'jesus' && active(x, t) && (doneOn(x, t) || isScheduled(x, t)));

  return h('div', { class: 'page', style: { '--c': '#e3b341' } },
    h('header', { class: 'top' }, h('div', {}, h('div', { class: 'eyebrow' }, fmtLong(t)), h('h1', {}, 'Вяра'))),

    h('section', { class: 'card' + (info.red ? ' feast-card' : '') },
      info.season ? h('div', { class: 'eyebrow', style: { marginBottom: '6px' } }, info.season) : null,
      info.moveable ? h('div', { class: 'feast' + (info.red ? ' red' : '') }, info.moveable) : null,
      h('div', { class: 'saints' }, info.saints || '—'),
      fastBadge(info.fast),
      nf ? h('div', { class: 'muted', style: { marginTop: '10px' } }, `Следващ голям празник: ${nf.name} — след ${days(nf.days)} (${fmtShort(nf.date)})`) : null),

    rows.length ? h('section', { class: 'card' },
      h('div', { class: 'sec-title' }, h('h2', {}, '🙏 Днес'), h('span', { class: 'count' }, `${rows.filter((x) => doneOn(x, t)).length}/${rows.length}`)),
      h('div', { class: 'rows' }, rows.map((x) => trackerRow(x, t, true)))) : null,

    rope(t),

    topic ? h('section', { class: 'card' },
      h('div', { class: 'sec-title' }, h('h2', {}, '📜 Тема на деня'), h('button', { class: 'count', onclick: librarySheet }, 'Библиотека →')),
      h('div', { class: 'eyebrow' }, topic.cat),
      h('h3', { style: { margin: '2px 0 6px', fontSize: '18px' } }, topic.title),
      h('p', { class: 'clamp', style: { margin: 0 } }, topic.text),
      h('div', { class: 'btn-row', style: { marginTop: '10px' } },
        h('button', { class: 'btn small', onclick: () => topicSheet(topic, t) }, 'Прочети цялата'),
        studied()[topic.id] ? h('span', { class: 'btn small', style: { color: 'var(--c)' } }, '✓ Изучена')
          : h('button', { class: 'btn small primary', style: { background: 'var(--c)', borderColor: 'var(--c)' }, onclick: () => markStudied(topic, t) }, 'Изучих я ✓')))
      : h('section', { class: 'card' }, h('div', { class: 'empty' }, 'Библиотеката с теми се зарежда…')),

    h('section', { class: 'card' },
      h('div', { class: 'sec-title' }, h('h2', {}, '📖 Четене днес'), h('span', { class: 'count' }, `ден ${rd.day} от ${rd.of}`)),
      h('div', { class: 'reading' }, h('div', {}, h('span', { class: 'muted' }, 'Нов Завет'), h('b', {}, rd.nt)), h('div', {}, h('span', { class: 'muted' }, 'Псалтир'), h('b', {}, rd.ps))),
      readTr ? h('button', { class: 'btn small block' + (readDone ? '' : ' primary'), style: { marginTop: '10px', ...(readDone ? {} : { background: 'var(--c)', borderColor: 'var(--c)' }) }, onclick: async () => { await setEntry(t, 'scripture', !readDone || null); render(); } },
        readDone ? '✓ Прочетено' : 'Прочетох') : null,
      h('p', { class: 'fhint', style: { margin: '8px 0 0' } }, 'По една глава от Новия Завет на ден — целият за около 9 месеца, и по един псалом.')),

    h('section', { class: 'card' },
      h('div', { class: 'sec-title' }, h('h2', {}, '📕 Молитвеник')),
      h('div', { class: 'list' },
        RULES.map((r) => h('button', { class: 'li', onclick: () => ruleSheet(r) }, h('span', {}, '☦️'), h('div', { style: { flex: 1 } }, h('div', {}, r.title), h('div', { class: 'rmeta' }, r.note)), h('span', { class: 'chev' }, '›'))),
        Object.entries(PRAYERS).map(([id, p]) => h('button', { class: 'li', onclick: () => prayerSheet(id) }, h('span', { style: { flex: 1 } }, p.title), h('span', { class: 'chev' }, '›'))))),

    calendar(t),

    h('p', { class: 'fhint', style: { textAlign: 'center' } }, 'Постът е според църковния устав в опростен вид. За лични облекчения (болест, тежки тренировки, работа) питай своя духовник.'));
}
