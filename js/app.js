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

  function _showError(msg) {
    hideLoading();
    const vc = document.getElementById('view-container');
    if (vc) vc.innerHTML =
      `<div style="padding:32px 20px;text-align:center;">
         <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:24px;display:inline-block;max-width:400px;text-align:right;">
           <p style="color:#dc2626;font-weight:700;margin-bottom:8px;">שגיאה</p>
           <p style="color:#7f1d1d;font-size:.9rem;">${msg}</p>
           <button onclick="location.reload()" style="margin-top:16px;padding:8px 20px;background:#8DC63F;color:white;border:none;border-radius:6px;cursor:pointer;font-size:.9rem;">רענן דף</button>
         </div>
       </div>`;
  }

  // ── Admin header actions ───────────────────────────────────────────────────

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

  function _initAdminRoutes() {
    Router.register('/', () => {
      ReportView.cleanup();
      PeopleView.render({ headerActionsHtml: _adminHeaderActions() });
    });
    Router.register('/person/:personId', (p) => {
      ReportView.cleanup();
      ProjectsView.render(p);
    });
    Router.register('/person/:personId/new-project', (p) => {
      ReportView.cleanup();
      NewProjectView.render(p);
    });
    Router.register('/project/:projectId', (p) => {
      ReportView.cleanup();
      ReportsView.render(p);
    });
    Router.register('/report/:reportId', (p) => {
      ReportView.render(p);
    });
    Router.register('/admin', () => {
      ReportView.cleanup();
      AdminView.render();
    });
  }

  function _initViewerRoutes() {
    Router.register('/', () => {
      ViewerReportsView.render();
    });
    Router.register('/report/:reportId', (p) => {
      ReportView.render(p, { readOnly: true });
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

  function _startApp() {
    hideLoading();
    Router.clear();
    if (Auth.isAdmin()) {
      _initAdminRoutes();
    } else {
      _initViewerRoutes();
    }
    Router.init();
  }

  // ── Boot ───────────────────────────────────────────────────────────────────

  async function init() {
    // Register service worker for offline support
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    // Online / offline indicator
    window.addEventListener('offline', () => toast('אין חיבור — עובד במצב לא מקוון'));
    window.addEventListener('online',  () => toast('החיבור שוחזר ✓'));


    showLoading('טוען...');

    try {
      await Auth.init(_onAuthChange);
      // Auth state is handled by _onAuthChange callback above.
      // The INITIAL_SESSION event will fire and show login or app.
      // Add a fallback timeout in case no event fires.
      setTimeout(() => {
        if (document.getElementById('view-container')?.querySelector('[style*="טוען"]') ||
            document.querySelector('.loading-overlay')) {
          hideLoading();
          LoginView.render();
        }
      }, 5000);
    } catch (err) {
      _showError(err.message || 'שגיאת חיבור — בדוק אינטרנט ורענן');
    }
  }

  return { setHeader, goBack, toast, confirm, showLoading, hideLoading, init };
})();

document.addEventListener('DOMContentLoaded', App.init);
