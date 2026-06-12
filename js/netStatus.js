// Network/sync status banner. Listens to online/offline and to the
// 'dc:syncstate' CustomEvent broadcast by Storage's sync queue, and renders a
// slim fixed banner at the bottom of the screen. States:
//   offline  → "אין חיבור — עובד במצב לא מקוון"   (persistent)
//   syncing  → "מסנכרן… (N)"                       (while queue drains)
//   failed   → "N שינויים לא סונכרנו" + "נסה שוב"
//   synced   → "הנתונים סונכרנו ✓"                 (brief, auto-hides)
const NetStatus = (() => {
  let _el = null;
  let _prevPending = 0;
  let _hideTimer = null;

  // wifi-off glyph for the offline state
  const _ICON_OFFLINE =
    '<svg class="net-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">' +
    '<line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>' +
    '<path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/>' +
    '<path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>';
  const _ICON_SPIN = '<span class="net-spinner" aria-hidden="true"></span>';
  const _ICON_OK   = '<span class="net-icon" aria-hidden="true">✓</span>';

  function _ensureEl() {
    if (_el) return _el;
    _el = document.createElement('div');
    _el.id = 'net-status';
    _el.className = 'net-status hidden';
    _el.setAttribute('role', 'status');
    _el.setAttribute('aria-live', 'polite');
    document.body.appendChild(_el);
    return _el;
  }

  function _render(state) {
    const el = _ensureEl();
    clearTimeout(_hideTimer);
    if (!state.show) { el.className = 'net-status hidden'; return; }
    el.className = 'net-status ' + state.cls;
    el.innerHTML =
      (state.icon || '') +
      '<span class="net-text">' + state.text + '</span>' +
      (state.retry ? '<button type="button" class="net-retry" onclick="Storage.retryFailedWrites()">נסה שוב</button>' : '');
    if (state.autohide) {
      _hideTimer = setTimeout(() => { el.className = 'net-status hidden'; }, 2500);
    }
  }

  // Derive the banner state from the sync queue snapshot.
  function _update(s) {
    if (!s) {
      s = (typeof Storage !== 'undefined' && Storage.syncState)
        ? Storage.syncState()
        : { online: navigator.onLine, pending: 0, failed: 0, syncing: false };
    }
    let state;
    if (!s.online) {
      state = { show: true, cls: 'offline', icon: _ICON_OFFLINE, text: 'אין חיבור — עובד במצב לא מקוון' };
    } else if (s.failed > 0) {
      state = { show: true, cls: 'failed', text: s.failed + ' שינויים לא סונכרנו', retry: true };
    } else if (s.pending > 0) {
      state = { show: true, cls: 'syncing', icon: _ICON_SPIN, text: 'מסנכרן… (' + s.pending + ')' };
    } else if (_prevPending > 0) {
      // Queue just drained → brief confirmation, then auto-hide.
      state = { show: true, cls: 'synced', icon: _ICON_OK, text: 'הנתונים סונכרנו' };
      state.autohide = true;
    } else {
      state = { show: false };
    }
    _prevPending = s.pending || 0;
    _render(state);
  }

  function init() {
    _ensureEl();
    window.addEventListener('dc:syncstate', e => _update(e.detail));
    window.addEventListener('online',  () => _update());
    window.addEventListener('offline', () => _update());
    _update();
  }

  return { init, update: _update };
})();

document.addEventListener('DOMContentLoaded', NetStatus.init);
