import {log, query} from './core/utils.mjs';
import {prefs, storage} from './core/prefs.mjs';
import {starters} from './core/startup.mjs';
import {discard} from './core/discard.mjs';
import {navigate} from './core/navigate.mjs';
import './modes/number.mjs';
import './menu.mjs';

/*
  remote access

  request = {
    method: 'discard',
    query, {}, // query to find tabs with chrome.tabs
    forced: false // whether or not to filter pages
  }
*/

// S3: onMessageExternal accepts {method:'discard'} from external callers. No externally_connectable
// is declared, so any actual external caller would be unauthorized — guard with sender.id self-check.
chrome.runtime.onMessageExternal.addListener((request, sender, resposne) => {
  if (sender.id !== chrome.runtime.id) {
    log('onMessageExternal rejected: unauthorized sender', sender.id);
    return false;
  }
  if (request.method === 'discard') {
    log('onMessageExternal request received', request);

    query(request.query).then((tbs = []) => {
      if (request.forced !== true) {
        tbs = tbs.filter(({url = '', discarded, active}) => (url.startsWith('http') ||
          url.startsWith('ftp')) && !discarded && !active);
      }
      tbs.forEach(discard);

      resposne(tbs.map(t => t.id));
    });
    return true;
  }
});

chrome.runtime.onMessage.addListener((request, sender, resposne) => {
  log('onMessage request received', request);
  const {method} = request;
  if (method === 'discard.on.load') { // for links after initial load
    discard(sender.tab);
  }
  else if (method === 'storage') {
    Promise.all([
      storage(request.managed || {}, 'managed'),
      storage(request.session || {}, 'session')
    ]).then(a => Object.assign(...a)).then(resposne);

    return true;
  }
});

// left-click action
const popup = () => chrome.action.setPopup({
  popup: prefs.click === 'click.popup' ? '/data/popup/index.html' : ''
});
starters.push(() => popup());
storage.on('click', () => popup());

// idle timeout
starters.push(() => {
  chrome.idle.setDetectionInterval(prefs['idle-timeout']);
});
storage.on('idle-timeout', () => {
  chrome.idle.setDetectionInterval(prefs['idle-timeout']);
});

// badge
starters.push(() => chrome.action.setBadgeBackgroundColor({
  color: '#666'
}));

/* FAQs & Feedback */
// O5: align with data_collection_permissions.required:["none"]. Removed webextension.org navigation
// (onInstalled open homepage and uninstall URL version/name query) — now uses local notification only.
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, notifications} = chrome;
  if (navigator.webdriver !== true) {
    const {name, version} = getManifest();
    onInstalled.addListener(({reason}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage({
        'faqs': true,
        'last-update': 0
      }).then(prefs => {
        if (reason === 'install' && prefs.faqs) {
          notifications.create({
            type: 'basic',
            title: name,
            message: chrome.i18n.getMessage('installed_notification') || `Installed ${name} ${version}`,
            iconUrl: '/data/icons/48.png'
          });
        }
      }));
    });
    // Standard uninstall feedback page; no version/name query to avoid fingerprinting.
    setUninstallURL(getManifest().homepage_url);
  }
}
