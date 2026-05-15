const App = (() => {
  let _loadingEl  = null;
  let _toastTimer = null;

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
    ReportView.cleanup();
    history.back();
  }

  function toast(msg) {
    const el = document.getElementById('toast');
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

  // ── Auth-aware header actions ──────────────────────────────────────────────

  function _logoutIconHtml() {
    return `
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
      ${_logoutIconHtml()}`;
  }

  // ── Route init ─────────────────────────────────────────────────────────────

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

  // ── Auth state handler ─────────────────────────────────────────────────────

  function _onAuthChange(event, session) {
    if (event === 'SIGNED_IN' && session) {
      _startApp();
    } else if (event === 'SIGNED_OUT') {
      LoginView.render();
    }
  }

  function _startApp() {
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
    // Show loading while checking auth
    showLoading('טוען...');
    try {
      const session = await Auth.init(_onAuthChange);
      hideLoading();
      if (!session) {
        LoginView.render();
      } else {
        _startApp();
      }
    } catch (err) {
      hideLoading();
      // If Supabase not configured, show config error
      if (CONFIG.SUPABASE_URL === 'YOUR_SUPABASE_URL') {
        document.getElementById('view-container').innerHTML = `
          <div style="padding:32px;text-align:center;color:#dc2626;">
            <h2 style="margin-bottom:12px;">⚙️ הגדרת Supabase נדרשת</h2>
            <p>ערוך את הקובץ <code>js/config.js</code> והכנס את פרטי ה-Supabase שלך.</p>
            <p style="margin-top:8px;font-size:.85rem;color:#666;">ראה את <code>SETUP.md</code> להוראות מפורטות.</p>
          </div>`;
      } else {
        document.getElementById('view-container').innerHTML = `
          <div style="padding:32px;text-align:center;color:#dc2626;">
            <p>שגיאה בטעינה: ${err.message || 'נסה לרענן את הדף'}</p>
          </div>`;
      }
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  return { setHeader, goBack, toast, confirm, showLoading, hideLoading, init };
})();

document.addEventListener('DOMContentLoaded', App.init);
