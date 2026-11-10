// "Още": manage trackers and areas, notification time, backup/restore.
import { S, saveTracker, deleteTracker, saveArea, deleteArea, setSetting, exportData, importData, areaById } from '../store.js';
import { freqText } from '../logic.js';
import { today, fmtShort } from '../dates.js';
import { h, openSheet, field, select, dayChips, toast, num } from '../ui.js';
import { render } from '../app.js';
import { enablePush, testPush, disablePush, updatePushTime, isStandalone, pushSupported, buildMorning } from '../push.js';

const col = (...kids) => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } }, ...kids);

function seg(options, value, onChange) {
  let cur = value;
  const el = h('div', { class: 'seg' });
  const draw = () => el.replaceChildren(...options.map(([v, label]) =>
    h('button', { type: 'button', class: v === cur ? 'on' : '', onclick: () => { cur = v; draw(); onChange(v); } }, label)));
  draw();
  return { el, get: () => cur };
}

function trackerForm(tr, areaId) {
  const t = tr ? structuredClone(tr) : { name: '', area: areaId || S.areas[0]?.id, type: 'check', freq: { kind: 'week', days: [0, 1, 2, 3, 4, 5, 6] } };
  const name = h('input', { value: t.name, placeholder: 'напр. Без захар, Чета 20 мин' });
  const area = select(S.areas.map((a) => [a.id, `${a.emoji} ${a.name}`]), t.area);

  const target = h('input', { inputmode: 'decimal', value: t.target ?? '', placeholder: 'няма' });
  const unit = h('input', { value: t.unit || '', placeholder: 'кг, ч, пъти…' });
  const step = h('input', { inputmode: 'numeric', value: t.step ?? 1 });
  const dir = select([['min', 'Поне (≥)'], ['max', 'Най-много (≤)']], t.dir || 'min');
  const fTarget = field('Цел', target), fUnit = field('Единица', unit), fStep = field('Стъпка на бутона', step), fDir = field('Целта е', dir);

  const showType = (v) => {
    fTarget.classList.toggle('hidden', v === 'check');
    fUnit.classList.toggle('hidden', v === 'check');
    fStep.classList.toggle('hidden', v !== 'counter');
    fDir.classList.toggle('hidden', v !== 'number');
  };
  const type = seg([['check', 'Отметка'], ['number', 'Число'], ['counter', 'Брояч']], t.type, showType);
  showType(t.type);

  const chips = dayChips(t.freq.kind === 'week' ? t.freq.days : [0, 1, 2, 3, 4, 5, 6]);
  const every = h('input', { inputmode: 'numeric', value: t.freq.kind === 'every' ? t.freq.n : 7 });
  const fChips = field('В кои дни', chips.el), fEvery = field('На колко дни', every, 'Ще се появява отново, щом минат толкова дни от последното изпълнение.');
  const showFreq = (v) => { fChips.classList.toggle('hidden', v !== 'week'); fEvery.classList.toggle('hidden', v !== 'every'); };
  const freq = seg([['week', 'Дни'], ['every', 'На N дни'], ['fast', 'Постни дни']], t.freq.kind, showFreq);
  showFreq(t.freq.kind);

  const save = async () => {
    if (!name.value.trim()) { toast('Напиши име'); return false; }
    const f = freq.get() === 'week' ? { kind: 'week', days: chips.get() } : freq.get() === 'fast' ? { kind: 'fast' } : { kind: 'every', n: Math.max(1, Math.round(num(every.value) || 1)) };
    if (f.kind === 'week' && !f.days.length) { toast('Избери поне един ден'); return false; }
    Object.assign(t, { name: name.value.trim(), area: area.value, type: type.get(), freq: f });
    if (t.type === 'number') Object.assign(t, { target: num(target.value), unit: unit.value.trim(), dir: dir.value });
    if (t.type === 'counter') Object.assign(t, { target: Math.max(1, num(target.value) || 1), unit: unit.value.trim(), step: Math.max(1, num(step.value) || 1) });
    await saveTracker(t); render(); toast('Запазено');
  };

  openSheet({
    title: tr ? 'Редакция' : 'Нов тракер',
    body: col(field('Име', name), field('Област', area), field('Вид', type.el),
      h('div', { class: 'two' }, fTarget, fUnit), h('div', { class: 'two' }, fDir, fStep),
      field('Колко често', freq.el), fChips, fEvery),
    actions: [
      tr ? { label: 'Скрий', onClick: async () => { t.archivedAt = today(); await saveTracker(t); render(); toast('Скрито — историята е запазена'); } } : null,
      tr ? { label: 'Изтрий', kind: 'danger', onClick: async () => {
        if (!confirm(`Да изтрия ли „${tr.name}“ заедно с цялата му история? Това не може да се върне.`)) return false;
        await deleteTracker(tr.id); render();
      } } : null,
      { label: 'Запази', kind: 'primary', onClick: save },
    ].filter(Boolean),
  });
}

function areaForm(ar) {
  const a = ar ? { ...ar } : { name: '', emoji: '⭐', color: '#d2a8ff' };
  const name = h('input', { value: a.name, placeholder: 'напр. Учене, Семейство' });
  const emoji = h('input', { value: a.emoji, maxlength: 4 });
  const color = h('input', { type: 'color', value: a.color });
  const used = ar && S.trackers.some((t) => t.area === ar.id);
  openSheet({
    title: ar ? 'Редакция на област' : 'Нова област',
    body: col(field('Име', name), h('div', { class: 'two' }, field('Емоджи', emoji), field('Цвят', color))),
    actions: [
      ar ? { label: 'Изтрий', kind: 'danger', onClick: async () => {
        if (used) { toast('Първо премести или изтрий тракерите в нея'); return false; }
        if (!confirm('Да изтрия ли областта?')) return false;
        await deleteArea(ar.id); render();
      } } : null,
      { label: 'Запази', kind: 'primary', onClick: async () => {
        if (!name.value.trim()) { toast('Напиши име'); return false; }
        Object.assign(a, { name: name.value.trim(), emoji: emoji.value.trim() || '•', color: color.value });
        await saveArea(a); render();
      } },
    ].filter(Boolean),
  });
}

async function doExport() {
  const data = await exportData();
  const name = `podvig-backup-${today()}.json`;
  const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Подвиг – резервно копие' });
    else {
      const a = h('a', { href: URL.createObjectURL(file), download: name });
      document.body.append(a); a.click(); a.remove();
    }
    await setSetting('lastBackup', new Date().toISOString());
    toast('Резервното копие е готово'); render();
  } catch (e) {
    if (e.name !== 'AbortError') toast('Неуспешно: ' + e.message);
  }
}

function doImport() {
  const input = h('input', { type: 'file', accept: 'application/json,.json' });
  input.onchange = async () => {
    const f = input.files[0];
    if (!f) return;
    if (!confirm('Това ще замени ВСИЧКИ текущи данни с тези от файла. Продължаваш ли?')) return;
    try { await importData(JSON.parse(await f.text())); toast('Данните са възстановени'); render(); }
    catch (e) { toast(e.message || 'Невалиден файл'); }
  };
  input.click();
}

function notifyBox() {
  const on = S.settings.pushOn;
  const server = h('input', { value: S.settings.pushServer || '', placeholder: 'podvig-push.твоето-име.workers.dev', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' });
  const iosNotInstalled = /iPhone|iPad/.test(navigator.userAgent) && !isStandalone();
  const preview = () => { const m = buildMorning(today()); openSheet({ title: m.title, body: h('p', { style: { whiteSpace: 'pre-line', margin: 0, lineHeight: 1.6 } }, m.body) }); };
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' } },
    iosNotInstalled ? h('div', { class: 'banner' }, '📲 За да получаваш известия, първо добави Подвиг на началния екран: бутон „Сподели“ → „Добави към началния екран“, и го отвори от иконата.') : null,
    !pushSupported() && !iosNotInstalled ? h('div', { class: 'muted' }, 'Този браузър не поддържа известия.') : null,
    on ? h('div', { class: 'muted' }, '✅ Известията са включени. Ще ги получаваш всяка сутрин.') : field('Адрес на сървъра за известия', server, 'Копира се от Cloudflare след настройката (виж ръководството).'),
    h('div', { class: 'btn-row' },
      on ? [
        h('button', { class: 'btn', onclick: async () => { try { await testPush(); toast('Изпратено — провери телефона'); } catch (e) { toast(e.message); } } }, 'Изпрати тест'),
        h('button', { class: 'btn danger', onclick: async () => { await disablePush(); render(); toast('Известията са изключени'); } }, 'Изключи'),
      ] : h('button', { class: 'btn primary', onclick: async () => {
        try { await enablePush(server.value); render(); toast('Известията са включени 🔔'); } catch (e) { toast(e.message); }
      } }, 'Включи известията'),
      h('button', { class: 'btn', onclick: preview }, 'Виж днешното')));
}

export default function more() {
  const archived = S.trackers.filter((t) => t.archivedAt);
  const time = h('input', { type: 'time', value: S.settings.notifyTime || '06:00' });
  time.addEventListener('change', async () => {
    await setSetting('notifyTime', time.value);
    try { await updatePushTime(); toast('Часът е запазен'); } catch (e) { toast(e.message); }
  });
  const last = S.settings.lastBackup;

  return h('div', { class: 'page' },
    h('header', { class: 'top' }, h('h1', {}, 'Още')),

    h('a', { class: 'card li', href: '#/schedule', style: { textDecoration: 'none', color: 'inherit', padding: '14px' } },
      h('span', {}, '🗓'), h('span', { style: { flex: 1 } }, 'График — работа, тренировки, събития'), h('span', { class: 'chev' }, '›')),

    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Тракери'), h('button', { class: 'btn small primary', onclick: () => trackerForm(null) }, '+ Нов')),
      S.areas.map((a) => {
        const ts = S.trackers.filter((t) => t.area === a.id && !t.archivedAt);
        return [
          h('div', { class: 'group-label' }, `${a.emoji} ${a.name}`),
          h('div', { class: 'list' },
            ts.map((t) => h('button', { class: 'li', style: { '--c': a.color }, onclick: () => trackerForm(t) },
              h('span', { class: 'dotc' }), h('span', { style: { flex: 1 } }, t.name),
              h('span', { class: 'muted' }, freqText(t.freq)), h('span', { class: 'chev' }, '›'))),
            h('button', { class: 'li muted', onclick: () => trackerForm(null, a.id) }, `+ добави в ${a.name}`)),
        ];
      }),
      archived.length ? [
        h('div', { class: 'group-label' }, 'Скрити'),
        h('div', { class: 'list' }, archived.map((t) => h('div', { class: 'li' },
          h('span', { style: { flex: 1 } }, t.name, h('span', { class: 'muted' }, ` · ${areaById(t.area).name}`)),
          h('button', { class: 'btn small', onclick: async () => { delete t.archivedAt; await saveTracker(t); render(); } }, 'Върни')))),
      ] : null),

    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Области'), h('button', { class: 'btn small', onclick: () => areaForm(null) }, '+ Нова')),
      h('div', { class: 'list' }, S.areas.map((a) => h('button', { class: 'li', style: { '--c': a.color }, onclick: () => areaForm(a) },
        h('span', { class: 'dotc' }), h('span', { style: { flex: 1 } }, `${a.emoji} ${a.name}`), h('span', { class: 'chev' }, '›'))))),

    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, '🔔 Сутрешно известие')),
      field('Час', time),
      notifyBox()),

    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, '💾 Резервно копие')),
      h('p', { class: 'muted', style: { marginTop: 0 } },
        'Всички данни са само на телефона ти. Пази копие във Файлове или iCloud веднъж седмично. ',
        last ? `Последно: ${fmtShort(last.slice(0, 10))}.` : 'Още нямаш копие.'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn primary', onclick: doExport }, 'Запази копие'),
        h('button', { class: 'btn', onclick: doImport }, 'Възстанови'))),

    h('p', { class: 'muted', style: { textAlign: 'center', margin: '8px 0' } }, 'Подвиг · версия 1.0'));
}
