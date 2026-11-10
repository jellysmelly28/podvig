// Morning notification: the text is prepared on the phone (next 14 days) and
// stored in IndexedDB; the push server only wakes the phone at 6:00.
import { S, setSetting } from './store.js';
import { dayStats, eventsOn, tasksOn, active, isScheduled, doneOn } from './logic.js';
import { dayInfo, topicFor } from './orthodox.js';
import { today, addDays, parse, diffDays, DAYS_LONG, MONTHS, dow } from './dates.js';

const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function buildMorning(date) {
  const d = parse(date);
  const info = dayInfo(date);
  const lines = [];
  const holy = info.moveable || info.saints;
  if (holy) lines.push(`☦️ ${cut(holy, 70)}`);
  if (info.fast.level !== 'free') lines.push(`${info.fast.emoji} ${info.fast.label}`);

  const evs = eventsOn(date);
  if (evs.length) lines.push('🗓 ' + evs.map((e) => `${e.start} ${e.title}`).join(' · '));

  const tasks = S.tasks.filter((k) => !k.done && k.date <= date);
  if (tasks.length) lines.push('📝 ' + cut(tasks.map((k) => k.title).join(', '), 90));

  const chores = S.trackers.filter((t) => t.freq.kind === 'every' && t.freq.n > 1 && active(t, date) && isScheduled(t, date) && !doneOn(t, date));
  if (chores.length) lines.push('🏠 ' + cut(chores.map((t) => t.name).join(', '), 80));

  const fight = S.settings.fight;
  if (fight?.date >= date) { const n = diffDays(date, fight.date); if (n === 0) lines.push('🥊 Днес е мачът! Господ да те пази.'); else if (n <= 90) lines.push(`🥊 ${n} ${n === 1 ? 'ден' : 'дни'} до мача`); }

  const topic = topicFor(date, S.settings.installedAt || today());
  if (topic) lines.push(`📜 Тема: ${topic.title}`);

  const s = dayStats(date);
  return {
    title: `Добро утро! ${DAYS_LONG[dow(date)]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`.replace(/^(.*?! )(.)/, (m, a, b) => a + b.toUpperCase()),
    body: [`✅ ${s.due} неща за днес`, ...lines].join('\n'),
  };
}

let timer = null;
export function scheduleMorning() {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const out = {};
    for (let i = 0; i < 14; i++) { const d = addDays(today(), i); out[d] = buildMorning(d); }
    await setSetting('morning', out);
  }, 1500);
}

// ---------- push subscription ----------
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export function normalizeServer(url) {
  let u = (url || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//.test(u)) u = 'https://' + u;
  return u.replace(/\/+$/, '');
}

async function post(server, path, body) {
  const r = await fetch(server + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Сървърът отговори ${r.status}`);
  return data;
}

export async function enablePush(serverUrl) {
  if (!pushSupported()) throw new Error('Известията не се поддържат тук. На iPhone: добави Подвиг на началния екран и го отвори оттам (iOS 16.4+).');
  const perm = await Notification.requestPermission(); // must run first, inside the tap
  if (perm !== 'granted') throw new Error('Известията не са разрешени. Включи ги от Настройки на iPhone → Известия → Подвиг.');
  const server = normalizeServer(serverUrl);
  if (!server) throw new Error('Постави адреса на сървъра за известия.');

  let vapid = S.settings.vapid;
  if (!vapid) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    vapid = {
      publicKey: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)),
      privateJwk: await crypto.subtle.exportKey('jwk', kp.privateKey),
      subject: location.origin.startsWith('https:') ? location.origin : 'mailto:podvig@users.noreply.github.com',
    };
    await setSetting('vapid', vapid);
  }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub && sub.options?.applicationServerKey && b64u(sub.options.applicationServerKey) !== vapid.publicKey) { await sub.unsubscribe(); sub = null; }
  sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(vapid.publicKey) });

  let token = S.settings.pushToken;
  if (!token) { token = b64u(crypto.getRandomValues(new Uint8Array(24))); await setSetting('pushToken', token); }
  await post(server, '/subscribe', { token, subscription: sub.toJSON(), vapid, time: S.settings.notifyTime || '06:00', tz: 'Europe/Sofia' });
  await setSetting('pushServer', server);
  await setSetting('pushOn', true);
  scheduleMorning();
}

export async function updatePushTime() {
  if (!S.settings.pushOn) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await post(S.settings.pushServer, '/subscribe', { token: S.settings.pushToken, subscription: sub.toJSON(), vapid: S.settings.vapid, time: S.settings.notifyTime || '06:00', tz: 'Europe/Sofia' });
}

export async function testPush() {
  await post(S.settings.pushServer, '/test', { token: S.settings.pushToken });
}

export async function disablePush() {
  try { await post(S.settings.pushServer, '/unsubscribe', { token: S.settings.pushToken }); } catch { /* server may be gone */ }
  try { const reg = await navigator.serviceWorker.ready; await (await reg.pushManager.getSubscription())?.unsubscribe(); } catch { /* ignore */ }
  await setSetting('pushOn', false);
}
