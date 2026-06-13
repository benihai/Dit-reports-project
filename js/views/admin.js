const AdminView = (() => {
  let _users     = [];
  let _people    = [];
  let _folderMap = {};   // { userId: [personId, ...] }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function roleLabel(role) {
    if (role === 'admin') return 'מנהל מערכת';
    if (role === 'viewer') return 'צופה (ישן)';
    return 'משתמש';
  }

  function displayName(u) {
    return u.name || u.email || `משתמש ${String(u.id).slice(0, 8)}`;
  }

  function personName(personId) {
    const p = _people.find(x => x.id === personId);
    return p ? p.name : personId;
  }

  // Folders assigned to a user (ids → names), tolerant of the legacy person_id.
  function userFolderIds(u) {
    const ids = _folderMap[u.id] ? [..._folderMap[u.id]] : [];
    if (u.person_id && !ids.includes(u.person_id)) ids.unshift(u.person_id);
    return ids;
  }

  function foldersCellHtml(u) {
    const ids = userFolderIds(u);
    if (ids.length === 0) return '<span class="users-no-folder">— לא משויך —</span>';
    return `<div class="folder-chips">${ids.map(id =>
      `<span class="folder-chip">${escHtml(personName(id))}</span>`).join('')}</div>`;
  }

  // Checkbox list of all folders, pre-checking the given ids.
  function folderCheckListHtml(selectedIds, listId) {
    if (_people.length === 0) {
      return `<p class="form-hint" id="${listId}">אין תיקיות עדיין — צור תיקייה חדשה למטה</p>`;
    }
    const sel = new Set(selectedIds || []);
    return `<div class="folder-check-list" id="${listId}">
      ${_people.map(p => `
        <label class="folder-check">
          <input type="checkbox" value="${escHtml(p.id)}" ${sel.has(p.id) ? 'checked' : ''}>
          <span>${escHtml(p.name)}</span>
        </label>`).join('')}
    </div>`;
  }

  function _checkedFolderIds(listId) {
    return Array.from(document.querySelectorAll(`#${listId} input[type="checkbox"]:checked`))
      .map(cb => cb.value);
  }

  async function render() {
    if (!Auth.isAdmin()) {
      App.showAccessDenied('דף זה זמין למנהלי מערכת בלבד');
      return;
    }

    App.setHeader('ניהול משתמשים', true, '');
    const container = document.getElementById('view-container');
    container.innerHTML = `<div style="padding:40px;text-align:center;"><div class="spinner" style="width:36px;height:36px;border-color:var(--border);border-top-color:var(--green);"></div></div>`;

    try {
      [_users, _people, _folderMap] = await Promise.all([
        Auth.getAllUsers(),
        Storage.People.getAll(),
        Auth.getAllUserFolders().catch(() => ({})),
      ]);
      _renderContent();
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p>שגיאה בטעינה: ${escHtml(err.message)}</p></div>`;
    }
  }

  function _renderContent() {
    const meId = Auth.getUser()?.id;
    const container = document.getElementById('view-container');

    const rowsHtml = _users.length === 0
      ? `<tr><td colspan="5" class="users-table-empty">אין משתמשים עדיין</td></tr>`
      : _users.map(u => `
          <tr class="${u.id === meId ? 'users-table-row-current' : ''}">
            <td class="users-col-name">
              <div class="users-name">${escHtml(displayName(u))}</div>
              ${u.id === meId ? '<span class="users-you-badge">אתה</span>' : ''}
            </td>
            <td class="users-col-email">${escHtml(u.email || '—')}</td>
            <td class="users-col-role">
              <span class="user-role-badge ${u.role === 'admin' ? 'admin' : 'user'}">${roleLabel(u.role)}</span>
            </td>
            <td class="users-col-folder">
              ${u.role === 'admin'
                ? '<span class="users-all-folders">כל התיקיות</span>'
                : foldersCellHtml(u)}
            </td>
            <td class="users-col-actions">
              ${u.role !== 'admin' && u.id !== meId ? `
                <button class="btn btn-outline btn-sm" onclick="AdminView.openFolderEditor('${escHtml(u.id)}')">📁 תיקיות</button>
              ` : ''}
              ${u.id !== meId ? `
                <button class="btn btn-outline btn-sm btn-danger-text" onclick="AdminView.deleteUser('${escHtml(u.id)}','${escHtml(displayName(u))}')">הסר</button>
              ` : '<span class="users-no-action">—</span>'}
            </td>
          </tr>
        `).join('');

    container.innerHTML = `
      <div class="admin-intro">
        <p>כאן ניתן להוסיף משתמשים חדשים, לשייך כל משתמש ל<strong>תיקייה אחת או יותר</strong> (מנהלי פרויקטים), ולהסיר משתמשים מהמערכת.</p>
        <p class="admin-intro-note">אין תיקייה? ניתן ליצור תיקייה חדשה ישירות בעת הוספת משתמש או בעריכת התיקיות.</p>
      </div>

      <div class="admin-section" style="margin-top:8px;">
        <div class="admin-section-header">
          <span class="admin-section-title">משתמשים (${_users.length})</span>
          <button class="btn btn-primary btn-sm" onclick="AdminView.showCreateUser()">+ משתמש חדש</button>
        </div>
        <div class="users-table-wrap">
          <table class="users-table">
            <thead>
              <tr>
                <th>שם</th>
                <th>אימייל</th>
                <th>תפקיד</th>
                <th>תיקיות</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>

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
            <select id="new-user-role" onchange="AdminView.toggleFolderField()">
              <option value="user">משתמש — גישה לתיקיות נבחרות</option>
              <option value="admin">מנהל מערכת — גישה מלאה</option>
            </select>
          </div>
          <div class="form-group" id="new-user-folder-group">
            <label>תיקיות משויכות <span class="required">*</span></label>
            <p class="form-hint">סמן תיקייה אחת או יותר שאליהן למשתמש תהיה גישה</p>
            ${folderCheckListHtml([], 'new-user-folders')}
            <div class="folder-new-row">
              <input type="text" id="new-folder-name" placeholder="+ צור תיקייה חדשה (אופציונלי)">
            </div>
          </div>
          <div id="create-user-error" class="login-error hidden"></div>
          <div class="modal-actions">
            <button class="btn btn-outline" onclick="AdminView.hideCreateUser()">ביטול</button>
            <button class="btn btn-primary" id="create-user-btn" onclick="AdminView.createUser()">צור משתמש</button>
          </div>
        </div>
      </div>

      <div id="folder-editor-overlay" class="modal-overlay hidden" onclick="if(event.target===this) AdminView.hideFolderEditor()">
        <div class="modal-box" onclick="event.stopPropagation()">
          <div class="modal-handle"></div>
          <div class="modal-title" id="folder-editor-title">תיקיות משויכות</div>
          <div class="form-group">
            <p class="form-hint">סמן את כל התיקיות שאליהן למשתמש תהיה גישה</p>
            <div id="folder-editor-list-wrap"></div>
            <div class="folder-new-row">
              <input type="text" id="editor-new-folder-name" placeholder="+ צור תיקייה חדשה (אופציונלי)">
            </div>
          </div>
          <div id="folder-editor-error" class="login-error hidden"></div>
          <div class="modal-actions">
            <button class="btn btn-outline" onclick="AdminView.hideFolderEditor()">ביטול</button>
            <button class="btn btn-primary" id="folder-editor-btn" onclick="AdminView.saveFolderEditor()">שמור</button>
          </div>
        </div>
      </div>
    `;
  }

  async function _createPerson(name) {
    const person = { id: Storage.generateId(), name, createdAt: Date.now() };
    await Storage.People.save(person);
    _people.push(person);
    return person;
  }

  // ── CREATE USER ──────────────────────────────────────────────────────────
  function showCreateUser() {
    const overlay = document.getElementById('create-user-overlay');
    if (!overlay) return;
    document.getElementById('new-user-name').value     = '';
    document.getElementById('new-user-email').value    = '';
    document.getElementById('new-user-password').value = '';
    document.getElementById('new-user-role').value     = 'user';
    document.getElementById('new-folder-name').value   = '';
    document.querySelectorAll('#new-user-folders input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.getElementById('create-user-error').classList.add('hidden');
    toggleFolderField();
    overlay.classList.remove('hidden');
  }

  function hideCreateUser() {
    document.getElementById('create-user-overlay')?.classList.add('hidden');
  }

  function toggleFolderField() {
    const role  = document.getElementById('new-user-role')?.value;
    const group = document.getElementById('new-user-folder-group');
    if (group) group.classList.toggle('hidden', role === 'admin');
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
    if (password.length < 6) {
      errEl.textContent = 'הסיסמה חייבת להכיל לפחות 6 תווים';
      errEl.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'יוצר...';

    try {
      let personIds = [];
      if (role === 'user') {
        personIds = _checkedFolderIds('new-user-folders');
        const newName = document.getElementById('new-folder-name')?.value.trim();
        if (newName) {
          const person = await _createPerson(newName);
          personIds.push(person.id);
        }
        if (personIds.length === 0) {
          errEl.textContent = 'יש לבחור לפחות תיקייה אחת (או ליצור חדשה)';
          errEl.classList.remove('hidden');
          btn.disabled = false;
          btn.textContent = 'צור משתמש';
          return;
        }
      }

      await Auth.createUser(email, password, name || email, role, personIds);
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

  // ── FOLDER EDITOR (per existing user) ────────────────────────────────────
  let _editorUserId = null;

  function openFolderEditor(userId) {
    const u = _users.find(x => x.id === userId);
    if (!u) return;
    _editorUserId = userId;
    document.getElementById('folder-editor-title').textContent = `תיקיות משויכות — ${displayName(u)}`;
    document.getElementById('folder-editor-list-wrap').innerHTML =
      folderCheckListHtml(userFolderIds(u), 'folder-editor-list');
    document.getElementById('editor-new-folder-name').value = '';
    document.getElementById('folder-editor-error').classList.add('hidden');
    document.getElementById('folder-editor-overlay').classList.remove('hidden');
  }

  function hideFolderEditor() {
    _editorUserId = null;
    document.getElementById('folder-editor-overlay')?.classList.add('hidden');
  }

  async function saveFolderEditor() {
    if (!_editorUserId) return;
    const errEl = document.getElementById('folder-editor-error');
    const btn   = document.getElementById('folder-editor-btn');
    errEl.classList.add('hidden');

    btn.disabled = true;
    btn.textContent = 'שומר...';
    try {
      const ids = _checkedFolderIds('folder-editor-list');
      const newName = document.getElementById('editor-new-folder-name')?.value.trim();
      if (newName) {
        const person = await _createPerson(newName);
        ids.push(person.id);
      }
      if (ids.length === 0) {
        errEl.textContent = 'יש לבחור לפחות תיקייה אחת (או ליצור חדשה)';
        errEl.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'שמור';
        return;
      }
      await Auth.setUserFolders(_editorUserId, ids);
      hideFolderEditor();
      App.toast('התיקיות עודכנו');
      await render();
    } catch (err) {
      errEl.textContent = err.message || 'שגיאה בשמירה';
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'שמור';
    }
  }

  function deleteUser(userId, displayName) {
    App.confirm(
      `להסיר את ${displayName || 'המשתמש'} מהמערכת? לא יוכל עוד להתחבר.`,
      async () => {
        try {
          await Auth.deleteUser(userId);
          App.toast('המשתמש הוסר');
          await render();
        } catch (err) {
          App.toast('שגיאה: ' + (err.message || 'נסה שנית'));
        }
      },
      'הסר'
    );
  }

  return {
    render,
    showCreateUser,
    hideCreateUser,
    toggleFolderField,
    createUser,
    openFolderEditor,
    hideFolderEditor,
    saveFolderEditor,
    deleteUser,
  };
})();
