const ViewerReportsView = (() => {

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function initials(str) {
    if (!str) return '?';
    const words = str.trim().split(/\s+/);
    return (words.length === 1 ? words[0][0] : words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  async function render() {
    App.setHeader('הדוחות שלי', false, `
      <button class="btn-icon" title="יציאה" onclick="Auth.logout()" aria-label="יציאה">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      </button>
    `);

    const container = document.getElementById('view-container');
    container.innerHTML = `<div style="padding:40px;text-align:center;"><div class="spinner" style="width:36px;height:36px;border-color:var(--border);border-top-color:var(--green);"></div></div>`;

    try {
      const reports = await Storage.Reports.getPermitted();

      if (!reports || reports.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <svg width="60" height="60" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <h3>אין דוחות זמינים עדיין</h3>
            <p>המנהל יעניק לך גישה לדוחות</p>
          </div>`;
        return;
      }

      container.innerHTML = `
        <div class="reports-viewer-list">
          ${reports.map(r => {
            const title = escHtml(r.siteName || `דוח #${r.reportNumber || ''}`);
            const meta  = [r.personName, r.projectName].filter(Boolean).map(escHtml).join(' · ');
            const logoHtml = r.projectLogoUrl
              ? `<img src="${escHtml(r.projectLogoUrl)}" alt="" onerror="this.style.display='none'">`
              : `<div class="viewer-report-initials">${escHtml(initials(r.projectName || r.siteName))}</div>`;

            return `
              <div class="viewer-report-card" onclick="Router.navigate('/report/${escHtml(r.id)}')">
                <div class="viewer-report-logo">${logoHtml}</div>
                <div class="viewer-report-info">
                  <div class="viewer-report-title">${title}</div>
                  <div class="viewer-report-meta">${meta}${r.date ? (meta ? ' · ' : '') + escHtml(r.date) : ''}</div>
                </div>
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="flex-shrink:0;color:var(--text-light);">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </div>`;
          }).join('')}
        </div>`;
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p>שגיאה בטעינה: ${escHtml(err.message)}</p></div>`;
    }
  }

  return { render };
})();
