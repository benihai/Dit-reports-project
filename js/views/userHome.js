const UserHomeView = (() => {

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

  function projectCardHtml(project, reportCount, personId) {
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
      </div>`;
  }

  const _accountActions = `
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

  function headerActions(personId) {
    return `
      <button class="btn btn-primary btn-sm" onclick="Router.navigate('/person/${personId}/new-project')">+ פרויקט</button>
      ${_accountActions}`;
  }

  // ── FOLDER PICKER (for users assigned to several folders) ────────────────────
  function folderPickerCardHtml(person, projectCount) {
    const initials = (person.name || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return `
      <div class="project-card" onclick="Router.navigate('/person/${person.id}')">
        <div class="project-card-header">
          <div class="project-client-initials">${initials}</div>
          <div>
            <div class="project-name">${escHtml(person.name)}</div>
            <div class="project-client">תיקייה</div>
          </div>
          <div style="margin-right:auto;">
            <span class="badge badge-gray">${projectCount} פרויקטים</span>
          </div>
        </div>
      </div>`;
  }

  async function renderPicker(ids) {
    App.setHeader('', false, _accountActions);
    const container = document.getElementById('view-container');
    container.innerHTML = `<div style="padding:40px;text-align:center;"><div class="spinner" style="width:36px;height:36px;border-color:var(--border);border-top-color:var(--green);"></div></div>`;

    const userName = Auth.getProfile()?.name || Auth.getUser()?.email || 'משתמש';
    const allPeople = await Storage.People.getAll();
    const people = allPeople.filter(p => ids.includes(p.id));
    const projectLists = await Promise.all(people.map(p => Storage.Projects.getForPerson(p.id)));

    const cards = people.map((p, i) => folderPickerCardHtml(p, projectLists[i].length)).join('');

    container.innerHTML = `
      <div class="welcome-banner user-home-welcome">
        <div class="welcome-text" style="margin:0 auto;text-align:center;">
          <h1>ברוכים הבאים ל-DIT Report</h1>
          <p>מערכת ניהול דוחות פיקוח וסיור</p>
          <p class="user-home-greeting">שלום, <strong>${escHtml(userName)}</strong></p>
        </div>
      </div>

      <div class="user-home-account">
        <button class="user-home-account-btn" onclick="UserHomeView.openProfile()">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          עריכת פרופיל
        </button>
        <button class="user-home-account-btn user-home-account-btn-muted" onclick="Auth.logout()">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          התנתקות
        </button>
      </div>

      <div class="user-home-folder">
        <div class="screen-title">
          <span>התיקיות שלי</span>
          <span class="badge badge-gray">${people.length}</span>
        </div>
        <p class="user-home-folder-meta">בחר תיקייה כדי לראות את הפרויקטים שלה</p>
        <div class="user-home-projects">${cards}</div>
      </div>
    `;

    _ensureProfileModal();
  }

  async function render(personId = null, opts = {}) {
    const ids = Auth.getAssignedPersonIds();
    if (ids.length === 0) {
      App.showAccessDenied(
        'לא הוקצתה לך תיקייה במערכת. פנה למנהל המערכת.',
        { showLogout: true }
      );
      return;
    }

    // No specific folder requested: pick one, or show the picker for many.
    if (!personId) {
      if (ids.length > 1) { await renderPicker(ids); return; }
      personId = ids[0];
    }

    if (!personId || !Auth.canAccessPerson(personId)) {
      App.showAccessDenied('אין לך הרשאה לגשת לתיקייה זו', { showLogout: false });
      return;
    }

    // Show a back button when the user has several folders (came from the picker).
    const showBack = opts.back || ids.length > 1;
    App.setHeader(showBack ? '' : '', showBack, headerActions(personId));
    const container = document.getElementById('view-container');
    container.innerHTML = `<div style="padding:40px;text-align:center;"><div class="spinner" style="width:36px;height:36px;border-color:var(--border);border-top-color:var(--green);"></div></div>`;

    const profile = Auth.getProfile();
    const userName = profile?.name || Auth.getUser()?.email || 'משתמש';

    const [person, projects] = await Promise.all([
      Storage.People.get(personId),
      Storage.Projects.getForPerson(personId),
    ]);

    const counts = await Storage.Reports.countsForProjects(projects.map(p => p.id));

    const projectsHtml = projects.length === 0
      ? `<div class="empty-state user-home-empty">
           <svg width="50" height="50" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
             <rect x="2" y="3" width="20" height="14" rx="2"/>
             <line x1="8" y1="21" x2="16" y2="21"/>
             <line x1="12" y1="17" x2="12" y2="21"/>
           </svg>
           <h3>אין פרויקטים עדיין</h3>
           <p>לחץ על "+ פרויקט" להתחלה</p>
         </div>`
      : projects.map(p => projectCardHtml(p, counts[p.id] || 0, personId)).join('');

    container.innerHTML = `
      <div class="welcome-banner user-home-welcome">
        <div class="welcome-text" style="margin:0 auto;text-align:center;">
          <h1>ברוכים הבאים ל-DIT Report</h1>
          <p>מערכת ניהול דוחות פיקוח וסיור</p>
          <p class="user-home-greeting">שלום, <strong>${escHtml(userName)}</strong></p>
        </div>
      </div>

      <div class="user-home-account">
        <button class="user-home-account-btn" onclick="UserHomeView.openProfile()">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          עריכת פרופיל
        </button>
        <button class="user-home-account-btn user-home-account-btn-muted" onclick="Auth.logout()">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          התנתקות
        </button>
      </div>

      <div class="user-home-folder">
        <div class="screen-title">
          <span>פרויקטים</span>
          <span class="badge badge-gray">${projects.length}</span>
        </div>
        ${person ? `<p class="user-home-folder-meta">תיקייה: ${escHtml(person.name)}</p>` : ''}
        <div class="user-home-projects">
          ${projectsHtml}
        </div>
      </div>
    `;

    _ensureProfileModal();
  }

  function _ensureProfileModal() {
    if (document.getElementById('user-profile-overlay')) return;
    const el = document.createElement('div');
    el.id = 'user-profile-overlay';
    el.className = 'modal-overlay hidden';
    el.onclick = (e) => { if (e.target === el) closeProfile(); };
    el.innerHTML = `
      <div class="modal-box" onclick="event.stopPropagation()" style="max-width:400px;">
        <div class="modal-handle"></div>
        <div class="modal-title">הפרופיל שלי</div>
        <div class="form-group">
          <label>שם מלא</label>
          <input type="text" id="profile-name-input" placeholder="השם שלך">
        </div>
        <div class="form-group">
          <label>דואר אלקטרוני</label>
          <input type="email" id="profile-email-display" disabled style="background:#f4f4f5;color:#6b7280;">
          <p class="form-hint">לא ניתן לשנות אימייל מכאן</p>
        </div>
        <div id="profile-save-error" class="login-error hidden"></div>
        <div class="modal-actions">
          <button class="btn btn-outline" onclick="UserHomeView.closeProfile()">ביטול</button>
          <button class="btn btn-primary" id="profile-save-btn" onclick="UserHomeView.saveProfile()">שמור</button>
        </div>
      </div>`;
    document.body.appendChild(el);
  }

  function openProfile() {
    _ensureProfileModal();
    const profile = Auth.getProfile();
    const user    = Auth.getUser();
    document.getElementById('profile-name-input').value  = profile?.name || '';
    document.getElementById('profile-email-display').value = profile?.email || user?.email || '';
    document.getElementById('profile-save-error').classList.add('hidden');
    document.getElementById('user-profile-overlay').classList.remove('hidden');
    setTimeout(() => document.getElementById('profile-name-input')?.focus(), 80);
  }

  function closeProfile() {
    document.getElementById('user-profile-overlay')?.classList.add('hidden');
  }

  async function saveProfile() {
    const name  = document.getElementById('profile-name-input').value.trim();
    const errEl = document.getElementById('profile-save-error');
    const btn   = document.getElementById('profile-save-btn');
    errEl.classList.add('hidden');

    if (!name) {
      errEl.textContent = 'נא להזין שם';
      errEl.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'שומר...';
    try {
      await Auth.updateMyProfile({ name });
      closeProfile();
      App.toast('הפרופיל עודכן');
      await render();
    } catch (err) {
      errEl.textContent = err.message || 'שגיאה בשמירה';
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'שמור';
    }
  }

  return { render, openProfile, closeProfile, saveProfile };
})();
