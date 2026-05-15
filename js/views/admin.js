const AdminView = (() => {
  let _users      = [];
  let _allReports = [];

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── LOAD ────────────────────────────────────────────────────────────────────

  async function render() {
    App.setHeader('ניהול משתמשים', true, '');
    const container = document.getElementById('view-container');
    container.innerHTML = `<div style="padding:40px;text-align:center;"><div class="spinner" style="width:36px;height:36px;border-color:var(--border);border-top-color:var(--green);"></div></div>`;

    try {
      [_users, _allReports] = await Promise.all([Auth.getAllUsers(), _loadAllReports()]);
      _renderContent();
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p>שגיאה בטעינה: ${escHtml(err.message)}</p></div>`;
    }
  }

  async function _loadAllReports() {
    const people = await Storage.People.getAll();
    const flat = [];
    for (const person of people) {
      const projects = await Storage.Projects.getForPerson(person.id);
      for (const project of projects) {
        const reports = await Storage.Reports.getForProject(project.id);
        for (const report of reports) {
          flat.push({ ...report, personName: person.name, projectName: project.name });
        }
      }
    }
    return flat.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  // ── RENDER ──────────────────────────────────────────────────────────────────

  function _renderContent() {
    const meId = Auth.getUser()?.id;
    const container = document.getElementById('view-container');

    container.innerHTML = `
      <div class="admin-section" style="margin-top:8px;">
        <div class="admin-section-header">
          <span class="admin-section-title">משתמשים (${_users.length})</span>
          <button class="btn btn-primary btn-sm" onclick="AdminView.showCreateUser()">+ משתמש חדש</button>
        </div>
        <div class="user-list">
          ${_users.length === 0 ? '<div style="padding:16px;color:var(--text-muted);text-align:center;">אין משתמשים עדיין</div>' :
            _users.map(u => `
              <div class="user-card ${u.id === meId ? 'user-card-current' : ''}">
                <div class="user-info">
                  <div class="user-name">${escHtml(u.name || '—')}</div>
                  <span class="user-role-badge ${u.role === 'admin' ? 'admin' : 'viewer'}">${u.role === 'admin' ? 'מנהל' : 'צופה'}</span>
                </div>
                <div class="user-actions">
                  ${u.role === 'viewer' ? `<button class="btn btn-outline btn-sm" onclick="AdminView.managePermissions('${escHtml(u.id)}')">הרשאות</button>` : ''}
                  ${u.id !== meId ? `<button class="btn btn-outline btn-sm" onclick="AdminView.toggleRole('${escHtml(u.id)}','${escHtml(u.role)}')">${u.role === 'admin' ? 'הפוך לצופה' : 'הפוך למנהל'}</button>` : ''}
                </div>
              </div>
              <div id="perm-section-${escHtml(u.id)}" class="hidden" style="background:var(--green-bg);border-bottom:1px solid var(--border);"></div>
            `).join('')
          }
        </div>
      </div>

      <!-- CREATE USER MODAL -->
      <div id="create-user-overlay" class="modal-overlay hidden" onclick="if(event.target===this) AdminView.hideCreateUser()">
        <div class="modal-box" onclick="event.stopPropagation()">
          <div class="modal-handle"></div>
          <div class="modal-title">משתמש חדש</div>
          <div class="form-group">
            <label>שם מלא</label>
            <input type="text" id="new-user-name" placeholder="ישראל ישראלי">
          </div>
          <div class="form-group">
            <label>דואר אלקטרוני</label>
            <input type="email" id="new-user-email" placeholder="user@example.com">
          </div>
          <div class="form-group">
            <label>סיסמה (לפחות 6 תווים)</label>
            <input type="password" id="new-user-password" placeholder="••••••">
          </div>
          <div class="form-group">
            <label>תפקיד</label>
            <select id="new-user-role">
              <option value="viewer">צופה — רק קריאה</option>
              <option value="admin">מנהל — גישה מלאה</option>
            </select>
          </div>
          <div id="create-user-error" class="login-error hidden"></div>
          <div class="modal-actions">
            <button class="btn btn-outline" onclick="AdminView.hideCreateUser()">ביטול</button>
            <button class="btn btn-primary" id="create-user-btn" onclick="AdminView.createUser()">צור משתמש</button>
          </div>
        </div>
      </div>
    `;
  }

  // ── MODAL ───────────────────────────────────────────────────────────────────

  function showCreateUser() {
    const overlay = document.getElementById('create-user-overlay');
    if (!overlay) return;
    document.getElementById('new-user-name').value     = '';
    document.getElementById('new-user-email').value    = '';
    document.getElementById('new-user-password').value = '';
    document.getElementById('new-user-role').value     = 'viewer';
    document.getElementById('create-user-error').classList.add('hidden');
    overlay.classList.remove('hidden');
  }

  function hideCreateUser() {
    document.getElementById('create-user-overlay')?.classList.add('hidden');
  }

  async function createUser() {
    const name     = document.getElementById('new-user-name').value.trim();
    const email    = document.getElementById('new-user-email').value.trim();
    const password = document.getElementById('new-user-password').value;
    const role     = document.getElementById('new-user-role').value;
    const errEl    = document.getElementById('create-user-error');
    const btn      = document.getElementById('create-user-btn');

    errEl.classList.add('hidden');
    if (!email || !password) {
      errEl.textContent = 'יש למלא דואר אלקטרוני וסיסמה';
      errEl.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'יוצר...';

    try {
      await Auth.createUser(email, password, name || email, role);
      hideCreateUser();
      App.toast('המשתמש נוצר בהצלחה');
      await render();
    } catch (err) {
      errEl.textContent = err.message || 'שגיאה ביצירת משתמש';
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'צור משתמש';
    }
  }

  // ── ROLE ────────────────────────────────────────────────────────────────────

  async function toggleRole(userId, currentRole) {
    const newRole = currentRole === 'admin' ? 'viewer' : 'admin';
    try {
      await Auth.updateUserRole(userId, newRole);
      App.toast(`תפקיד עודכן ל-${newRole === 'admin' ? 'מנהל' : 'צופה'}`);
      await render();
    } catch (err) {
      App.toast('שגיאה: ' + (err.message || 'נסה שנית'));
    }
  }

  // ── PERMISSIONS ─────────────────────────────────────────────────────────────

  async function managePermissions(userId) {
    const section = document.getElementById(`perm-section-${userId}`);
    if (!section) return;

    if (!section.classList.contains('hidden')) {
      section.classList.add('hidden');
      return;
    }

    section.innerHTML = '<div style="padding:12px 16px;color:var(--text-muted);">טוען...</div>';
    section.classList.remove('hidden');

    try {
      const granted = new Set(await Auth.getReportPermissions(userId));

      const itemsHtml = _allReports.length === 0
        ? '<div style="padding:12px 16px;color:var(--text-muted);">אין דוחות במערכת עדיין</div>'
        : _allReports.map(r => `
            <label class="permission-item">
              <input type="checkbox" value="${escHtml(r.id)}" ${granted.has(r.id) ? 'checked' : ''}>
              <div class="permission-info">
                <div class="permission-report">${escHtml(r.siteName || 'דוח #' + (r.reportNumber || ''))}</div>
                <div class="permission-meta">${escHtml(r.personName)} · ${escHtml(r.projectName)} · #${r.reportNumber || ''}${r.date ? ' · ' + r.date : ''}</div>
              </div>
            </label>
          `).join('');

      section.innerHTML = `
        <div class="permissions-list" style="max-height:280px;overflow-y:auto;" id="perm-list-${escHtml(userId)}">
          ${itemsHtml}
        </div>
        <div style="padding:10px 16px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid var(--border);">
          <button class="btn btn-outline btn-sm" onclick="document.getElementById('perm-section-${escHtml(userId)}').classList.add('hidden')">ביטול</button>
          <button class="btn btn-primary btn-sm" onclick="AdminView.savePermissions('${escHtml(userId)}')">שמור</button>
        </div>
      `;
    } catch (err) {
      section.innerHTML = `<div style="padding:12px 16px;color:#dc2626;">שגיאה: ${escHtml(err.message)}</div>`;
    }
  }

  async function savePermissions(userId) {
    const list = document.getElementById(`perm-list-${userId}`);
    if (!list) return;
    const reportIds = Array.from(list.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value);
    try {
      await Auth.setReportPermissions(userId, reportIds);
      App.toast('הרשאות עודכנו');
      document.getElementById(`perm-section-${userId}`)?.classList.add('hidden');
    } catch (err) {
      App.toast('שגיאה בשמירה: ' + (err.message || ''));
    }
  }

  return { render, showCreateUser, hideCreateUser, createUser, toggleRole, managePermissions, savePermissions };
})();
