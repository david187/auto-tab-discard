// localization
[...document.querySelectorAll('[data-i18n]')].forEach(e => {
  e[e.dataset.i18nValue || 'textContent'] = chrome.i18n.getMessage(e.dataset.i18n);
});

const args = new URLSearchParams(location.search);
document.title = chrome.i18n.getMessage('blank_header') + ' ' + args.get('title');

// S5: prefer same-origin favicon; fall back to bundled extension icon to preserve original UX
const favicon = args.get('favicon');
const link = document.createElement('link');
link.setAttribute('rel', 'icon');
if (favicon) {
  link.setAttribute('href', favicon);
}
else {
  link.setAttribute('href', chrome.runtime.getURL('/data/page.png'));
}
document.head.appendChild(link);

chrome.runtime.onMessage.addListener(request => {
  if (request.method === 'tab-is-active') {
    window.close();
  }
});
document.addEventListener('click', () => window.close());

// close this window if it is hidden
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    window.close();
  }
});
