// Date helpers. Dates are local "YYYY-MM-DD" strings; weekday 0 = Monday.
export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => ymd(new Date());
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
export const dow = (s) => (parse(s).getDay() + 6) % 7;
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
export const weekStart = (s) => addDays(s, -dow(s));

export const DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
export const DAYS_LONG = ['понеделник', 'вторник', 'сряда', 'четвъртък', 'петък', 'събота', 'неделя'];
export const MONTHS = ['януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември'];
export const MONTHS_SHORT = ['яну', 'фев', 'мар', 'апр', 'май', 'юни', 'юли', 'авг', 'сеп', 'окт', 'ное', 'дек'];

export const fmtLong = (s) => { const d = parse(s); return `${DAYS_LONG[dow(s)]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
export const fmtShort = (s) => { const d = parse(s); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`; };
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
