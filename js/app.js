const App = (() => {
  let _loadingEl  = null;
  let _toastTimer = null;
  let _appStarted = false;

  function setHeader(title, showBack, actionsHtml = '') {
    const backBtn = document.getElementById('btn-back');
    if (showBack) backBtn.classList.remove('hidden');
    else          backBtn.classList.add('hidden');
    document.getElementById('header-actions').innerHTML = actionsHtml;

    const logo   = document.getElementById('header-logo');
    const hTitle = document.getElementById('header-title');
    if (showBack) {
      if (logo) logo.style.opacity = '0.55';
    } else {
      if (logo) logo.style.opacity = '1';
    }
    if (hTitle) {
      // Clear the text when empty — the title is now a flex spacer (no longer
      // display:none), so a stale title must not linger on the home screen.
      hTitle.textContent = title || '';
      hTitle.classList.toggle('visible', !!title);
    }
  }

  function goBack() {
    if (typeof ReportView !== 'undefined') ReportView.cleanup();
    history.back();
  }

  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function confirm(message, onYes, yesLabel = 'מחק') {
    const overlay = document.getElementById('confirm-overlay');
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-yes').textContent = yesLabel;
    overlay.classList.remove('hidden');
    document.getElementById('confirm-yes').onclick = () => { overlay.classList.add('hidden'); onYes(); };
    document.getElementById('confirm-no').onclick  = () => overlay.classList.add('hidden');
    // Click on the dark backdrop = cancel (the inner box stops propagation)
    overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.add('hidden'); };
  }

  function showLoading(text = 'אנא המתן...') {
    if (_loadingEl) _loadingEl.remove();
    _loadingEl = document.createElement('div');
    _loadingEl.className = 'loading-overlay';
    _loadingEl.innerHTML = `<div class="spinner"></div><p>${text}</p>`;
    document.body.appendChild(_loadingEl);
  }

  function hideLoading() {
    if (_loadingEl) { _loadingEl.remove(); _loadingEl = null; }
  }

  function _showError(msg, { showLogout = false } = {}) {
    hideLoading();
    _appStarted = false;
    const vc = document.getElementById('view-container');
    if (vc) vc.innerHTML =
      `<div style="padding:32px 20px;text-align:center;">
         <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:24px;display:inline-block;max-width:400px;text-align:right;">
           <p style="color:#dc2626;font-weight:700;margin-bottom:8px;">שגיאה</p>
           <p style="color:#7f1d1d;font-size:.9rem;">${msg}</p>
           <div style="margin-top:16px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
             ${showLogout ? `<button onclick="Auth.logout()" style="padding:8px 20px;background:#8DC63F;color:white;border:none;border-radius:6px;cursor:pointer;font-size:.9rem;">יציאה והתחברות מחדש</button>` : ''}
             <button onclick="location.reload()" style="padding:8px 20px;background:white;color:#374151;border:1px solid #d1d5db;border-radius:6px;cursor:pointer;font-size:.9rem;">רענן דף</button>
           </div>
         </div>
       </div>`;
    setHeader('', false, '');
  }

  function showAccessDenied(message = 'אין לך הרשאה לגשת לתיקייה זו', { showLogout = false } = {}) {
    hideLoading();
    toast(message);
    const personId = Auth.getAssignedPersonId();
    const backPath = Auth.isAdmin() ? '/' : (personId ? `/person/${personId}` : '/');
    const vc = document.getElementById('view-container');
    if (vc) vc.innerHTML = `
      <div class="access-denied">
        <div class="access-denied-icon">${showLogout ? '⚠️' : '🚫'}</div>
        <h2>${showLogout ? 'החשבון לא מוגדר' : 'גישה נדחתה'}</h2>
        <p>${message}</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:8px;">
          ${showLogout
            ? `<button class="btn btn-primary" onclick="Auth.logout()">יציאה והתחברות מחדש</button>`
            : `<button class="btn btn-primary" onclick="Router.navigate('${backPath}')">חזרה</button>`}
        </div>
      </div>`;
    setHeader(showLogout ? 'הגדרת חשבון' : 'גישה נדחתה', false, _userHeaderActions());
  }

  // ── Admin header actions ───────────────────────────────────────────────────

  function _userHeaderActions() {
    return `
      <button class="btn-icon" onclick="UserHomeView.openProfile()" title="הפרופיל שלי" aria-label="הפרופיל שלי">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </button>
      <button class="btn-icon" onclick="Auth.logout()" title="יציאה" aria-label="יציאה">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      </button>`;
  }

  function _adminHeaderActions() {
    return `
      <button class="btn-icon" onclick="Router.navigate('/admin')" title="ניהול משתמשים" aria-label="ניהול משתמשים">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </button>
      <button class="btn-icon" onclick="Auth.logout()" title="יציאה" aria-label="יציאה">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      </button>`;
  }

  // ── Routes ─────────────────────────────────────────────────────────────────

  function _safeRender(fn) {
    Promise.resolve().then(fn).catch(err => {
      console.error('Route render error:', err);
      const vc = document.getElementById('view-container');
      if (vc) vc.innerHTML =
        `<div style="padding:32px 20px;text-align:center;">
           <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:24px;display:inline-block;max-width:400px;text-align:right;">
             <p style="color:#dc2626;font-weight:700;margin-bottom:8px;">שגיאת טעינה</p>
             <p style="color:#7f1d1d;font-size:.9rem;">${String(err.message || err)}</p>
             <button onclick="location.reload()" style="margin-top:16px;padding:8px 20px;background:#8DC63F;color:white;border:none;border-radius:6px;cursor:pointer;">רענן</button>
           </div>
         </div>`;
    });
  }

  async function _guardPerson(personId, fn) {
    if (!Auth.canAccessPerson(personId)) {
      showAccessDenied('אין לך הרשאה לגשת לתיקייה זו');
      return;
    }
    await fn();
  }

  async function _guardProject(projectId, fn) {
    if (!(await Auth.canAccessProject(projectId))) {
      showAccessDenied('אין לך הרשאה לגשת לפרויקט זה');
      return;
    }
    await fn();
  }

  async function _guardReport(reportId, fn) {
    if (!(await Auth.canAccessReport(reportId))) {
      showAccessDenied('אין לך הרשאה לגשת לדוח זה');
      return;
    }
    await fn();
  }

  function _initRoutes() {
    const header = Auth.isAdmin() ? _adminHeaderActions() : _userHeaderActions();

    Router.register('/', () => {
      ReportView.cleanup();
      if (Auth.isAdmin()) {
        _safeRender(() => PeopleView.render({ headerActionsHtml: header }));
        return;
      }
      if (Auth.getProfile()?.role === 'viewer') {
        _safeRender(() => ViewerReportsView.render());
        return;
      }
      const personId = Auth.getAssignedPersonId();
      if (personId) {
        _safeRender(() => UserHomeView.render());
      } else {
        showAccessDenied(
          'לא הוקצתה לך תיקייה במערכת. פנה למנהל המערכת לשיוך תיקייה, או התחבר עם חשבון אחר.',
          { showLogout: true }
        );
      }
    });

    Router.register('/person/:personId', (p) => {
      ReportView.cleanup();
      // A folder-scoped user opening one of their folders gets the friendly
      // UserHome view (with a back button to the folder picker).
      if (!Auth.isAdmin() && Auth.canAccessPerson(p.personId)) {
        _safeRender(() => UserHomeView.render(p.personId, { back: true }));
        return;
      }
      _safeRender(() => _guardPerson(p.personId, () => ProjectsView.render(p)));
    });

    Router.register('/person/:personId/new-project', (p) => {
      ReportView.cleanup();
      _safeRender(() => _guardPerson(p.personId, () => NewProjectView.render(p)));
    });

    Router.register('/project/:projectId', (p) => {
      ReportView.cleanup();
      _safeRender(() => _guardProject(p.projectId, () => ReportsView.render(p)));
    });

    Router.register('/report/:reportId', (p) => {
      const readOnly = Auth.getProfile()?.role === 'viewer';
      _safeRender(() => _guardReport(p.reportId, () => ReportView.render(p, { readOnly })));
    });

    Router.register('/admin', () => {
      ReportView.cleanup();
      if (!Auth.isAdmin()) {
        showAccessDenied('דף זה זמין למנהלי מערכת בלבד');
        return;
      }
      _safeRender(() => AdminView.render());
    });

    // Diagnostics: shows the captured error log (route + message + UA) so an
    // intermittent crash can be reported by screenshotting #/diag.
    Router.register('/diag', () => {
      ReportView.cleanup();
      _safeRender(() => _renderDiag());
    });
  }

  function _renderDiag() {
    setHeader('אבחון שגיאות', true, '');
    const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    let log = [];
    try { log = JSON.parse(localStorage.getItem('dc:errlog') || '[]'); } catch (_) {}

    const rows = log.length === 0
      ? `<tr><td colspan="4" style="padding:16px;text-align:center;color:#888;">לא נרשמו שגיאות 🎉</td></tr>`
      : log.slice().reverse().map(e => `
          <tr style="border-bottom:1px solid #eee;">
            <td style="padding:6px 8px;white-space:nowrap;font-size:.72rem;color:#666;">${esc((e.t||'').replace('T',' ').slice(0,19))}</td>
            <td style="padding:6px 8px;font-family:monospace;font-size:.72rem;color:#1d4ed8;">${esc(e.hash||'')}</td>
            <td style="padding:6px 8px;font-size:.78rem;color:#991b1b;">${esc(e.msg||'')}${e.src ? `<br><small style="color:#999;">${esc(e.src)}:${esc(e.line)}</small>` : ''}</td>
            <td style="padding:6px 8px;font-size:.7rem;color:#999;">${esc(e.kind||'')}${e.online === false ? ' · offline' : ''}</td>
          </tr>`).join('');

    const vc = document.getElementById('view-container');
    vc.innerHTML = `
      <div style="padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
          <div style="font-weight:700;">יומן שגיאות (${log.length})</div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-outline btn-sm" onclick="App.clearDiag()">נקה יומן</button>
            <button class="btn btn-outline btn-sm" onclick="location.reload()">רענן</button>
          </div>
        </div>
        <p style="font-size:.78rem;color:#666;margin-bottom:10px;">אם קיבלת שגיאה — צלם את המסך הזה ושלח לתמיכה. העמודה "מסלול" מראה היכן זה קרה.</p>
        <div style="overflow-x:auto;border:1px solid #eee;border-radius:8px;">
          <table style="width:100%;border-collapse:collapse;direction:rtl;">
            <thead><tr style="background:#f7f7f7;text-align:right;">
              <th style="padding:8px;font-size:.72rem;">זמן</th>
              <th style="padding:8px;font-size:.72rem;">מסלול</th>
              <th style="padding:8px;font-size:.72rem;">שגיאה</th>
              <th style="padding:8px;font-size:.72rem;">סוג</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <p style="font-size:.68rem;color:#aaa;margin-top:10px;word-break:break-all;">דפדפן: ${esc(navigator.userAgent)}</p>
      </div>`;
  }

  function clearDiag() {
    try { localStorage.removeItem('dc:errlog'); } catch (_) {}
    _renderDiag();
  }

  // ── Auth ───────────────────────────────────────────────────────────────────

  function _onAuthChange(event, session) {
    // Explicit, user-initiated logout always returns to the login screen.
    if (event === 'SIGNED_OUT' && Auth.wasLogoutRequested()) {
      _appStarted = false;
      hideLoading();
      LoginView.render();
      return;
    }
    // A live session (incl. the persisted one Supabase restored) → run the app.
    if (session) {
      if (!_appStarted) { _appStarted = true; _startApp(); }
      return;
    }
    // No session from Supabase. Offline re-entry: if a session + profile were
    // persisted from a previous online login, boot from them anyway — the SDK
    // just can't refresh the token without a network. This also means a
    // refresh-failure SIGNED_OUT while offline won't lock the user out.
    if (!navigator.onLine && Auth.adoptStoredUserOffline()) {
      if (!_appStarted) { _appStarted = true; _startApp(); }
      return;
    }
    // Genuinely signed out (online logout / no recoverable session) → login.
    _appStarted = false;
    hideLoading();
    LoginView.render();
  }

  async function _startApp() {
    showLoading('טוען...');
    await Auth.ensureProfile();

    const profile = Auth.getProfile();
    if (!profile) {
      _showError('לא נמצא פרופיל למשתמש זה. פנה למנהל המערכת.', { showLogout: true });
      return;
    }

    Router.clear();
    _initRoutes();
    Router.init();
    // Must hide AFTER Router.init() — LoginView.submit() calls showLoading()
    // after Auth.login() returns, which races with the hideLoading() that was
    // at the top of this function and left a permanent overlay.
    hideLoading();

    // Warm the offline cache (people → projects → reports) in the background so
    // the "enter app → create a new report" chain works later with no network.
    if (navigator.onLine) Storage.prefetchForOffline();
  }

  // Shown when a new SW activates mid-session (the user is already working, so we
  // can't silently reload without risking unsaved edits). Lets them refresh when
  // it's convenient. Idempotent — never stacks more than one banner.
  function _showUpdateBanner() {
    if (document.getElementById('update-banner')) return;
    const bar = document.createElement('div');
    bar.id = 'update-banner';
    bar.dir = 'rtl';
    bar.style.cssText =
      'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;max-width:520px;margin:0 auto;' +
      'background:#1f2937;color:#fff;border-radius:10px;padding:12px 16px;' +
      'box-shadow:0 6px 20px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:.92rem;';
    bar.innerHTML =
      '<span>גרסה חדשה זמינה</span>' +
      '<button id="update-banner-btn" style="flex:none;padding:8px 18px;background:#8DC63F;color:#fff;' +
      'border:none;border-radius:6px;cursor:pointer;font-size:.9rem;font-weight:600;">רענן עכשיו</button>';
    document.body.appendChild(bar);
    document.getElementById('update-banner-btn').onclick = () => window.location.reload();
  }

  // ── Boot ───────────────────────────────────────────────────────────────────

  async function init() {
    // Register service worker for offline support.
    // When a new SW activates (new deployment), reload automatically so the
    // user always gets fresh code — but only if the app hasn't started yet
    // (i.e. they're on the loading/login screen, not mid-session).
    if ('serviceWorker' in navigator) {
      // updateViaCache:'none' — never serve sw.js itself from the HTTP cache, so
      // an update check always sees the freshly deployed file (critical on iOS,
      // where a stale sw.js would otherwise hide new deployments for hours/days).
      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
        .then(reg => {
          // The app is a home-screen PWA with hash routing — it has no real page
          // navigations, so the browser never auto-checks for a new sw.js on its
          // own. We force the check ourselves: every 30 min while open, and every
          // time the user returns to the app (re-opens it / brings it back from
          // the background). reg.update() re-fetches sw.js; if it changed, the new
          // SW installs → skipWaiting → activate → controllerchange fires below.
          const checkForUpdate = () => reg.update().catch(() => {});
          setInterval(checkForUpdate, 30 * 60 * 1000);
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') checkForUpdate();
          });
          // iOS standalone PWAs are frozen when backgrounded and RESTORED from the
          // bfcache when reopened (pageshow with persisted=true) — a real reload,
          // and visibilitychange, often never fire in that path. pageshow is the
          // reliable hook to re-check for a new version the moment the user taps
          // the home-screen icon. This is the single biggest gap on iOS.
          window.addEventListener('pageshow', (e) => {
            if (e.persisted) checkForUpdate();
          });
        })
        .catch(() => {});
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // A new SW took control. Before the user starts working (login/loading
        // screen) just reload for the fresh code. Mid-session we don't reload —
        // that would discard unsaved edits — instead we surface a banner so the
        // user can refresh when it's convenient.
        if (!_appStarted) window.location.reload();
        else _showUpdateBanner();
      });
    }

    // Network state + sync progress are shown by NetStatus (persistent banner).

    // Re-warm the offline cache whenever connectivity returns mid-session.
    window.addEventListener('online', () => { if (_appStarted) Storage.prefetchForOffline(); });

    showLoading('טוען...');

    Auth.init(_onAuthChange);

    // Fallback: if INITIAL_SESSION never fires (Supabase unreachable or profile
    // query hangs), show LoginView after 8 seconds instead of freezing forever.
    setTimeout(() => {
      if (!_appStarted) {
        hideLoading();
        LoginView.render();
      }
    }, 8000);
  }

  return { setHeader, goBack, toast, confirm, showLoading, hideLoading, showAccessDenied, init, clearDiag };
})();

document.addEventListener('DOMContentLoaded', App.init);
