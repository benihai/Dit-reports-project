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
      if (title) { hTitle.textContent = title; hTitle.classList.add('visible'); }
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

  function init() {
    Router.register('/', () => {
      ReportView.cleanup();
      PeopleView.render();
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

    Router.init();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  return { setHeader, goBack, toast, confirm, showLoading, hideLoading, init };
})();

document.addEventListener('DOMContentLoaded', App.init);
