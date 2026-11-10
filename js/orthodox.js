// Bulgarian Orthodox calendar: Pascha, moveable feasts, fasting rules, seasons,
// saints of the day (Revised Julian: fixed feasts on civil dates, Pascha by the Julian computus).
import { ymd, parse, addDays, dow, diffDays } from './dates.js';

let SAINTS = {};
let TOPICS = [];
export async function loadFaithData() {
  const [s, a, b] = await Promise.allSettled([import('./data/saints.js'), import('./data/topics-a.js'), import('./data/topics-b.js')]);
  if (s.status === 'fulfilled') SAINTS = s.value.SAINTS || {};
  TOPICS = [
    ...(a.status === 'fulfilled' ? a.value.TOPICS_A || [] : []),
    ...(b.status === 'fulfilled' ? b.value.TOPICS_B || [] : []),
  ];
}
export const topics = () => TOPICS;

// ---- Pascha ----
const paschaCache = {};
export function pascha(y) {
  if (paschaCache[y]) return paschaCache[y];
  const a = y % 4, b = y % 7, c = y % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const m = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  const jul = new Date(y, m - 1, day);
  jul.setDate(jul.getDate() + 13); // Julian → Gregorian (valid 1900–2099)
  return (paschaCache[y] = ymd(jul));
}
export const paschaOffset = (date) => diffDays(pascha(parse(date).getFullYear()), date);

// ---- moveable feasts (days from Pascha) ----
const MOVEABLE = {
  '-70': ['Неделя на Митаря и фарисея'],
  '-63': ['Неделя на блудния син'],
  '-57': ['Месопустна задушница'],
  '-56': ['Месни заговезни. Неделя на Страшния съд'],
  '-49': ['Сирни заговезни. Неделя Прощална'],
  '-48': ['Чисти понеделник. Начало на Великия пост'],
  '-43': ['Тодорова събота'],
  '-42': ['Неделя Православна'],
  '-35': ['Неделя на св. Григорий Палама'],
  '-28': ['Кръстопоклонна неделя'],
  '-21': ['Неделя на св. Йоан Лествичник'],
  '-14': ['Неделя на прп. Мария Египетска'],
  '-8': ['Лазарова събота (Лазаровден)'],
  '-7': ['Вход Господен в Йерусалим (Цветница)', 1],
  '-6': ['Велики понеделник'],
  '-5': ['Велики вторник'],
  '-4': ['Велика сряда'],
  '-3': ['Велики четвъртък'],
  '-2': ['Велики петък. Разпятие Христово', 1],
  '-1': ['Велика събота'],
  0: ['Възкресение Христово (Великден)', 1],
  1: ['Светли понеделник. Втори ден на Великден', 1],
  2: ['Светли вторник. Трети ден на Великден', 1],
  5: ['Светли петък. Живоприемен източник'],
  7: ['Томина неделя'],
  39: ['Възнесение Господне (Спасовден)', 1],
  48: ['Черешова задушница'],
  49: ['Петдесетница. Света Троица', 1],
  50: ['Духов ден', 1],
  56: ['Неделя на всички светии'],
};

const GREAT_FIXED = {
  '01-01': 'Обрезание Господне. Св. Василий Велики', '01-06': 'Богоявление (Йордановден)', '01-07': 'Събор на св. Йоан Кръстител (Ивановден)',
  '02-02': 'Сретение Господне', '03-25': 'Благовещение', '05-11': 'Св. Св. Кирил и Методий',
  '06-24': 'Рождество на св. Йоан Кръстител (Еньовден)', '06-29': 'Св. ап. Петър и Павел (Петровден)',
  '08-06': 'Преображение Господне', '08-15': 'Успение на Пресвета Богородица', '08-29': 'Отсичане главата на св. Йоан Кръстител',
  '09-08': 'Рождество на Пресвета Богородица', '09-14': 'Въздвижение на Светия Кръст (Кръстовден)', '10-19': 'Св. Иван Рилски',
  '10-26': 'Св. вмчк Димитър (Димитровден)', '11-08': 'Св. Архангел Михаил (Архангеловден)', '11-21': 'Въведение Богородично',
  '12-06': 'Св. Николай Чудотворец (Никулден)', '12-25': 'Рождество Христово (Коледа)', '12-26': 'Събор на Пресвета Богородица',
};
const LORD_THEOTOKOS = ['01-06', '02-02', '03-25', '08-06', '08-15', '09-08', '11-21', '12-25'];

export function dayInfo(date) {
  const md = date.slice(5);
  const o = paschaOffset(date);
  const mv = MOVEABLE[o];
  const fixed = SAINTS[md];
  const saints = fixed?.s || GREAT_FIXED[md] || '';
  const red = !!(mv?.[1] || fixed?.r || (!fixed && GREAT_FIXED[md]) || dow(date) === 6);
  return { moveable: mv?.[0] || null, saints, red, great: !!(mv?.[1] || LORD_THEOTOKOS.includes(md)), fast: fastOn(date), season: season(date) };
}

export function nextFeast(from) {
  for (let i = 1; i < 400; i++) {
    const d = addDays(from, i);
    const md = d.slice(5), mv = MOVEABLE[paschaOffset(d)];
    if (mv?.[1]) return { date: d, name: mv[0], days: i };
    if (LORD_THEOTOKOS.includes(md)) return { date: d, name: GREAT_FIXED[md], days: i };
  }
  return null;
}

// ---- fasting ----
export const FAST = {
  free: { emoji: '🍖', label: 'Без пост' },
  nomeat: { emoji: '🧀', label: 'Без месо (млечни и яйца — разрешени)' },
  fish: { emoji: '🐟', label: 'Пост — разрешена риба' },
  oil: { emoji: '🫒', label: 'Пост — разрешени олио и вино' },
  vegan: { emoji: '🥦', label: 'Постен ден — без месо, млечни, яйца и риба' },
  strict: { emoji: '🍞', label: 'Строг пост — без олио' },
  total: { emoji: '✝️', label: 'Пълно въздържание (според силите)' },
};
const f = (level, note) => ({ level, ...FAST[level], note: note || null });

export function fastOn(date) {
  const md = date.slice(5), o = paschaOffset(date), wd = dow(date);
  const wedFri = wd === 2 || wd === 4, weekend = wd >= 5;

  // fast-free periods
  if (md >= '12-25' || md <= '01-04') return f('free', 'Святки — няма пост');
  if (o >= -69 && o <= -64) return f('free', 'Седмица след Митаря и фарисея — няма пост');
  if (o >= 1 && o <= 6) return f('free', 'Светла седмица — няма пост');
  if (o >= 50 && o <= 55) return f('free', 'Седмица след Петдесетница — няма пост');
  if (o >= -55 && o <= -49) return f('nomeat', 'Сирна седмица');

  // Great Lent and Holy Week
  if (o >= -48 && o <= -1) {
    if (o === -2) return f('total', 'Велики петък');
    if (o === -48) return f('strict', 'Чисти понеделник');
    if (o === -7) return f('fish', 'Цветница');
    if (md === '03-25' && o < -6) return f('fish', 'Благовещение');
    if (o === -8) return f('oil', 'Лазарова събота — разрешен хайвер');
    if (weekend) return f('oil', 'Велик пост');
    return f('strict', 'Велик пост');
  }

  // single strict days
  if (md === '01-05') return f('vegan', 'Навечерие на Богоявление');
  if (md === '08-29') return f('vegan', 'Отсичане главата на св. Йоан Кръстител');
  if (md === '09-14') return f('vegan', 'Въздвижение на Светия Кръст');

  // Apostles' fast: Monday after All Saints → 28 June
  if (o >= 57 && md <= '06-28') return wedFri ? f('vegan', 'Петров пост') : f('fish', 'Петров пост');

  // Dormition fast
  if (md >= '08-01' && md <= '08-14') {
    if (md === '08-06') return f('fish', 'Преображение — Богородичен пост');
    return weekend ? f('oil', 'Богородичен пост') : f('strict', 'Богородичен пост');
  }

  // Nativity fast
  if (md >= '11-15' && md <= '12-24') {
    if (md === '12-24') return f('vegan', 'Бъдни вечер — постна трапеза');
    if (md === '11-21' || md === '12-06') return f('fish', 'Коледни пости');
    if (md >= '12-20') return weekend ? f('oil', 'Коледни пости') : f('vegan', 'Коледни пости');
    return wedFri ? f('vegan', 'Коледни пости') : f('fish', 'Коледни пости');
  }

  if (wedFri) {
    if (LORD_THEOTOKOS.includes(md) || ['06-24', '06-29'].includes(md)) return f('fish', 'Празник в постен ден');
    return f('vegan', wd === 2 ? 'Сряда' : 'Петък');
  }
  return f('free');
}
export const isFastDay = (date) => fastOn(date).level !== 'free';

export function season(date) {
  const md = date.slice(5), o = paschaOffset(date);
  if (md >= '12-25' || md <= '01-04') return 'Святки';
  if (o >= -70 && o <= -49) return 'Подготвителни седмици за Великия пост';
  if (o >= -48 && o <= -8) return `Велик пост · ${Math.floor((o + 48) / 7) + 1}-а седмица`;
  if (o >= -7 && o <= -1) return 'Страстна седмица';
  if (o >= 0 && o <= 6) return 'Светла седмица';
  if (o > 6 && o < 39) return 'Време след Великден — „Христос воскресе!“';
  if (o >= 39 && o < 49) return 'След Възнесение';
  if (o >= 57 && md <= '06-28') return 'Петров пост';
  if (md >= '08-01' && md <= '08-14') return 'Богородичен пост';
  if (md >= '11-15' && md <= '12-24') return 'Коледни пости';
  return null;
}

// ---- daily Scripture plan: New Testament in order + one Psalm a day ----
const NT = [['Мат.', 28], ['Марк', 16], ['Лука', 24], ['Йоан', 21], ['Деян.', 28], ['Римл.', 16], ['1 Кор.', 16], ['2 Кор.', 13], ['Гал.', 6], ['Еф.', 6], ['Фил.', 4], ['Кол.', 4], ['1 Сол.', 5], ['2 Сол.', 3], ['1 Тим.', 6], ['2 Тим.', 4], ['Тит', 3], ['Филим.', 1], ['Евр.', 13], ['Иак.', 5], ['1 Петр.', 5], ['2 Петр.', 3], ['1 Йоан', 5], ['2 Йоан', 1], ['3 Йоан', 1], ['Иуда', 1], ['Откр.', 22]];
const NT_CH = NT.flatMap(([b, n]) => Array.from({ length: n }, (_, i) => `${b} ${i + 1}`));
export function readingFor(date, start) {
  const i = Math.max(0, diffDays(start, date));
  return { nt: NT_CH[i % NT_CH.length], ps: `Пс. ${(i % 150) + 1}`, day: (i % NT_CH.length) + 1, of: NT_CH.length };
}

// ---- theology topic of the day: a fixed shuffled order, one per day, no repeats for a year ----
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
let order = null, orderKey = '';
export function topicFor(date, start) {
  if (!TOPICS.length) return null;
  const key = start + TOPICS.length;
  if (orderKey !== key) {
    const r = rng([...start].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    order = TOPICS.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    orderKey = key;
  }
  const i = Math.max(0, diffDays(start, date)) % TOPICS.length;
  return TOPICS[order[i]];
}
