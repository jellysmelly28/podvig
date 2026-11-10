// Home: today's ring, the year grid, and one small grid per life area.
import { S, areaById } from '../store.js';
import { dayStats, ratio, level, dayStreak, streak, active, firstDay } from '../logic.js';
import { today, addDays, weekStart, parse, fmtLong, fmtShort, diffDays, MONTHS_SHORT } from '../dates.js';
import { h } from '../ui.js';
import { go } from '../app.js';
import { faithLine } from './today.js';

function greeting() {
  const hr = new Date().getHours();
  return hr < 11 ? 'Добро утро' : hr < 18 ? 'Добър ден' : 'Добър вечер';
}

function ring(r) {
  const R = 34, C = 2 * Math.PI * R, p = r ?? 0;
  return h('div', { class: 'ring', html: `
    <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden="true">
      <circle cx="40" cy="40" r="${R}" fill="none" stroke="var(--line)" stroke-width="8"/>
      <circle cx="40" cy="40" r="${R}" fill="none" stroke="var(--accent)" stroke-width="8" stroke-linecap="round"
        stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p)}" transform="rotate(-90 40 40)"/>
    </svg>
    <span>${Math.round(p * 100)}%</span>` });
}

// GitHub-style grid: columns are weeks (Mon→Sun top to bottom).
function grid({ weeks, color, scoreOf, fixed, months }) {
  const t = today();
  const start = addDays(weekStart(t), -7 * (weeks - 1));
  const g = h('div', { class: 'grid' + (fixed ? ' fixed' : ''), style: { '--cols': weeks, '--c': color } });
  const labels = [];
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      if (d === 0 && months) {
        const first = parse(date).getDate() <= 7;
        if (w === 0 || first) labels.push([w, MONTHS_SHORT[parse(addDays(date, 6)).getMonth()]]);
      }
      if (date > t) { g.append(h('i', { class: 'cell future' })); continue; }
      const lv = level(scoreOf(date));
      g.append(h('button', {
        class: `cell l${lv}${date === t ? ' now' : ''}`,
        title: fmtShort(date),
        'aria-label': fmtLong(date),
        onclick: () => go('#/today/' + date),
      }));
    }
  }
  if (!months) return g;
  const row = h('div', { class: 'months', style: { '--cols': weeks } });
  let lastCol = -3;
  for (const [col, name] of labels) {
    if (col - lastCol < 3) continue;
    row.append(h('span', { style: { gridColumn: `${col + 1} / span 3` } }, name));
    lastCol = col;
  }
  return h('div', { class: 'grid-wrap' }, row, g);
}

function legend(color) {
  return h('div', { class: 'legend', style: { '--c': color } },
    'по-малко', [0, 1, 2, 3, 4].map((l) => h('i', { class: 'cell l' + l })), 'повече');
}

export default function home() {
  const t = today();
  const statsCache = new Map();
  const stats = (d) => { if (!statsCache.has(d)) statsCache.set(d, dayStats(d)); return statsCache.get(d); };
  const todayStats = stats(t);
  const r = ratio(todayStats);
  const start = firstDay();

  // Backup reminder
  const last = S.settings.lastBackup;
  const since = last ? diffDays(last.slice(0, 10), t) : diffDays(S.settings.installedAt || t, t);
  const needBackup = since >= 7;

  const big = grid({ weeks: 53, color: 'var(--accent)', scoreOf: (d) => ratio(stats(d)), fixed: true, months: true });
  const scroller = h('div', { class: 'hscroll' }, big);
  queueMicrotask(() => { scroller.scrollLeft = scroller.scrollWidth; });

  let activeDays = 0;
  for (let d = start; d <= t; d = addDays(d, 1)) if (stats(d).done > 0) activeDays++;

  const areaCards = S.areas
    .filter((a) => S.trackers.some((tr) => tr.area === a.id && active(tr, t)))
    .map((a) => {
      const s = todayStats.areas[a.id] || { due: 0, done: 0 };
      const best = S.trackers
        .filter((tr) => tr.area === a.id && active(tr, t) && tr.freq.kind === 'week')
        .map((tr) => [tr, streak(tr)])
        .sort((x, y) => y[1] - x[1])[0];
      return h('section', { class: 'card area', style: { '--c': a.color } },
        h('div', { class: 'area-head' },
          h('span', { class: 'area-name' }, a.emoji, ' ', a.name),
          h('span', { class: 'area-count' + (s.due && s.done === s.due ? ' full' : '') }, s.due ? `${s.done}/${s.due} днес` : 'почивка')),
        grid({ weeks: 18, color: a.color, scoreOf: (d) => ratio(stats(d).areas[a.id]) }),
        best && best[1] > 0 ? h('div', { class: 'area-foot' }, `🔥 ${best[0].name} · ${best[1]} ${best[1] === 1 ? 'ден' : 'дни'}`) : null);
    });

  return h('div', { class: 'page' },
    h('header', { class: 'top' },
      h('div', {}, h('div', { class: 'eyebrow' }, fmtLong(t)), h('h1', {}, greeting()), faithLine(t)),
      h('a', { class: 'iconbtn', href: '#/more', 'aria-label': 'Настройки', style: { textDecoration: 'none', color: 'inherit', alignSelf: 'flex-start' } }, '⚙')),

    needBackup ? h('button', { class: 'banner', onclick: () => go('#/more') },
      '💾 ', last ? `Последно резервно копие преди ${since} дни.` : 'Още нямаш резервно копие.', ' Направи сега →') : null,

    h('section', { class: 'card today-card', onclick: () => go('#/today') },
      ring(r),
      h('div', { class: 'today-text' },
        h('div', { class: 'big' }, todayStats.due ? `${todayStats.done} от ${todayStats.due}` : 'Нищо за днес'),
        h('div', { class: 'muted' }, r === 1 ? 'Всичко е изпълнено. Слава Богу!' : 'изпълнени за днес'),
        h('div', { class: 'link' }, 'Към днешния списък →'))),

    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Последните 12 месеца')),
      scroller,
      h('div', { class: 'stats-row' },
        h('div', {}, h('b', {}, dayStreak()), h('span', {}, 'дни серия (80%+)')),
        h('div', {}, h('b', {}, activeDays), h('span', {}, 'активни дни'))),
      legend('var(--accent)')),

    areaCards);
}
