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
      if (title) { hTitle.textContent = title; hTitle.classList.add('visible'); hTitle.style.textAlign = 'center'; }
      else        hTitle.classList.remove('visible');
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
      if (!Auth.isAdmin() && p.personId === Auth.getAssignedPersonId()) {
        _safeRender(() => UserHomeView.render());
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
  }

  // ── Auth ───────────────────────────────────────────────────────────────────

  function _onAuthChange(event, session) {
    // INITIAL_SESSION fires on page load — treat like SIGNED_IN/SIGNED_OUT
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
      if (!_appStarted) {
        _appStarted = true;
        _startApp();
      }
    } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
      _appStarted = false;
      hideLoading();
      LoginView.render();
    }
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
  }

  // ── Boot ───────────────────────────────────────────────────────────────────

  async function init() {
    // Register service worker for offline support.
    // When a new SW activates (new deployment), reload automatically so the
    // user always gets fresh code — but only if the app hasn't started yet
    // (i.e. they're on the loading/login screen, not mid-session).
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Only auto-reload before the user starts working (login/loading screen).
        // Reloading mid-session would discard unsaved edits — let the fresh code
        // apply on the next natural load instead.
        if (!_appStarted) window.location.reload();
      });
    }

    // Online / offline indicator
    window.addEventListener('offline', () => toast('אין חיבור — עובד במצב לא מקוון'));
    window.addEventListener('online',  () => toast('החיבור שוחזר ✓'));


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

  return { setHeader, goBack, toast, confirm, showLoading, hideLoading, showAccessDenied, init };
})();

document.addEventListener('DOMContentLoaded', App.init);
