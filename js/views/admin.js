const AdminView = (() => {
  let _users   = [];
  let _people  = [];

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
    if (!personId) return '— לא משויך —';
    const p = _people.find(x => x.id === personId);
    return p ? p.name : personId;
  }

  function folderOptionsHtml(selectedId, includeNew = false) {
    const opts = _people.map(p =>
      `<option value="${escHtml(p.id)}" ${p.id === selectedId ? 'selected' : ''}>${escHtml(p.name)}</option>`
    ).join('');
    const newOpt = includeNew
      ? `<option value="__new__" ${selectedId === '__new__' ? 'selected' : ''}>+ צור תיקייה חדשה...</option>`
      : '';
    return `<option value="">— בחר תיקייה —</option>${opts}${newOpt}`;
  }

  function folderFieldHtml() {
    const noFolders = _people.length === 0;
    return `
      <div class="form-group" id="new-user-folder-group">
        <label>תיקייה משויכת <span class="required">*</span></label>

        <div id="new-user-folder-existing" class="${noFolders ? 'hidden' : ''}">
          <select id="new-user-folder" onchange="AdminView.onFolderSelectChange()">
            ${folderOptionsHtml('', true)}
          </select>
          <button type="button" class="btn btn-outline btn-sm folder-inline-btn" onclick="AdminView.showNewFolderForm()">+ תיקייה חדשה</button>
        </div>

        <div id="new-user-folder-new" class="${noFolders ? '' : 'hidden'}">
          <input type="text" id="new-folder-name" placeholder="שם התיקייה (למשל: דני כהן)">
          <p class="form-hint">תיקייה חדשה תיווצר ותשויך אוטומטית למשתמש</p>
          ${_people.length > 0 ? `
            <button type="button" class="btn btn-ghost btn-sm folder-inline-btn" onclick="AdminView.showExistingFolderList()">בחר מתיקייה קיימת</button>
          ` : ''}
        </div>
      </div>`;
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
      [_users, _people] = await Promise.all([Auth.getAllUsers(), Storage.People.getAll()]);
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
                : escHtml(personName(u.person_id))}
            </td>
            <td class="users-col-actions">
              ${u.role !== 'admin' && u.id !== meId ? `
                <select class="user-folder-select" onchange="AdminView.onRowFolderChange('${escHtml(u.id)}', this)">
                  ${folderOptionsHtml(u.person_id, true)}
                </select>
              ` : ''}
              ${u.id !== meId ? `
                <button class="btn btn-outline btn-sm btn-danger-text" onclick="AdminView.deleteUser('${escHtml(u.id)}','${escHtml(displayName(u))}')">הסר</button>
              ` : '<span class="users-no-action">—</span>'}
            </td>
          </tr>
        `).join('');

    container.innerHTML = `
      <div class="admin-intro">
        <p>כאן ניתן להוסיף משתמשים חדשים, לשייך כל משתמש ל<strong>תיקייה אחת</strong> (מנהל פרויקטים), ולהסיר משתמשים מהמערכת.</p>
        <p class="admin-intro-note">אין תיקייה? ניתן ליצור תיקייה חדשה ישירות בעת הוספת משתמש.</p>
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
                <th>תיקייה</th>
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
              <option value="user">משתמש — גישה לתיקייה אחת</option>
              <option value="admin">מנהל מערכת — גישה מלאה</option>
            </select>
          </div>
          ${folderFieldHtml()}
          <div id="create-user-error" class="login-error hidden"></div>
          <div class="modal-actions">
            <button class="btn btn-outline" onclick="AdminView.hideCreateUser()">ביטול</button>
            <button class="btn btn-primary" id="create-user-btn" onclick="AdminView.createUser()">צור משתמש</button>
          </div>
        </div>
      </div>

      <div id="new-folder-prompt-overlay" class="modal-overlay hidden" onclick="if(event.target===this) AdminView.hideNewFolderPrompt()">
        <div class="modal-box" onclick="event.stopPropagation()" style="max-width:360px;">
          <div class="modal-handle"></div>
          <div class="modal-title">תיקייה חדשה</div>
          <div class="form-group">
            <label>שם התיקייה</label>
            <input type="text" id="row-new-folder-name" placeholder="למשל: דני כהן">
          </div>
          <div class="modal-actions">
            <button class="btn btn-outline" onclick="AdminView.hideNewFolderPrompt()">ביטול</button>
            <button class="btn btn-primary" id="row-new-folder-btn" onclick="AdminView.saveNewFolderForUser()">צור ושייך</button>
          </div>
        </div>
      </div>
    `;
  }

  let _pendingFolderUserId = null;

  function showNewFolderForm() {
    document.getElementById('new-user-folder-existing')?.classList.add('hidden');
    document.getElementById('new-user-folder-new')?.classList.remove('hidden');
    document.getElementById('new-folder-name')?.focus();
  }

  function showExistingFolderList() {
    document.getElementById('new-user-folder-new')?.classList.add('hidden');
    document.getElementById('new-user-folder-existing')?.classList.remove('hidden');
    const sel = document.getElementById('new-user-folder');
    if (sel) sel.value = '';
  }

  function onFolderSelectChange() {
    const sel = document.getElementById('new-user-folder');
    if (sel?.value === '__new__') {
      sel.value = '';
      showNewFolderForm();
    }
  }

  function onRowFolderChange(userId, selectEl) {
    if (selectEl.value === '__new__') {
      _pendingFolderUserId = userId;
      selectEl.value = '';
      document.getElementById('row-new-folder-name').value = '';
      document.getElementById('new-folder-prompt-overlay')?.classList.remove('hidden');
      setTimeout(() => document.getElementById('row-new-folder-name')?.focus(), 80);
      return;
    }
    if (selectEl.value) changeFolder(userId, selectEl.value);
  }

  function hideNewFolderPrompt() {
    _pendingFolderUserId = null;
    document.getElementById('new-folder-prompt-overlay')?.classList.add('hidden');
  }

  async function _createPerson(name) {
    const person = { id: Storage.generateId(), name, createdAt: Date.now() };
    await Storage.People.save(person);
    _people.push(person);
    return person;
  }

  async function saveNewFolderForUser() {
    const name = document.getElementById('row-new-folder-name')?.value.trim();
    const btn  = document.getElementById('row-new-folder-btn');
    if (!name) { App.toast('נא להזין שם תיקייה'); return; }
    if (!_pendingFolderUserId) return;

    btn.disabled = true;
    btn.textContent = 'יוצר...';
    try {
      const person = await _createPerson(name);
      await Auth.updateUserFolder(_pendingFolderUserId, person.id);
      hideNewFolderPrompt();
      App.toast(`התיקייה "${name}" נוצרה ושויכה`);
      await render();
    } catch (err) {
      App.toast('שגיאה: ' + (err.message || ''));
      btn.disabled = false;
      btn.textContent = 'צור ושייך';
    }
  }

  async function _resolvePersonId(role) {
    if (role !== 'user') return null;

    const existingEl = document.getElementById('new-user-folder-existing');
    const isNewMode  = existingEl?.classList.contains('hidden');

    if (isNewMode || _people.length === 0) {
      const folderName = document.getElementById('new-folder-name')?.value.trim();
      if (!folderName) return { error: 'יש להזין שם לתיקייה החדשה' };
      const person = await _createPerson(folderName);
      return { personId: person.id };
    }

    const personId = document.getElementById('new-user-folder')?.value;
    if (!personId) return { error: 'יש לבחור תיקייה למשתמש' };
    return { personId };
  }

  function showCreateUser() {
    const overlay = document.getElementById('create-user-overlay');
    if (!overlay) return;
    document.getElementById('new-user-name').value     = '';
    document.getElementById('new-user-email').value    = '';
    document.getElementById('new-user-password').value = '';
    document.getElementById('new-user-role').value     = 'user';
    document.getElementById('new-folder-name').value   = '';
    document.getElementById('create-user-error').classList.add('hidden');
    toggleFolderField();
    if (_people.length === 0) showNewFolderForm();
    else showExistingFolderList();
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
      let personId = null;
      if (role === 'user') {
        const resolved = await _resolvePersonId(role);
        if (resolved.error) {
          errEl.textContent = resolved.error;
          errEl.classList.remove('hidden');
          btn.disabled = false;
          btn.textContent = 'צור משתמש';
          return;
        }
        personId = resolved.personId;
      }

      await Auth.createUser(email, password, name || email, role, personId);
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

  async function changeFolder(userId, personId) {
    if (!personId) return;
    try {
      await Auth.updateUserFolder(userId, personId);
      App.toast('התיקייה עודכנה');
      await render();
    } catch (err) {
      App.toast('שגיאה: ' + (err.message || 'נסה שנית'));
      await render();
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
    showNewFolderForm,
    showExistingFolderList,
    onFolderSelectChange,
    onRowFolderChange,
    hideNewFolderPrompt,
    saveNewFolderForUser,
    createUser,
    changeFolder,
    deleteUser,
  };
})();
