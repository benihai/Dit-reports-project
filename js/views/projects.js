const ProjectsView = (() => {

  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function logoHtml(project) {
    if (project.logoData) {
      return `<img class="project-client-logo" src="${project.logoData}" alt="${escHtml(project.clientName)}">`;
    }
    const initials = (project.clientName || project.name || '?')
      .trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return `<div class="project-client-initials">${initials}</div>`;
  }

  function projectCardHtml(project, reportCount) {
    return `
      <div class="project-card" onclick="Router.navigate('/project/${project.id}')">
        <div class="project-card-header">
          ${logoHtml(project)}
          <div>
            <div class="project-name">${escHtml(project.name)}</div>
            <div class="project-client">${escHtml(project.clientName || '')}</div>
          </div>
          <div style="margin-right:auto;">
            <span class="badge badge-gray">${reportCount} דוחות</span>
          </div>
        </div>
        <div class="project-card-actions" onclick="event.stopPropagation()">
          <button class="btn btn-outline btn-sm" onclick="Router.navigate('/project/${project.id}')">דוחות</button>
          <button class="btn btn-outline btn-sm" onclick="ProjectsView.editProject('${project.id}')">✏️ ערוך</button>
          <button class="btn-icon-sm" title="מחק פרויקט" onclick="ProjectsView.deleteProject('${project.id}')">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  function homePath() {
    return '/';
  }

  async function render({ personId }) {
    if (!Auth.canAccessPerson(personId)) {
      App.showAccessDenied('אין לך הרשאה לגשת לתיקייה זו');
      return;
    }

    const [person, projects] = await Promise.all([
      Storage.People.get(personId),
      Storage.Projects.getForPerson(personId),
    ]);
    if (!person) { Router.navigate(homePath()); return; }

    App.setHeader(person.name, true, `
      <button class="btn btn-primary btn-sm" onclick="Router.navigate('/person/${personId}/new-project')">
        + פרויקט
      </button>
    `);

    // Report counts for all projects in a single query
    const counts = await Storage.Reports.countsForProjects(projects.map(p => p.id));

    const container = document.getElementById('view-container');

    if (projects.length === 0) {
      container.innerHTML = `
        <div class="breadcrumb">
          <span class="breadcrumb-item" onclick="Router.navigate('${homePath()}')">דף הבית</span>
          <span class="breadcrumb-sep">›</span>
          <span class="breadcrumb-current">${escHtml(person.name)}</span>
        </div>
        <div class="empty-state">
          <svg width="50" height="50" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <h3>אין פרויקטים עדיין</h3>
          <p>לחץ על "+ פרויקט" להתחלה</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="breadcrumb">
        <span class="breadcrumb-item" onclick="Router.navigate('${homePath()}')">דף הבית</span>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-current">${escHtml(person.name)}</span>
      </div>
      <div class="screen-title">
        <span>פרויקטים</span>
        <span class="badge badge-gray">${projects.length}</span>
      </div>
      ${projects.map(p => projectCardHtml(p, counts[p.id] || 0)).join('')}
    `;
  }

  async function editProject(id) {
    const project = await Storage.Projects.get(id);
    if (!project) return;

    _pendingLogo = null;   // reset any logo staged from a previous (cancelled) edit
    let _editLogo = project.logoData || null;

    let overlay = document.getElementById('edit-project-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id        = 'edit-project-overlay';
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="modal-box" onclick="event.stopPropagation()" style="max-width:420px;">
        <div class="modal-handle"></div>
        <div class="modal-title">עריכת פרויקט</div>

        <div class="form-group">
          <label>שם הפרויקט <span class="required">*</span></label>
          <input type="text" id="ep-name" value="${escHtml(project.name)}">
        </div>
        <div class="form-group">
          <label>שם חברת פיקוח</label>
          <input type="text" id="ep-client" value="${escHtml(project.clientName || '')}">
        </div>
        <div class="form-group">
          <label>לוגו</label>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
            <div id="ep-logo-preview" style="width:56px;height:40px;display:flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:6px;overflow:hidden;background:#f8f8f8;">
              ${_editLogo
                ? `<img src="${_editLogo}" style="max-width:54px;max-height:38px;object-fit:contain;">`
                : `<span style="color:var(--text-muted);font-size:.7rem;">אין</span>`}
            </div>
            <label class="btn btn-outline btn-sm" style="cursor:pointer;">
              העלה לוגו
              <input type="file" accept="image/*" style="display:none;" onchange="ProjectsView._onEditLogo(event,'${id}')">
            </label>
            ${_editLogo ? `<button class="btn btn-ghost btn-sm" style="color:#dc2626;" onclick="ProjectsView._clearEditLogo('${id}')">הסר</button>` : ''}
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="text" id="ep-domain" placeholder="לוגו לפי דומיין (למשל: apple.com)"
                   value="${escHtml(project.domain || '')}"
                   style="flex:1;font-size:.85rem;">
            <button class="btn btn-outline btn-sm" onclick="ProjectsView._searchLogoByDomain('${id}')">חפש לוגו</button>
          </div>
        </div>

        <div style="margin-top:16px;">
          <div style="font-weight:700;font-size:.9rem;margin-bottom:8px;">אנשי קשר</div>
          <div id="ep-contacts-list"></div>
          <button type="button" class="btn btn-outline btn-sm" onclick="ProjectsView._addEpContact()">+ הוסף איש קשר</button>
        </div>

        <div class="form-actions">
          <button class="btn btn-outline" onclick="document.getElementById('edit-project-overlay').classList.add('hidden')">ביטול</button>
          <button class="btn btn-primary" onclick="ProjectsView._saveEdit('${id}')">שמור</button>
        </div>
      </div>
    `;
    overlay.classList.remove('hidden');
    overlay.onclick = e => { if (e.target === overlay) overlay.classList.add('hidden'); };
    setTimeout(() => {
      document.getElementById('ep-name')?.focus();
      _renderEpContacts(project.contacts || []);
    }, 0);
  }

  let _epContacts = [];

  function _renderEpContacts(list) {
    if (list !== undefined) _epContacts = list.slice();
    const container = document.getElementById('ep-contacts-list');
    if (!container) return;
    container.innerHTML = _epContacts.map((c, i) => `
      <div class="contact-row" data-row="${i}">
        <button type="button" class="contact-row-del" onclick="ProjectsView._removeEpContact(${i})">✕</button>
        <div class="form-group" style="margin:0;">
          <label style="font-size:.8rem;">שם <span class="required">*</span></label>
          <input type="text" data-ep="${i}-name" value="${escHtml(c.name)}" placeholder="שם מלא">
        </div>
        <div class="form-group" style="margin:0;">
          <label style="font-size:.8rem;">מייל <span class="required">*</span></label>
          <input type="email" data-ep="${i}-email" value="${escHtml(c.email)}" placeholder="example@mail.com">
        </div>
        <div class="form-group" style="margin:0;">
          <label style="font-size:.8rem;">תפקיד</label>
          <input type="text" data-ep="${i}-role" value="${escHtml(c.role || '')}" placeholder="תפקיד (רשות)">
        </div>
        <div class="form-group" style="margin:0;">
          <label style="font-size:.8rem;">טלפון</label>
          <input type="tel" data-ep="${i}-phone" value="${escHtml(c.phone || '')}" placeholder="050-0000000 (רשות)">
        </div>
      </div>
    `).join('');
  }

  function _gatherEpContacts() {
    const items = document.querySelectorAll('#ep-contacts-list .contact-row');
    return Array.from(items).map((row, i) => ({
      name:  row.querySelector(`[data-ep="${i}-name"]`)?.value.trim()  || '',
      email: row.querySelector(`[data-ep="${i}-email"]`)?.value.trim() || '',
      role:  row.querySelector(`[data-ep="${i}-role"]`)?.value.trim()  || '',
      phone: row.querySelector(`[data-ep="${i}-phone"]`)?.value.trim() || '',
    })).filter(c => c.name && c.email);
  }

  function _addEpContact() {
    _epContacts = _gatherEpContacts();
    _epContacts.push({ name: '', email: '', role: '', phone: '' });
    _renderEpContacts();
  }

  function _removeEpContact(idx) {
    _epContacts = _gatherEpContacts();
    _epContacts.splice(idx, 1);
    _renderEpContacts();
  }

  // Called from inline onchange — store logo in a module-level temp var
  let _pendingLogo = null;

  function _onEditLogo(e, projectId) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      _pendingLogo = ev.target.result;
      const preview = document.getElementById('ep-logo-preview');
      if (preview) preview.innerHTML = `<img src="${_pendingLogo}" style="max-width:54px;max-height:38px;object-fit:contain;">`;
    };
    reader.readAsDataURL(file);
  }

  function _clearEditLogo(projectId) {
    _pendingLogo = '';   // empty string = remove logo
    const preview = document.getElementById('ep-logo-preview');
    if (preview) preview.innerHTML = `<span style="color:var(--text-muted);font-size:.7rem;">אין</span>`;
  }

  async function _searchLogoByDomain(projectId) {
    const domain = document.getElementById('ep-domain')?.value.trim();
    if (!domain) { App.toast('הזן דומיין לחיפוש'); return; }
    App.showLoading('מחפש לוגו...');
    try {
      const url = await LogoSearch.searchByDomain(domain);
      if (!url) { App.toast('לא נמצא לוגו לדומיין זה'); return; }
      const dataUrl = await LogoSearch.toDataUrl(url);
      _pendingLogo = dataUrl || url;
      const preview = document.getElementById('ep-logo-preview');
      if (preview) preview.innerHTML = `<img src="${dataUrl}" style="max-width:54px;max-height:38px;object-fit:contain;">`;
      App.toast('לוגו נמצא');
    } catch (err) {
      App.toast('שגיאה בחיפוש לוגו');
    } finally {
      App.hideLoading();
    }
  }

  async function _saveEdit(projectId) {
    const name   = document.getElementById('ep-name')?.value.trim();
    const client = document.getElementById('ep-client')?.value.trim();
    const domain = document.getElementById('ep-domain')?.value.trim();
    if (!name) { App.toast('נא להזין שם פרויקט'); return; }

    const project = await Storage.Projects.get(projectId);
    project.name       = name;
    project.clientName = client || '';
    project.domain     = domain || '';
    if (_pendingLogo !== null) project.logoData = _pendingLogo;
    project.contacts   = _gatherEpContacts();

    App.showLoading('שומר...');
    try {
      await Storage.Projects.save(project);
      App.toast('הפרויקט עודכן');
      document.getElementById('edit-project-overlay')?.classList.add('hidden');
      _pendingLogo = null;
      // Refresh the current view
      const personId = project.personId;
      if (personId) await render({ personId });
    } catch (err) {
      App.toast('שגיאה בשמירה: ' + (err.message || err));
    } finally {
      App.hideLoading();
    }
  }

  async function deleteProject(id) {
    const project = await Storage.Projects.get(id);
    App.confirm(`למחוק את "${project?.name}"? כל הדוחות יימחקו.`, async () => {
      const proj = await Storage.Projects.get(id);
      await Storage.Projects.delete(id);
      App.toast('הפרויקט נמחק');
      Router.navigate(Auth.isAdmin() ? `/person/${proj.personId}` : '/');
    });
  }

  return { render, editProject, _onEditLogo, _clearEditLogo, _searchLogoByDomain, _saveEdit, deleteProject, _addEpContact, _removeEpContact };
})();
