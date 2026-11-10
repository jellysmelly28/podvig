import { load } from './store.js';
import { loadFaithData } from './orthodox.js';
import faith from './views/faith.js';
import { scheduleMorning } from './push.js';
import home from './views/home.js';
import today from './views/today.js';
import schedule from './views/schedule.js';
import more from './views/more.js';
import training from './views/training.js';
import money from './views/money.js';

const routes = { home, today, schedule, more, training, money, faith };
const tabOf = { schedule: 'today', more: 'home' };
const view = document.getElementById('view');

export function render() {
  const [, name = 'home', arg] = (location.hash || '#/home').split('/');
  const route = routes[name] ? name : 'home';
  view.replaceChildren(routes[route](arg));
  document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === (tabOf[route] || route)));
  scheduleMorning();
}

export function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

// Re-render when the app comes back to the foreground on a new day.
let shownDay = new Date().toDateString();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && new Date().toDateString() !== shownDay) {
    shownDay = new Date().toDateString();
    render();
  }
});

(async () => {
  await Promise.all([load(), loadFaithData()]);
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
})();
