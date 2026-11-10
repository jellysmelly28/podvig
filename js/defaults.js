// Starting setup. Everything here can be edited or removed in the app.
const ALL = [0, 1, 2, 3, 4, 5, 6];
const daily = { kind: 'week', days: ALL };
const week = (...days) => ({ kind: 'week', days });
const every = (n) => ({ kind: 'every', n });

export const DEFAULT_AREAS = [
  { id: 'self', name: 'Дисциплина', emoji: '🧠', color: '#a371f7', order: 0 },
  { id: 'training', name: 'Тренировки', emoji: '🥊', color: '#ff7b47', order: 1 },
  { id: 'faith', name: 'Вяра', emoji: '☦️', color: '#e3b341', order: 2 },
  { id: 'home', name: 'Дом', emoji: '🏠', color: '#58a6ff', order: 3 },
  { id: 'money', name: 'Пари', emoji: '💶', color: '#3fb950', order: 4 },
  { id: 'work', name: 'Работа', emoji: '💼', color: '#39c5cf', order: 5 },
];

const t = (id, area, name, type, freq, extra = {}) => ({ id, area, name, type, freq, ...extra });

// Ticking this logs the shift pay as income automatically. Days are set in Пари → Работа.
export const SHIFT_TRACKER = t('shift', 'work', 'Отработих смяна', 'check', { kind: 'week', days: [] });

export const DEFAULT_TRACKERS = [
  t('bed', 'self', 'Оправих леглото', 'check', daily),
  t('wake', 'self', 'Станах навреме', 'check', daily),
  t('sleep', 'self', 'Сън', 'number', daily, { target: 7, unit: 'ч', dir: 'min' }),
  t('water', 'self', 'Вода', 'counter', daily, { target: 8, unit: 'чаши', step: 1 }),

  t('am', 'training', 'Сутрешна тренировка', 'check', week(0, 1, 2, 3, 4, 5)),
  t('pm', 'training', 'Вечерна тренировка', 'check', week(0, 1, 2, 3, 4)),
  t('weight', 'training', 'Сутрешно тегло', 'number', daily, { unit: 'кг' }),
  t('mobility', 'training', 'Разтягане / мобилност', 'check', daily),
  t('meals', 'training', 'Хранене по план', 'check', daily),

  t('mprayer', 'faith', 'Утринни молитви', 'check', daily),
  t('eprayer', 'faith', 'Вечерни молитви', 'check', daily),
  t('mealprayer', 'faith', 'Молитва преди и след хранене', 'check', daily),
  t('jesus', 'faith', 'Иисусова молитва', 'counter', daily, { target: 100, unit: 'пъти', step: 10 }),
  t('scripture', 'faith', 'Четене на Светото Писание', 'check', daily),
  t('liturgy', 'faith', 'Света Литургия', 'check', week(6)),
  t('fast', 'faith', 'Спазих поста', 'check', { kind: 'fast' }),
  t('theology', 'faith', 'Изучих темата на деня', 'check', daily),
  t('examen', 'faith', 'Вечерна равносметка на деня', 'check', daily),
  t('alms', 'faith', 'Милостиня или добро дело', 'check', every(7)),
  t('confession', 'faith', 'Изповед', 'check', every(30), { startIn: 14 }),
  t('communion', 'faith', 'Свето Причастие', 'check', every(30), { startIn: 14 }),

  t('dishes', 'home', 'Измих чиниите', 'check', daily),
  t('tidy', 'home', 'Подредих 10 минути', 'check', daily),
  t('trash', 'home', 'Изхвърлих боклука', 'check', every(2)),
  t('laundry', 'home', 'Пране', 'check', every(7), { startIn: 1 }),
  t('vacuum', 'home', 'Прахосмукачка', 'check', every(7), { startIn: 2 }),
  t('bathroom', 'home', 'Почистих банята', 'check', every(7), { startIn: 4 }),
  t('groceries', 'home', 'Пазаруване', 'check', every(7)),
  t('sheets', 'home', 'Смяна на чаршафите', 'check', every(14), { startIn: 5 }),
  t('fridge', 'home', 'Почистих хладилника', 'check', every(14), { startIn: 8 }),
  t('deepclean', 'home', 'Основно почистване', 'check', every(30), { startIn: 12 }),
  t('bills', 'home', 'Платих сметките', 'check', every(30), { startIn: 20 }),

  t('logged', 'money', 'Записах всички разходи', 'check', daily),
  t('noimpulse', 'money', 'Без импулсивни покупки', 'check', daily),
  t('notrading', 'money', 'Без трейдинг', 'check', daily),

  SHIFT_TRACKER,
];

export const DEFAULT_EVENTS = [
  { id: 'ev-am', title: 'Сутрешна тренировка', area: 'training', start: '07:00', end: '08:30', days: [0, 1, 2, 3, 4, 5] },
  { id: 'ev-pm', title: 'Вечерна тренировка', area: 'training', start: '18:30', end: '20:00', days: [0, 1, 2, 3, 4] },
  { id: 'ev-lit', title: 'Света Литургия', area: 'faith', start: '08:30', end: '10:30', days: [6] },
];

// Money categories. `fixed` ones (rent, bills, subscriptions) don't count toward
// the daily spending colour. `noBudget` = tracked but never budgeted.
export const DEFAULT_CATEGORIES = [
  { id: 'food', kind: 'expense', name: 'Храна и магазин', emoji: '🛒' },
  { id: 'eatout', kind: 'expense', name: 'Заведения и доставки', emoji: '🍔' },
  { id: 'rent', kind: 'expense', name: 'Наем и жилище', emoji: '🏠', fixed: true },
  { id: 'bills', kind: 'expense', name: 'Сметки (ток, вода, нет)', emoji: '💡', fixed: true },
  { id: 'phone', kind: 'expense', name: 'Телефон и абонаменти', emoji: '📱', fixed: true },
  { id: 'transport', kind: 'expense', name: 'Транспорт и гориво', emoji: '⛽' },
  { id: 'gym', kind: 'expense', name: 'Зала и добавки', emoji: '🥊' },
  { id: 'health', kind: 'expense', name: 'Здраве', emoji: '💊' },
  { id: 'clothes', kind: 'expense', name: 'Дрехи и екипировка', emoji: '👕' },
  { id: 'household', kind: 'expense', name: 'Домакински', emoji: '🧽' },
  { id: 'fun', kind: 'expense', name: 'Развлечения', emoji: '🎮' },
  { id: 'gifts', kind: 'expense', name: 'Подаръци', emoji: '🎁' },
  { id: 'church', kind: 'expense', name: 'Църква и милостиня', emoji: '☦️' },
  { id: 'trading', kind: 'expense', name: 'Трейдинг', emoji: '📉', noBudget: true },
  { id: 'other', kind: 'expense', name: 'Друго', emoji: '📦' },
  { id: 'shifts', kind: 'income', name: 'Смени (работа)', emoji: '💼' },
  { id: 'bbb', kind: 'income', name: 'BuiltByBit магазин', emoji: '🛍️' },
  { id: 'purse', kind: 'income', name: 'Хонорар от мач', emoji: '🏆' },
  { id: 'side', kind: 'income', name: 'Допълнителни', emoji: '🛠' },
  { id: 'inc_other', kind: 'income', name: 'Друго', emoji: '➕' },
];

export const SESSION_TYPES = [
  ['boxing', '🥊 Бокс'], ['kick', '🦵 Кикбокс / Муай тай'], ['wrestling', '🤼 Борба'],
  ['bjj', '🥋 БЖЖ / граплинг'], ['mma', '⚔️ ММА'], ['sparring', '🔥 Спаринг'],
  ['sc', '🏋️ Сила и кондиция'], ['run', '🏃 Бягане / кардио'], ['mob', '🧘 Мобилност'], ['other', '• Друго'],
];
