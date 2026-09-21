import {overwrite, release} from '../loader.mjs';
import {log, query} from '../../core/utils.mjs';

// S5: only return favicon URL when its origin matches the tab's URL,
// preventing arbitrary outbound GETs from extension origin.
function sameOriginFavicon(tb) {
  if (!tb || !tb.favIconUrl || !tb.url) return '';
  try {
    const a = new URL(tb.favIconUrl);
    const b = new URL(tb.url);
    if (a.protocol !== 'https:' && a.protocol !== 'http:') return '';
    return a.hostname === b.hostname && a.protocol === b.protocol ? a.href : '';
  } catch (e) {
    return '';
  }
}

function enable() {
  log('blank.enable is called');
  overwrite('before-menu-click', function({menuItemId}, tab) {
    log('menu command:', menuItemId);
    if (menuItemId === 'release-tabs' || menuItemId === 'release-other-windows') {
      return query({
        active: true,
        currentWindow: false
      }).then(tbs => {
        for (const tb of tbs) {
          chrome.tabs.sendMessage(tb.id, {
            method: 'tab-is-active'
          });
        }
      });
    }
    else if (menuItemId === 'discard-other-windows' || menuItemId === 'discard-tabs') {
      return query({
        active: true,
        currentWindow: false,
        url: '*://*/*' // only if the active tab is not an internal page
      }).then(tbs => Promise.all(tbs.map(tb => {
        const args = new URLSearchParams();
        args.set('title', tb.title);
        // S5: same-origin check before forwarding favicon URL
        args.set('favicon', sameOriginFavicon(tb));

        return chrome.tabs.create({
          openerTabId: tb.id,
          windowId: tb.windowId,
          url: '/worker/plugins/blank/blank.html?' + args.toString(),
          index: tb.index
        });
      })));
    }
    else if (menuItemId === 'discard-tab' || menuItemId === 'discard-tree') {
      return query({
        active: false,
        highlighted: false,
        currentWindow: true,
        discarded: false
      }).then(tbs => {
        if (tbs.length === 0 && tab.url?.startsWith('http')) {
          const args = new URLSearchParams();
          args.set('title', tab.title);
          // S5: same-origin check before forwarding favicon URL
          args.set('favicon', sameOriginFavicon(tab));

          return chrome.tabs.create({
            openerTabId: tab.id,
            windowId: tab.windowId,
            url: '/worker/plugins/blank/blank.html?' + args.toString(),
            index: tab.index,
            active: false // so that this tab gets focused
          });
        }
      });
    }
  });
}
function disable() {
  log('blank.disable is called');
  release('before-menu-click');
}

export default {
  enable,
  disable
};
